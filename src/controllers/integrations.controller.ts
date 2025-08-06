import { Request, Response } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { WorkoutPlan } from '../models/WorkoutPlan';
import { DietPlan } from '../models/DietPlan';
import { User } from '../models/User';
import { workoutPlanningService } from '../services/external/workout-planning.service';
import { dietPlanCacheService } from '../services/diet-plan-cache.service';
import MealDetectionService from '../services/external/meal-detection.service';
import { mealCacheService } from '../services/meal-cache.service';
import { fileStorageService } from '../services/file-storage.service';
import { AppError } from '../utils/errors';

/**
 * Integrations Controller
 * 
 * Handles integration-related API endpoints:
 * - POST /api/integrations/workout-plans - Create/refresh user's workout plan
 * - DELETE /api/integrations/workout-plans/:planId - Deactivate a workout plan
 * - GET /api/integrations/workout-plans/status - Get plan status and refresh info
 * - POST /api/integrations/diet-plans - Create/refresh user's diet plan
 * - DELETE /api/integrations/diet-plans/:planId - Deactivate a diet plan
 * - GET /api/integrations/diet-plans/status - Get diet plan status and refresh info
 * - POST /api/integrations/meal-detection - Process meal image through external AI service
 */

// Validation schemas
const createWorkoutPlanSchema = Joi.object({
  targetUserId: Joi.string().optional(), // Allow admin to specify target user
  forceRefresh: Joi.boolean().default(false),
  weeklyWorkoutDays: Joi.number().min(1).max(7).optional(),
  customPreferences: Joi.object({
    focusAreas: Joi.array().items(Joi.string()).optional(),
    avoidExercises: Joi.array().items(Joi.string()).optional(),
    preferredEquipment: Joi.array().items(Joi.string()).optional()
  }).optional()
});

const planIdParamSchema = Joi.object({
  planId: Joi.string().required()
});

const createDietPlanSchema = Joi.object({
  targetUserId: Joi.string().optional(), // Allow admin to specify target user
  forceRefresh: Joi.boolean().default(false),
  customPreferences: Joi.object({
    targetWeightKg: Joi.number().min(20).max(500).optional(),
    dietaryRestrictions: Joi.array().items(Joi.string()).optional(),
    mealPreferences: Joi.object({
      mealsPerDay: Joi.number().min(3).max(6).optional(),
      cuisineTypes: Joi.array().items(Joi.string()).optional()
    }).optional()
  }).optional()
});

const mealDetectionSchema = Joi.object({
  mealType: Joi.string().valid('breakfast', 'lunch', 'dinner', 'snack').optional(),
  notes: Joi.string().max(500).optional()
});

/**
 * POST /api/integrations/workout-plans
 * Creates or refreshes a user's workout plan using external service
 */
export const createOrRefreshWorkoutPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const authenticatedUserId = req.user?.id;
    if (!authenticatedUserId) {
      throw new AppError(401, 'User authentication required');
    }

    // Allow admin to create workout plans for other users via targetUserId parameter
    const targetUserId = req.body.targetUserId || authenticatedUserId;
    
    // If targeting another user, require admin role
    const isAdmin = req.user?.email?.includes('admin') || 
                   (req.user as any)?.role === 'admin' || 
                   (req.user as any)?.isAdmin === true ||  
                   req.user?.email === 'admin@example.com';
                   
    if (targetUserId !== authenticatedUserId && !isAdmin) {
      throw new AppError(403, 'Admin role required to create workout plans for other users');
    }

    // Validate request body
    const { error, value: requestData } = createWorkoutPlanSchema.validate(req.body);
    if (error) {
      throw new AppError(400, `Invalid request data: ${error.details[0]?.message || 'Validation failed'}`);
    }

    logger.info('Creating/refreshing workout plan for user', {
      service: 'integrations-controller',
      authenticatedUserId,
      targetUserId,
      forceRefresh: requestData.forceRefresh,
      weeklyWorkoutDays: requestData.weeklyWorkoutDays,
      event: 'create-workout-plan-start'
    });

    // Get target user profile data
    const user = await User.findById(targetUserId).lean();
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Check if user has required profile data
    if (!user.fitnessProfile?.level || !user.fitnessProfile?.goal || 
        !user.demographics?.age || !user.demographics?.heightCm || 
        !user.demographics?.weightKg) {
      throw new AppError(400, 
        'Incomplete user profile. Please complete your fitness profile and demographics to create a workout plan.'
      );
    }

    // Check for existing active workout plan
    const existingPlan = await WorkoutPlan.findOne({ userId: targetUserId, isActive: true });
    
    if (existingPlan && !requestData.forceRefresh) {
      // Check if plan is still valid (not expired)
      const now = new Date();
      if (existingPlan.cacheExpiry > now) {
        logger.info('Returning existing active workout plan', {
          service: 'integrations-controller',
          authenticatedUserId,
          targetUserId,
          existingPlanId: existingPlan.planId,
          cacheExpiry: existingPlan.cacheExpiry,
          event: 'existing-plan-returned'
        });

        res.status(200).json({
          success: true,
          message: 'Active workout plan already exists',
          data: {
            workoutPlan: existingPlan,
            isNewPlan: false,
            nextRefreshDate: existingPlan.nextRefreshDate
          }
        });
        return;
      }
    }

    // Prepare user profile for external service
    const userProfile = {
      fitnessLevel: user.fitnessProfile.level,
      goal: user.fitnessProfile.goal,
      age: user.demographics.age,
      heightCm: user.demographics.heightCm,
      weightKg: user.demographics.weightKg,
      activityLevel: user.demographics.activityLevel || 'moderate',
      healthConditions: user.fitnessProfile.healthConditions || [],
      weeklyWorkoutDays: requestData.weeklyWorkoutDays || 3
    };

    // Create workout plan via external service
    const externalPlanResponse = await workoutPlanningService.createWorkoutPlan({
      userId: targetUserId,
      userProfile
    });

    // Start database transaction to ensure data consistency
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Deactivate any existing active plans for this user
        await WorkoutPlan.updateMany(
          { userId: targetUserId, isActive: true },
          { isActive: false },
          { session }
        );

        // Create new workout plan record
        const now = new Date();
        const newWorkoutPlan = new WorkoutPlan({
          planId: externalPlanResponse.planId,
          planName: externalPlanResponse.planName,
          userId: targetUserId,
          isActive: true,
          source: 'external',
          workoutDays: externalPlanResponse.workoutDays,
          weeklySchedule: externalPlanResponse.weeklySchedule,
          planDuration: externalPlanResponse.planDuration,
          difficultyLevel: externalPlanResponse.difficultyLevel,
          userContext: {
            fitnessLevel: userProfile.fitnessLevel,
            goal: userProfile.goal,
            age: userProfile.age,
            heightCm: userProfile.heightCm,
            weightKg: userProfile.weightKg,
            activityLevel: userProfile.activityLevel,
            healthConditions: userProfile.healthConditions
          },
          lastRefreshed: now,
          nextRefreshDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
          cacheExpiry: new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now
        });

        await newWorkoutPlan.save({ session });

        // Update user's activePlans reference
        await User.findByIdAndUpdate(
          targetUserId,
          { 
            'activePlans.workoutPlanId': newWorkoutPlan._id 
          },
          { session }
        );

        logger.info('Workout plan created and user updated successfully', {
          service: 'integrations-controller',
          authenticatedUserId,
          targetUserId,
          newPlanId: newWorkoutPlan.planId,
          planName: newWorkoutPlan.planName,
          workoutDays: newWorkoutPlan.workoutDays.length,
          isRefresh: !!existingPlan,
          event: 'create-workout-plan-success'
        });

        res.status(201).json({
          success: true,
          message: existingPlan ? 'Workout plan refreshed successfully' : 'Workout plan created successfully',
          data: {
            workoutPlan: {
              id: newWorkoutPlan._id,
              planId: newWorkoutPlan.planId,
              planName: newWorkoutPlan.planName,
              weeklySchedule: newWorkoutPlan.weeklySchedule,
              difficultyLevel: newWorkoutPlan.difficultyLevel,
              planDuration: newWorkoutPlan.planDuration,
              workoutDaysCount: newWorkoutPlan.workoutDays.length,
              lastRefreshed: newWorkoutPlan.lastRefreshed,
              nextRefreshDate: newWorkoutPlan.nextRefreshDate,
              cacheExpiry: newWorkoutPlan.cacheExpiry
            },
            isNewPlan: true,
            nextRefreshDate: newWorkoutPlan.nextRefreshDate,
            metadata: {
              source: 'external',
              userProfileUsed: {
                fitnessLevel: userProfile.fitnessLevel,
                goal: userProfile.goal,
                weeklyWorkoutDays: userProfile.weeklyWorkoutDays
              }
            }
          }
        });
      });
    } finally {
      await session.endSession();
    }

  } catch (error) {
    logger.error('Failed to create/refresh workout plan', error as Error, {
      service: 'integrations-controller',
      authenticatedUserId: req.user?.id,
      targetUserId: req.body.targetUserId,
      event: 'create-workout-plan-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while creating workout plan',
        data: null
      });
    }
  }
};

