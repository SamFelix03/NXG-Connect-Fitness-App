import request from 'supertest';
import { Application } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import App from '../../../src/app';
import { User } from '../../../src/models/User';
import { DietPlan } from '../../../src/models/DietPlan';
import { UserActivity } from '../../../src/models/UserActivity';
import { generateToken } from '../../../src/utils/jwt';
import { mealCacheService } from '../../../src/services/meal-cache.service';
import MealDetectionService from '../../../src/services/external/meal-detection.service';
import { fileStorageService } from '../../../src/services/file-storage.service';

// Mock external services
jest.mock('../../../src/services/external/meal-detection.service');
jest.mock('../../../src/services/file-storage.service');
jest.mock('../../../src/services/meal-cache.service');

const MockedMealDetectionService = MealDetectionService as jest.MockedClass<typeof MealDetectionService>;

/**
 * Integration Tests for Nutrition API Endpoints
 * 
 * These tests verify the complete nutrition API workflow including:
 * - Authentication and authorization
 * - Database interactions
 * - Response formatting
 * - Error handling
 */

describe('Nutrition API Integration Tests', () => {
  let app: Application;
  let mongoServer: MongoMemoryServer;
  let userToken: string;
  let adminToken: string;
  let testUserId: string;
  let testDietPlanId: string;

  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashedpassword',
    isActive: true,
    emailVerified: true,
    fitnessProfile: {
      goal: 'weight_loss',
      level: 'beginner',
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
        Indian: ['Non-Veg', 'Veg'],
        RegionAndState: ['South Indian']
      }
    },
    currentMacros: {
      calories: '1800',
      carbs: '200g',
      protein: '120g',
      fat: '60g',
      fiber: '25g',
      validTill: new Date(Date.now() + 24 * 60 * 60 * 1000)
    },
    totalPoints: 0
  };

  const testDietPlan = {
    planName: 'Test Diet Plan',
    targetWeightKg: 70,
    source: 'external',
    isActive: true,
    totalMacros: {
      calories: '1800',
      carbs: '200g',
      protein: '120g',
      fat: '60g',
      fiber: '25g'
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
          },
          {
            mealType: 'Lunch',
            mealDescription: '150g Kaima Rice with 150g Vegetable Curry',
            shortName: 'Kaima Rice, Vegetable Curry',
            calories: 550,
            mealOrder: 3
          },
          {
            mealType: 'Dinner',
            mealDescription: '2 pieces Appam with 150g Egg Roast',
            shortName: 'Appam, Egg Roast',
            calories: 657,
            mealOrder: 5
          }
        ]
      },
      {
        day: 2,
        dayName: 'Tuesday',
        meals: [
          {
            mealType: 'Breakfast',
            mealDescription: '150g Jackfruit Upma',
            shortName: 'Jackfruit Upma',
            calories: 360,
            mealOrder: 1
          }
        ]
      }
    ],
    cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    lastRefreshed: new Date(),
    nextRefreshDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  };

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri);

    // Initialize app
    const appInstance = new App();
    app = appInstance.app;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database
    await User.deleteMany({});
    await DietPlan.deleteMany({});
    await UserActivity.deleteMany({});

    // Clear mocks
    jest.clearAllMocks();

    // Create test user
    const user = new User(testUser);
    const savedUser = await user.save();
    testUserId = savedUser._id.toString();

    // Create test diet plan
    const dietPlan = new DietPlan({
      ...testDietPlan,
      userId: testUserId
    });
    const savedDietPlan = await dietPlan.save();
    testDietPlanId = savedDietPlan._id.toString();

    // Update user with active diet plan reference
    await User.findByIdAndUpdate(testUserId, {
      'activePlans.dietPlanId': testDietPlanId
    });

    // Generate tokens
    userToken = generateToken({ id: testUserId, email: testUser.email });
    adminToken = generateToken({ id: 'admin123', email: 'admin@example.com' });

    // Setup mock defaults for meal detection services
    (mealCacheService.generateMealId as jest.Mock).mockReturnValue('meal-12345');
    (mealCacheService.cacheMeal as jest.Mock).mockResolvedValue(undefined);
    (mealCacheService.getCachedMeal as jest.Mock).mockResolvedValue(null);
    (mealCacheService.getUserMeals as jest.Mock).mockResolvedValue([]);
    (mealCacheService.updateMealAfterCorrection as jest.Mock).mockResolvedValue(undefined);
    
    (fileStorageService.uploadMealImage as jest.Mock).mockResolvedValue({
      s3Key: 'meals/user123/meal12345_1234567890.jpg',
      s3Url: 'https://s3.amazonaws.com/test-bucket/meals/user123/meal12345_1234567890.jpg',
      cdnUrl: 'https://cdn.example.com/meals/user123/meal12345_1234567890.jpg',
      contentType: 'image/jpeg',
      size: 1024,
      uploadedAt: new Date()
    });

    // Setup meal detection service mock
    const mockMealDetectionInstance = {
      identifyMeal: jest.fn(),
      correctMeal: jest.fn(),
      compressImage: jest.fn().mockResolvedValue(Buffer.from('compressed-image')),
      retryWithBackoff: jest.fn()
    };

    MockedMealDetectionService.mockImplementation(() => mockMealDetectionInstance as any);
  });

  describe('GET /api/nutrition/daily', () => {
    it('should return complete daily nutrition plan for authenticated user', async () => {
      const response = await request(app)
        .get('/api/nutrition/daily')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Daily nutrition plan retrieved successfully',
        data: {
          dietPlan: {
            planName: testDietPlan.planName,
            targetWeightKg: testDietPlan.targetWeightKg,
            totalMacros: testDietPlan.totalMacros
          },
          weeklyMealPlan: expect.arrayContaining([
            expect.objectContaining({
              day: 1,
              dayName: 'Monday',
              meals: expect.arrayContaining([
                expect.objectContaining({
                  mealType: 'Breakfast',
                  mealDescription: expect.any(String),
                  calories: expect.any(Number)
                })
              ]),
              totalCalories: expect.any(Number),
              mealCount: expect.any(Number)
            })
          ]),
          summary: {
            totalDays: expect.any(Number),
            avgCaloriesPerDay: expect.any(Number),
            targetWeight: testDietPlan.targetWeightKg,
            macroTargets: testDietPlan.totalMacros
          }
        }
      });

      expect(response.body.data.weeklyMealPlan).toHaveLength(2);
      expect(response.body.data.weeklyMealPlan[0].meals[0].mealOrder).toBe(1);
    });

    it('should return 404 when user has no active diet plan', async () => {
      // Remove diet plan reference
      await User.findByIdAndUpdate(testUserId, {
        $unset: { 'activePlans.dietPlanId': '' }
      });

      const response = await request(app)
        .get('/api/nutrition/daily')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'No active diet plan found. Please create a diet plan first.',
        recommendations: {
          action: 'create_diet_plan',
          endpoint: '/api/integrations/diet-plans'
        }
      });
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/nutrition/daily')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/nutrition/daily/:day', () => {
    it('should return specific day meal plan', async () => {
      const response = await request(app)
        .get('/api/nutrition/daily/1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Meal plan for Monday retrieved successfully',
        data: {
          day: {
            number: 1,
            name: 'Monday',
            totalCalories: expect.any(Number),
            mealCount: 3
          },
          meals: expect.arrayContaining([
            expect.objectContaining({
              mealType: 'Breakfast',
              description: expect.any(String),
              shortName: expect.any(String),
              calories: expect.any(Number),
              mealOrder: expect.any(Number),
              estimatedPreparationTime: expect.any(String),
              mealTiming: expect.any(String)
            })
          ]),
          nutritionSummary: {
            totalCalories: expect.any(Number),
            avgCaloriesPerMeal: expect.any(Number),
            mealDistribution: expect.any(Object)
          }
        }
      });

      expect(response.body.data.meals).toHaveLength(3);
      expect(response.body.data.day.totalCalories).toBe(1557); // 350 + 550 + 657
    });

    it('should return 404 for non-existent day', async () => {
      const response = await request(app)
        .get('/api/nutrition/daily/8') // Day 8 doesn't exist
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'No meal plan found for day 8. Please ensure you have an active diet plan.',
        recommendations: {
          action: 'check_diet_plan',
          endpoint: '/api/integrations/diet-plans/status'
        }
      });
    });

    it('should validate day parameter', async () => {
      const response = await request(app)
        .get('/api/nutrition/daily/invalid')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid day parameter');
    });

    it('should validate day range (1-7)', async () => {
      const response = await request(app)
        .get('/api/nutrition/daily/0')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/nutrition/library', () => {
    it('should return complete nutrition library', async () => {
      const response = await request(app)
        .get('/api/nutrition/library')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Nutrition library retrieved successfully',
        data: {
          library: {
            cuisineTypes: expect.arrayContaining([
              expect.objectContaining({
                id: expect.any(String),
                name: expect.any(String),
                subcategories: expect.any(Array),
                dietaryOptions: expect.any(Array),
                popularDishes: expect.any(Array),
                avgCaloriesPerMeal: expect.any(Number)
              })
            ]),
            mealCategories: expect.arrayContaining([
              expect.objectContaining({
                id: expect.any(String),
                name: expect.any(String),
                recommendedCalories: expect.objectContaining({
                  min: expect.any(Number),
                  max: expect.any(Number)
                }),
                timing: expect.any(String),
                macroDistribution: expect.any(Object)
              })
            ]),
            dietaryRestrictions: expect.any(Array),
            nutritionTips: expect.any(Array)
          },
          metadata: {
            totalItems: expect.any(Number),
            category: 'all',
            lastUpdated: expect.any(String),
            dataVersion: '1.0'
          }
        }
      });

      expect(response.body.data.library.cuisineTypes.length).toBeGreaterThan(0);
      expect(response.body.data.library.mealCategories.length).toBeGreaterThan(0);
    });

    it('should filter library by category', async () => {
      const response = await request(app)
        .get('/api/nutrition/library?category=meals')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.library).toHaveProperty('mealCategories');
      expect(response.body.data.library).not.toHaveProperty('cuisineTypes');
      expect(response.body.data.metadata.category).toBe('meals');
    });

    it('should handle invalid category parameter', async () => {
      const response = await request(app)
        .get('/api/nutrition/library?category=invalid')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid query parameters');
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/nutrition/library?limit=150') // Above max limit
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/nutrition/macros', () => {
    it('should return user current macro targets', async () => {
      const response = await request(app)
        .get('/api/nutrition/macros')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Current macro targets retrieved successfully',
        data: {
          macroTargets: {
            calories: testDietPlan.totalMacros.calories,
            carbs: testDietPlan.totalMacros.carbs,
            protein: testDietPlan.totalMacros.protein,
            fat: testDietPlan.totalMacros.fat,
            fiber: testDietPlan.totalMacros.fiber
          },
          macroPercentages: {
            carbs: expect.any(Number),
            protein: expect.any(Number),
            fat: expect.any(Number)
          },
          macroCalories: {
            carbs: expect.any(Number),
            protein: expect.any(Number),
            fat: expect.any(Number)
          },
          dietPlanInfo: {
            planName: testDietPlan.planName,
            targetWeightKg: testDietPlan.targetWeightKg
          },
          recommendations: expect.any(Object)
        }
      });

      // Verify macro calculations
      const macroPercentages = response.body.data.macroPercentages;
      expect(macroPercentages.carbs + macroPercentages.protein + macroPercentages.fat)
        .toBeCloseTo(100, 0);
    });

    it('should return 404 when user has no active diet plan', async () => {
      // Remove diet plan
      await DietPlan.findByIdAndUpdate(testDietPlanId, { isActive: false });

      const response = await request(app)
        .get('/api/nutrition/macros')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'No active diet plan found for macro targets. Please create a diet plan first.',
        recommendations: {
          action: 'create_diet_plan',
          endpoint: '/api/integrations/diet-plans'
        }
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all nutrition endpoints', async () => {
      const endpoints = [
        '/api/nutrition/daily',
        '/api/nutrition/daily/1',
        '/api/nutrition/library',
        '/api/nutrition/macros'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/nutrition/daily')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should allow admin access to nutrition endpoints', async () => {
      const response = await request(app)
        .get('/api/nutrition/library')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to nutrition endpoints', async () => {
      const requests = Array.from({ length: 152 }, () => 
        request(app)
          .get('/api/nutrition/library')
          .set('Authorization', `Bearer ${userToken}`)
      );

      const responses = await Promise.allSettled(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(result => 
        result.status === 'fulfilled' && 
        (result.value as any).status === 429
      );

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000); // Increase timeout for rate limiting test
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Disconnect from database to simulate error
      await mongoose.disconnect();

      const response = await request(app)
        .get('/api/nutrition/daily')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Internal server error');

      // Reconnect for cleanup
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    });

    it('should validate request parameters properly', async () => {
      const response = await request(app)
        .get('/api/nutrition/daily/99') // Invalid day
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid day parameter');
    });
  });

  describe('Health Check', () => {
    it('should provide nutrition service health status', async () => {
      const response = await request(app)
        .get('/api/nutrition/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Nutrition service is healthy',
        data: {
          service: 'nutrition',
          status: 'operational',
          timestamp: expect.any(String),
          availableEndpoints: expect.arrayContaining([
            'GET /api/nutrition/daily',
            'GET /api/nutrition/daily/:day',
            'GET /api/nutrition/library',
            'GET /api/nutrition/macros'
          ]),
          features: {
            dailyMealPlans: 'enabled',
            nutritionLibrary: 'enabled',
            macroTracking: 'enabled',
            dietaryPreferences: 'enabled'
          }
        }
      });
    });
  });

  // Meal Detection Integration Tests
  describe('Meal Detection Endpoints', () => {
    let testImageBuffer: Buffer;

    beforeEach(() => {
      testImageBuffer = Buffer.from('fake-test-image-data');
    });

    describe('POST /api/nutrition/upload-meal', () => {
      const mockDetectionResponse = {
        success: true,
        confidence: 0.85,
        foods: [
          {
            name: 'Chicken Breast',
            description: 'Grilled chicken breast',
            quantity: 150,
            unit: 'g',
            nutrition: {
              calories: 231,
              carbs: 0,
              fat: 5,
              protein: 43,
              fiber: 0
            }
          }
        ]
      };

      beforeEach(() => {
        const mockInstance = new (MockedMealDetectionService as any)();
        mockInstance.retryWithBackoff.mockResolvedValue(mockDetectionResponse);
      });

      it('should successfully upload and process meal image', async () => {
        const response = await request(app)
          .post('/api/nutrition/upload-meal')
          .set('Authorization', `Bearer ${userToken}`)
          .field('mealType', 'lunch')
          .field('notes', 'Healthy lunch meal')
          .attach('image', testImageBuffer, 'meal.jpg');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Meal uploaded and processed successfully');
        expect(response.body.data).toHaveProperty('mealId');
        expect(response.body.data.detectedFoods).toHaveLength(1);
        expect(response.body.data.detectedFoods[0].name).toBe('Chicken Breast');
        expect(response.body.data.totalNutrition.calories).toBe(231);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/nutrition/upload-meal')
          .attach('image', testImageBuffer, 'meal.jpg');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should require image file', async () => {
        const response = await request(app)
          .post('/api/nutrition/upload-meal')
          .set('Authorization', `Bearer ${userToken}`)
          .field('mealType', 'lunch');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('image');
      });

      it('should validate meal type when provided', async () => {
        const response = await request(app)
          .post('/api/nutrition/upload-meal')
          .set('Authorization', `Bearer ${userToken}`)
          .field('mealType', 'invalid-meal-type')
          .attach('image', testImageBuffer, 'meal.jpg');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should handle meal detection service errors', async () => {
        const mockInstance = new (MockedMealDetectionService as any)();
        mockInstance.retryWithBackoff.mockRejectedValue(new Error('AI service unavailable'));

        const response = await request(app)
          .post('/api/nutrition/upload-meal')
          .set('Authorization', `Bearer ${userToken}`)
          .attach('image', testImageBuffer, 'meal.jpg');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/nutrition/meal-history', () => {
      const mockMealHistory = [
        {
          mealId: 'meal-001',
          userId: testUserId,
          imageUrl: 'https://cdn.example.com/meal-001.jpg',
          foods: [
            {
              name: 'Salad',
              description: 'Mixed green salad',
              quantity: 200,
              unit: 'g',
              nutrition: { calories: 50, carbs: 10, fat: 1, protein: 3, fiber: 5 }
            }
          ],
          totalNutrition: { calories: 50, carbs: 10, fat: 1, protein: 3, fiber: 5 },
          detectedAt: new Date(),
          correctionCount: 0,
          isVerified: true
        }
      ];

      beforeEach(() => {
        (mealCacheService.getUserMeals as jest.Mock).mockResolvedValue(mockMealHistory);
      });

      it('should retrieve user meal history successfully', async () => {
        const response = await request(app)
          .get('/api/nutrition/meal-history')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.meals).toHaveLength(1);
        expect(response.body.data.meals[0].mealId).toBe('meal-001');
        expect(response.body.data.totalMeals).toBe(1);
      });

      it('should support pagination with limit parameter', async () => {
        const response = await request(app)
          .get('/api/nutrition/meal-history?limit=5')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(mealCacheService.getUserMeals).toHaveBeenCalledWith(testUserId, 5);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/nutrition/meal-history');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should handle empty meal history', async () => {
        (mealCacheService.getUserMeals as jest.Mock).mockResolvedValue([]);

        const response = await request(app)
          .get('/api/nutrition/meal-history')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.meals).toHaveLength(0);
        expect(response.body.data.totalMeals).toBe(0);
      });
    });

    describe('POST /api/nutrition/log-previous-meal/:mealId', () => {
      const mockCachedMeal = {
        mealId: 'meal-123',
        userId: testUserId,
        imageUrl: 'https://cdn.example.com/meal-123.jpg',
        foods: [
          {
            name: 'Pasta',
            description: 'Spaghetti with marinara sauce',
            quantity: 200,
            unit: 'g',
            nutrition: { calories: 350, carbs: 70, fat: 2, protein: 12, fiber: 3 }
          }
        ],
        totalNutrition: { calories: 350, carbs: 70, fat: 2, protein: 12, fiber: 3 },
        detectedAt: new Date(),
        correctionCount: 0,
        isVerified: true
      };

      beforeEach(() => {
        (mealCacheService.getCachedMeal as jest.Mock).mockResolvedValue(mockCachedMeal);
      });

      it('should successfully log previous meal', async () => {
        const response = await request(app)
          .post('/api/nutrition/log-previous-meal/meal-123')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            mealType: 'dinner',
            notes: 'Reused pasta meal'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Previous meal logged successfully');
        expect(response.body.data.loggedMeal.mealType).toBe('dinner');
        expect(response.body.data.loggedMeal.totalNutrition.calories).toBe(350);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/nutrition/log-previous-meal/meal-123');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should return 404 for non-existent meal', async () => {
        (mealCacheService.getCachedMeal as jest.Mock).mockResolvedValue(null);

        const response = await request(app)
          .post('/api/nutrition/log-previous-meal/non-existent')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ mealType: 'lunch' });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not found');
      });

      it('should validate meal type when provided', async () => {
        const response = await request(app)
          .post('/api/nutrition/log-previous-meal/meal-123')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ mealType: 'invalid-type' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/nutrition/correct-meal/:mealId', () => {
      const mockCachedMeal = {
        mealId: 'meal-456',
        userId: testUserId,
        imageUrl: 'https://cdn.example.com/meal-456.jpg',
        foods: [
          {
            name: 'Pizza',
            description: 'Cheese pizza slice',
            quantity: 1,
            unit: 'slice',
            nutrition: { calories: 285, carbs: 35, fat: 10, protein: 12, fiber: 2 }
          }
        ],
        totalNutrition: { calories: 285, carbs: 35, fat: 10, protein: 12, fiber: 2 },
        detectedAt: new Date(),
        correctionCount: 0,
        isVerified: false
      };

      const mockCorrectedResponse = {
        success: true,
        confidence: 0.90,
        foods: [
          {
            name: 'Pizza',
            description: 'Pepperoni pizza slices',
            quantity: 2,
            unit: 'slices',
            nutrition: { calories: 570, carbs: 70, fat: 20, protein: 24, fiber: 4 }
          }
        ]
      };

      beforeEach(() => {
        (mealCacheService.getCachedMeal as jest.Mock).mockResolvedValue(mockCachedMeal);
        
        const mockInstance = new (MockedMealDetectionService as any)();
        mockInstance.correctMeal.mockResolvedValue(mockCorrectedResponse);
      });

      it('should successfully correct meal', async () => {
        const response = await request(app)
          .post('/api/nutrition/correct-meal/meal-456')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            correction: 'Actually it was 2 slices with pepperoni',
            notes: 'User correction for better accuracy'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Meal corrected successfully');
        expect(response.body.data.correctedMeal.foods[0].quantity).toBe(2);
        expect(response.body.data.correctedMeal.totalNutrition.calories).toBe(570);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/nutrition/correct-meal/meal-456')
          .send({ correction: 'Test correction' });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should validate correction text is required', async () => {
        const response = await request(app)
          .post('/api/nutrition/correct-meal/meal-456')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ notes: 'Missing correction text' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('correction');
      });

      it('should return 404 for non-existent meal', async () => {
        (mealCacheService.getCachedMeal as jest.Mock).mockResolvedValue(null);

        const response = await request(app)
          .post('/api/nutrition/correct-meal/non-existent')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ correction: 'Test correction' });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });

      it('should handle meal correction service errors', async () => {
        const mockInstance = new (MockedMealDetectionService as any)();
        mockInstance.correctMeal.mockRejectedValue(new Error('Correction service error'));

        const response = await request(app)
          .post('/api/nutrition/correct-meal/meal-456')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ correction: 'Test correction' });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
      });

      it('should increment correction count in cache', async () => {
        await request(app)
          .post('/api/nutrition/correct-meal/meal-456')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ correction: 'Test correction' });

        expect(mealCacheService.updateMealAfterCorrection).toHaveBeenCalledWith(
          'meal-456',
          expect.objectContaining({
            correctionCount: 1,
            isVerified: true
          })
        );
      });
    });

    describe('Error handling and edge cases for meal detection', () => {
      it('should handle database connection errors', async () => {
        jest.spyOn(UserActivity.prototype, 'save').mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post('/api/nutrition/upload-meal')
          .set('Authorization', `Bearer ${userToken}`)
          .attach('image', testImageBuffer, 'meal.jpg');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
      });

      it('should handle cache service failures gracefully', async () => {
        (mealCacheService.cacheMeal as jest.Mock).mockRejectedValue(new Error('Cache error'));

        const mockInstance = new (MockedMealDetectionService as any)();
        mockInstance.retryWithBackoff.mockResolvedValue({
          success: true,
          confidence: 0.85,
          foods: [{ name: 'Test', nutrition: { calories: 100, carbs: 0, fat: 0, protein: 0, fiber: 0 } }]
        });

        const response = await request(app)
          .post('/api/nutrition/upload-meal')
          .set('Authorization', `Bearer ${userToken}`)
          .attach('image', testImageBuffer, 'meal.jpg');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
      });

      it('should handle file storage failures', async () => {
        (fileStorageService.uploadMealImage as jest.Mock).mockRejectedValue(new Error('S3 upload failed'));

        const mockInstance = new (MockedMealDetectionService as any)();
        mockInstance.retryWithBackoff.mockResolvedValue({
          success: true,
          confidence: 0.85,
          foods: [{ name: 'Test', nutrition: { calories: 100, carbs: 0, fat: 0, protein: 0, fiber: 0 } }]
        });

        const response = await request(app)
          .post('/api/nutrition/upload-meal')
          .set('Authorization', `Bearer ${userToken}`)
          .attach('image', testImageBuffer, 'meal.jpg');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
      });

      it('should validate file type restrictions', async () => {
        const response = await request(app)
          .post('/api/nutrition/upload-meal')
          .set('Authorization', `Bearer ${userToken}`)
          .attach('image', Buffer.from('not-an-image'), 'document.txt');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });
  });
});