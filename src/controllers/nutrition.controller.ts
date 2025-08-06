import { Request, Response } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { dietPlanCacheService } from '../services/diet-plan-cache.service';
import { mealCacheService } from '../services/meal-cache.service';
import MealDetectionService from '../services/external/meal-detection.service';
import { fileStorageService } from '../services/file-storage.service';
import { UserActivity } from '../models/UserActivity';
import { AppError } from '../utils/errors';

/**
 * Nutrition Controller
 * 
 * Handles nutrition-related API endpoints:
 * - GET /api/nutrition/daily - Get user's daily nutrition plan
 * - GET /api/nutrition/daily/:day - Get specific day's meal plan
 * - GET /api/nutrition/library - Get nutrition library with dietary options
 * - GET /api/nutrition/macros - Get user's current macro targets
 * - POST /api/nutrition/upload-meal - Upload and analyze meal image
 * - GET /api/nutrition/meal-history - Get user's meal history with pagination
 * - POST /api/nutrition/log-previous-meal - Log a meal from history without re-scanning
 * - POST /api/nutrition/correct-meal - Correct a meal detection and trigger re-analysis
 */

// Validation schemas
const dayParamSchema = Joi.object({
  day: Joi.number().min(1).max(7).required()
});

const libraryQuerySchema = Joi.object({
  category: Joi.string().valid('meals', 'cuisines', 'dietary_restrictions').optional(),
  filter: Joi.string().optional(),
  limit: Joi.number().min(1).max(100).default(20),
  offset: Joi.number().min(0).default(0)
});

const uploadMealSchema = Joi.object({
  mealType: Joi.string().valid('breakfast', 'lunch', 'dinner', 'snack').optional(),
  notes: Joi.string().max(500).optional()
});

const mealHistoryQuerySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(50).default(20),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional()
});

const logPreviousMealSchema = Joi.object({
  mealId: Joi.string().required(),
  mealType: Joi.string().valid('breakfast', 'lunch', 'dinner', 'snack').optional(),
  notes: Joi.string().max(500).optional()
});

const correctMealSchema = Joi.object({
  mealId: Joi.string().required(),
  correction: Joi.string().min(10).max(1000).required(),
  mealType: Joi.string().valid('breakfast', 'lunch', 'dinner', 'snack').optional()
});

/**
 * GET /api/nutrition/daily
 * Returns user's complete active diet plan with all days
 */
export const getDailyNutrition = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    logger.info('Fetching daily nutrition plan for user', {
      service: 'nutrition-controller',
      userId,
      event: 'get-daily-nutrition-start'
    });

    // Get user's active diet plan
    const activeDietPlan = await dietPlanCacheService.getUserActiveDietPlan(userId);

    if (!activeDietPlan) {
      logger.info('No active diet plan found for user', {
        service: 'nutrition-controller',
        userId,
        event: 'no-active-diet-plan'
      });

      res.status(404).json({
        success: false,
        message: 'No active diet plan found. Please create a diet plan first.',
        data: null,
        recommendations: {
          action: 'create_diet_plan',
          endpoint: '/api/integrations/diet-plans',
          message: 'Visit the integrations endpoint to create your personalized diet plan'
        }
      });
      return;
    }

    // Calculate daily averages
    const totalMealsPerDay = activeDietPlan.mealPlan.length > 0 ? 
      activeDietPlan.mealPlan[0]?.meals.length || 0 : 0;
    
    const avgCaloriesPerDay = activeDietPlan.mealPlan.reduce((total, day) => {
      return total + day.meals.reduce((dayTotal, meal) => dayTotal + meal.calories, 0);
    }, 0) / Math.max(activeDietPlan.mealPlan.length, 1);

    logger.info('Daily nutrition plan retrieved successfully', {
      service: 'nutrition-controller',
      userId,
      planId: activeDietPlan.planId,
      totalDays: activeDietPlan.mealPlan.length,
      avgCaloriesPerDay: Math.round(avgCaloriesPerDay),
      event: 'get-daily-nutrition-success'
    });

    res.status(200).json({
      success: true,
      message: 'Daily nutrition plan retrieved successfully',
      data: {
        dietPlan: {
          id: activeDietPlan.planId,
          planName: activeDietPlan.planName,
          targetWeightKg: activeDietPlan.targetWeightKg,
          totalMacros: activeDietPlan.totalMacros,
          lastRefreshed: activeDietPlan.lastRefreshed,
          nextRefreshDate: activeDietPlan.nextRefreshDate
        },
        weeklyMealPlan: activeDietPlan.mealPlan.map(day => ({
          day: day.day,
          dayName: day.dayName,
          meals: day.meals?.sort((a, b) => a.mealOrder - b.mealOrder) || [],
          totalCalories: day.meals?.reduce((sum, meal) => sum + meal.calories, 0) || 0,
          mealCount: day.meals?.length || 0
        })),
        summary: {
          totalDays: activeDietPlan.mealPlan.length,
          avgCaloriesPerDay: Math.round(avgCaloriesPerDay),
          totalMealsPerDay,
          targetWeight: activeDietPlan.targetWeightKg,
          macroTargets: activeDietPlan.totalMacros
        },
        cacheInfo: {
          lastRefreshed: activeDietPlan.lastRefreshed,
          nextRefreshDate: activeDietPlan.nextRefreshDate,
          cacheExpiry: activeDietPlan.cacheExpiry
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get daily nutrition plan', error as Error, {
      service: 'nutrition-controller',
      userId: req.user?.id,
      event: 'get-daily-nutrition-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching daily nutrition plan',
        data: null
      });
    }
  }
};