/**
 * DELETE /api/integrations/workout-plans/:planId
 * Deactivates a specific workout plan
 */
export const deactivateWorkoutPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    // Validate plan ID parameter
    const { error, value: params } = planIdParamSchema.validate(req.params);
    if (error) {
      throw new AppError(400, `Invalid plan ID: ${error.details[0]?.message || 'Validation failed'}`);
    }

    logger.info('Deactivating workout plan', {
      service: 'integrations-controller',
      userId,
      planId: params.planId,
      event: 'deactivate-workout-plan-start'
    });

    // Find and deactivate the workout plan
    const workoutPlan = await WorkoutPlan.findOne({ 
      planId: params.planId, 
      userId,
      isActive: true 
    });

    if (!workoutPlan) {
      throw new AppError(404, 'Active workout plan not found');
    }

    // Start transaction for data consistency
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Deactivate the workout plan
        workoutPlan.isActive = false;
        await workoutPlan.save({ session });

        // Remove reference from user's activePlans
        await User.findByIdAndUpdate(
          userId,
          { 
            $unset: { 'activePlans.workoutPlanId': '' }
          },
          { session }
        );

        logger.info('Workout plan deactivated successfully', {
          service: 'integrations-controller',
          userId,
          planId: params.planId,
          planName: workoutPlan.planName,
          event: 'deactivate-workout-plan-success'
        });

        res.status(200).json({
          success: true,
          message: 'Workout plan deactivated successfully',
          data: {
            deactivatedPlan: {
              id: workoutPlan._id,
              planId: workoutPlan.planId,
              planName: workoutPlan.planName,
              deactivatedAt: new Date()
            }
          }
        });
      });
    } finally {
      await session.endSession();
    }

  } catch (error) {
    logger.error('Failed to deactivate workout plan', error as Error, {
      service: 'integrations-controller',
      userId: req.user?.id,
      planId: req.params['planId'],
      event: 'deactivate-workout-plan-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while deactivating workout plan',
        data: null
      });
    }
  }
};

/**
 * GET /api/integrations/workout-plans/status
 * Gets the status of user's workout plan including refresh information
 */
