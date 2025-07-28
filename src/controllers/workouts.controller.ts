import { Request, Response } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';
import { WorkoutPlan } from '../models/WorkoutPlan';
import { Branch } from '../models/Branch';
import { workoutPlanningService } from '../services/external/workout-planning.service';
import { AppError } from '../utils/errors';

/**
 * Workouts Controller
 * 
 * Handles workout-related API endpoints:
 * - GET /api/workouts/daily - Get user's active daily workout plan
 * - GET /api/workouts/days/:muscleGroup - Get workouts for specific muscle group
 * - GET /api/workouts/library - Get exercise library with machine availability
 */

// Validation schemas
const getDailyWorkoutQuerySchema = Joi.object({
  branchId: Joi.string().optional(),
  includeAvailability: Joi.boolean().default(true)
});

const getWorkoutDayQuerySchema = Joi.object({
  branchId: Joi.string().optional(),
  includeAvailability: Joi.boolean().default(true)
});

const getLibraryQuerySchema = Joi.object({
  muscleGroup: Joi.string().optional(),
  equipment: Joi.string().optional(),
  difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
  branchId: Joi.string().optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20)
});

/**
 * GET /api/workouts/daily
 * Returns the user's current active workout plan with real-time machine availability
 */
export const getDailyWorkout = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    // Validate query parameters
    const { error, value: queryParams } = getDailyWorkoutQuerySchema.validate(req.query);
    if (error) {
      throw new AppError(400, `Invalid query parameters: ${error.details[0]?.message || 'Validation failed'}`);
    }

    logger.info('Fetching daily workout for user', {
      service: 'workouts-controller',
      userId,
      branchId: queryParams.branchId,
      includeAvailability: queryParams.includeAvailability,
      event: 'get-daily-workout-start'
    });

    // Find user's active workout plan
    const activeWorkoutPlan = await WorkoutPlan.findOne({ 
      userId, 
      isActive: true 
    }).lean();

    if (!activeWorkoutPlan) {
      logger.info('No active workout plan found for user', {
        service: 'workouts-controller',
        userId,
        event: 'no-active-plan'
      });

      res.status(404).json({
        success: false,
        message: 'No active workout plan found. Please create a workout plan first.',
        data: null
      });
      return;
    }

    // Check if plan is expired and needs refresh
    const now = new Date();
    if (activeWorkoutPlan.cacheExpiry < now) {
      logger.warn('Workout plan has expired', {
        service: 'workouts-controller',
        userId,
        planId: activeWorkoutPlan.planId,
        cacheExpiry: activeWorkoutPlan.cacheExpiry,
        event: 'plan-expired'
      });

      // Could trigger background refresh here
      // For now, we'll still return the expired plan with a warning
    }

    // Get machine availability if requested and branchId provided
    let machineAvailability: any = null;
    if (queryParams.includeAvailability && queryParams.branchId) {
      try {
        const branch = await Branch.findById(queryParams.branchId).select('machines').lean();
        if (branch) {
          machineAvailability = branch.machines.reduce((acc: any, machine) => {
            acc[machine.name.toLowerCase()] = {
              isAvailable: machine.isAvailable,
              maintenanceStatus: machine.maintenanceStatus,
              qrCode: machine.qrCode,
              location: machine.location
            };
            return acc;
          }, {});
        }
      } catch (machineError) {
        logger.error('Failed to fetch machine availability', machineError as Error, {
          service: 'workouts-controller',
          userId,
          branchId: queryParams.branchId,
          event: 'machine-availability-error'
        });
        // Continue without machine availability
      }
    }

    // Enhance workout plan with machine availability
    const enhancedWorkoutPlan = {
      ...activeWorkoutPlan,
      workoutDays: activeWorkoutPlan.workoutDays.map(day => ({
        ...day,
        exercises: day.exercises.map(exercise => {
          const machineInfo = machineAvailability?.[exercise.name.toLowerCase()] || 
                             (exercise.equipment && machineAvailability?.[exercise.equipment.toLowerCase()]);
          
          return {
            ...exercise,
            machineAvailability: machineInfo ? {
              isAvailable: machineInfo.isAvailable,
              maintenanceStatus: machineInfo.maintenanceStatus,
              qrCode: machineInfo.qrCode,
              location: machineInfo.location
            } : null
          };
        })
      })),
      metadata: {
        isExpired: activeWorkoutPlan.cacheExpiry < now,
        nextRefreshDate: activeWorkoutPlan.nextRefreshDate,
        lastRefreshed: activeWorkoutPlan.lastRefreshed,
        source: activeWorkoutPlan.source,
        branchId: queryParams.branchId || null,
        machineAvailabilityIncluded: !!machineAvailability
      }
    };

    logger.info('Daily workout fetched successfully', {
      service: 'workouts-controller',
      userId,
      planId: activeWorkoutPlan.planId,
      workoutDays: activeWorkoutPlan.workoutDays.length,
      isExpired: activeWorkoutPlan.cacheExpiry < now,
      machineAvailabilityIncluded: !!machineAvailability,
      event: 'get-daily-workout-success'
    });

    res.status(200).json({
      success: true,
      message: 'Daily workout plan retrieved successfully',
      data: enhancedWorkoutPlan
    });

  } catch (error) {
    logger.error('Failed to get daily workout', error as Error, {
      service: 'workouts-controller',
      userId: req.user?.id,
      event: 'get-daily-workout-error'
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
        message: 'Internal server error while fetching daily workout',
        data: null
      });
    }
  }
};