/**
 * GET /api/nutrition/daily/:day
 * Returns specific day's meal plan from user's active diet plan
 */
export const getDayMealPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    // Validate day parameter
    const { error, value: params } = dayParamSchema.validate(req.params);
    if (error) {
      throw new AppError(400, `Invalid day parameter: ${error.details[0]?.message || 'Validation failed'}`);
    }

    const dayNumber = params.day;

    logger.info('Fetching day meal plan for user', {
      service: 'nutrition-controller',
      userId,
      dayNumber,
      event: 'get-day-meal-plan-start'
    });

    // Get specific day's meals
    const dayMeals = await dietPlanCacheService.getDayMeals(userId, dayNumber);

    if (!dayMeals) {
      logger.info('No meal plan found for specified day', {
        service: 'nutrition-controller',
        userId,
        dayNumber,
        event: 'no-day-meal-plan'
      });

      res.status(404).json({
        success: false,
        message: `No meal plan found for day ${dayNumber}. Please ensure you have an active diet plan.`,
        data: null,
        recommendations: {
          action: 'check_diet_plan',
          endpoint: '/api/integrations/diet-plans/status',
          message: 'Check your diet plan status or create a new plan'
        }
      });
      return;
    }

    // Get day name
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayName = dayNames[dayNumber - 1];

    logger.info('Day meal plan retrieved successfully', {
      service: 'nutrition-controller',
      userId,
      dayNumber,
      dayName,
      totalCalories: dayMeals.totalCalories,
      mealCount: dayMeals.meals.length,
      event: 'get-day-meal-plan-success'
    });

    res.status(200).json({
      success: true,
      message: `Meal plan for ${dayName} retrieved successfully`,
      data: {
        day: {
          number: dayMeals.day,
          name: dayMeals.dayName,
          totalCalories: dayMeals.totalCalories,
          mealCount: dayMeals.meals?.length || 0
        },
        meals: (dayMeals.meals || []).map((meal: any) => ({
          mealType: meal.mealType,
          mealOrder: meal.mealOrder,
          description: meal.mealDescription,
          shortName: meal.shortName,
          calories: meal.calories,
          estimatedPreparationTime: getEstimatedPrepTime(meal.mealType),
          mealTiming: getMealTiming(meal.mealType)
        })),
        nutritionSummary: {
          totalCalories: dayMeals.totalCalories,
          avgCaloriesPerMeal: Math.round(dayMeals.totalCalories / Math.max(dayMeals.meals?.length || 1, 1)),
          mealDistribution: calculateMealDistribution(dayMeals.meals || [])
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get day meal plan', error as Error, {
      service: 'nutrition-controller',
      userId: req.user?.id,
      dayNumber: req.params['day'],
      event: 'get-day-meal-plan-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching day meal plan',
        data: null
      });
    }
  }
};

/**
 * GET /api/nutrition/library
 * Returns nutrition library with dietary options and meal categories
 */
