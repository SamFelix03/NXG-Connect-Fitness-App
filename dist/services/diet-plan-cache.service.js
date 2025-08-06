"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dietPlanCacheService = exports.DietPlanCacheService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../utils/logger");
const redis_1 = require("../utils/redis");
const DietPlan_1 = require("../models/DietPlan");
const User_1 = require("../models/User");
const diet_planning_service_1 = require("./external/diet-planning.service");
const external_apis_config_1 = require("../config/external-apis.config");
class DietPlanCacheService {
    async createOrRefreshDietPlan(input) {
        const session = await mongoose_1.default.startSession();
        try {
            session.startTransaction();
            logger_1.logger.info('Creating/refreshing diet plan for user', {
                service: 'diet-plan-cache-service',
                userId: input.userId,
                forceRefresh: input.forceRefresh,
                event: 'create-diet-plan-start'
            });
            const user = await User_1.User.findById(input.userId).session(session);
            if (!user) {
                throw new Error('User not found');
            }
            let existingPlan = null;
            if (user.activePlans?.dietPlanId) {
                existingPlan = await DietPlan_1.DietPlan.findById(user.activePlans.dietPlanId).session(session);
            }
            const shouldCreateNew = input.forceRefresh ||
                !existingPlan ||
                !existingPlan.isActive ||
                existingPlan.isExpired() ||
                existingPlan.needsRefresh();
            if (!shouldCreateNew && existingPlan) {
                logger_1.logger.info('Returning existing active diet plan', {
                    service: 'diet-plan-cache-service',
                    userId: input.userId,
                    planId: existingPlan._id.toString(),
                    event: 'existing-plan-returned'
                });
                await session.commitTransaction();
                return this.formatDietPlanResponse(existingPlan);
            }
            await DietPlan_1.DietPlan.updateMany({ userId: input.userId, isActive: true }, {
                $set: {
                    isActive: false,
                    updatedAt: new Date()
                }
            }).session(session);
            const dietPlanInput = {
                userId: input.userId,
                userProfile: input.userProfile
            };
            if (input.dietPreferences) {
                dietPlanInput.dietPreferences = input.dietPreferences;
            }
            const externalPlan = await diet_planning_service_1.dietPlanningService.createDietPlan(dietPlanInput);
            const processedPlan = this.processExternalResponse(externalPlan, input.userProfile);
            const now = new Date();
            const newDietPlan = new DietPlan_1.DietPlan({
                userId: input.userId,
                planName: processedPlan.planName,
                targetWeightKg: processedPlan.targetWeightKg,
                source: 'external',
                isActive: true,
                totalMacros: processedPlan.totalMacros,
                mealPlan: processedPlan.mealPlan,
                lastRefreshed: now,
                nextRefreshDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
                cacheExpiry: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            });
            const savedPlan = await newDietPlan.save({ session });
            await User_1.User.findByIdAndUpdate(input.userId, {
                $set: {
                    'activePlans.dietPlanId': savedPlan._id,
                    currentMacros: {
                        calories: processedPlan.totalMacros.calories,
                        carbs: processedPlan.totalMacros.carbs,
                        protein: processedPlan.totalMacros.protein,
                        fat: processedPlan.totalMacros.fat,
                        fiber: processedPlan.totalMacros.fiber,
                        validTill: savedPlan.cacheExpiry
                    }
                }
            }, { session });
            await this.cacheInRedis(input.userId, savedPlan);
            await session.commitTransaction();
            logger_1.logger.info('Diet plan created successfully', {
                service: 'diet-plan-cache-service',
                userId: input.userId,
                planId: savedPlan._id.toString(),
                planName: savedPlan.planName,
                targetWeight: savedPlan.targetWeightKg,
                mealPlanDays: savedPlan.mealPlan.length,
                event: 'create-diet-plan-success'
            });
            return this.formatDietPlanResponse(savedPlan);
        }
        catch (error) {
            await session.abortTransaction();
            logger_1.logger.error('Failed to create/refresh diet plan', error, {
                service: 'diet-plan-cache-service',
                userId: input.userId,
                event: 'create-diet-plan-error'
            });
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    async getUserActiveDietPlan(userId) {
        try {
            logger_1.logger.info('Fetching active diet plan for user', {
                service: 'diet-plan-cache-service',
                userId,
                event: 'get-active-plan-start'
            });
            const cached = await this.getFromRedisCache(userId);
            if (cached) {
                logger_1.logger.info('Returning cached diet plan from Redis', {
                    service: 'diet-plan-cache-service',
                    userId,
                    event: 'redis-cache-hit'
                });
                return cached;
            }
            const user = await User_1.User.findById(userId);
            if (!user || !user.activePlans?.dietPlanId) {
                logger_1.logger.info('No active diet plan found for user', {
                    service: 'diet-plan-cache-service',
                    userId,
                    event: 'no-active-plan'
                });
                return null;
            }
            const activePlan = await DietPlan_1.DietPlan.findById(user.activePlans.dietPlanId);
            if (!activePlan || !activePlan.isActive) {
                logger_1.logger.warn('Active plan ID exists but plan not found or inactive', {
                    service: 'diet-plan-cache-service',
                    userId,
                    planId: user.activePlans.dietPlanId?.toString(),
                    event: 'plan-not-found'
                });
                return null;
            }
            await this.cacheInRedis(userId, activePlan);
            logger_1.logger.info('Returning active diet plan from MongoDB', {
                service: 'diet-plan-cache-service',
                userId,
                planId: activePlan._id.toString(),
                event: 'mongodb-plan-returned'
            });
            return this.formatDietPlanResponse(activePlan);
        }
        catch (error) {
            logger_1.logger.error('Failed to get active diet plan', error, {
                service: 'diet-plan-cache-service',
                userId,
                event: 'get-active-plan-error'
            });
            return null;
        }
    }
    async getDayMeals(userId, dayNumber) {
        try {
            const activePlan = await this.getUserActiveDietPlan(userId);
            if (!activePlan) {
                return null;
            }
            const dayPlan = activePlan.mealPlan.find(day => day.day === dayNumber);
            if (!dayPlan) {
                logger_1.logger.warn('Day not found in meal plan', {
                    service: 'diet-plan-cache-service',
                    userId,
                    dayNumber,
                    availableDays: activePlan.mealPlan.map(d => d.day),
                    event: 'day-not-found'
                });
                return null;
            }
            return {
                day: dayPlan.day,
                dayName: dayPlan.dayName,
                meals: dayPlan.meals.sort((a, b) => a.mealOrder - b.mealOrder),
                totalCalories: dayPlan.meals.reduce((sum, meal) => sum + meal.calories, 0)
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get day meals', error, {
                service: 'diet-plan-cache-service',
                userId,
                dayNumber,
                event: 'get-day-meals-error'
            });
            return null;
        }
    }
    async findPlansNeedingRefresh() {
        try {
            const plans = await DietPlan_1.DietPlan.find({
                isActive: true,
                nextRefreshDate: { $lte: new Date() }
            }).populate('userId');
            logger_1.logger.info('Found plans needing refresh', {
                service: 'diet-plan-cache-service',
                planCount: plans.length,
                event: 'plans-needing-refresh'
            });
            return plans;
        }
        catch (error) {
            logger_1.logger.error('Failed to find plans needing refresh', error, {
                service: 'diet-plan-cache-service',
                event: 'find-refresh-plans-error'
            });
            return [];
        }
    }
    processExternalResponse(externalPlan, userProfile) {
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const mealTypes = ['Breakfast', 'Snack 1', 'Lunch', 'Snack 2', 'Dinner'];
        const mealOrder = { 'Breakfast': 1, 'Snack 1': 2, 'Lunch': 3, 'Snack 2': 4, 'Dinner': 5 };
        const mealPlan = externalPlan.meal_plan.map((dayPlan) => ({
            day: dayPlan.day,
            dayName: dayNames[dayPlan.day - 1],
            meals: mealTypes.map(mealType => ({
                mealType,
                mealDescription: dayPlan.meals[mealType] || '',
                shortName: dayPlan.short_names[mealType] || '',
                calories: dayPlan.calories[mealType] || 0,
                mealOrder: mealOrder[mealType] || 1
            })).filter(meal => meal.mealDescription)
        }));
        return {
            planId: `diet-plan-${Date.now()}`,
            planName: `Personalized Diet Plan - ${userProfile.goal.replace('_', ' ')}`,
            targetWeightKg: parseFloat(externalPlan.target_weight),
            totalMacros: {
                calories: externalPlan.macros['Total Calories'],
                carbs: externalPlan.macros['Total Carbs'],
                protein: externalPlan.macros['Total Protein'],
                fat: externalPlan.macros['Total Fat'],
                fiber: externalPlan.macros['Total Fiber']
            },
            mealPlan,
            source: 'external',
            cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
            lastRefreshed: new Date(),
            nextRefreshDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        };
    }
    formatDietPlanResponse(dietPlan) {
        return {
            planId: dietPlan._id.toString(),
            planName: dietPlan.planName,
            targetWeightKg: dietPlan.targetWeightKg,
            totalMacros: dietPlan.totalMacros,
            mealPlan: dietPlan.mealPlan,
            source: 'external',
            cacheExpiry: dietPlan.cacheExpiry || new Date(),
            lastRefreshed: dietPlan.lastRefreshed || new Date(),
            nextRefreshDate: dietPlan.nextRefreshDate || new Date()
        };
    }
    async cacheInRedis(userId, dietPlan) {
        try {
            const client = redis_1.redis.getClient();
            const cacheKey = `${external_apis_config_1.externalApiCacheConfig.keyPrefixes.dietPlans}user:${userId}`;
            const formattedPlan = this.formatDietPlanResponse(dietPlan);
            await client.setEx(cacheKey, external_apis_config_1.externalApiCacheConfig.ttl.dietPlans, JSON.stringify(formattedPlan));
            logger_1.logger.debug('Diet plan cached in Redis', {
                service: 'diet-plan-cache-service',
                userId,
                cacheKey,
                ttl: external_apis_config_1.externalApiCacheConfig.ttl.dietPlans,
                event: 'redis-cache-set'
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to cache diet plan in Redis', error, {
                service: 'diet-plan-cache-service',
                userId,
                event: 'redis-cache-error'
            });
        }
    }
    async getFromRedisCache(userId) {
        try {
            const client = redis_1.redis.getClient();
            const cacheKey = `${external_apis_config_1.externalApiCacheConfig.keyPrefixes.dietPlans}user:${userId}`;
            const cached = await client.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (new Date(parsed.cacheExpiry) > new Date()) {
                    return parsed;
                }
                else {
                    await client.del(cacheKey);
                    logger_1.logger.debug('Expired diet plan removed from Redis cache', {
                        service: 'diet-plan-cache-service',
                        userId,
                        cacheKey,
                        event: 'redis-cache-expired'
                    });
                }
            }
            return null;
        }
        catch (error) {
            logger_1.logger.error('Failed to get diet plan from Redis cache', error, {
                service: 'diet-plan-cache-service',
                userId,
                event: 'redis-cache-get-error'
            });
            return null;
        }
    }
}
exports.DietPlanCacheService = DietPlanCacheService;
exports.dietPlanCacheService = new DietPlanCacheService();
//# sourceMappingURL=diet-plan-cache.service.js.map