/**
 * GET /api/workouts/days/:muscleGroup
 * Returns exercises for a specific muscle group (Chest, Lat, Shoulder, Arms, Legs)
 * User's workout plan is universal - branch only affects machine availability at current location
 */
export const getWorkoutDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    const { muscleGroup } = req.params;
    if (!muscleGroup) {
      throw new AppError(400, 'Muscle group parameter is required');
    }

    // Validate query parameters
    const { error, value: queryParams } = getWorkoutDayQuerySchema.validate(req.query);
    if (error) {
      throw new AppError(400, `Invalid query parameters: ${error.details[0]?.message || 'Validation failed'}`);
    }

    logger.info('Fetching workout day for user', {
      service: 'workouts-controller',
      userId,
      muscleGroup,
      branchId: queryParams.branchId,
      includeAvailability: queryParams.includeAvailability,
      event: 'get-workout-day-start'
    });

    // Find user's active workout plan
    const activeWorkoutPlan = await WorkoutPlan.findOne({ 
      userId, 
      isActive: true 
    }).lean();

    if (!activeWorkoutPlan) {
      logger.info('No active workout plan found for user', {
        service: 'workouts-controller',
        userId,
        event: 'no-active-plan'
      });

      res.status(404).json({
        success: false,
        message: 'No active workout plan found. Please create a workout plan first.',
        data: null
      });
      return;
    }

    // Find the specific muscle group day
    const workoutDay = activeWorkoutPlan.workoutDays.find(
      day => day.muscleGroup.toLowerCase() === muscleGroup.toLowerCase()
    );

    if (!workoutDay) {
      logger.info('Muscle group not found in workout plan', {
        service: 'workouts-controller',
        userId,
        muscleGroup,
        availableMuscleGroups: activeWorkoutPlan.workoutDays.map(day => day.muscleGroup),
        event: 'muscle-group-not-found'
      });

      res.status(404).json({
        success: false,
        message: `Muscle group '${muscleGroup}' not found in your active workout plan`,
        data: {
          availableMuscleGroups: activeWorkoutPlan.workoutDays.map(day => day.muscleGroup)
        }
      });
      return;
    }

    // Get machine availability if requested and branchId provided
    let machineAvailability: any = null;
    if (queryParams.includeAvailability && queryParams.branchId) {
      try {
        const branch = await Branch.findById(queryParams.branchId).select('machines').lean();
        if (branch) {
          machineAvailability = branch.machines.reduce((acc: any, machine) => {
            acc[machine.name.toLowerCase()] = {
              isAvailable: machine.isAvailable,
              maintenanceStatus: machine.maintenanceStatus,
              qrCode: machine.qrCode,
              location: machine.location
            };
            return acc;
          }, {});
        }
      } catch (machineError) {
        logger.error('Failed to fetch machine availability', machineError as Error, {
          service: 'workouts-controller',
          userId,
          branchId: queryParams.branchId,
          event: 'machine-availability-error'
        });
        // Continue without machine availability
      }
    }

    // Enhance workout day with machine availability
    const enhancedWorkoutDay = {
      ...workoutDay,
      exercises: workoutDay.exercises.map((exercise: any) => {
        const machineInfo = machineAvailability?.[exercise.name.toLowerCase()];
        
        return {
          ...exercise,
          machineAvailability: machineInfo ? {
            isAvailable: machineInfo.isAvailable,
            maintenanceStatus: machineInfo.maintenanceStatus,
            qrCode: machineInfo.qrCode,
            location: machineInfo.location
          } : null
        };
      })
    };

    logger.info('Workout day fetched successfully', {
      service: 'workouts-controller',
      userId,
      muscleGroup,
      totalExercises: enhancedWorkoutDay.exercises.length,
      machineAvailabilityIncluded: !!machineAvailability,
      event: 'get-workout-day-success'
    });

    res.status(200).json({
      success: true,
      message: `${muscleGroup} workout exercises retrieved successfully`,
      data: {
        muscleGroup: enhancedWorkoutDay['muscleGroup'],
        exercises: enhancedWorkoutDay.exercises,
        metadata: {
          planId: activeWorkoutPlan.planId,
          planName: activeWorkoutPlan.planName,
          totalExercises: enhancedWorkoutDay.exercises.length,
          // Branch info only included if machine availability was fetched
          ...(machineAvailability && {
            branchInfo: {
              branchId: queryParams.branchId,
              machineAvailabilityIncluded: true
            }
          })
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get workout day', error as Error, {
      service: 'workouts-controller',
      userId: req.user?.id,
      muscleGroup: req.params['muscleGroup'],
      event: 'get-workout-day-error'
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
        message: 'Internal server error while fetching workout day',
        data: null
      });
    }
  }
};