export const getNutritionLibrary = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    // Validate query parameters
    const { error, value: queryParams } = libraryQuerySchema.validate(req.query);
    if (error) {
      throw new AppError(400, `Invalid query parameters: ${error.details[0]?.message || 'Validation failed'}`);
    }

    logger.info('Fetching nutrition library', {
      service: 'nutrition-controller',
      userId,
      category: queryParams.category,
      filter: queryParams.filter,
      event: 'get-nutrition-library-start'
    });

    // Build nutrition library data
    const libraryData = {
      cuisineTypes: [
        {
          id: 'indian',
          name: 'Indian',
          subcategories: ['North Indian', 'South Indian', 'Bengali', 'Gujarati', 'Punjabi', 'Kerala'],
          dietaryOptions: ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Jain'],
          popularDishes: ['Dal Tadka', 'Biryani', 'Curry', 'Roti', 'Rice'],
          avgCaloriesPerMeal: 450
        },
        {
          id: 'continental',
          name: 'Continental',
          subcategories: ['Italian', 'Mediterranean', 'French', 'American'],
          dietaryOptions: ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Keto'],
          popularDishes: ['Pasta', 'Salad', 'Grilled Chicken', 'Soup', 'Sandwich'],
          avgCaloriesPerMeal: 380
        },
        {
          id: 'asian',
          name: 'Asian',
          subcategories: ['Chinese', 'Thai', 'Japanese', 'Korean'],
          dietaryOptions: ['Vegetarian', 'Non-Vegetarian', 'Pescatarian'],
          popularDishes: ['Fried Rice', 'Noodles', 'Sushi', 'Stir Fry', 'Curry'],
          avgCaloriesPerMeal: 420
        }
      ],
      mealCategories: [
        {
          id: 'breakfast',
          name: 'Breakfast',
          recommendedCalories: { min: 300, max: 500 },
          typicalMeals: ['Oats', 'Upma', 'Dosa', 'Paratha', 'Eggs'],
          timing: '7:00 AM - 9:00 AM',
          macroDistribution: { carbs: 45, protein: 20, fat: 35 }
        },
        {
          id: 'lunch',
          name: 'Lunch',
          recommendedCalories: { min: 500, max: 700 },
          typicalMeals: ['Rice with Curry', 'Roti with Sabzi', 'Biryani', 'Salad Bowl'],
          timing: '12:00 PM - 2:00 PM',
          macroDistribution: { carbs: 50, protein: 25, fat: 25 }
        },
        {
          id: 'dinner',
          name: 'Dinner',
          recommendedCalories: { min: 400, max: 600 },
          typicalMeals: ['Light Curry', 'Soup', 'Grilled Items', 'Salad'],
          timing: '7:00 PM - 9:00 PM',
          macroDistribution: { carbs: 40, protein: 30, fat: 30 }
        },
        {
          id: 'snacks',
          name: 'Snacks',
          recommendedCalories: { min: 100, max: 300 },
          typicalMeals: ['Fruits', 'Nuts', 'Yogurt', 'Smoothie'],
          timing: '10:00 AM - 11:00 AM, 4:00 PM - 5:00 PM',
          macroDistribution: { carbs: 40, protein: 20, fat: 40 }
        }
      ],
      dietaryRestrictions: [
        {
          id: 'vegetarian',
          name: 'Vegetarian',
          description: 'Plant-based diet excluding meat, poultry, and fish',
          commonSubstitutes: { protein: ['Paneer', 'Dal', 'Tofu', 'Nuts'] }
        },
        {
          id: 'vegan',
          name: 'Vegan',
          description: 'Plant-based diet excluding all animal products',
          commonSubstitutes: { protein: ['Tofu', 'Legumes', 'Quinoa'], dairy: ['Almond Milk', 'Coconut Milk'] }
        },
        {
          id: 'gluten_free',
          name: 'Gluten Free',
          description: 'Diet excluding gluten-containing grains',
          commonSubstitutes: { grains: ['Rice', 'Quinoa', 'Millet'] }
        },
        {
          id: 'diabetic_friendly',
          name: 'Diabetic Friendly',
          description: 'Low glycemic index foods suitable for diabetes',
          recommendations: ['High Fiber', 'Complex Carbs', 'Lean Proteins']
        }
      ],
      nutritionTips: [
        {
          category: 'hydration',
          tip: 'Drink at least 8-10 glasses of water daily',
          importance: 'high'
        },
        {
          category: 'meal_timing',
          tip: 'Eat meals at regular intervals to maintain metabolism',
          importance: 'medium'
        },
        {
          category: 'portion_control',
          tip: 'Use smaller plates to control portion sizes naturally',
          importance: 'high'
        },
        {
          category: 'macro_balance',
          tip: 'Include all three macronutrients in each meal',
          importance: 'high'
        }
      ]
    };

    // Filter data based on query parameters
    let filteredData = libraryData;
    
    if (queryParams.category) {
      switch (queryParams.category) {
        case 'meals':
          filteredData = { mealCategories: libraryData.mealCategories } as any;
          break;
        case 'cuisines':
          filteredData = { cuisineTypes: libraryData.cuisineTypes } as any;
          break;
        case 'dietary_restrictions':
          filteredData = { dietaryRestrictions: libraryData.dietaryRestrictions } as any;
          break;
      }
    }

    // Apply pagination if needed
    const totalItems = Object.keys(filteredData).reduce((total, key) => {
      const items = (filteredData as any)[key];
      return total + (Array.isArray(items) ? items.length : 0);
    }, 0);

    logger.info('Nutrition library retrieved successfully', {
      service: 'nutrition-controller',
      userId,
      category: queryParams.category,
      totalItems,
      event: 'get-nutrition-library-success'
    });

    res.status(200).json({
      success: true,
      message: 'Nutrition library retrieved successfully',
      data: {
        library: filteredData,
        metadata: {
          totalItems,
          category: queryParams.category || 'all',
          lastUpdated: new Date().toISOString(),
          dataVersion: '1.0'
        },
        userRecommendations: {
          suggestedCuisines: ['Indian', 'Continental'], // Based on user preferences
          recommendedMealTiming: getRecommendedMealTiming(),
          dailyCalorieTarget: null // Would be filled from user's active diet plan
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get nutrition library', error as Error, {
      service: 'nutrition-controller',
      userId: req.user?.id,
      event: 'get-nutrition-library-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching nutrition library',
        data: null
      });
    }
  }
};

