import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { redis } from '../utils/redis';
import { DietPlan, IDietPlan } from '../models/DietPlan';
import { User } from '../models/User';
import { dietPlanningService } from './external/diet-planning.service';
import { externalApiCacheConfig } from '../config/external-apis.config';

/**
 * Diet Plan Cache Management Service
 * 
 * This service manages diet plan caching and ensures single active plan per user:
 * 1. Enforce single active diet plan per user
 * 2. Manage MongoDB and Redis caching layers
 * 3. Handle cache expiration and refresh logic
 * 4. Integrate with external diet planning service
 */

export interface CreateDietPlanInput {
  userId: string;
  userProfile: {
    goal: string;
    age: number;
    heightCm: number;
    weightKg: number;
    targetWeightKg?: number;
    gender: string;
    activityLevel: string;
    allergies?: string[];
    healthConditions?: string[];
  };
  dietPreferences?: {
    cuisinePreferences?: Record<string, string[]>;
  };
  forceRefresh?: boolean;
}

export interface ProcessedDietPlan {
  planId: string;
  planName: string;
  targetWeightKg: number;
  totalMacros: {
    calories: string;
    carbs: string;
    protein: string;
    fat: string;
    fiber: string;
  };
  mealPlan: Array<{
    day: number;
    dayName: string;
    meals: Array<{
      mealType: string;
      mealDescription: string;
      shortName: string;
      calories: number;
      mealOrder: number;
    }>;
  }>;
  source: 'external';
  cacheExpiry: Date;
  lastRefreshed: Date;
  nextRefreshDate: Date;
}

export class DietPlanCacheService {
  /**
   * Create or refresh a single active diet plan for a user
   */
  async createOrRefreshDietPlan(input: CreateDietPlanInput): Promise<ProcessedDietPlan> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      logger.info('Creating/refreshing diet plan for user', {
        service: 'diet-plan-cache-service',
        userId: input.userId,
        forceRefresh: input.forceRefresh,
        event: 'create-diet-plan-start'
      });