export const getWorkoutPlanStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    logger.info('Fetching workout plan status', {
      service: 'integrations-controller',
      userId,
      event: 'get-workout-plan-status-start'
    });

    // Get user's active workout plan
    const activeWorkoutPlan = await WorkoutPlan.findOne({ 
      userId, 
      isActive: true 
    }).lean();

    // Get user profile completeness
    const user = await User.findById(userId)
      .select('fitnessProfile demographics activePlans')
      .lean();

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const profileComplete = !!(
      user.fitnessProfile?.level && 
      user.fitnessProfile?.goal && 
      user.demographics?.age && 
      user.demographics?.heightCm && 
      user.demographics?.weightKg
    );

    const now = new Date();
    let planStatus = 'none';
    let needsRefresh = false;
    let isExpired = false;

    if (activeWorkoutPlan) {
      isExpired = activeWorkoutPlan.cacheExpiry < now;
      needsRefresh = activeWorkoutPlan.nextRefreshDate <= now;
      
      if (isExpired) {
        planStatus = 'expired';
      } else if (needsRefresh) {
        planStatus = 'needs_refresh';
      } else {
        planStatus = 'active';
      }
    }

    // Get count of all user's workout plans (active and inactive)
    const totalPlansCount = await WorkoutPlan.countDocuments({ userId });

    logger.info('Workout plan status retrieved successfully', {
      service: 'integrations-controller',
      userId,
      planStatus,
      profileComplete,
      totalPlansCount,
      event: 'get-workout-plan-status-success'
    });

    res.status(200).json({
      success: true,
      message: 'Workout plan status retrieved successfully',
      data: {
        planStatus,
        hasActivePlan: !!activeWorkoutPlan,
        profileComplete,
        needsRefresh,
        isExpired,
        currentPlan: activeWorkoutPlan ? {
          id: activeWorkoutPlan._id,
          planId: activeWorkoutPlan.planId,
          planName: activeWorkoutPlan.planName,
          weeklySchedule: activeWorkoutPlan.weeklySchedule,
          difficultyLevel: activeWorkoutPlan.difficultyLevel,
          workoutDaysCount: activeWorkoutPlan.workoutDays.length,
          lastRefreshed: activeWorkoutPlan.lastRefreshed,
          nextRefreshDate: activeWorkoutPlan.nextRefreshDate,
          cacheExpiry: activeWorkoutPlan.cacheExpiry,
          source: activeWorkoutPlan.source
        } : null,
        userProfile: {
          fitnessLevel: user.fitnessProfile?.level || null,
          goal: user.fitnessProfile?.goal || null,
          hasBasicDemographics: !!(user.demographics?.age && user.demographics?.heightCm && user.demographics?.weightKg),
          profileCompleteness: profileComplete
        },
        statistics: {
          totalPlansCount,
          canCreatePlan: profileComplete
        },
        recommendations: {
          shouldCreatePlan: !activeWorkoutPlan && profileComplete,
          shouldRefreshPlan: needsRefresh,
          shouldCompleteProfile: !profileComplete,
          shouldUpdateExpiredPlan: isExpired
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get workout plan status', error as Error, {
      service: 'integrations-controller',
      userId: req.user?.id,
      event: 'get-workout-plan-status-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching workout plan status',
        data: null
      });
    }
  }
};

/**
 * POST /api/integrations/diet-plans
 * Creates or refreshes a user's diet plan using external service
 */