/**
 * GET /api/nutrition/macros
 * Returns user's current macro targets and progress
 */
export const getCurrentMacros = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    logger.info('Fetching current macros for user', {
      service: 'nutrition-controller',
      userId,
      event: 'get-current-macros-start'
    });

    // Get user's active diet plan for macro targets
    const activeDietPlan = await dietPlanCacheService.getUserActiveDietPlan(userId);

    if (!activeDietPlan) {
      logger.info('No active diet plan found for macro targets', {
        service: 'nutrition-controller',
        userId,
        event: 'no-active-diet-plan-for-macros'
      });

      res.status(404).json({
        success: false,
        message: 'No active diet plan found for macro targets. Please create a diet plan first.',
        data: null,
        recommendations: {
          action: 'create_diet_plan',
          endpoint: '/api/integrations/diet-plans',
          message: 'Create a personalized diet plan to get macro targets'
        }
      });
      return;
    }

    // Calculate macro percentages
    const totalCalories = parseInt(activeDietPlan.totalMacros.calories);
    const carbsGrams = parseInt(activeDietPlan.totalMacros.carbs.replace('g', ''));
    const proteinGrams = parseInt(activeDietPlan.totalMacros.protein.replace('g', ''));
    const fatGrams = parseInt(activeDietPlan.totalMacros.fat.replace('g', ''));

    const macroPercentages = {
      carbs: Math.round((carbsGrams * 4 / totalCalories) * 100),
      protein: Math.round((proteinGrams * 4 / totalCalories) * 100),
      fat: Math.round((fatGrams * 9 / totalCalories) * 100)
    };

    logger.info('Current macros retrieved successfully', {
      service: 'nutrition-controller',
      userId,
      totalCalories,
      macroPercentages,
      event: 'get-current-macros-success'
    });

    res.status(200).json({
      success: true,
      message: 'Current macro targets retrieved successfully',
      data: {
        macroTargets: {
          calories: activeDietPlan.totalMacros.calories,
          carbs: activeDietPlan.totalMacros.carbs,
          protein: activeDietPlan.totalMacros.protein,
          fat: activeDietPlan.totalMacros.fat,
          fiber: activeDietPlan.totalMacros.fiber
        },
        macroPercentages,
        macroCalories: {
          carbs: carbsGrams * 4,
          protein: proteinGrams * 4,
          fat: fatGrams * 9
        },
        dietPlanInfo: {
          planId: activeDietPlan.planId,
          planName: activeDietPlan.planName,
          targetWeightKg: activeDietPlan.targetWeightKg,
          lastRefreshed: activeDietPlan.lastRefreshed,
          nextRefreshDate: activeDietPlan.nextRefreshDate
        },
        recommendations: {
          waterIntake: '8-10 glasses per day',
          mealFrequency: '5-6 small meals throughout the day',
          macroTiming: 'Distribute protein evenly across all meals'
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get current macros', error as Error, {
      service: 'nutrition-controller',
      userId: req.user?.id,
      event: 'get-current-macros-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching current macros',
        data: null
      });
    }
  }
};