      // Check if user exists and get current active plan
      const user = await User.findById(input.userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      // Check for existing active plan
      let existingPlan = null;
      if (user.activePlans?.dietPlanId) {
        existingPlan = await DietPlan.findById(user.activePlans.dietPlanId).session(session);
      }

      // Check if we need to create a new plan
      const shouldCreateNew = input.forceRefresh || 
                             !existingPlan || 
                             !existingPlan.isActive || 
                             (existingPlan as any).isExpired() || 
                             (existingPlan as any).needsRefresh();

      if (!shouldCreateNew && existingPlan) {
        logger.info('Returning existing active diet plan', {
          service: 'diet-plan-cache-service',
          userId: input.userId,
          planId: existingPlan._id.toString(),
          event: 'existing-plan-returned'
        });
        
        await session.commitTransaction();
        return this.formatDietPlanResponse(existingPlan);
      }

      // Deactivate all existing plans for this user (enforce single active plan)
      await DietPlan.updateMany(
        { userId: input.userId, isActive: true },
        { 
          $set: { 
            isActive: false, 
            updatedAt: new Date() 
          } 
        }
      ).session(session);

      // Call external service to get new diet plan
      const dietPlanInput: any = {
        userId: input.userId,
        userProfile: input.userProfile
      };
      
      if (input.dietPreferences) {
        dietPlanInput.dietPreferences = input.dietPreferences;
      }
      
      const externalPlan = await dietPlanningService.createDietPlan(dietPlanInput);

      // Process and store the new plan
      const processedPlan = this.processExternalResponse(externalPlan, input.userProfile);
      
      // Create new diet plan document
      const now = new Date();
      const newDietPlan = new DietPlan({
        userId: input.userId,
        planName: processedPlan.planName,
        targetWeightKg: processedPlan.targetWeightKg,
        source: 'external',
        isActive: true,
        totalMacros: processedPlan.totalMacros,
        mealPlan: processedPlan.mealPlan,
        lastRefreshed: now,
        nextRefreshDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
        cacheExpiry: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours from now
      });

      const savedPlan = await newDietPlan.save({ session });

      // Update user's active plans
      await User.findByIdAndUpdate(
        input.userId,
        {
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
        },
        { session }
      );

      // Cache in Redis for quick access
      await this.cacheInRedis(input.userId, savedPlan);

      await session.commitTransaction();

      logger.info('Diet plan created successfully', {
        service: 'diet-plan-cache-service',
        userId: input.userId,
        planId: savedPlan._id.toString(),
        planName: savedPlan.planName,
        targetWeight: savedPlan.targetWeightKg,
        mealPlanDays: savedPlan.mealPlan.length,
        event: 'create-diet-plan-success'
      });

      return this.formatDietPlanResponse(savedPlan);

    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Failed to create/refresh diet plan', error as Error, {
        service: 'diet-plan-cache-service',
        userId: input.userId,
        event: 'create-diet-plan-error'
      });
      
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get user's active diet plan with fallback mechanisms
   */
  async getUserActiveDietPlan(userId: string): Promise<ProcessedDietPlan | null> {
    try {
      logger.info('Fetching active diet plan for user', {
        service: 'diet-plan-cache-service',
        userId,
        event: 'get-active-plan-start'
      });

      // Try Redis cache first
      const cached = await this.getFromRedisCache(userId);
      if (cached) {
        logger.info('Returning cached diet plan from Redis', {
          service: 'diet-plan-cache-service',
          userId,
          event: 'redis-cache-hit'
        });
        return cached;
      }

      // Fallback to MongoDB
      const user = await User.findById(userId);
      if (!user || !user.activePlans?.dietPlanId) {
        logger.info('No active diet plan found for user', {
          service: 'diet-plan-cache-service',
          userId,
          event: 'no-active-plan'
        });
        return null;
      }

      const activePlan = await DietPlan.findById(user.activePlans.dietPlanId);
      if (!activePlan || !activePlan.isActive) {
        logger.warn('Active plan ID exists but plan not found or inactive', {
          service: 'diet-plan-cache-service',
          userId,
          planId: user.activePlans.dietPlanId?.toString(),
          event: 'plan-not-found'
        });
        return null;
      }

      // Cache in Redis for future requests
      await this.cacheInRedis(userId, activePlan);

      logger.info('Returning active diet plan from MongoDB', {
        service: 'diet-plan-cache-service',
        userId,
        planId: activePlan._id.toString(),
        event: 'mongodb-plan-returned'
      });

      return this.formatDietPlanResponse(activePlan);

    } catch (error) {
      logger.error('Failed to get active diet plan', error as Error, {
        service: 'diet-plan-cache-service',
        userId,
        event: 'get-active-plan-error'
      });
      
      return null;
    }
  }

  /**
   * Get specific day's meals from user's active plan
   */
  async getDayMeals(userId: string, dayNumber: number): Promise<any> {
    try {
      const activePlan = await this.getUserActiveDietPlan(userId);
      if (!activePlan) {
        return null;
      }

      const dayPlan = activePlan.mealPlan.find(day => day.day === dayNumber);
      if (!dayPlan) {
        logger.warn('Day not found in meal plan', {
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

    } catch (error) {
      logger.error('Failed to get day meals', error as Error, {
        service: 'diet-plan-cache-service',
        userId,
        dayNumber,
        event: 'get-day-meals-error'
      });
      
      return null;
    }
  }

  /**
   * Find plans that need refresh (background job helper)
   */
  async findPlansNeedingRefresh(): Promise<IDietPlan[]> {
    try {
      const plans = await DietPlan.find({
        isActive: true,
        nextRefreshDate: { $lte: new Date() }
      }).populate('userId');

      logger.info('Found plans needing refresh', {
        service: 'diet-plan-cache-service',
        planCount: plans.length,
        event: 'plans-needing-refresh'
      });

      return plans;
    } catch (error) {
      logger.error('Failed to find plans needing refresh', error as Error, {
        service: 'diet-plan-cache-service',
        event: 'find-refresh-plans-error'
      });
      
      return [];
    }
  }

  /**
   * Process external API response into our format
   */
  private processExternalResponse(externalPlan: any, userProfile: any): ProcessedDietPlan {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const mealTypes = ['Breakfast', 'Snack 1', 'Lunch', 'Snack 2', 'Dinner'];
    const mealOrder: Record<string, number> = { 'Breakfast': 1, 'Snack 1': 2, 'Lunch': 3, 'Snack 2': 4, 'Dinner': 5 };

    const mealPlan = externalPlan.meal_plan.map((dayPlan: any) => ({
      day: dayPlan.day,
      dayName: dayNames[dayPlan.day - 1],
      meals: mealTypes.map(mealType => ({
        mealType,
        mealDescription: dayPlan.meals[mealType] || '',
        shortName: dayPlan.short_names[mealType] || '',
        calories: dayPlan.calories[mealType] || 0,
        mealOrder: mealOrder[mealType] || 1
      })).filter(meal => meal.mealDescription) // Remove empty meals
    }));

    return {
      planId: `diet-plan-${Date.now()}`, // Generate unique ID
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
      source: 'external' as const,
      cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      lastRefreshed: new Date(),
      nextRefreshDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 2 weeks
    };
  }

  /**
   * Format diet plan for API response
   */
  private formatDietPlanResponse(dietPlan: IDietPlan): ProcessedDietPlan {
    return {
      planId: dietPlan._id.toString(),
      planName: dietPlan.planName,
      targetWeightKg: dietPlan.targetWeightKg,
      totalMacros: dietPlan.totalMacros,
      mealPlan: dietPlan.mealPlan,
      source: 'external' as const,
      cacheExpiry: dietPlan.cacheExpiry || new Date(),
      lastRefreshed: dietPlan.lastRefreshed || new Date(),
      nextRefreshDate: dietPlan.nextRefreshDate || new Date()
    };
  }

  /**
   * Redis caching methods
   */
  private async cacheInRedis(userId: string, dietPlan: IDietPlan): Promise<void> {
    try {
      const client = redis.getClient();
      const cacheKey = `${externalApiCacheConfig.keyPrefixes.dietPlans}user:${userId}`;
      const formattedPlan = this.formatDietPlanResponse(dietPlan);
      
      await client.setEx(
        cacheKey, 
        externalApiCacheConfig.ttl.dietPlans, 
        JSON.stringify(formattedPlan)
      );
      
      logger.debug('Diet plan cached in Redis', {
        service: 'diet-plan-cache-service',
        userId,
        cacheKey,
        ttl: externalApiCacheConfig.ttl.dietPlans,
        event: 'redis-cache-set'
      });
    } catch (error) {
      logger.error('Failed to cache diet plan in Redis', error as Error, {
        service: 'diet-plan-cache-service',
        userId,
        event: 'redis-cache-error'
      });
    }
  }

  private async getFromRedisCache(userId: string): Promise<ProcessedDietPlan | null> {
    try {
      const client = redis.getClient();
      const cacheKey = `${externalApiCacheConfig.keyPrefixes.dietPlans}user:${userId}`;
      const cached = await client.get(cacheKey);
      
      if (cached) {
        const parsed = JSON.parse(cached);
        // Check if cache is still valid
        if (new Date(parsed.cacheExpiry) > new Date()) {
          return parsed;
        } else {
          // Remove expired cache
          await client.del(cacheKey);
          logger.debug('Expired diet plan removed from Redis cache', {
            service: 'diet-plan-cache-service',
            userId,
            cacheKey,
            event: 'redis-cache-expired'
          });
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get diet plan from Redis cache', error as Error, {
        service: 'diet-plan-cache-service',
        userId,
        event: 'redis-cache-get-error'
      });
      return null;
    }
  }
}

// Export singleton instance
export const dietPlanCacheService = new DietPlanCacheService();