/**
 * GET /api/workouts/library
 * Returns exercise library with optional filtering and machine availability
 */
export const getWorkoutLibrary = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate query parameters
    const { error, value: queryParams } = getLibraryQuerySchema.validate(req.query);
    if (error) {
      throw new AppError(400, `Invalid query parameters: ${error.details[0]?.message || 'Validation failed'}`);
    }

    logger.info('Fetching workout library', {
      service: 'workouts-controller',
      filters: {
        muscleGroup: queryParams.muscleGroup,
        equipment: queryParams.equipment,
        difficulty: queryParams.difficulty,
        branchId: queryParams.branchId
      },
      pagination: {
        page: queryParams.page,
        limit: queryParams.limit
      },
      event: 'get-workout-library-start'
    });

    // Fetch exercise library from external service
    const exerciseFilters = {
      muscleGroup: queryParams.muscleGroup,
      equipment: queryParams.equipment,
      difficulty: queryParams.difficulty
    };

    // Remove undefined values
    Object.keys(exerciseFilters).forEach(key => {
      if (exerciseFilters[key as keyof typeof exerciseFilters] === undefined) {
        delete exerciseFilters[key as keyof typeof exerciseFilters];
      }
    });

    const exercises = await workoutPlanningService.getExerciseLibrary(
      Object.keys(exerciseFilters).length > 0 ? exerciseFilters : undefined
    );

    // Get machine availability for branch if specified
    let machineAvailability: any = null;
    if (queryParams.branchId) {
      try {
        const branch = await Branch.findById(queryParams.branchId).select('machines name').lean();
        if (branch) {
          machineAvailability = {
            branchName: branch.name,
            machines: branch.machines.reduce((acc: any, machine) => {
              acc[machine.name.toLowerCase()] = {
                isAvailable: machine.isAvailable,
                maintenanceStatus: machine.maintenanceStatus,
                qrCode: machine.qrCode,
                location: machine.location,
                type: machine.type
              };
              return acc;
            }, {})
          };
        }
      } catch (machineError) {
        logger.error('Failed to fetch machine availability for library', machineError as Error, {
          service: 'workouts-controller',
          branchId: queryParams.branchId,
          event: 'machine-availability-error'
        });
        // Continue without machine availability
      }
    }

    // Apply pagination
    const startIndex = (queryParams.page - 1) * queryParams.limit;
    const endIndex = startIndex + queryParams.limit;
    const paginatedExercises = exercises.slice(startIndex, endIndex);

    // Enhance exercises with machine availability
    const enhancedExercises = paginatedExercises.map(exercise => {
      const machineInfo = machineAvailability?.machines?.[exercise.name?.toLowerCase()] || 
                         machineAvailability?.machines?.[exercise.equipment?.toLowerCase()];
      
      return {
        ...exercise,
        machineAvailability: machineInfo ? {
          isAvailable: machineInfo.isAvailable,
          maintenanceStatus: machineInfo.maintenanceStatus,
          qrCode: machineInfo.qrCode,
          location: machineInfo.location,
          type: machineInfo.type
        } : null
      };
    });

    const totalExercises = exercises.length;
    const totalPages = Math.ceil(totalExercises / queryParams.limit);
    const hasNextPage = queryParams.page < totalPages;
    const hasPrevPage = queryParams.page > 1;

    logger.info('Workout library fetched successfully', {
      service: 'workouts-controller',
      totalExercises,
      returnedExercises: enhancedExercises.length,
      page: queryParams.page,
      totalPages,
      branchId: queryParams.branchId,
      machineAvailabilityIncluded: !!machineAvailability,
      event: 'get-workout-library-success'
    });

    res.status(200).json({
      success: true,
      message: 'Workout library retrieved successfully',
      data: {
        exercises: enhancedExercises,
        pagination: {
          currentPage: queryParams.page,
          totalPages,
          totalExercises,
          exercisesPerPage: queryParams.limit,
          hasNextPage,
          hasPrevPage
        },
        filters: {
          muscleGroup: queryParams.muscleGroup || null,
          equipment: queryParams.equipment || null,
          difficulty: queryParams.difficulty || null
        },
        branchInfo: machineAvailability ? {
          branchId: queryParams.branchId,
          branchName: machineAvailability.branchName,
          totalMachines: Object.keys(machineAvailability.machines).length,
          availableMachines: Object.values(machineAvailability.machines)
            .filter((m: any) => m.isAvailable).length
        } : null
      }
    });

  } catch (error) {
    logger.error('Failed to get workout library', error as Error, {
      service: 'workouts-controller',
      event: 'get-workout-library-error'
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
        message: 'Internal server error while fetching workout library',
        data: null
      });
    }
  }
};

/**
 * GET /api/workouts/progress
 * Optional endpoint to get workout progress/analytics
 */
export const getWorkoutProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    logger.info('Fetching workout progress', {
      service: 'workouts-controller',
      userId,
      event: 'get-workout-progress-start'
    });

    // This would integrate with analytics service to get workout progress
    // For now, return a placeholder response
    
    res.status(200).json({
      success: true,
      message: 'Workout progress endpoint - coming soon',
      data: {
        message: 'Workout progress tracking will be implemented in future releases',
        availableEndpoints: [
          'GET /api/workouts/daily - Get active workout plan',
          'GET /api/workouts/library - Get exercise library'
        ]
      }
    });

  } catch (error) {
    logger.error('Failed to get workout progress', error as Error, {
      service: 'workouts-controller',
      userId: req.user?.id,
      event: 'get-workout-progress-error'
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
        message: 'Internal server error while fetching workout progress',
        data: null
      });
    }
  }
};

export default {
  getDailyWorkout,
  getWorkoutDay,
  getWorkoutLibrary,
  getWorkoutProgress
};