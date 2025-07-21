"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateActivity = exports.getActivitySummary = exports.getActivityTimeline = exports.logActivity = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const UserActivity_1 = require("../models/UserActivity");
const User_1 = require("../models/User");
const validation_1 = require("../utils/validation");
const validation_2 = require("../utils/validation");
const logger_1 = __importDefault(require("../utils/logger"));
const logActivity = async (req, res) => {
    try {
        const { userId: paramUserId } = req.params;
        const jwtUserId = req.user?.userId;
        const userId = paramUserId || jwtUserId;
        if (!userId) {
            res.status(400).json({
                success: false,
                message: 'User ID is required',
                code: 'VALIDATION_ERROR'
            });
            return;
        }
        const validation = (0, validation_1.validateRequest)(req.body, validation_2.logActivitySchema);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const { activityType, activityData, date = new Date(), points = 0 } = validation.value;
        const activityDate = new Date(date);
        activityDate.setHours(0, 0, 0, 0);
        let activity = await UserActivity_1.UserActivity.findOne({
            userId,
            date: activityDate
        });
        if (!activity) {
            activity = new UserActivity_1.UserActivity({
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
        if (points > 0) {
            activity.pointsEarned.push({
                points,
                reason: activityData.pointsReason || `${activityType} completed`,
                awardedAt: new Date()
            });
            await User_1.User.findByIdAndUpdate(userId, {
                $inc: { totalPoints: points }
            });
        }
        if (activity.workoutActivity.assignedWorkouts > 0) {
            activity.workoutActivity.completionPercentage =
                (activity.workoutActivity.completedWorkouts / activity.workoutActivity.assignedWorkouts) * 100;
        }
        await activity.save();
        logger_1.default.info('Activity logged successfully', {
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
    }
    catch (error) {
        logger_1.default.error('Error logging activity', error instanceof Error ? error : new Error('Unknown error'), { userId: req.params['userId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
};
exports.logActivity = logActivity;
const getActivityTimeline = async (req, res) => {
    try {
        const { userId: paramUserId } = req.params;
        const jwtUserId = req.user?.userId;
        const userId = paramUserId || jwtUserId;
        if (!userId) {
            res.status(400).json({
                success: false,
                message: 'User ID is required',
                code: 'VALIDATION_ERROR'
            });
            return;
        }
        const validation = (0, validation_1.validateRequest)(req.query, validation_2.activityTimelineSchema);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date(), activityType, page = 1, limit = 20 } = validation.value;
        const query = {
            userId,
            date: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        };
        const activities = await UserActivity_1.UserActivity.find(query)
            .sort({ date: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
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
        const totalCount = await UserActivity_1.UserActivity.countDocuments(query);
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
    }
    catch (error) {
        logger_1.default.error('Error retrieving activity timeline', error instanceof Error ? error : new Error('Unknown error'), { userId: req.params['userId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
};
exports.getActivityTimeline = getActivityTimeline;
const getActivitySummary = async (req, res) => {
    try {
        const { userId: paramUserId } = req.params;
        const jwtUserId = req.user?.userId;
        const userId = paramUserId || jwtUserId;
        if (!userId) {
            res.status(400).json({
                success: false,
                message: 'User ID is required',
                code: 'VALIDATION_ERROR'
            });
            return;
        }
        const validation = (0, validation_1.validateRequest)(req.query, validation_2.activitySummarySchema);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const { period = 'week', startDate, endDate } = validation.value;
        let start, end;
        const now = new Date();
        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        }
        else {
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
        const summaryData = await UserActivity_1.UserActivity.aggregate([
            {
                $match: {
                    userId: new mongoose_1.default.Types.ObjectId(userId),
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
        const streakData = await calculateStreaks(userId, start, end);
        const topAchievements = await UserActivity_1.UserActivity.aggregate([
            {
                $match: {
                    userId: new mongoose_1.default.Types.ObjectId(userId),
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
    }
    catch (error) {
        logger_1.default.error('Error retrieving activity summary', error instanceof Error ? error : new Error('Unknown error'), { userId: req.params['userId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
};
exports.getActivitySummary = getActivitySummary;
const updateActivity = async (req, res) => {
    try {
        const { userId: paramUserId, activityId } = req.params;
        const jwtUserId = req.user?.userId;
        const userId = paramUserId || jwtUserId;
        if (!userId || !activityId) {
            res.status(400).json({
                success: false,
                message: 'User ID and Activity ID are required',
                code: 'VALIDATION_ERROR'
            });
            return;
        }
        const validation = (0, validation_1.validateRequest)(req.body, validation_2.updateActivitySchema);
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
        const activity = await UserActivity_1.UserActivity.findOneAndUpdate({ _id: activityId, userId }, { $set: updateData }, { new: true, runValidators: true });
        if (!activity) {
            res.status(404).json({
                success: false,
                message: 'Activity not found',
                code: 'ACTIVITY_NOT_FOUND'
            });
            return;
        }
        logger_1.default.info('Activity updated successfully', {
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
    }
    catch (error) {
        logger_1.default.error('Error updating activity', error instanceof Error ? error : new Error('Unknown error'), {
            userId: req.params['userId'] || 'unknown',
            activityId: req.params['activityId'] || 'unknown'
        });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
};
exports.updateActivity = updateActivity;
async function calculateStreaks(userId, startDate, endDate) {
    const activities = await UserActivity_1.UserActivity.find({
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
        if (activity.summary.totalWorkouts > 0) {
            currentWorkoutStreak++;
            maxWorkoutStreak = Math.max(maxWorkoutStreak, currentWorkoutStreak);
            const daysDiff = Math.floor((today.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 1) {
                workoutStreak = currentWorkoutStreak;
            }
        }
        else {
            currentWorkoutStreak = 0;
        }
        if (activity.summary.totalMeals > 0) {
            currentMealStreak++;
            maxMealStreak = Math.max(maxMealStreak, currentMealStreak);
            const daysDiff = Math.floor((today.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 1) {
                mealStreak = currentMealStreak;
            }
        }
        else {
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
//# sourceMappingURL=activity.controller.js.map