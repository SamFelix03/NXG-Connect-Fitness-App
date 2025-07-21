import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { UserActivity } from '../models/UserActivity';
import { User } from '../models/User';
import { validateRequest } from '../utils/validation';
import { 
  logActivitySchema,
  activityTimelineSchema,
  activitySummarySchema,
  updateActivitySchema
} from '../utils/validation';
import logger from '../utils/logger';

export const logActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get userId from params (admin route) or from JWT token (user route)
    const { userId: paramUserId } = req.params;
    const jwtUserId = (req as any).user?._id?.toString();
    const userId = paramUserId || jwtUserId;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Validate request body
    const validation = validateRequest(req.body, logActivitySchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const { 
      activityType, 
      activityData, 
      date = new Date(),
      points = 0
    } = validation.value;

    // Get or create activity record for the date
    const activityDate = new Date(date);
    activityDate.setHours(0, 0, 0, 0); // Set to start of day

    let activity = await UserActivity.findOne({
      userId,
      date: activityDate
    });

    if (!activity) {
      activity = new UserActivity({
        userId,
        date: activityDate,
        workoutActivity: {
          assignedWorkouts: 0,
          completedWorkouts: 0,
          completionPercentage: 0,
          workoutHistory: []
        },
        dietActivity: {
          scheduledMeals: 0,
          completedMeals: 0,
          mealHistory: [],
          uploadedMeals: []
        },
        pointsEarned: [],
        goals: {
          dailyGoals: {},
          achievements: []
        },
        summary: {
          totalWorkouts: 0,
          totalMeals: 0,
          totalPoints: 0,
          caloriesConsumed: 0,
          caloriesBurned: 0,
          activeMinutes: 0
        }
      });
    }

    // Process activity based on type
    switch (activityType) {
      case 'workout_completed':
        activity.workoutActivity.completedWorkouts += 1;
        if (activityData.workoutDetails) {
          activity.workoutActivity.workoutHistory.push({
            exerciseId: activityData.workoutDetails.exerciseId,
            exerciseName: activityData.workoutDetails.exerciseName,
            machineId: activityData.workoutDetails.machineId,
            completedSets: activityData.workoutDetails.completedSets,
            completedReps: activityData.workoutDetails.completedReps,
            completedSeconds: activityData.workoutDetails.completedSeconds,
            performanceNotes: activityData.workoutDetails.performanceNotes,
            completedAt: new Date()
          });
        }
        if (activityData.caloriesBurned) {
          activity.summary.caloriesBurned += activityData.caloriesBurned;
        }
        if (activityData.activeMinutes) {
          activity.summary.activeMinutes += activityData.activeMinutes;
        }
        break;

      case 'meal_logged':
        activity.dietActivity.completedMeals += 1;
        if (activityData.mealDetails) {
          activity.dietActivity.mealHistory.push({
            mealType: activityData.mealDetails.mealType,
            mealDescription: activityData.mealDetails.mealDescription,
            consumedAt: new Date(),
            wasOnSchedule: activityData.mealDetails.wasOnSchedule || true,
            notes: activityData.mealDetails.notes
          });
        }
        break;

      case 'meal_uploaded':
        if (activityData.uploadDetails) {
          activity.dietActivity.uploadedMeals.push({
            imageUrl: activityData.uploadDetails.imageUrl,
            calories: activityData.uploadDetails.calories,
            macros: activityData.uploadDetails.macros,
            uploadedAt: new Date(),
            aiVersion: activityData.uploadDetails.aiVersion,
            mealDetected: activityData.uploadDetails.mealDetected,
            isVerified: activityData.uploadDetails.isVerified || false
          });
        }
        break;

      case 'goal_achieved':
        if (activityData.achievement) {
          activity.goals.achievements?.push({
            achievementId: activityData.achievement.achievementId,
            achievementName: activityData.achievement.achievementName,
            completedAt: new Date(),
            points: points
          });
        }
        break;

      default:
        res.status(400).json({
          success: false,
          message: 'Invalid activity type',
          code: 'VALIDATION_ERROR'
        });
        return;
    }

    // Add points if provided
    if (points > 0) {
      activity.pointsEarned.push({
        points,
        reason: activityData.pointsReason || `${activityType} completed`,
        awardedAt: new Date()
      });

      // Update user's total points
      await User.findByIdAndUpdate(userId, {
        $inc: { totalPoints: points }
      });
    }

    // Calculate completion percentage for workouts
    if (activity.workoutActivity.assignedWorkouts > 0) {
      activity.workoutActivity.completionPercentage = 
        (activity.workoutActivity.completedWorkouts / activity.workoutActivity.assignedWorkouts) * 100;
    }

    await activity.save();

    logger.info('Activity logged successfully', { 
      userId, 
      activityType,
      date: activityDate,
      points 
    });

    res.status(201).json({
      success: true,
      message: 'Activity logged successfully',
      data: {
        activityId: activity._id,
        activityType,
        pointsEarned: points,
        summary: activity.summary
      }
    });

  } catch (error) {
    logger.error('Error logging activity', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

export const getActivityTimeline = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get userId from params (admin route) or from JWT token (user route)
    const { userId: paramUserId } = req.params;
    const jwtUserId = (req as any).user?._id?.toString();
    const userId = paramUserId || jwtUserId;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Validate query parameters
    const validation = validateRequest(req.query, activityTimelineSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate = new Date(),
      activityType,
      page = 1,
      limit = 20
    } = validation.value;

    // Build query
    const query: any = {
      userId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    // Execute query with pagination
    const activities = await UserActivity.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Filter activities by type if specified
    let filteredActivities = activities;
    if (activityType) {
      filteredActivities = activities.map(activity => {
        const filtered = { ...activity };
        switch (activityType) {
          case 'workout':
            filtered.dietActivity = { scheduledMeals: 0, completedMeals: 0, mealHistory: [], uploadedMeals: [] };
            break;
          case 'meal':
            filtered.workoutActivity = { assignedWorkouts: 0, completedWorkouts: 0, completionPercentage: 0, workoutHistory: [] };
            break;
          case 'achievement':
            filtered.workoutActivity = { assignedWorkouts: 0, completedWorkouts: 0, completionPercentage: 0, workoutHistory: [] };
            filtered.dietActivity = { scheduledMeals: 0, completedMeals: 0, mealHistory: [], uploadedMeals: [] };
            break;
        }
        return filtered;
      }).filter(activity => {
        switch (activityType) {
          case 'workout':
            return activity.workoutActivity.completedWorkouts > 0;
          case 'meal':
            return activity.dietActivity.completedMeals > 0;
          case 'achievement':
            return activity.goals.achievements && activity.goals.achievements.length > 0;
          default:
            return true;
        }
      });
    }

    const totalCount = await UserActivity.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      message: 'Activity timeline retrieved successfully',
      data: {
        activities: filteredActivities,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        filters: {
          startDate,
          endDate,
          activityType
        }
      }
    });

  } catch (error) {
    logger.error('Error retrieving activity timeline', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

export const getActivitySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get userId from params (admin route) or from JWT token (user route)
    const { userId: paramUserId } = req.params;
    const jwtUserId = (req as any).user?._id?.toString();
    const userId = paramUserId || jwtUserId;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Validate query parameters
    const validation = validateRequest(req.query, activitySummarySchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const { 
      period = 'week',
      startDate,
      endDate
    } = validation.value;

    // Calculate date range based on period
    let start: Date, end: Date;
    const now = new Date();

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      switch (period) {
        case 'day':
          start = new Date(now);
          start.setHours(0, 0, 0, 0);
          end = new Date(now);
          end.setHours(23, 59, 59, 999);
          break;
        case 'week':
          start = new Date(now);
          start.setDate(now.getDate() - 7);
          start.setHours(0, 0, 0, 0);
          end = new Date(now);
          end.setHours(23, 59, 59, 999);
          break;
        case 'month':
          start = new Date(now);
          start.setDate(now.getDate() - 30);
          start.setHours(0, 0, 0, 0);
          end = new Date(now);
          end.setHours(23, 59, 59, 999);
          break;
        default:
          start = new Date(now);
          start.setDate(now.getDate() - 7);
          end = new Date(now);
      }
    }

    // Get aggregated summary data
    const summaryData = await UserActivity.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          totalWorkouts: { $sum: '$summary.totalWorkouts' },
          totalMeals: { $sum: '$summary.totalMeals' },
          totalPoints: { $sum: '$summary.totalPoints' },
          totalCaloriesConsumed: { $sum: '$summary.caloriesConsumed' },
          totalCaloriesBurned: { $sum: '$summary.caloriesBurned' },
          totalActiveMinutes: { $sum: '$summary.activeMinutes' },
          totalAchievements: { $sum: { $size: { $ifNull: ['$goals.achievements', []] } } },
          activeDays: { $sum: 1 },
          avgWorkoutsPerDay: { $avg: '$summary.totalWorkouts' },
          avgMealsPerDay: { $avg: '$summary.totalMeals' },
          avgPointsPerDay: { $avg: '$summary.totalPoints' }
        }
      }
    ]);

    // Get streak information
    const streakData = await calculateStreaks(userId, start, end);

    // Get top achievements
    const topAchievements = await UserActivity.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          date: { $gte: start, $lte: end }
        }
      },
      { $unwind: { path: '$goals.achievements', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$goals.achievements.achievementName',
          points: { $sum: '$goals.achievements.points' },
          count: { $sum: 1 },
          lastCompleted: { $max: '$goals.achievements.completedAt' }
        }
      },
      { $sort: { points: -1 } },
      { $limit: 10 }
    ]);

    const summary = summaryData[0] || {
      totalWorkouts: 0,
      totalMeals: 0,
      totalPoints: 0,
      totalCaloriesConsumed: 0,
      totalCaloriesBurned: 0,
      totalActiveMinutes: 0,
      totalAchievements: 0,
      activeDays: 0,
      avgWorkoutsPerDay: 0,
      avgMealsPerDay: 0,
      avgPointsPerDay: 0
    };

    res.status(200).json({
      success: true,
      message: 'Activity summary retrieved successfully',
      data: {
        period: {
          type: period,
          startDate: start,
          endDate: end,
          totalDays: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        },
        summary: {
          ...summary,
          avgWorkoutsPerDay: Math.round(summary.avgWorkoutsPerDay * 100) / 100,
          avgMealsPerDay: Math.round(summary.avgMealsPerDay * 100) / 100,
          avgPointsPerDay: Math.round(summary.avgPointsPerDay * 100) / 100
        },
        streaks: streakData,
        topAchievements
      }
    });

  } catch (error) {
    logger.error('Error retrieving activity summary', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

export const updateActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get userId from params (admin route) or from JWT token (user route)
    const { userId: paramUserId, activityId } = req.params;
    const jwtUserId = (req as any).user?._id?.toString();
    const userId = paramUserId || jwtUserId;
    
    if (!userId || !activityId) {
      res.status(400).json({
        success: false,
        message: 'User ID and Activity ID are required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Validate request body
    const validation = validateRequest(req.body, updateActivitySchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const updateData = validation.value;

    // Find and update activity
    const activity = await UserActivity.findOneAndUpdate(
      { _id: activityId, userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!activity) {
      res.status(404).json({
        success: false,
        message: 'Activity not found',
        code: 'ACTIVITY_NOT_FOUND'
      });
      return;
    }

    logger.info('Activity updated successfully', { 
      userId, 
      activityId,
      updatedFields: Object.keys(updateData)
    });

    res.status(200).json({
      success: true,
      message: 'Activity updated successfully',
      data: {
        activityId: activity._id,
        summary: activity.summary,
        updatedAt: activity.updatedAt
      }
    });

  } catch (error) {
    logger.error('Error updating activity', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { 
        userId: req.params['userId'] || 'unknown',
        activityId: req.params['activityId'] || 'unknown'
      }
    );
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Helper function to calculate streaks
async function calculateStreaks(userId: string, startDate: Date, endDate: Date): Promise<any> {
  const activities = await UserActivity.find({
    userId,
    date: { $gte: startDate, $lte: endDate }
  })
  .sort({ date: 1 })
  .lean();

  let workoutStreak = 0;
  let mealStreak = 0;
  let currentWorkoutStreak = 0;
  let currentMealStreak = 0;
  let maxWorkoutStreak = 0;
  let maxMealStreak = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const activity of activities) {
    const activityDate = new Date(activity.date);
    activityDate.setHours(0, 0, 0, 0);

    // Check workout streak
    if (activity.summary.totalWorkouts > 0) {
      currentWorkoutStreak++;
      maxWorkoutStreak = Math.max(maxWorkoutStreak, currentWorkoutStreak);
      
      // If this is today or yesterday, continue current streak
      const daysDiff = Math.floor((today.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 1) {
        workoutStreak = currentWorkoutStreak;
      }
    } else {
      currentWorkoutStreak = 0;
    }

    // Check meal streak
    if (activity.summary.totalMeals > 0) {
      currentMealStreak++;
      maxMealStreak = Math.max(maxMealStreak, currentMealStreak);
      
      // If this is today or yesterday, continue current streak
      const daysDiff = Math.floor((today.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 1) {
        mealStreak = currentMealStreak;
      }
    } else {
      currentMealStreak = 0;
    }
  }

  return {
    currentWorkoutStreak: workoutStreak,
    currentMealStreak: mealStreak,
    maxWorkoutStreak,
    maxMealStreak
  };
}