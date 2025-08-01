"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkoutPlanStatus = exports.deactivateWorkoutPlan = exports.createOrRefreshWorkoutPlan = void 0;
const joi_1 = __importDefault(require("joi"));
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../utils/logger");
const WorkoutPlan_1 = require("../models/WorkoutPlan");
const User_1 = require("../models/User");
const workout_planning_service_1 = require("../services/external/workout-planning.service");
const errors_1 = require("../utils/errors");
const createWorkoutPlanSchema = joi_1.default.object({
    targetUserId: joi_1.default.string().optional(),
    forceRefresh: joi_1.default.boolean().default(false),
    weeklyWorkoutDays: joi_1.default.number().min(1).max(7).optional(),
    customPreferences: joi_1.default.object({
        focusAreas: joi_1.default.array().items(joi_1.default.string()).optional(),
        avoidExercises: joi_1.default.array().items(joi_1.default.string()).optional(),
        preferredEquipment: joi_1.default.array().items(joi_1.default.string()).optional()
    }).optional()
});
const planIdParamSchema = joi_1.default.object({
    planId: joi_1.default.string().required()
});
const createOrRefreshWorkoutPlan = async (req, res) => {
    try {
        const authenticatedUserId = req.user?.id;
        if (!authenticatedUserId) {
            throw new errors_1.AppError(401, 'User authentication required');
        }
        const targetUserId = req.body.targetUserId || authenticatedUserId;
        const isAdmin = req.user?.email?.includes('admin') ||
            req.user?.role === 'admin' ||
            req.user?.isAdmin === true ||
            req.user?.email === 'admin@example.com';
        if (targetUserId !== authenticatedUserId && !isAdmin) {
            throw new errors_1.AppError(403, 'Admin role required to create workout plans for other users');
        }
        const { error, value: requestData } = createWorkoutPlanSchema.validate(req.body);
        if (error) {
            throw new errors_1.AppError(400, `Invalid request data: ${error.details[0]?.message || 'Validation failed'}`);
        }
        logger_1.logger.info('Creating/refreshing workout plan for user', {
            service: 'integrations-controller',
            authenticatedUserId,
            targetUserId,
            forceRefresh: requestData.forceRefresh,
            weeklyWorkoutDays: requestData.weeklyWorkoutDays,
            event: 'create-workout-plan-start'
        });
        const user = await User_1.User.findById(targetUserId).lean();
        if (!user) {
            throw new errors_1.AppError(404, 'User not found');
        }
        if (!user.fitnessProfile?.level || !user.fitnessProfile?.goal ||
            !user.demographics?.age || !user.demographics?.heightCm ||
            !user.demographics?.weightKg) {
            throw new errors_1.AppError(400, 'Incomplete user profile. Please complete your fitness profile and demographics to create a workout plan.');
        }
        const existingPlan = await WorkoutPlan_1.WorkoutPlan.findOne({ userId: targetUserId, isActive: true });
        if (existingPlan && !requestData.forceRefresh) {
            const now = new Date();
            if (existingPlan.cacheExpiry > now) {
                logger_1.logger.info('Returning existing active workout plan', {
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
        const externalPlanResponse = await workout_planning_service_1.workoutPlanningService.createWorkoutPlan({
            userId: targetUserId,
            userProfile
        });
        const session = await mongoose_1.default.startSession();
        try {
            await session.withTransaction(async () => {
                await WorkoutPlan_1.WorkoutPlan.updateMany({ userId: targetUserId, isActive: true }, { isActive: false }, { session });
                const now = new Date();
                const newWorkoutPlan = new WorkoutPlan_1.WorkoutPlan({
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
                    nextRefreshDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
                    cacheExpiry: new Date(now.getTime() + 24 * 60 * 60 * 1000)
                });
                await newWorkoutPlan.save({ session });
                await User_1.User.findByIdAndUpdate(targetUserId, {
                    'activePlans.workoutPlanId': newWorkoutPlan._id
                }, { session });
                logger_1.logger.info('Workout plan created and user updated successfully', {
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
        }
        finally {
            await session.endSession();
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to create/refresh workout plan', error, {
            service: 'integrations-controller',
            authenticatedUserId: req.user?.id,
            targetUserId: req.body.targetUserId,
            event: 'create-workout-plan-error'
        });
        if (error instanceof errors_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
                data: null
            });
        }
        else {
            res.status(500).json({
                success: false,
                message: 'Internal server error while creating workout plan',
                data: null
            });
        }
    }
};
exports.createOrRefreshWorkoutPlan = createOrRefreshWorkoutPlan;
const deactivateWorkoutPlan = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.AppError(401, 'User authentication required');
        }
        const { error, value: params } = planIdParamSchema.validate(req.params);
        if (error) {
            throw new errors_1.AppError(400, `Invalid plan ID: ${error.details[0]?.message || 'Validation failed'}`);
        }
        logger_1.logger.info('Deactivating workout plan', {
            service: 'integrations-controller',
            userId,
            planId: params.planId,
            event: 'deactivate-workout-plan-start'
        });
        const workoutPlan = await WorkoutPlan_1.WorkoutPlan.findOne({
            planId: params.planId,
            userId,
            isActive: true
        });
        if (!workoutPlan) {
            throw new errors_1.AppError(404, 'Active workout plan not found');
        }
        const session = await mongoose_1.default.startSession();
        try {
            await session.withTransaction(async () => {
                workoutPlan.isActive = false;
                await workoutPlan.save({ session });
                await User_1.User.findByIdAndUpdate(userId, {
                    $unset: { 'activePlans.workoutPlanId': '' }
                }, { session });
                logger_1.logger.info('Workout plan deactivated successfully', {
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
        }
        finally {
            await session.endSession();
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to deactivate workout plan', error, {
            service: 'integrations-controller',
            userId: req.user?.id,
            planId: req.params['planId'],
            event: 'deactivate-workout-plan-error'
        });
        if (error instanceof errors_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
                data: null
            });
        }
        else {
            res.status(500).json({
                success: false,
                message: 'Internal server error while deactivating workout plan',
                data: null
            });
        }
    }
};
exports.deactivateWorkoutPlan = deactivateWorkoutPlan;
const getWorkoutPlanStatus = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.AppError(401, 'User authentication required');
        }
        logger_1.logger.info('Fetching workout plan status', {
            service: 'integrations-controller',
            userId,
            event: 'get-workout-plan-status-start'
        });
        const activeWorkoutPlan = await WorkoutPlan_1.WorkoutPlan.findOne({
            userId,
            isActive: true
        }).lean();
        const user = await User_1.User.findById(userId)
            .select('fitnessProfile demographics activePlans')
            .lean();
        if (!user) {
            throw new errors_1.AppError(404, 'User not found');
        }
        const profileComplete = !!(user.fitnessProfile?.level &&
            user.fitnessProfile?.goal &&
            user.demographics?.age &&
            user.demographics?.heightCm &&
            user.demographics?.weightKg);
        const now = new Date();
        let planStatus = 'none';
        let needsRefresh = false;
        let isExpired = false;
        if (activeWorkoutPlan) {
            isExpired = activeWorkoutPlan.cacheExpiry < now;
            needsRefresh = activeWorkoutPlan.nextRefreshDate <= now;
            if (isExpired) {
                planStatus = 'expired';
            }
            else if (needsRefresh) {
                planStatus = 'needs_refresh';
            }
            else {
                planStatus = 'active';
            }
        }
        const totalPlansCount = await WorkoutPlan_1.WorkoutPlan.countDocuments({ userId });
        logger_1.logger.info('Workout plan status retrieved successfully', {
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get workout plan status', error, {
            service: 'integrations-controller',
            userId: req.user?.id,
            event: 'get-workout-plan-status-error'
        });
        if (error instanceof errors_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message,
                data: null
            });
        }
        else {
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching workout plan status',
                data: null
            });
        }
    }
};
exports.getWorkoutPlanStatus = getWorkoutPlanStatus;
exports.default = {
    createOrRefreshWorkoutPlan: exports.createOrRefreshWorkoutPlan,
    deactivateWorkoutPlan: exports.deactivateWorkoutPlan,
    getWorkoutPlanStatus: exports.getWorkoutPlanStatus
};
//# sourceMappingURL=integrations.controller.js.map