// Helper methods
function getEstimatedPrepTime(mealType: string): string {
  const prepTimes: Record<string, string> = {
    'Breakfast': '15-20 minutes',
    'Snack 1': '5-10 minutes',
    'Lunch': '25-30 minutes',
    'Snack 2': '5-10 minutes',
    'Dinner': '20-25 minutes'
  };
  return prepTimes[mealType] || '15-20 minutes';
}

function getMealTiming(mealType: string): string {
  const timings: Record<string, string> = {
    'Breakfast': '7:00 AM - 9:00 AM',
    'Snack 1': '10:00 AM - 11:00 AM',
    'Lunch': '12:00 PM - 2:00 PM',
    'Snack 2': '4:00 PM - 5:00 PM',
    'Dinner': '7:00 PM - 9:00 PM'
  };
  return timings[mealType] || 'Flexible timing';
}

function calculateMealDistribution(meals: any[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
  
  meals.forEach(meal => {
    distribution[meal.mealType] = Math.round((meal.calories / totalCalories) * 100);
  });
  
  return distribution;
}

function getRecommendedMealTiming(): Record<string, string> {
  return {
    breakfast: '7:00 AM - 9:00 AM',
    morningSnack: '10:00 AM - 11:00 AM',
    lunch: '12:00 PM - 2:00 PM',
    eveningSnack: '4:00 PM - 5:00 PM',
    dinner: '7:00 PM - 9:00 PM'
  };
}

/**
 * POST /api/nutrition/upload-meal
 * Uploads and analyzes meal image, stores in user activity history
 */
export const uploadMeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    // Validate request body
    const { error, value: requestData } = uploadMealSchema.validate(req.body);
    if (error) {
      throw new AppError(400, `Invalid request data: ${error.details[0]?.message || 'Validation failed'}`);
    }

    // Check if image was uploaded
    const imageFile = req.file as Express.Multer.File;
    if (!imageFile) {
      throw new AppError(400, 'Meal image is required');
    }

    logger.info('Processing meal upload request', {
      service: 'nutrition-controller',
      userId,
      imageSize: imageFile.size,
      mealType: requestData.mealType,
      event: 'upload-meal-start'
    });

    // Initialize meal detection service
    const mealDetectionService = new MealDetectionService();

    // Compress and process image
    const processedImageBuffer = await mealDetectionService.compressImage(imageFile.buffer, 1024);

    // Detect meal using external service
    const detectionResult = await mealDetectionService.retryWithBackoff(
      () => mealDetectionService.identifyMeal(processedImageBuffer, imageFile.originalname),
      3,
      2000
    );

    // Generate unique meal ID
    const mealId = mealCacheService.generateMealId(userId);

    // Calculate total nutrition
    const totalNutrition = detectionResult.foods.reduce((total, food) => ({
      calories: total.calories + food.nutrition.calories,
      carbs: total.carbs + food.nutrition.carbs,
      fat: total.fat + food.nutrition.fat,
      protein: total.protein + food.nutrition.protein,
      fiber: total.fiber + food.nutrition.fiber
    }), { calories: 0, carbs: 0, fat: 0, protein: 0, fiber: 0 });

    // Store image in S3 and get CDN URL
    const uploadResult = await fileStorageService.uploadMealImage({
      userId,
      mealId,
      originalBuffer: processedImageBuffer,
      originalName: imageFile.originalname,
      optimize: true,
      makePublic: false
    });
    
    const imageUrl = uploadResult.cdnUrl;

    // Cache the meal
    await mealCacheService.cacheMeal({
      mealId,
      userId,
      imageUrl,
      foods: detectionResult.foods,
      totalNutrition,
      detectedAt: new Date(),
      correctionCount: 0,
      isVerified: false
    });

    // Store in user activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await UserActivity.findOneAndUpdate(
      { userId, date: today },
      {
        $push: {
          'dietActivity.uploadedMeals': {
            imageUrl,
            calories: totalNutrition.calories,
            macros: {
              carbs: totalNutrition.carbs,
              fat: totalNutrition.fat,
              protein: totalNutrition.protein,
              fiber: totalNutrition.fiber
            },
            uploadedAt: new Date(),
            aiVersion: '1.0',
            mealDetected: detectionResult.foods.map(f => f.name).join(', '),
            isVerified: false,
            mealId,
            previousBreakdown: mealDetectionService.formatMealForCorrection(detectionResult.foods)
          }
        }
      },
      { upsert: true }
    );

    logger.info('Meal uploaded and processed successfully', {
      service: 'nutrition-controller',
      userId,
      mealId,
      totalCalories: totalNutrition.calories,
      detectedFoodsCount: detectionResult.foods.length,
      event: 'upload-meal-success'
    });

    res.status(201).json({
      success: true,
      message: 'Meal uploaded and analyzed successfully',
      data: {
        mealId,
        detectedFoods: detectionResult.foods,
        totalNutrition,
        mealType: requestData.mealType,
        uploadedAt: new Date(),
        suggestions: {
          canCorrect: true,
          addToMealPlan: true,
          similarMeals: []
        }
      }
    });

  } catch (error) {
    logger.error('Failed to upload meal', error as Error, {
      service: 'nutrition-controller',
      userId: req.user?.id,
      event: 'upload-meal-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while processing meal upload',
        data: null
      });
    }
  }
};

