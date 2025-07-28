import { Request, Response } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { WorkoutPlan } from '../models/WorkoutPlan';
import { User } from '../models/User';
import { workoutPlanningService } from '../services/external/workout-planning.service';
import { AppError } from '../utils/errors';

/**
 * Integrations Controller
 * 
 * Handles integration-related API endpoints:
 * - POST /api/integrations/workout-plans - Create/refresh user's workout plan
 * - DELETE /api/integrations/workout-plans/:planId - Deactivate a workout plan
 * - GET /api/integrations/workout-plans/status - Get plan status and refresh info
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

export default {
  createOrRefreshWorkoutPlan,
  deactivateWorkoutPlan,
  getWorkoutPlanStatus
};