export const createOrRefreshDietPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const authenticatedUserId = req.user?.id;
    if (!authenticatedUserId) {
      throw new AppError(401, 'User authentication required');
    }

    // Allow admin to create diet plans for other users via targetUserId parameter
    const targetUserId = req.body.targetUserId || authenticatedUserId;
    
    // If targeting another user, require admin role
    const isAdmin = req.user?.email?.includes('admin') || 
                   (req.user as any)?.role === 'admin' || 
                   (req.user as any)?.isAdmin === true ||  
                   req.user?.email === 'admin@example.com';
                   
    if (targetUserId !== authenticatedUserId && !isAdmin) {
      throw new AppError(403, 'Admin role required to create diet plans for other users');
    }

    // Validate request body
    const { error, value: requestData } = createDietPlanSchema.validate(req.body);
    if (error) {
      throw new AppError(400, `Invalid request data: ${error.details[0]?.message || 'Validation failed'}`);
    }

    logger.info('Creating/refreshing diet plan for user', {
      service: 'integrations-controller',
      authenticatedUserId,
      targetUserId,
      forceRefresh: requestData.forceRefresh,
      event: 'create-diet-plan-start'
    });

    // Get target user profile data
    const user = await User.findById(targetUserId).lean();
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Check if user has required profile data
    if (!user.fitnessProfile?.goal || 
        !user.demographics?.age || !user.demographics?.heightCm || 
        !user.demographics?.weightKg || !user.demographics?.gender) {
      throw new AppError(400, 
        'Incomplete user profile. Please complete your fitness profile and demographics to create a diet plan.'
      );
    }

    // Prepare user profile for diet planning service
    const userProfile = {
      goal: user.fitnessProfile.goal,
      age: user.demographics.age,
      heightCm: user.demographics.heightCm,
      weightKg: user.demographics.weightKg,
      targetWeightKg: requestData.customPreferences?.targetWeightKg || 
                     user.demographics.targetWeightKg || 
                     user.demographics.weightKg,
      gender: user.demographics.gender,
      activityLevel: user.demographics.activityLevel || 'sedentary',
      allergies: user.demographics.allergies || [],
      healthConditions: user.fitnessProfile.healthConditions || []
    };

    const dietPreferences = {
      cuisinePreferences: user.dietPreferences?.cuisinePreferences || {}
    };

    // Create diet plan using cache service
    const dietPlan = await dietPlanCacheService.createOrRefreshDietPlan({
      userId: targetUserId,
      userProfile,
      dietPreferences,
      forceRefresh: requestData.forceRefresh
    });

    logger.info('Diet plan created successfully', {
      service: 'integrations-controller',
      authenticatedUserId,
      targetUserId,
      planId: dietPlan.planId,
      planName: dietPlan.planName,
      targetWeight: dietPlan.targetWeightKg,
      totalCalories: dietPlan.totalMacros.calories,
      event: 'create-diet-plan-success'
    });

    res.status(201).json({
      success: true,
      message: 'Diet plan created successfully',
      data: {
        dietPlan: {
          id: dietPlan.planId,
          planName: dietPlan.planName,
          targetWeightKg: dietPlan.targetWeightKg,
          totalMacros: dietPlan.totalMacros,
          mealPlanDays: dietPlan.mealPlan.length,
          lastRefreshed: dietPlan.lastRefreshed,
          nextRefreshDate: dietPlan.nextRefreshDate,
          cacheExpiry: dietPlan.cacheExpiry
        },
        isNewPlan: true,
        nextRefreshDate: dietPlan.nextRefreshDate,
        metadata: {
          source: dietPlan.source,
          userProfileUsed: {
            goal: userProfile.goal,
            targetWeightKg: userProfile.targetWeightKg,
            gender: userProfile.gender
          }
        }
      }
    });

  } catch (error) {
    logger.error('Failed to create/refresh diet plan', error as Error, {
      service: 'integrations-controller',
      authenticatedUserId: req.user?.id,
      targetUserId: req.body.targetUserId,
      event: 'create-diet-plan-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while creating diet plan',
        data: null
      });
    }
  }
};

/**
 * DELETE /api/integrations/diet-plans/:planId
 * Deactivates a specific diet plan
 */
export const deactivateDietPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    // Validate plan ID parameter
    const { error, value: params } = planIdParamSchema.validate(req.params);
    if (error) {
      throw new AppError(400, `Invalid plan ID: ${error.details[0]?.message || 'Validation failed'}`);
    }

    logger.info('Deactivating diet plan', {
      service: 'integrations-controller',
      userId,
      planId: params.planId,
      event: 'deactivate-diet-plan-start'
    });

    // Find and deactivate the diet plan
    const dietPlan = await DietPlan.findOne({ 
      _id: params.planId, 
      userId,
      isActive: true 
    });

    if (!dietPlan) {
      throw new AppError(404, 'Active diet plan not found');
    }

    // Start transaction for data consistency
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Deactivate the diet plan
        dietPlan.isActive = false;
        await dietPlan.save({ session });

        // Remove reference from user's activePlans
        await User.findByIdAndUpdate(
          userId,
          { 
            $unset: { 
              'activePlans.dietPlanId': '',
              'currentMacros': ''
            }
          },
          { session }
        );

        logger.info('Diet plan deactivated successfully', {
          service: 'integrations-controller',
          userId,
          planId: params.planId,
          planName: dietPlan.planName,
          event: 'deactivate-diet-plan-success'
        });

        res.status(200).json({
          success: true,
          message: 'Diet plan deactivated successfully',
          data: {
            deactivatedPlan: {
              id: dietPlan._id,
              planName: dietPlan.planName,
              deactivatedAt: new Date()
            }
          }
        });
      });
    } finally {
      await session.endSession();
    }

  } catch (error) {
    logger.error('Failed to deactivate diet plan', error as Error, {
      service: 'integrations-controller',
      userId: req.user?.id,
      planId: req.params['planId'],
      event: 'deactivate-diet-plan-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while deactivating diet plan',
        data: null
      });
    }
  }
};

