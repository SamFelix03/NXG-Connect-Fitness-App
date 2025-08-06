import { RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { mealCacheService, MealCacheService } from './meal-cache.service';

jest.mock('redis');
jest.mock('../utils/logger');

describe('MealCacheService', () => {
  let mockRedisClient: jest.Mocked<RedisClientType>;
  let service: MealCacheService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock Redis client
    mockRedisClient = {
      setEx: jest.fn(),
      get: jest.fn(),
      sAdd: jest.fn(),
      sMembers: jest.fn(),
      exists: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
      sRem: jest.fn()
    } as any;

    // Create service instance with mocked redis
    service = new MealCacheService();
    (service as any).redis = { getClient: () => mockRedisClient };
  });

  describe('generateMealId', () => {
    it('should generate unique meal ID with user prefix', () => {
      const userId = 'user123';
      const mealId = service.generateMealId(userId);
      
      expect(mealId).toMatch(/^user123_meal_\d{13}$/);
    });

    it('should generate different IDs for different users', () => {
      const mealId1 = service.generateMealId('user1');
      const mealId2 = service.generateMealId('user2');
      
      expect(mealId1).toContain('user1_meal_');
      expect(mealId2).toContain('user2_meal_');
      expect(mealId1).not.toBe(mealId2);
    });
  });

  describe('cacheMeal', () => {
    const testMeal = {
      mealId: 'user123_meal_1234567890123',
      userId: 'user123',
      imageUrl: 'https://example.com/meal.jpg',
      foods: [
        {
          name: 'Apple',
          description: 'Fresh apple',
          quantity: 1,
          unit: 'piece',
          nutrition: {
            calories: 95,
            carbs: 25,
            fat: 0.3,
            protein: 0.5,
            fiber: 4
          }
        }
      ],
      totalNutrition: {
        calories: 95,
        carbs: 25,
        fat: 0.3,
        protein: 0.5,
        fiber: 4
      },
      detectedAt: new Date(),
      correctionCount: 0,
      isVerified: false
    };

    it('should cache meal data successfully', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.sAdd.mockResolvedValue(1);

      await service.cacheMeal(testMeal);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        `meal:${testMeal.mealId}`,
        86400, // 24 hours TTL
        JSON.stringify(testMeal)
      );

      expect(mockRedisClient.sAdd).toHaveBeenCalledWith(
        `user_meals:${testMeal.userId}`,
        testMeal.mealId
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.cacheMeal(testMeal)).rejects.toThrow('Failed to cache meal');
    });

    it('should validate required meal properties', async () => {
      const invalidMeal = { ...testMeal, mealId: '' };

      await expect(service.cacheMeal(invalidMeal as any)).rejects.toThrow('Meal ID is required');
    });

    it('should validate nutrition data', async () => {
      const invalidMeal = {
        ...testMeal,
        totalNutrition: { ...testMeal.totalNutrition, calories: -1 }
      };

      await expect(service.cacheMeal(invalidMeal)).rejects.toThrow('Invalid nutrition data');
    });
  });

  describe('getCachedMeal', () => {
    const testMealData = {
      mealId: 'user123_meal_1234567890123',
      userId: 'user123',
      imageUrl: 'https://example.com/meal.jpg',
      foods: [],
      totalNutrition: { calories: 95, carbs: 25, fat: 0.3, protein: 0.5, fiber: 4 },
      detectedAt: '2023-01-01T10:00:00Z',
      correctionCount: 0,
      isVerified: false
    };

    it('should retrieve cached meal successfully', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testMealData));

      const result = await service.getCachedMeal('user123_meal_1234567890123');

      expect(result).toEqual({
        ...testMealData,
        detectedAt: new Date(testMealData.detectedAt)
      });
      expect(mockRedisClient.get).toHaveBeenCalledWith('meal:user123_meal_1234567890123');
    });

    it('should return null for non-existent meal', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getCachedMeal('non-existent');

      expect(result).toBeNull();
    });

    it('should handle corrupted JSON data', async () => {
      mockRedisClient.get.mockResolvedValue('invalid-json');

      const result = await service.getCachedMeal('corrupted');

      expect(result).toBeNull();
    });

    it('should validate meal ID parameter', async () => {
      await expect(service.getCachedMeal('')).rejects.toThrow('Meal ID is required');
    });
  });

  describe('getUserMeals', () => {
    const mockMealIds = ['meal1', 'meal2', 'meal3'];
    const mockMealData = {
      mealId: 'meal1',
      userId: 'user123',
      foods: [],
      totalNutrition: { calories: 100, carbs: 0, fat: 0, protein: 0, fiber: 0 },
      detectedAt: '2023-01-01T10:00:00Z'
    };

    it('should retrieve user meals successfully', async () => {
      mockRedisClient.sMembers.mockResolvedValue(mockMealIds);
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockMealData));

      const result = await service.getUserMeals('user123', 10);

      expect(result).toHaveLength(3);
      expect(mockRedisClient.sMembers).toHaveBeenCalledWith('user_meals:user123');
    });

    it('should respect limit parameter', async () => {
      mockRedisClient.sMembers.mockResolvedValue(mockMealIds);
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockMealData));

      await service.getUserMeals('user123', 2);

      // Should only fetch limited number of meals
      expect(mockRedisClient.get).toHaveBeenCalledTimes(2);
    });

    it('should handle empty meal list', async () => {
      mockRedisClient.sMembers.mockResolvedValue([]);

      const result = await service.getUserMeals('user123', 10);

      expect(result).toEqual([]);
    });

    it('should filter out corrupted meal data', async () => {
      mockRedisClient.sMembers.mockResolvedValue(['meal1', 'meal2']);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(mockMealData))
        .mockResolvedValueOnce('invalid-json');

      const result = await service.getUserMeals('user123', 10);

      expect(result).toHaveLength(1);
    });

    it('should validate user ID parameter', async () => {
      await expect(service.getUserMeals('', 10)).rejects.toThrow('User ID is required');
    });

    it('should validate limit parameter', async () => {
      await expect(service.getUserMeals('user123', 0)).rejects.toThrow('Limit must be greater than 0');
      await expect(service.getUserMeals('user123', 101)).rejects.toThrow('Limit cannot exceed 100');
    });
  });

  describe('updateMealAfterCorrection', () => {
    const existingMeal = {
      mealId: 'meal123',
      userId: 'user123',
      foods: [],
      totalNutrition: { calories: 100, carbs: 0, fat: 0, protein: 0, fiber: 0 },
      detectedAt: new Date(),
      correctionCount: 0,
      isVerified: false
    };

    const correctionData = {
      foods: [
        {
          name: 'Corrected Food',
          nutrition: { calories: 150, carbs: 10, fat: 5, protein: 15, fiber: 2 }
        }
      ],
      totalNutrition: { calories: 150, carbs: 10, fat: 5, protein: 15, fiber: 2 },
      correctionCount: 1,
      isVerified: true,
      lastCorrectedAt: new Date()
    };

    it('should update meal after correction', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existingMeal));
      mockRedisClient.setEx.mockResolvedValue('OK');

      await service.updateMealAfterCorrection('meal123', correctionData);

      const expectedUpdatedMeal = {
        ...existingMeal,
        ...correctionData
      };

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'meal:meal123',
        86400,
        JSON.stringify(expectedUpdatedMeal)
      );
    });

    it('should throw error if meal not found', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(service.updateMealAfterCorrection('non-existent', correctionData))
        .rejects.toThrow('Meal not found in cache');
    });

    it('should validate meal ID parameter', async () => {
      await expect(service.updateMealAfterCorrection('', correctionData))
        .rejects.toThrow('Meal ID is required');
    });

    it('should validate correction data', async () => {
      await expect(service.updateMealAfterCorrection('meal123', {} as any))
        .rejects.toThrow('Correction data is required');
    });

    it('should handle Redis update errors', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existingMeal));
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));

      await expect(service.updateMealAfterCorrection('meal123', correctionData))
        .rejects.toThrow('Failed to update meal in cache');
    });
  });

  describe('deleteMeal', () => {
    it('should delete meal from cache and user set', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.sRem.mockResolvedValue(1);

      await service.deleteMeal('meal123', 'user123');

      expect(mockRedisClient.del).toHaveBeenCalledWith('meal:meal123');
      expect(mockRedisClient.sRem).toHaveBeenCalledWith('user_meals:user123', 'meal123');
    });

    it('should handle deletion of non-existent meal', async () => {
      mockRedisClient.del.mockResolvedValue(0);

      await expect(service.deleteMeal('non-existent', 'user123'))
        .rejects.toThrow('Meal not found');
    });
  });

  describe('clearUserMeals', () => {
    it('should clear all meals for a user', async () => {
      const userMealIds = ['meal1', 'meal2', 'meal3'];
      mockRedisClient.sMembers.mockResolvedValue(userMealIds);
      mockRedisClient.del.mockResolvedValue(1);

      const deletedCount = await service.clearUserMeals('user123');

      expect(deletedCount).toBe(3);
      expect(mockRedisClient.del).toHaveBeenCalledTimes(4); // 3 meals + 1 user set
    });

    it('should handle empty user meal set', async () => {
      mockRedisClient.sMembers.mockResolvedValue([]);

      const deletedCount = await service.clearUserMeals('user123');

      expect(deletedCount).toBe(0);
    });
  });

  describe('getMealStats', () => {
    it('should return meal statistics for user', async () => {
      const mockMeals = [
        {
          totalNutrition: { calories: 300, carbs: 30, fat: 10, protein: 20, fiber: 5 },
          detectedAt: '2023-01-01T10:00:00Z',
          isVerified: true
        },
        {
          totalNutrition: { calories: 200, carbs: 25, fat: 8, protein: 15, fiber: 3 },
          detectedAt: '2023-01-02T10:00:00Z',
          isVerified: false
        }
      ];

      mockRedisClient.sMembers.mockResolvedValue(['meal1', 'meal2']);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(mockMeals[0]))
        .mockResolvedValueOnce(JSON.stringify(mockMeals[1]));

      const stats = await service.getMealStats('user123');

      expect(stats).toEqual({
        totalMeals: 2,
        verifiedMeals: 1,
        totalCalories: 500,
        avgCaloriesPerMeal: 250,
        avgMacros: {
          carbs: 27.5,
          fat: 9,
          protein: 17.5,
          fiber: 4
        },
        dateRange: {
          oldest: new Date(mockMeals[0].detectedAt),
          newest: new Date(mockMeals[1].detectedAt)
        }
      });
    });

    it('should handle user with no meals', async () => {
      mockRedisClient.sMembers.mockResolvedValue([]);

      const stats = await service.getMealStats('user123');

      expect(stats).toEqual({
        totalMeals: 0,
        verifiedMeals: 0,
        totalCalories: 0,
        avgCaloriesPerMeal: 0,
        avgMacros: { carbs: 0, fat: 0, protein: 0, fiber: 0 },
        dateRange: { oldest: null, newest: null }
      });
    });
  });

  describe('error handling and logging', () => {
    it('should log cache operations', async () => {
      const testMeal = {
        mealId: 'test',
        userId: 'user123',
        foods: [],
        totalNutrition: { calories: 100, carbs: 0, fat: 0, protein: 0, fiber: 0 },
        detectedAt: new Date(),
        correctionCount: 0,
        isVerified: false
      };

      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.sAdd.mockResolvedValue(1);

      await service.cacheMeal(testMeal);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Meal cached successfully'),
        expect.objectContaining({
          service: 'meal-cache-service',
          mealId: testMeal.mealId,
          userId: testMeal.userId
        })
      );
    });

    it('should log errors appropriately', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Connection failed'));

      await expect(service.getCachedMeal('test')).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get cached meal'),
        expect.any(Error),
        expect.objectContaining({
          service: 'meal-cache-service',
          mealId: 'test'
        })
      );
    });
  });
});