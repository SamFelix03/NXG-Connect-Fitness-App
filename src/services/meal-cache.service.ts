import { redis } from '../utils/redis';
import { logger } from '../utils/logger';
import { MealDetectionFood } from './external/meal-detection.service';

/**
 * Meal Cache Service
 * 
 * This service manages meal detection caching for frequently accessed meals:
 * 1. Cache meal detection results with Redis
 * 2. Manage cache expiration for meal data
 * 3. Optimize performance for repeated meal queries
 * 4. Handle cache invalidation for corrected meals
 */

export interface CachedMeal {
  mealId: string;
  userId: string;
  imageUrl: string;
  foods: MealDetectionFood[];
  totalNutrition: {
    calories: number;
    carbs: number;
    fat: number;
    protein: number;
    fiber: number;
  };
  detectedAt: Date;
  correctionCount: number;
  isVerified: boolean;
}

class MealCacheService {
  private readonly cacheKeyPrefix = 'meal:';
  private readonly userMealsKeyPrefix = 'user_meals:';
  private readonly defaultTTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly frequentMealTTL = 7 * 24 * 60 * 60; // 7 days for frequently accessed

  /**
   * Cache a meal detection result
   */
  async cacheMeal(mealData: CachedMeal): Promise<void> {
    try {
      const client = redis.getClient();
      const mealKey = `${this.cacheKeyPrefix}${mealData.mealId}`;
      const userMealsKey = `${this.userMealsKeyPrefix}${mealData.userId}`;

      // Cache the meal data
      await client.setEx(mealKey, this.defaultTTL, JSON.stringify(mealData));

      // Add to user's meal list (for quick retrieval)
      await client.sAdd(userMealsKey, mealData.mealId);
      await client.expire(userMealsKey, this.defaultTTL);

      logger.info('Meal cached successfully', {
        mealId: mealData.mealId,
        userId: mealData.userId,
        calories: mealData.totalNutrition.calories,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to cache meal', error as Error, {
        service: 'meal-cache-service',
        mealId: mealData.mealId,
        userId: mealData.userId
      });
      throw error;
    }
  }

  /**
   * Get cached meal by ID
   */
  async getCachedMeal(mealId: string): Promise<CachedMeal | null> {
    try {
      const client = redis.getClient();
      const mealKey = `${this.cacheKeyPrefix}${mealId}`;
      const cached = await client.get(mealKey);

      if (!cached) {
        return null;
      }

      const mealData: CachedMeal = JSON.parse(cached);
      
      // Extend TTL for frequently accessed meals
      await this.extendTTLForFrequentAccess(mealId);

      logger.info('Meal retrieved from cache', {
        mealId,
        userId: mealData.userId,
        timestamp: new Date().toISOString()
      });

      return mealData;
    } catch (error) {
      logger.error('Failed to retrieve cached meal', error as Error, {
        service: 'meal-cache-service',
        mealId
      });
      return null;
    }
  }