/**
 * GET /api/nutrition/meal-history
 * Retrieves user's meal history with pagination and filtering
 */
export const getMealHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    // Validate query parameters
    const { error, value: queryParams } = mealHistoryQuerySchema.validate(req.query);
    if (error) {
      throw new AppError(400, `Invalid query parameters: ${error.details[0]?.message || 'Validation failed'}`);
    }

    logger.info('Fetching meal history for user', {
      service: 'nutrition-controller',
      userId,
      page: queryParams.page,
      limit: queryParams.limit,
      event: 'get-meal-history-start'
    });

    // Build date filter
    const dateFilter: any = {};
    if (queryParams.startDate) {
      dateFilter.$gte = queryParams.startDate;
    }
    if (queryParams.endDate) {
      dateFilter.$lte = queryParams.endDate;
    }

    // Query user activities with uploaded meals
    const skip = (queryParams.page - 1) * queryParams.limit;
    
    const activities = await UserActivity.find(
      { 
        userId, 
        'dietActivity.uploadedMeals': { $exists: true, $ne: [] },
        ...(Object.keys(dateFilter).length > 0 && { date: dateFilter })
      }
    )
    .sort({ date: -1 })
    .skip(skip)
    .limit(queryParams.limit)
    .lean();

    // Extract and format meal history
    const mealHistory = activities.flatMap(activity => 
      activity.dietActivity.uploadedMeals?.map(meal => ({
        mealId: meal.mealId,
        date: activity.date,
        uploadedAt: meal.uploadedAt,
        imageUrl: meal.imageUrl,
        mealDetected: meal.mealDetected,
        nutrition: {
          calories: meal.calories,
          macros: meal.macros
        },
        isVerified: meal.isVerified,
        correctionCount: meal.correctionHistory?.length || 0,
        canReuse: true,
        canCorrect: !meal.isVerified
      })) || []
    );

    // Get total count for pagination
    const totalActivities = await UserActivity.countDocuments({
      userId,
      'dietActivity.uploadedMeals': { $exists: true, $ne: [] },
      ...(Object.keys(dateFilter).length > 0 && { date: dateFilter })
    });

    const totalPages = Math.ceil(totalActivities / queryParams.limit);

    logger.info('Meal history retrieved successfully', {
      service: 'nutrition-controller',
      userId,
      mealCount: mealHistory.length,
      totalActivities,
      currentPage: queryParams.page,
      event: 'get-meal-history-success'
    });

    res.status(200).json({
      success: true,
      message: 'Meal history retrieved successfully',
      data: {
        meals: mealHistory,
        pagination: {
          currentPage: queryParams.page,
          totalPages,
          totalItems: totalActivities,
          itemsPerPage: queryParams.limit,
          hasNextPage: queryParams.page < totalPages,
          hasPreviousPage: queryParams.page > 1
        },
        summary: {
          totalMeals: mealHistory.length,
          avgCaloriesPerMeal: mealHistory.length > 0 
            ? Math.round(mealHistory.reduce((sum, meal) => sum + meal.nutrition.calories, 0) / mealHistory.length)
            : 0,
          verifiedMeals: mealHistory.filter(meal => meal.isVerified).length
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get meal history', error as Error, {
      service: 'nutrition-controller',
      userId: req.user?.id,
      event: 'get-meal-history-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching meal history',
        data: null
      });
    }
  }
};

