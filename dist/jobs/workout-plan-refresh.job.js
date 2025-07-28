"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkoutPlanRefreshJob = exports.workoutPlanRefreshJob = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../utils/logger");
const WorkoutPlan_1 = require("../models/WorkoutPlan");
const User_1 = require("../models/User");
const workout_planning_service_1 = require("../services/external/workout-planning.service");
class WorkoutPlanRefreshJob {
    jobStats;
    isRunning = false;
    constructor() {
        this.jobStats = this.initializeStats();
    }
    initializeStats() {
        return {
            plansChecked: 0,
            plansRefreshed: 0,
            plansSkipped: 0,
            errors: 0,
            startTime: new Date()
        };
    }
    startJob() {
        const cronExpression = '0 2 * * *';
        const testCronExpression = process.env['NODE_ENV'] === 'development' ? '*/30 * * * *' : cronExpression;
        node_cron_1.default.schedule(testCronExpression, async () => {
            if (this.isRunning) {
                logger_1.logger.warn('Workout plan refresh job already running, skipping this execution', {
                    service: 'workout-plan-refresh-job',
                    event: 'job-skip-already-running'
                });
                return;
            }
            try {
                await this.executeRefreshJob();
            }
            catch (error) {
                logger_1.logger.error('Workout plan refresh job failed', error, {
                    service: 'workout-plan-refresh-job',
                    event: 'job-execution-error'
                });
            }
        }, {
            scheduled: true,
            timezone: 'UTC'
        });
        logger_1.logger.info('Workout plan refresh job scheduled', {
            service: 'workout-plan-refresh-job',
            schedule: testCronExpression,
            timezone: 'UTC',
            event: 'job-scheduled'
        });
    }
    async executeRefreshJob() {
        this.isRunning = true;
        this.jobStats = this.initializeStats();
        logger_1.logger.info('Starting workout plan refresh job', {
            service: 'workout-plan-refresh-job',
            startTime: this.jobStats.startTime,
            event: 'job-start'
        });
        try {
            const now = new Date();
            const plansToRefresh = await WorkoutPlan_1.WorkoutPlan.find({
                isActive: true,
                nextRefreshDate: { $lte: now }
            }).populate('userId', 'fitnessProfile demographics').lean();
            this.jobStats.plansChecked = plansToRefresh.length;
            logger_1.logger.info('Found workout plans to refresh', {
                service: 'workout-plan-refresh-job',
                plansFound: plansToRefresh.length,
                event: 'plans-found'
            });
            for (const plan of plansToRefresh) {
                try {
                    await this.refreshSinglePlan(plan);
                    this.jobStats.plansRefreshed++;
                }
                catch (error) {
                    logger_1.logger.error('Failed to refresh individual plan', error, {
                        service: 'workout-plan-refresh-job',
                        planId: plan.planId,
                        userId: plan.userId.toString(),
                        event: 'individual-plan-refresh-error'
                    });
                    this.jobStats.errors++;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            this.jobStats.endTime = new Date();
            this.jobStats.duration = this.jobStats.endTime.getTime() - this.jobStats.startTime.getTime();
            logger_1.logger.info('Workout plan refresh job completed', {
                service: 'workout-plan-refresh-job',
                stats: {
                    plansChecked: this.jobStats.plansChecked,
                    plansRefreshed: this.jobStats.plansRefreshed,
                    plansSkipped: this.jobStats.plansSkipped,
                    errors: this.jobStats.errors,
                    duration: this.jobStats.duration
                },
                event: 'job-completed'
            });
        }
        catch (error) {
            this.jobStats.endTime = new Date();
            this.jobStats.duration = this.jobStats.endTime.getTime() - this.jobStats.startTime.getTime();
            logger_1.logger.error('Workout plan refresh job failed', error, {
                service: 'workout-plan-refresh-job',
                stats: this.jobStats,
                event: 'job-error'
            });
        }
        finally {
            this.isRunning = false;
        }
        return this.jobStats;
    }
    async refreshSinglePlan(plan) {
        const userId = plan.userId._id || plan.userId;
        const userProfile = plan.userId.fitnessProfile || {};
        const userDemographics = plan.userId.demographics || {};
        logger_1.logger.info('Refreshing workout plan', {
            service: 'workout-plan-refresh-job',
            planId: plan.planId,
            userId,
            planName: plan.planName,
            event: 'plan-refresh-start'
        });
        if (!userProfile.level || !userProfile.goal ||
            !userDemographics.age || !userDemographics.heightCm ||
            !userDemographics.weightKg) {
            logger_1.logger.warn('Skipping plan refresh due to incomplete user profile', {
                service: 'workout-plan-refresh-job',
                planId: plan.planId,
                userId,
                missingFields: {
                    fitnessLevel: !userProfile.level,
                    goal: !userProfile.goal,
                    age: !userDemographics.age,
                    height: !userDemographics.heightCm,
                    weight: !userDemographics.weightKg
                },
                event: 'plan-refresh-skip-incomplete-profile'
            });
            this.jobStats.plansSkipped++;
            return;
        }
        const refreshUserProfile = {
            fitnessLevel: userProfile.level,
            goal: userProfile.goal,
            age: userDemographics.age,
            heightCm: userDemographics.heightCm,
            weightKg: userDemographics.weightKg,
            activityLevel: userDemographics.activityLevel || 'moderate',
            healthConditions: userProfile.healthConditions || [],
            weeklyWorkoutDays: plan.weeklySchedule || 3
        };
        try {
            const externalPlanResponse = await workout_planning_service_1.workoutPlanningService.createWorkoutPlan({
                userId: userId.toString(),
                userProfile: refreshUserProfile
            });
            const session = await mongoose_1.default.startSession();
            try {
                await session.withTransaction(async () => {
                    await WorkoutPlan_1.WorkoutPlan.findByIdAndUpdate(plan._id, { isActive: false }, { session });
                    const newWorkoutPlan = new WorkoutPlan_1.WorkoutPlan({
                        planId: externalPlanResponse.planId,
                        planName: externalPlanResponse.planName,
                        userId,
                        isActive: true,
                        source: 'external',
                        workoutDays: externalPlanResponse.workoutDays,
                        weeklySchedule: externalPlanResponse.weeklySchedule,
                        planDuration: externalPlanResponse.planDuration,
                        difficultyLevel: externalPlanResponse.difficultyLevel,
                        userContext: {
                            fitnessLevel: refreshUserProfile.fitnessLevel,
                            goal: refreshUserProfile.goal,
                            age: refreshUserProfile.age,
                            heightCm: refreshUserProfile.heightCm,
                            weightKg: refreshUserProfile.weightKg,
                            activityLevel: refreshUserProfile.activityLevel,
                            healthConditions: refreshUserProfile.healthConditions
                        },
                        lastRefreshed: new Date()
                    });
                    await newWorkoutPlan.save({ session });
                    await User_1.User.findByIdAndUpdate(userId, {
                        'activePlans.workoutPlanId': newWorkoutPlan._id
                    }, { session });
                    logger_1.logger.info('Workout plan refreshed successfully', {
                        service: 'workout-plan-refresh-job',
                        oldPlanId: plan.planId,
                        newPlanId: newWorkoutPlan.planId,
                        userId,
                        planName: newWorkoutPlan.planName,
                        event: 'plan-refresh-success'
                    });
                });
            }
            finally {
                await session.endSession();
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to refresh workout plan via external service', error, {
                service: 'workout-plan-refresh-job',
                planId: plan.planId,
                userId,
                event: 'external-service-refresh-error'
            });
            const nextRetryDate = new Date();
            nextRetryDate.setDate(nextRetryDate.getDate() + 7);
            await WorkoutPlan_1.WorkoutPlan.findByIdAndUpdate(plan._id, {
                nextRefreshDate: nextRetryDate,
                lastRefreshed: new Date()
            });
            logger_1.logger.info('Updated failed plan retry date', {
                service: 'workout-plan-refresh-job',
                planId: plan.planId,
                userId,
                nextRetryDate,
                event: 'plan-retry-scheduled'
            });
            throw error;
        }
    }
    async triggerManualRefresh() {
        logger_1.logger.info('Manual workout plan refresh triggered', {
            service: 'workout-plan-refresh-job',
            event: 'manual-trigger'
        });
        return await this.executeRefreshJob();
    }
    getJobStats() {
        return { ...this.jobStats };
    }
    isJobRunning() {
        return this.isRunning;
    }
    getNextRunInfo() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(2, 0, 0, 0);
        return {
            nextRun: tomorrow,
            isRunning: this.isRunning
        };
    }
}
exports.WorkoutPlanRefreshJob = WorkoutPlanRefreshJob;
const workoutPlanRefreshJob = new WorkoutPlanRefreshJob();
exports.workoutPlanRefreshJob = workoutPlanRefreshJob;
if (process.env['NODE_ENV'] !== 'test') {
    workoutPlanRefreshJob.startJob();
}
exports.default = workoutPlanRefreshJob;
//# sourceMappingURL=workout-plan-refresh.job.js.map