/**
 * GET /api/integrations/diet-plans/status
 * Gets the status of user's diet plan including refresh information
 */
export const getDietPlanStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    logger.info('Fetching diet plan status', {
      service: 'integrations-controller',
      userId,
      event: 'get-diet-plan-status-start'
    });

    // Get user's active diet plan
    const activeDietPlan = await DietPlan.findOne({ 
      userId, 
      isActive: true 
    }).lean();

    // Get user profile completeness
    const user = await User.findById(userId)
      .select('fitnessProfile demographics dietPreferences activePlans currentMacros')
      .lean();

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const profileComplete = !!(
      user.fitnessProfile?.goal && 
      user.demographics?.age && 
      user.demographics?.heightCm && 
      user.demographics?.weightKg &&
      user.demographics?.gender
    );

    const now = new Date();
    let planStatus = 'none';
    let needsRefresh = false;
    let isExpired = false;

    if (activeDietPlan) {
      isExpired = !!(activeDietPlan.cacheExpiry && activeDietPlan.cacheExpiry < now);
      needsRefresh = !!(activeDietPlan.nextRefreshDate && activeDietPlan.nextRefreshDate <= now);
      
      if (isExpired) {
        planStatus = 'expired';
      } else if (needsRefresh) {
        planStatus = 'needs_refresh';
      } else {
        planStatus = 'active';
      }
    }

    // Get count of all user's diet plans (active and inactive)
    const totalPlansCount = await DietPlan.countDocuments({ userId });

    logger.info('Diet plan status retrieved successfully', {
      service: 'integrations-controller',
      userId,
      planStatus,
      profileComplete,
      totalPlansCount,
      event: 'get-diet-plan-status-success'
    });

    res.status(200).json({
      success: true,
      message: 'Diet plan status retrieved successfully',
      data: {
        planStatus,
        hasActivePlan: !!activeDietPlan,
        profileComplete,
        needsRefresh,
        isExpired,
        currentPlan: activeDietPlan ? {
          id: activeDietPlan._id,
          planName: activeDietPlan.planName,
          targetWeightKg: activeDietPlan.targetWeightKg,
          totalMacros: activeDietPlan.totalMacros,
          mealPlanDays: activeDietPlan.mealPlan.length,
          lastRefreshed: activeDietPlan.lastRefreshed,
          nextRefreshDate: activeDietPlan.nextRefreshDate,
          cacheExpiry: activeDietPlan.cacheExpiry,
          source: activeDietPlan.source
        } : null,
        userProfile: {
          goal: user.fitnessProfile?.goal || null,
          hasBasicDemographics: !!(user.demographics?.age && user.demographics?.heightCm && user.demographics?.weightKg && user.demographics?.gender),
          hasDietPreferences: !!(user.dietPreferences?.cuisinePreferences && Object.keys(user.dietPreferences.cuisinePreferences).length > 0),
          profileCompleteness: profileComplete
        },
        currentMacros: user.currentMacros || null,
        statistics: {
          totalPlansCount,
          canCreatePlan: profileComplete
        },
        recommendations: {
          shouldCreatePlan: !activeDietPlan && profileComplete,
          shouldRefreshPlan: needsRefresh,
          shouldCompleteProfile: !profileComplete,
          shouldUpdateExpiredPlan: isExpired
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get diet plan status', error as Error, {
      service: 'integrations-controller',
      userId: req.user?.id,
      event: 'get-diet-plan-status-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching diet plan status',
        data: null
      });
    }
  }
};

/**
 * POST /api/integrations/meal-detection
 * Processes meal image through external AI service and caches result
 */