/**
 * POST /api/nutrition/log-previous-meal
 * Logs a meal from history without re-scanning
 */
export const logPreviousMeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    // Validate request body
    const { error, value: requestData } = logPreviousMealSchema.validate(req.body);
    if (error) {
      throw new AppError(400, `Invalid request data: ${error.details[0]?.message || 'Validation failed'}`);
    }

    logger.info('Logging previous meal for user', {
      service: 'nutrition-controller',
      userId,
      mealId: requestData.mealId,
      event: 'log-previous-meal-start'
    });

    // Get cached meal data
    const cachedMeal = await mealCacheService.getCachedMeal(requestData.mealId);
    if (!cachedMeal || cachedMeal.userId !== userId) {
      throw new AppError(404, 'Meal not found in your history');
    }

    // Log to today's activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await UserActivity.findOneAndUpdate(
      { userId, date: today },
      {
        $push: {
          'dietActivity.uploadedMeals': {
            imageUrl: cachedMeal.imageUrl,
            calories: cachedMeal.totalNutrition.calories,
            macros: {
              carbs: cachedMeal.totalNutrition.carbs,
              fat: cachedMeal.totalNutrition.fat,
              protein: cachedMeal.totalNutrition.protein,
              fiber: cachedMeal.totalNutrition.fiber
            },
            uploadedAt: new Date(),
            aiVersion: '1.0',
            mealDetected: cachedMeal.foods.map(f => f.name).join(', '),
            isVerified: cachedMeal.isVerified,
            mealId: cachedMeal.mealId,
            previousBreakdown: cachedMeal.foods.length > 0 ? 
              new MealDetectionService().formatMealForCorrection(cachedMeal.foods) : ''
          }
        }
      },
      { upsert: true }
    );

    logger.info('Previous meal logged successfully', {
      service: 'nutrition-controller',
      userId,
      mealId: requestData.mealId,
      calories: cachedMeal.totalNutrition.calories,
      event: 'log-previous-meal-success'
    });

    res.status(201).json({
      success: true,
      message: 'Previous meal logged successfully',
      data: {
        loggedMeal: {
          mealId: cachedMeal.mealId,
          detectedFoods: cachedMeal.foods,
          totalNutrition: cachedMeal.totalNutrition,
          loggedAt: new Date(),
          mealType: requestData.mealType,
          isFromHistory: true
        }
      }
    });

  } catch (error) {
    logger.error('Failed to log previous meal', error as Error, {
      service: 'nutrition-controller',
      userId: req.user?.id,
      mealId: req.body.mealId,
      event: 'log-previous-meal-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while logging previous meal',
        data: null
      });
    }
  }
};

/**
 * POST /api/nutrition/correct-meal
 * Corrects a meal detection and triggers re-analysis
 */
