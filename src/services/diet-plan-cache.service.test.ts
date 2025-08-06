import { DietPlanCacheService } from './diet-plan-cache.service';
import { DietPlan } from '../models/DietPlan';
import { User } from '../models/User';
import { dietPlanningService } from './external/diet-planning.service';
import { redis } from '../utils/redis';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../models/DietPlan');
jest.mock('../models/User');
jest.mock('./external/diet-planning.service');
jest.mock('../utils/redis');
jest.mock('../utils/logger');
jest.mock('mongoose');

const mockDietPlan = DietPlan as jest.Mocked<typeof DietPlan>;
const mockUser = User as jest.Mocked<typeof User>;
const mockDietPlanningService = dietPlanningService as jest.Mocked<typeof dietPlanningService>;
const mockRedis = {
  getClient: jest.fn().mockReturnValue({
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn()
  })
};

(redis as jest.Mocked<typeof redis>) = mockRedis as any;

describe('DietPlanCacheService', () => {
  let service: DietPlanCacheService;
  let mockSession: any;

  const mockUserData = {
    _id: 'user123',
    fitnessProfile: {
      goal: 'weight_loss',
      healthConditions: []
    },
    demographics: {
      age: 25,
      heightCm: 175,
      weightKg: 75,
      targetWeightKg: 70,
      gender: 'Male',
      activityLevel: 'moderately_active',
      allergies: []
    },
    dietPreferences: {
      cuisinePreferences: {
        Indian: ['Non-Veg', 'Veg']
      }
    },
    activePlans: {}
  };

  const mockExternalPlanResponse = {
    target_weight: "70.0",
    macros: {
      "Total Calories": "1800",
      "Total Carbs": "200g",
      "Total Protein": "120g",
      "Total Fat": "60g",
      "Total Fiber": "25g"
    },
    meal_plan: [
      {
        day: 1,
        meals: {
          "Breakfast": "150g Rava Dosa with 100ml Tomato Chutney",
          "Lunch": "150g Kaima Rice with 150g Vegetable Curry",
          "Dinner": "2 pieces Appam with 150g Egg Roast"
        },
        calories: {
          "Breakfast": 350,
          "Lunch": 550,
          "Dinner": 657
        },
        short_names: {
          "Breakfast": "Rava Dosa, Tomato Chutney",
          "Lunch": "Kaima Rice, Vegetable Curry",
          "Dinner": "Appam, Egg Roast"
        }
      }
    ]
  };

  const mockDietPlanDocument = {
    _id: 'plan123',
    userId: 'user123',
    planName: 'Personalized Diet Plan - weight loss',
    targetWeightKg: 70,
    source: 'external',
    isActive: true,
    totalMacros: {
      calories: "1800",
      carbs: "200g",
      protein: "120g",
      fat: "60g",
      fiber: "25g"
    },
    mealPlan: [
      {
        day: 1,
        dayName: 'Monday',
        meals: [
          {
            mealType: 'Breakfast',
            mealDescription: '150g Rava Dosa with 100ml Tomato Chutney',
            shortName: 'Rava Dosa, Tomato Chutney',
            calories: 350,
            mealOrder: 1
          }
        ]
      }
    ],
    cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    lastRefreshed: new Date(),
    nextRefreshDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    isExpired: jest.fn().mockReturnValue(false),
    needsRefresh: jest.fn().mockReturnValue(false),
    save: jest.fn().mockResolvedValue(undefined),
    toObject: jest.fn().mockReturnValue({})
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    service = new DietPlanCacheService();

    // Mock mongoose session
    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn()
    };

    (mongoose.startSession as jest.Mock).mockResolvedValue(mockSession);
  });

  describe('createOrRefreshDietPlan', () => {
    it('should create new diet plan when none exists', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserData.demographics,
        dietPreferences: mockUserData.dietPreferences,
        forceRefresh: false
      };

      mockUser.findById.mockResolvedValue(mockUserData as any);
      mockDietPlan.updateMany.mockResolvedValue({ acknowledged: true } as any);
      mockUser.findByIdAndUpdate.mockResolvedValue(mockUserData as any);
      mockDietPlanningService.createDietPlan.mockResolvedValue(mockExternalPlanResponse);
      
      const mockNewPlan = {
        ...mockDietPlanDocument,
        save: jest.fn().mockResolvedValue(mockDietPlanDocument)
      };
      
      (mockDietPlan as any).mockImplementation(() => mockNewPlan);

      // Act
      const result = await service.createOrRefreshDietPlan(input);

      // Assert
      expect(mockUser.findById).toHaveBeenCalledWith('user123');
      expect(mockDietPlanningService.createDietPlan).toHaveBeenCalled();
      expect(mockNewPlan.save).toHaveBeenCalled();
      expect(mockUser.findByIdAndUpdate).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.planName).toContain('weight loss');
    });

    it('should return existing plan when valid and not forcing refresh', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserData.demographics,
        dietPreferences: mockUserData.dietPreferences,
        forceRefresh: false
      };

      const userWithActivePlan = {
        ...mockUserData,
        activePlans: { dietPlanId: 'plan123' }
      };

      mockUser.findById.mockResolvedValue(userWithActivePlan as any);
      mockDietPlan.findById.mockResolvedValue(mockDietPlanDocument as any);

      // Act
      const result = await service.createOrRefreshDietPlan(input);

      // Assert
      expect(mockDietPlanningService.createDietPlan).not.toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('should refresh plan when force refresh is true', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserData.demographics,
        dietPreferences: mockUserData.dietPreferences,
        forceRefresh: true
      };

      const userWithActivePlan = {
        ...mockUserData,
        activePlans: { dietPlanId: 'plan123' }
      };

      mockUser.findById.mockResolvedValue(userWithActivePlan as any);
      mockDietPlan.findById.mockResolvedValue(mockDietPlanDocument as any);
      mockDietPlan.updateMany.mockResolvedValue({ acknowledged: true } as any);
      mockUser.findByIdAndUpdate.mockResolvedValue(mockUserData as any);
      mockDietPlanningService.createDietPlan.mockResolvedValue(mockExternalPlanResponse);
      
      const mockNewPlan = {
        ...mockDietPlanDocument,
        save: jest.fn().mockResolvedValue(mockDietPlanDocument)
      };
      
      (mockDietPlan as any).mockImplementation(() => mockNewPlan);

      // Act
      const result = await service.createOrRefreshDietPlan(input);

      // Assert
      expect(mockDietPlanningService.createDietPlan).toHaveBeenCalled();
      expect(mockDietPlan.updateMany).toHaveBeenCalledWith(
        { userId: 'user123', isActive: true },
        expect.objectContaining({ $set: expect.objectContaining({ isActive: false }) })
      );
    });

    it('should handle user not found error', async () => {
      // Arrange
      const input = {
        userId: 'nonexistent',
        userProfile: mockUserData.demographics,
        dietPreferences: mockUserData.dietPreferences
      };

      mockUser.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createOrRefreshDietPlan(input))
        .rejects.toThrow('User not found');
      
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('should handle external service errors and rollback transaction', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserData.demographics,
        dietPreferences: mockUserData.dietPreferences
      };

      mockUser.findById.mockResolvedValue(mockUserData as any);
      mockDietPlanningService.createDietPlan.mockRejectedValue(new Error('External service error'));

      // Act & Assert
      await expect(service.createOrRefreshDietPlan(input))
        .rejects.toThrow('External service error');
      
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('should enforce single active plan per user', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserData.demographics,
        dietPreferences: mockUserData.dietPreferences
      };

      mockUser.findById.mockResolvedValue(mockUserData as any);
      mockDietPlan.updateMany.mockResolvedValue({ acknowledged: true } as any);
      mockUser.findByIdAndUpdate.mockResolvedValue(mockUserData as any);
      mockDietPlanningService.createDietPlan.mockResolvedValue(mockExternalPlanResponse);
      
      const mockNewPlan = {
        ...mockDietPlanDocument,
        save: jest.fn().mockResolvedValue(mockDietPlanDocument)
      };
      
      (mockDietPlan as any).mockImplementation(() => mockNewPlan);

      // Act
      await service.createOrRefreshDietPlan(input);

      // Assert
      expect(mockDietPlan.updateMany).toHaveBeenCalledWith(
        { userId: 'user123', isActive: true },
        expect.objectContaining({
          $set: expect.objectContaining({
            isActive: false
          })
        })
      );
    });
  });

  describe('getUserActiveDietPlan', () => {
    it('should return cached plan from Redis when available', async () => {
      // Arrange
      const cachedPlan = {
        planId: 'cached-plan',
        planName: 'Cached Plan',
        cacheExpiry: new Date(Date.now() + 60000)
      };

      const mockRedisClient = mockRedis.getClient();
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedPlan));

      // Act
      const result = await service.getUserActiveDietPlan('user123');

      // Assert
      expect(result).toEqual(cachedPlan);
      expect(mockUser.findById).not.toHaveBeenCalled();
    });

    it('should fallback to MongoDB when Redis cache misses', async () => {
      // Arrange
      const userWithActivePlan = {
        ...mockUserData,
        activePlans: { dietPlanId: 'plan123' }
      };

      const mockRedisClient = mockRedis.getClient();
      mockRedisClient.get.mockResolvedValue(null);
      
      mockUser.findById.mockResolvedValue(userWithActivePlan as any);
      mockDietPlan.findById.mockResolvedValue(mockDietPlanDocument as any);

      // Act
      const result = await service.getUserActiveDietPlan('user123');

      // Assert
      expect(result).toBeDefined();
      expect(mockUser.findById).toHaveBeenCalledWith('user123');
      expect(mockDietPlan.findById).toHaveBeenCalledWith('plan123');
      expect(mockRedisClient.setEx).toHaveBeenCalled(); // Should cache the result
    });

    it('should return null when no active plan exists', async () => {
      // Arrange
      const mockRedisClient = mockRedis.getClient();
      mockRedisClient.get.mockResolvedValue(null);
      
      mockUser.findById.mockResolvedValue(mockUserData as any); // No activePlans.dietPlanId

      // Act
      const result = await service.getUserActiveDietPlan('user123');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      const userWithActivePlan = {
        ...mockUserData,
        activePlans: { dietPlanId: 'plan123' }
      };

      const mockRedisClient = mockRedis.getClient();
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));
      
      mockUser.findById.mockResolvedValue(userWithActivePlan as any);
      mockDietPlan.findById.mockResolvedValue(mockDietPlanDocument as any);

      // Act
      const result = await service.getUserActiveDietPlan('user123');

      // Assert
      expect(result).toBeDefined();
      expect(mockUser.findById).toHaveBeenCalled();
    });
  });

  describe('getDayMeals', () => {
    it('should return meals for specific day', async () => {
      // Arrange
      const mockPlan = {
        ...mockDietPlanDocument,
        mealPlan: [
          {
            day: 1,
            dayName: 'Monday',
            meals: [
              {
                mealType: 'Breakfast',
                mealDescription: 'Test Breakfast',
                calories: 300,
                mealOrder: 1
              },
              {
                mealType: 'Lunch',
                mealDescription: 'Test Lunch',
                calories: 500,
                mealOrder: 3
              }
            ]
          }
        ]
      };

      jest.spyOn(service, 'getUserActiveDietPlan').mockResolvedValue(mockPlan as any);

      // Act
      const result = await service.getDayMeals('user123', 1);

      // Assert
      expect(result).toBeDefined();
      expect(result.day).toBe(1);
      expect(result.dayName).toBe('Monday');
      expect(result.meals).toHaveLength(2);
      expect(result.totalCalories).toBe(800);
      expect(result.meals[0].mealOrder).toBe(1); // Should be sorted by meal order
    });

    it('should return null when day not found', async () => {
      // Arrange
      const mockPlan = {
        ...mockDietPlanDocument,
        mealPlan: [
          {
            day: 1,
            dayName: 'Monday',
            meals: []
          }
        ]
      };

      jest.spyOn(service, 'getUserActiveDietPlan').mockResolvedValue(mockPlan as any);

      // Act
      const result = await service.getDayMeals('user123', 5); // Day 5 doesn't exist

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when no active plan exists', async () => {
      // Arrange
      jest.spyOn(service, 'getUserActiveDietPlan').mockResolvedValue(null);

      // Act
      const result = await service.getDayMeals('user123', 1);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findPlansNeedingRefresh', () => {
    it('should find plans that need refreshing', async () => {
      // Arrange
      const plansNeedingRefresh = [
        { ...mockDietPlanDocument, nextRefreshDate: new Date(Date.now() - 60000) }
      ];

      mockDietPlan.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(plansNeedingRefresh)
        })
      } as any);

      // Act
      const result = await service.findPlansNeedingRefresh();

      // Assert
      expect(result).toEqual(plansNeedingRefresh);
      expect(mockDietPlan.find).toHaveBeenCalledWith({
        isActive: true,
        nextRefreshDate: { $lte: expect.any(Date) }
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockDietPlan.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      } as any);

      // Act
      const result = await service.findPlansNeedingRefresh();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle transaction failures properly', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserData.demographics,
        dietPreferences: mockUserData.dietPreferences
      };

      mockUser.findById.mockResolvedValue(mockUserData as any);
      mockSession.startTransaction.mockRejectedValue(new Error('Transaction error'));

      // Act & Assert
      await expect(service.createOrRefreshDietPlan(input))
        .rejects.toThrow('Transaction error');
      
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should handle cache storage errors gracefully', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserData.demographics,
        dietPreferences: mockUserData.dietPreferences
      };

      mockUser.findById.mockResolvedValue(mockUserData as any);
      mockDietPlan.updateMany.mockResolvedValue({ acknowledged: true } as any);
      mockUser.findByIdAndUpdate.mockResolvedValue(mockUserData as any);
      mockDietPlanningService.createDietPlan.mockResolvedValue(mockExternalPlanResponse);
      
      const mockNewPlan = {
        ...mockDietPlanDocument,
        save: jest.fn().mockResolvedValue(mockDietPlanDocument)
      };
      
      (mockDietPlan as any).mockImplementation(() => mockNewPlan);

      const mockRedisClient = mockRedis.getClient();
      mockRedisClient.setEx.mockRejectedValue(new Error('Cache error'));

      // Act - Should not throw despite cache error
      const result = await service.createOrRefreshDietPlan(input);

      // Assert
      expect(result).toBeDefined();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });
  });
});