"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DietPlanRefreshJob = exports.dietPlanRefreshJob = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("../utils/logger");
const DietPlan_1 = require("../models/DietPlan");
const User_1 = require("../models/User");
const diet_plan_cache_service_1 = require("../services/diet-plan-cache.service");
class DietPlanRefreshJob {
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
        const cronExpression = '0 3 * * *';
        const testCronExpression = process.env['NODE_ENV'] === 'development' ? '*/35 * * * *' : cronExpression;
        node_cron_1.default.schedule(testCronExpression, async () => {
            if (this.isRunning) {
                logger_1.logger.warn('Diet plan refresh job already running, skipping this execution', {
                    service: 'diet-plan-refresh-job',
                    event: 'job-skip-already-running'
                });
                return;
            }
            try {
                await this.executeRefreshJob();
            }
            catch (error) {
                logger_1.logger.error('Diet plan refresh job failed', error, {
                    service: 'diet-plan-refresh-job',
                    event: 'job-execution-error'
                });
            }
        }, {
            scheduled: true,
            timezone: 'UTC'
        });
        logger_1.logger.info('Diet plan refresh job scheduled', {
            service: 'diet-plan-refresh-job',
            schedule: testCronExpression,
            timezone: 'UTC',
            event: 'job-scheduled'
        });
    }
    async executeRefreshJob() {
        this.isRunning = true;
        this.jobStats = this.initializeStats();
        logger_1.logger.info('Starting diet plan refresh job', {
            service: 'diet-plan-refresh-job',
            startTime: this.jobStats.startTime,
            event: 'job-start'
        });
        try {
            const now = new Date();
            const plansToRefresh = await DietPlan_1.DietPlan.find({
                isActive: true,
                nextRefreshDate: { $lte: now }
            }).populate('userId', 'fitnessProfile demographics dietPreferences').lean();
            this.jobStats.plansChecked = plansToRefresh.length;
            logger_1.logger.info('Found diet plans to refresh', {
                service: 'diet-plan-refresh-job',
                plansFound: plansToRefresh.length,
                event: 'plans-found'
            });
            for (const plan of plansToRefresh) {
                try {
                    await this.refreshSinglePlan(plan);
                    this.jobStats.plansRefreshed++;
                }
                catch (error) {
                    logger_1.logger.error('Failed to refresh individual diet plan', error, {
                        service: 'diet-plan-refresh-job',
                        planId: plan._id.toString(),
                        userId: plan.userId.toString(),
                        event: 'individual-plan-refresh-error'
                    });
                    this.jobStats.errors++;
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            this.jobStats.endTime = new Date();
            this.jobStats.duration = this.jobStats.endTime.getTime() - this.jobStats.startTime.getTime();
            logger_1.logger.info('Diet plan refresh job completed', {
                service: 'diet-plan-refresh-job',
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
            logger_1.logger.error('Diet plan refresh job failed', error, {
                service: 'diet-plan-refresh-job',
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
        const userDietPreferences = plan.userId.dietPreferences || {};
        logger_1.logger.info('Refreshing diet plan', {
            service: 'diet-plan-refresh-job',
            planId: plan._id.toString(),
            userId,
            planName: plan.planName,
            event: 'plan-refresh-start'
        });
        if (!userProfile.goal ||
            !userDemographics.age || !userDemographics.heightCm ||
            !userDemographics.weightKg || !userDemographics.gender) {
            logger_1.logger.warn('Skipping diet plan refresh due to incomplete user profile', {
                service: 'diet-plan-refresh-job',
                planId: plan._id.toString(),
                userId,
                missingFields: {
                    goal: !userProfile.goal,
                    age: !userDemographics.age,
                    height: !userDemographics.heightCm,
                    weight: !userDemographics.weightKg,
                    gender: !userDemographics.gender
                },
                event: 'plan-refresh-skip-incomplete-profile'
            });
            this.jobStats.plansSkipped++;
            return;
        }
        const refreshUserProfile = {
            goal: userProfile.goal,
            age: userDemographics.age,
            heightCm: userDemographics.heightCm,
            weightKg: userDemographics.weightKg,
            targetWeightKg: userDemographics.targetWeightKg || userDemographics.weightKg,
            gender: userDemographics.gender,
            activityLevel: userDemographics.activityLevel || 'sedentary',
            allergies: userDemographics.allergies || [],
            healthConditions: userProfile.healthConditions || []
        };
        const dietPreferences = {
            cuisinePreferences: userDietPreferences.cuisinePreferences || {}
        };
        try {
            const refreshedPlan = await diet_plan_cache_service_1.dietPlanCacheService.createOrRefreshDietPlan({
                userId: userId.toString(),
                userProfile: refreshUserProfile,
                dietPreferences,
                forceRefresh: true
            });
            logger_1.logger.info('Diet plan refreshed successfully', {
                service: 'diet-plan-refresh-job',
                oldPlanId: plan._id.toString(),
                newPlanId: refreshedPlan.planId,
                userId,
                planName: refreshedPlan.planName,
                targetWeight: refreshedPlan.targetWeightKg,
                totalCalories: refreshedPlan.totalMacros.calories,
                event: 'plan-refresh-success'
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to refresh diet plan via external service', error, {
                service: 'diet-plan-refresh-job',
                planId: plan._id.toString(),
                userId,
                event: 'external-service-refresh-error'
            });
            const nextRetryDate = new Date();
            nextRetryDate.setDate(nextRetryDate.getDate() + 7);
            await DietPlan_1.DietPlan.findByIdAndUpdate(plan._id, {
                nextRefreshDate: nextRetryDate,
                lastRefreshed: new Date()
            });
            logger_1.logger.info('Updated failed diet plan retry date', {
                service: 'diet-plan-refresh-job',
                planId: plan._id.toString(),
                userId,
                nextRetryDate,
                event: 'plan-retry-scheduled'
            });
            throw error;
        }
    }
    async triggerManualRefresh() {
        logger_1.logger.info('Manual diet plan refresh triggered', {
            service: 'diet-plan-refresh-job',
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
        tomorrow.setHours(3, 0, 0, 0);
        return {
            nextRun: tomorrow,
            isRunning: this.isRunning
        };
    }
    async refreshPlansForGoalChange(userId) {
        try {
            logger_1.logger.info('Refreshing diet plan due to goal change', {
                service: 'diet-plan-refresh-job',
                userId,
                event: 'goal-change-refresh-start'
            });
            const activePlan = await DietPlan_1.DietPlan.findOne({
                userId,
                isActive: true
            });
            if (!activePlan) {
                logger_1.logger.info('No active diet plan found for goal change refresh', {
                    service: 'diet-plan-refresh-job',
                    userId,
                    event: 'no-active-plan-for-goal-change'
                });
                return;
            }
            const user = await User_1.User.findById(userId)
                .select('fitnessProfile demographics dietPreferences')
                .lean();
            if (!user) {
                throw new Error('User not found for goal change refresh');
            }
            const planWithUser = {
                ...activePlan.toObject(),
                userId: user
            };
            await this.refreshSinglePlan(planWithUser);
            logger_1.logger.info('Diet plan refreshed successfully due to goal change', {
                service: 'diet-plan-refresh-job',
                userId,
                event: 'goal-change-refresh-success'
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to refresh diet plan for goal change', error, {
                service: 'diet-plan-refresh-job',
                userId,
                event: 'goal-change-refresh-error'
            });
            throw error;
        }
    }
}
exports.DietPlanRefreshJob = DietPlanRefreshJob;
const dietPlanRefreshJob = new DietPlanRefreshJob();
exports.dietPlanRefreshJob = dietPlanRefreshJob;
if (process.env['NODE_ENV'] !== 'test') {
    dietPlanRefreshJob.startJob();
}
exports.default = dietPlanRefreshJob;
//# sourceMappingURL=diet-plan-refresh.job.js.map