export const correctMeal = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'User authentication required');
    }

    // Validate request body
    const { error, value: requestData } = correctMealSchema.validate(req.body);
    if (error) {
      throw new AppError(400, `Invalid request data: ${error.details[0]?.message || 'Validation failed'}`);
    }

    logger.info('Correcting meal for user', {
      service: 'nutrition-controller',
      userId,
      mealId: requestData.mealId,
      event: 'correct-meal-start'
    });

    // Get cached meal data
    const cachedMeal = await mealCacheService.getCachedMeal(requestData.mealId);
    if (!cachedMeal || cachedMeal.userId !== userId) {
      throw new AppError(404, 'Meal not found in your history');
    }

    // Get previous breakdown for correction
    const previousBreakdown = new MealDetectionService().formatMealForCorrection(cachedMeal.foods);

    // Initialize meal detection service and correct meal
    const mealDetectionService = new MealDetectionService();
    const correctedResult = await mealDetectionService.correctMeal(
      previousBreakdown,
      requestData.correction
    );

    // Calculate new total nutrition
    const newTotalNutrition = correctedResult.foods.reduce((total, food) => ({
      calories: total.calories + food.nutrition.calories,
      carbs: total.carbs + food.nutrition.carbs,
      fat: total.fat + food.nutrition.fat,
      protein: total.protein + food.nutrition.protein,
      fiber: total.fiber + food.nutrition.fiber
    }), { calories: 0, carbs: 0, fat: 0, protein: 0, fiber: 0 });

    // Update cached meal with correction
    await mealCacheService.updateMealAfterCorrection(requestData.mealId, {
      foods: correctedResult.foods,
      totalNutrition: newTotalNutrition,
      correctionCount: cachedMeal.correctionCount + 1
    });

    // Update user activity with corrected data
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Find and update the specific meal in user activities
        await UserActivity.updateOne(
          { 
            userId,
            'dietActivity.uploadedMeals.mealId': requestData.mealId
          },
          {
            $set: {
              'dietActivity.uploadedMeals.$.calories': newTotalNutrition.calories,
              'dietActivity.uploadedMeals.$.macros.carbs': newTotalNutrition.carbs,
              'dietActivity.uploadedMeals.$.macros.fat': newTotalNutrition.fat,
              'dietActivity.uploadedMeals.$.macros.protein': newTotalNutrition.protein,
              'dietActivity.uploadedMeals.$.macros.fiber': newTotalNutrition.fiber,
              'dietActivity.uploadedMeals.$.mealDetected': correctedResult.foods.map(f => f.name).join(', ')
            },
            $push: {
              'dietActivity.uploadedMeals.$.correctionHistory': {
                correction: requestData.correction,
                correctedAt: new Date(),
                previousData: {
                  calories: cachedMeal.totalNutrition.calories,
                  macros: {
                    carbs: cachedMeal.totalNutrition.carbs,
                    fat: cachedMeal.totalNutrition.fat,
                    protein: cachedMeal.totalNutrition.protein,
                    fiber: cachedMeal.totalNutrition.fiber
                  }
                }
              }
            }
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    logger.info('Meal corrected successfully', {
      service: 'nutrition-controller',
      userId,
      mealId: requestData.mealId,
      oldCalories: cachedMeal.totalNutrition.calories,
      newCalories: newTotalNutrition.calories,
      correctionCount: cachedMeal.correctionCount + 1,
      event: 'correct-meal-success'
    });

    res.status(200).json({
      success: true,
      message: 'Meal corrected and re-analyzed successfully',
      data: {
        correctedMeal: {
          mealId: requestData.mealId,
          correctedFoods: correctedResult.foods,
          newTotalNutrition,
          correctionApplied: requestData.correction,
          correctedAt: new Date(),
          correctionCount: cachedMeal.correctionCount + 1,
          previousNutrition: cachedMeal.totalNutrition
        },
        changes: {
          calorieChange: newTotalNutrition.calories - cachedMeal.totalNutrition.calories,
          macroChanges: {
            carbs: newTotalNutrition.carbs - cachedMeal.totalNutrition.carbs,
            fat: newTotalNutrition.fat - cachedMeal.totalNutrition.fat,
            protein: newTotalNutrition.protein - cachedMeal.totalNutrition.protein,
            fiber: newTotalNutrition.fiber - cachedMeal.totalNutrition.fiber
          }
        }
      }
    });

  } catch (error) {
    logger.error('Failed to correct meal', error as Error, {
      service: 'nutrition-controller',
      userId: req.user?.id,
      mealId: req.body.mealId,
      event: 'correct-meal-error'
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: null
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error while correcting meal',
        data: null
      });
    }
  }
};

export default {
  getDailyNutrition,
  getDayMealPlan,
  getNutritionLibrary,
  getCurrentMacros,
  uploadMeal,
  getMealHistory,
  logPreviousMeal,
  correctMeal
};