export const detectMeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    // Validate request body
    const { error, value: requestData } = mealDetectionSchema.validate(req.body);
    if (error) {
      throw new AppError(400, `Invalid request data: ${error.details[0]?.message || 'Validation failed'}`);
    }

    // Check if image was uploaded
    const imageFile = req.file as Express.Multer.File;
    if (!imageFile) {
      throw new AppError(400, 'Meal image is required');
    }

    // Validate image format and size
    if (!imageFile.mimetype.startsWith('image/')) {
      throw new AppError(400, 'Invalid file format. Only image files are allowed');
    }

    if (imageFile.size > 10 * 1024 * 1024) { // 10MB limit
      throw new AppError(400, 'Image file size must be less than 10MB');
    }

    logger.info('Processing meal detection request', {
      service: 'integrations-controller',
      userId,
      imageSize: imageFile.size,
      imageMimetype: imageFile.mimetype,
      mealType: requestData.mealType,
      event: 'meal-detection-start'
    });

    // Initialize meal detection service
    const mealDetectionService = new MealDetectionService();

    // Compress image if needed
    let processedImageBuffer = imageFile.buffer;
    try {
      processedImageBuffer = await mealDetectionService.compressImage(imageFile.buffer, 1024);
    } catch (compressionError) {
      logger.warn('Image compression failed, using original', {
        service: 'integrations-controller',
        userId,
        error: compressionError,
        event: 'image-compression-warning'
      });
    }

    // Detect meal using external service with retry logic
    const detectionResult = await mealDetectionService.retryWithBackoff(
      () => mealDetectionService.identifyMeal(processedImageBuffer, imageFile.originalname),
      3,
      2000
    );

    // Generate unique meal ID
    const mealId = mealCacheService.generateMealId(userId);

    // Calculate total nutrition from detected foods
    const totalNutrition = detectionResult.foods.reduce((total, food) => ({
      calories: total.calories + food.nutrition.calories,
      carbs: total.carbs + food.nutrition.carbs,
      fat: total.fat + food.nutrition.fat,
      protein: total.protein + food.nutrition.protein,
      fiber: total.fiber + food.nutrition.fiber
    }), { calories: 0, carbs: 0, fat: 0, protein: 0, fiber: 0 });

    // Store image in S3 and get CDN URL
    const uploadResult = await fileStorageService.uploadMealImage({
      userId,
      mealId,
      originalBuffer: processedImageBuffer,
      originalName: imageFile.originalname,
      optimize: true,
      makePublic: false
    });
    
    const imageUrl = uploadResult.cdnUrl;

    // Create cached meal object
    const cachedMeal = {
      mealId,
      userId,
      imageUrl,
      foods: detectionResult.foods,
      totalNutrition,
      detectedAt: new Date(),
      correctionCount: 0,
      isVerified: false
    };

    // Cache the meal result
    await mealCacheService.cacheMeal(cachedMeal);

    // Format response data
    const responseData = {
      mealId,
      detectedFoods: detectionResult.foods.map(food => ({
        name: food.name,
        quantity: `${food.quantity} ${food.unit}`,
        description: food.description,
        nutrition: food.nutrition
      })),
      totalNutrition,
      mealType: requestData.mealType || 'unknown',
      detectedAt: cachedMeal.detectedAt,
      imageProcessed: true,
      suggestions: {
        canCorrect: true,
        canReuse: true,
        addToMealHistory: true
      }
    };

    logger.info('Meal detection completed successfully', {
      service: 'integrations-controller',
      userId,
      mealId,
      detectedFoodsCount: detectionResult.foods.length,
      totalCalories: totalNutrition.calories,
      event: 'meal-detection-success'
    });

    res.status(200).json({
      success: true,
      message: 'Meal detected successfully',
      data: responseData
    });

  } catch (error) {
    logger.error('Failed to detect meal', error as Error, {
      service: 'integrations-controller',
      userId: req.user?.id,
      event: 'meal-detection-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while processing meal image',
        data: null
      });
    }
  }
};

export default {
  createOrRefreshWorkoutPlan,
  deactivateWorkoutPlan,
  getWorkoutPlanStatus,
  createOrRefreshDietPlan,
  deactivateDietPlan,
  getDietPlanStatus,
  detectMeal
};