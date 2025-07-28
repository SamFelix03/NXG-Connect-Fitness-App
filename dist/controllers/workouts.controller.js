"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkoutProgress = exports.getWorkoutLibrary = exports.getWorkoutDay = exports.getDailyWorkout = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("../utils/logger");
const WorkoutPlan_1 = require("../models/WorkoutPlan");
const Branch_1 = require("../models/Branch");
const workout_planning_service_1 = require("../services/external/workout-planning.service");
const errors_1 = require("../utils/errors");
const getDailyWorkoutQuerySchema = joi_1.default.object({
    branchId: joi_1.default.string().optional(),
    includeAvailability: joi_1.default.boolean().default(true)
});
const getWorkoutDayQuerySchema = joi_1.default.object({
    branchId: joi_1.default.string().optional(),
    includeAvailability: joi_1.default.boolean().default(true)
});
const getLibraryQuerySchema = joi_1.default.object({
    muscleGroup: joi_1.default.string().optional(),
    equipment: joi_1.default.string().optional(),
    difficulty: joi_1.default.string().valid('beginner', 'intermediate', 'advanced').optional(),
    branchId: joi_1.default.string().optional(),
    page: joi_1.default.number().min(1).default(1),
    limit: joi_1.default.number().min(1).max(100).default(20)
});
const getDailyWorkout = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.AppError(401, 'User authentication required');
        }
        const { error, value: queryParams } = getDailyWorkoutQuerySchema.validate(req.query);
        if (error) {
            throw new errors_1.AppError(400, `Invalid query parameters: ${error.details[0]?.message || 'Validation failed'}`);
        }
        logger_1.logger.info('Fetching daily workout for user', {
            service: 'workouts-controller',
            userId,
            branchId: queryParams.branchId,
            includeAvailability: queryParams.includeAvailability,
            event: 'get-daily-workout-start'
        });
        const activeWorkoutPlan = await WorkoutPlan_1.WorkoutPlan.findOne({
            userId,
            isActive: true
        }).lean();
        if (!activeWorkoutPlan) {
            logger_1.logger.info('No active workout plan found for user', {
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
        const now = new Date();
        if (activeWorkoutPlan.cacheExpiry < now) {
            logger_1.logger.warn('Workout plan has expired', {
                service: 'workouts-controller',
                userId,
                planId: activeWorkoutPlan.planId,
                cacheExpiry: activeWorkoutPlan.cacheExpiry,
                event: 'plan-expired'
            });
        }
        let machineAvailability = null;
        if (queryParams.includeAvailability && queryParams.branchId) {
            try {
                const branch = await Branch_1.Branch.findById(queryParams.branchId).select('machines').lean();
                if (branch) {
                    machineAvailability = branch.machines.reduce((acc, machine) => {
                        acc[machine.name.toLowerCase()] = {
                            isAvailable: machine.isAvailable,
                            maintenanceStatus: machine.maintenanceStatus,
                            qrCode: machine.qrCode,
                            location: machine.location
                        };
                        return acc;
                    }, {});
                }
            }
            catch (machineError) {
                logger_1.logger.error('Failed to fetch machine availability', machineError, {
                    service: 'workouts-controller',
                    userId,
                    branchId: queryParams.branchId,
                    event: 'machine-availability-error'
                });
            }
        }
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
        logger_1.logger.info('Daily workout fetched successfully', {
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get daily workout', error, {
            service: 'workouts-controller',
            userId: req.user?.id,
            event: 'get-daily-workout-error'
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
                message: 'Internal server error while fetching daily workout',
                data: null
            });
        }
    }
};
exports.getDailyWorkout = getDailyWorkout;
const getWorkoutDay = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.AppError(401, 'User authentication required');
        }
        const { muscleGroup } = req.params;
        if (!muscleGroup) {
            throw new errors_1.AppError(400, 'Muscle group parameter is required');
        }
        const { error, value: queryParams } = getWorkoutDayQuerySchema.validate(req.query);
        if (error) {
            throw new errors_1.AppError(400, `Invalid query parameters: ${error.details[0]?.message || 'Validation failed'}`);
        }
        logger_1.logger.info('Fetching workout day for user', {
            service: 'workouts-controller',
            userId,
            muscleGroup,
            branchId: queryParams.branchId,
            includeAvailability: queryParams.includeAvailability,
            event: 'get-workout-day-start'
        });
        const activeWorkoutPlan = await WorkoutPlan_1.WorkoutPlan.findOne({
            userId,
            isActive: true
        }).lean();
        if (!activeWorkoutPlan) {
            logger_1.logger.info('No active workout plan found for user', {
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
        const workoutDay = activeWorkoutPlan.workoutDays.find(day => day.muscleGroup.toLowerCase() === muscleGroup.toLowerCase());
        if (!workoutDay) {
            logger_1.logger.info('Muscle group not found in workout plan', {
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
        let machineAvailability = null;
        if (queryParams.includeAvailability && queryParams.branchId) {
            try {
                const branch = await Branch_1.Branch.findById(queryParams.branchId).select('machines').lean();
                if (branch) {
                    machineAvailability = branch.machines.reduce((acc, machine) => {
                        acc[machine.name.toLowerCase()] = {
                            isAvailable: machine.isAvailable,
                            maintenanceStatus: machine.maintenanceStatus,
                            qrCode: machine.qrCode,
                            location: machine.location
                        };
                        return acc;
                    }, {});
                }
            }
            catch (machineError) {
                logger_1.logger.error('Failed to fetch machine availability', machineError, {
                    service: 'workouts-controller',
                    userId,
                    branchId: queryParams.branchId,
                    event: 'machine-availability-error'
                });
            }
        }
        const enhancedWorkoutDay = {
            ...workoutDay,
            exercises: workoutDay.exercises.map((exercise) => {
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
        logger_1.logger.info('Workout day fetched successfully', {
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
                    ...(machineAvailability && {
                        branchInfo: {
                            branchId: queryParams.branchId,
                            machineAvailabilityIncluded: true
                        }
                    })
                }
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get workout day', error, {
            service: 'workouts-controller',
            userId: req.user?.id,
            muscleGroup: req.params['muscleGroup'],
            event: 'get-workout-day-error'
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
                message: 'Internal server error while fetching workout day',
                data: null
            });
        }
    }
};
exports.getWorkoutDay = getWorkoutDay;
const getWorkoutLibrary = async (req, res) => {
    try {
        const { error, value: queryParams } = getLibraryQuerySchema.validate(req.query);
        if (error) {
            throw new errors_1.AppError(400, `Invalid query parameters: ${error.details[0]?.message || 'Validation failed'}`);
        }
        logger_1.logger.info('Fetching workout library', {
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
        const exerciseFilters = {
            muscleGroup: queryParams.muscleGroup,
            equipment: queryParams.equipment,
            difficulty: queryParams.difficulty
        };
        Object.keys(exerciseFilters).forEach(key => {
            if (exerciseFilters[key] === undefined) {
                delete exerciseFilters[key];
            }
        });
        const exercises = await workout_planning_service_1.workoutPlanningService.getExerciseLibrary(Object.keys(exerciseFilters).length > 0 ? exerciseFilters : undefined);
        let machineAvailability = null;
        if (queryParams.branchId) {
            try {
                const branch = await Branch_1.Branch.findById(queryParams.branchId).select('machines name').lean();
                if (branch) {
                    machineAvailability = {
                        branchName: branch.name,
                        machines: branch.machines.reduce((acc, machine) => {
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
            }
            catch (machineError) {
                logger_1.logger.error('Failed to fetch machine availability for library', machineError, {
                    service: 'workouts-controller',
                    branchId: queryParams.branchId,
                    event: 'machine-availability-error'
                });
            }
        }
        const startIndex = (queryParams.page - 1) * queryParams.limit;
        const endIndex = startIndex + queryParams.limit;
        const paginatedExercises = exercises.slice(startIndex, endIndex);
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
        logger_1.logger.info('Workout library fetched successfully', {
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
                        .filter((m) => m.isAvailable).length
                } : null
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get workout library', error, {
            service: 'workouts-controller',
            event: 'get-workout-library-error'
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
                message: 'Internal server error while fetching workout library',
                data: null
            });
        }
    }
};
exports.getWorkoutLibrary = getWorkoutLibrary;
const getWorkoutProgress = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.AppError(401, 'User authentication required');
        }
        logger_1.logger.info('Fetching workout progress', {
            service: 'workouts-controller',
            userId,
            event: 'get-workout-progress-start'
        });
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get workout progress', error, {
            service: 'workouts-controller',
            userId: req.user?.id,
            event: 'get-workout-progress-error'
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
                message: 'Internal server error while fetching workout progress',
                data: null
            });
        }
    }
};
exports.getWorkoutProgress = getWorkoutProgress;
exports.default = {
    getDailyWorkout: exports.getDailyWorkout,
    getWorkoutDay: exports.getWorkoutDay,
    getWorkoutLibrary: exports.getWorkoutLibrary,
    getWorkoutProgress: exports.getWorkoutProgress
};
//# sourceMappingURL=workouts.controller.js.map