  /**
   * Get all cached meals for a user
   */
  async getUserMeals(userId: string, limit: number = 50): Promise<CachedMeal[]> {
    try {
      const client = redis.getClient();
      const userMealsKey = `${this.userMealsKeyPrefix}${userId}`;
      const mealIds = await client.sMembers(userMealsKey);

      if (mealIds.length === 0) {
        return [];
      }

      // Get meals in parallel with limit
      const limitedMealIds = mealIds.slice(0, limit);
      const mealPromises = limitedMealIds.map((mealId: string) => this.getCachedMeal(mealId));
      const meals = await Promise.all(mealPromises);

      // Filter out null results and sort by detection date
      const validMeals = meals
        .filter((meal: CachedMeal | null): meal is CachedMeal => meal !== null)
        .sort((a: CachedMeal, b: CachedMeal) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

      logger.info('Retrieved user meals from cache', {
        userId,
        mealCount: validMeals.length,
        timestamp: new Date().toISOString()
      });

      return validMeals;
    } catch (error) {
      logger.error('Failed to retrieve user meals from cache', error as Error, {
        service: 'meal-cache-service',
        userId
      });
      return [];
    }
  }

  /**
   * Update cached meal after correction
   */
  async updateMealAfterCorrection(mealId: string, correctedData: {
    foods: MealDetectionFood[];
    totalNutrition: CachedMeal['totalNutrition'];
    correctionCount: number;
  }): Promise<void> {
    try {
      const existingMeal = await this.getCachedMeal(mealId);
      if (!existingMeal) {
        logger.warn('Meal not found in cache for correction update', { mealId });
        return;
      }

      const updatedMeal: CachedMeal = {
        ...existingMeal,
        foods: correctedData.foods,
        totalNutrition: correctedData.totalNutrition,
        correctionCount: correctedData.correctionCount
      };

      await this.cacheMeal(updatedMeal);

      logger.info('Meal updated after correction', {
        mealId,
        userId: existingMeal.userId,
        correctionCount: correctedData.correctionCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to update meal after correction', error as Error, {
        service: 'meal-cache-service',
        mealId
      });
      throw error;
    }
  }

  /**
   * Remove meal from cache
   */
  async removeMeal(mealId: string, userId: string): Promise<void> {
    try {
      const client = redis.getClient();
      const mealKey = `${this.cacheKeyPrefix}${mealId}`;
      const userMealsKey = `${this.userMealsKeyPrefix}${userId}`;

      // Remove meal data
      await client.del(mealKey);
      
      // Remove from user's meal list
      await client.sRem(userMealsKey, mealId);

      logger.info('Meal removed from cache', {
        mealId,
        userId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to remove meal from cache', error as Error, {
        service: 'meal-cache-service',
        mealId,
        userId
      });
      throw error;
    }
  }

  /**
   * Clear all cached meals for a user
   */
  async clearUserMeals(userId: string): Promise<void> {
    try {
      const client = redis.getClient();
      const userMealsKey = `${this.userMealsKeyPrefix}${userId}`;
      const mealIds = await client.sMembers(userMealsKey);

      if (mealIds.length > 0) {
        // Remove all meal data
        const mealKeys = mealIds.map((mealId: string) => `${this.cacheKeyPrefix}${mealId}`);
        await client.del(mealKeys);
      }

      // Remove user's meal list
      await client.del(userMealsKey);

      logger.info('All user meals cleared from cache', {
        userId,
        mealCount: mealIds.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to clear user meals from cache', error as Error, {
        service: 'meal-cache-service',
        userId
      });
      throw error;
    }
  }

  /**
   * Get cache statistics for a user
   */
  async getCacheStats(userId: string): Promise<{
    totalMeals: number;
    verifiedMeals: number;
    avgCorrectionCount: number;
  }> {
    try {
      const meals = await this.getUserMeals(userId);
      
      const stats = {
        totalMeals: meals.length,
        verifiedMeals: meals.filter(meal => meal.isVerified).length,
        avgCorrectionCount: meals.length > 0 
          ? meals.reduce((sum, meal) => sum + meal.correctionCount, 0) / meals.length 
          : 0
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get cache statistics', error as Error, {
        service: 'meal-cache-service',
        userId
      });
      return { totalMeals: 0, verifiedMeals: 0, avgCorrectionCount: 0 };
    }
  }

  /**
   * Extend TTL for frequently accessed meals
   */
  private async extendTTLForFrequentAccess(mealId: string): Promise<void> {
    try {
      const client = redis.getClient();
      const mealKey = `${this.cacheKeyPrefix}${mealId}`;
      const currentTTL = await client.ttl(mealKey);
      
      // If TTL is less than half of default, extend it
      if (currentTTL > 0 && currentTTL < this.defaultTTL / 2) {
        await client.expire(mealKey, this.frequentMealTTL);
        
        logger.debug('Extended TTL for frequently accessed meal', {
          mealId,
          newTTL: this.frequentMealTTL,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Failed to extend TTL for meal', error as Error, {
        service: 'meal-cache-service',
        mealId
      });
    }
  }

  /**
   * Generate a unique meal ID
   */
  generateMealId(userId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `meal_${userId}_${timestamp}_${random}`;
  }
}

export const mealCacheService = new MealCacheService();
export default MealCacheService;