"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentMacros = exports.getNutritionLibrary = exports.getDayMealPlan = exports.getDailyNutrition = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("../utils/logger");
const diet_plan_cache_service_1 = require("../services/diet-plan-cache.service");
const errors_1 = require("../utils/errors");
const dayParamSchema = joi_1.default.object({
    day: joi_1.default.number().min(1).max(7).required()
});
const libraryQuerySchema = joi_1.default.object({
    category: joi_1.default.string().valid('meals', 'cuisines', 'dietary_restrictions').optional(),
    filter: joi_1.default.string().optional(),
    limit: joi_1.default.number().min(1).max(100).default(20),
    offset: joi_1.default.number().min(0).default(0)
});
const getDailyNutrition = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.AppError(401, 'User authentication required');
        }
        logger_1.logger.info('Fetching daily nutrition plan for user', {
            service: 'nutrition-controller',
            userId,
            event: 'get-daily-nutrition-start'
        });
        const activeDietPlan = await diet_plan_cache_service_1.dietPlanCacheService.getUserActiveDietPlan(userId);
        if (!activeDietPlan) {
            logger_1.logger.info('No active diet plan found for user', {
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
        const totalMealsPerDay = activeDietPlan.mealPlan.length > 0 ?
            activeDietPlan.mealPlan[0]?.meals.length || 0 : 0;
        const avgCaloriesPerDay = activeDietPlan.mealPlan.reduce((total, day) => {
            return total + day.meals.reduce((dayTotal, meal) => dayTotal + meal.calories, 0);
        }, 0) / Math.max(activeDietPlan.mealPlan.length, 1);
        logger_1.logger.info('Daily nutrition plan retrieved successfully', {
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get daily nutrition plan', error, {
            service: 'nutrition-controller',
            userId: req.user?.id,
            event: 'get-daily-nutrition-error'
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
                message: 'Internal server error while fetching daily nutrition plan',
                data: null
            });
        }
    }
};
exports.getDailyNutrition = getDailyNutrition;
const getDayMealPlan = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.AppError(401, 'User authentication required');
        }
        const { error, value: params } = dayParamSchema.validate(req.params);
        if (error) {
            throw new errors_1.AppError(400, `Invalid day parameter: ${error.details[0]?.message || 'Validation failed'}`);
        }
        const dayNumber = params.day;
        logger_1.logger.info('Fetching day meal plan for user', {
            service: 'nutrition-controller',
            userId,
            dayNumber,
            event: 'get-day-meal-plan-start'
        });
        const dayMeals = await diet_plan_cache_service_1.dietPlanCacheService.getDayMeals(userId, dayNumber);
        if (!dayMeals) {
            logger_1.logger.info('No meal plan found for specified day', {
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
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const dayName = dayNames[dayNumber - 1];
        logger_1.logger.info('Day meal plan retrieved successfully', {
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
                meals: (dayMeals.meals || []).map((meal) => ({
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get day meal plan', error, {
            service: 'nutrition-controller',
            userId: req.user?.id,
            dayNumber: req.params['day'],
            event: 'get-day-meal-plan-error'
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
                message: 'Internal server error while fetching day meal plan',
                data: null
            });
        }
    }
};
exports.getDayMealPlan = getDayMealPlan;
const getNutritionLibrary = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.AppError(401, 'User authentication required');
        }
        const { error, value: queryParams } = libraryQuerySchema.validate(req.query);
        if (error) {
            throw new errors_1.AppError(400, `Invalid query parameters: ${error.details[0]?.message || 'Validation failed'}`);
        }
        logger_1.logger.info('Fetching nutrition library', {
            service: 'nutrition-controller',
            userId,
            category: queryParams.category,
            filter: queryParams.filter,
            event: 'get-nutrition-library-start'
        });
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
        let filteredData = libraryData;
        if (queryParams.category) {
            switch (queryParams.category) {
                case 'meals':
                    filteredData = { mealCategories: libraryData.mealCategories };
                    break;
                case 'cuisines':
                    filteredData = { cuisineTypes: libraryData.cuisineTypes };
                    break;
                case 'dietary_restrictions':
                    filteredData = { dietaryRestrictions: libraryData.dietaryRestrictions };
                    break;
            }
        }
        const totalItems = Object.keys(filteredData).reduce((total, key) => {
            const items = filteredData[key];
            return total + (Array.isArray(items) ? items.length : 0);
        }, 0);
        logger_1.logger.info('Nutrition library retrieved successfully', {
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
                    suggestedCuisines: ['Indian', 'Continental'],
                    recommendedMealTiming: getRecommendedMealTiming(),
                    dailyCalorieTarget: null
                }
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get nutrition library', error, {
            service: 'nutrition-controller',
            userId: req.user?.id,
            event: 'get-nutrition-library-error'
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
                message: 'Internal server error while fetching nutrition library',
                data: null
            });
        }
    }
};
exports.getNutritionLibrary = getNutritionLibrary;
const getCurrentMacros = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.AppError(401, 'User authentication required');
        }
        logger_1.logger.info('Fetching current macros for user', {
            service: 'nutrition-controller',
            userId,
            event: 'get-current-macros-start'
        });
        const activeDietPlan = await diet_plan_cache_service_1.dietPlanCacheService.getUserActiveDietPlan(userId);
        if (!activeDietPlan) {
            logger_1.logger.info('No active diet plan found for macro targets', {
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
        const totalCalories = parseInt(activeDietPlan.totalMacros.calories);
        const carbsGrams = parseInt(activeDietPlan.totalMacros.carbs.replace('g', ''));
        const proteinGrams = parseInt(activeDietPlan.totalMacros.protein.replace('g', ''));
        const fatGrams = parseInt(activeDietPlan.totalMacros.fat.replace('g', ''));
        const macroPercentages = {
            carbs: Math.round((carbsGrams * 4 / totalCalories) * 100),
            protein: Math.round((proteinGrams * 4 / totalCalories) * 100),
            fat: Math.round((fatGrams * 9 / totalCalories) * 100)
        };
        logger_1.logger.info('Current macros retrieved successfully', {
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get current macros', error, {
            service: 'nutrition-controller',
            userId: req.user?.id,
            event: 'get-current-macros-error'
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
                message: 'Internal server error while fetching current macros',
                data: null
            });
        }
    }
};
exports.getCurrentMacros = getCurrentMacros;
function getEstimatedPrepTime(mealType) {
    const prepTimes = {
        'Breakfast': '15-20 minutes',
        'Snack 1': '5-10 minutes',
        'Lunch': '25-30 minutes',
        'Snack 2': '5-10 minutes',
        'Dinner': '20-25 minutes'
    };
    return prepTimes[mealType] || '15-20 minutes';
}
function getMealTiming(mealType) {
    const timings = {
        'Breakfast': '7:00 AM - 9:00 AM',
        'Snack 1': '10:00 AM - 11:00 AM',
        'Lunch': '12:00 PM - 2:00 PM',
        'Snack 2': '4:00 PM - 5:00 PM',
        'Dinner': '7:00 PM - 9:00 PM'
    };
    return timings[mealType] || 'Flexible timing';
}
function calculateMealDistribution(meals) {
    const distribution = {};
    const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
    meals.forEach(meal => {
        distribution[meal.mealType] = Math.round((meal.calories / totalCalories) * 100);
    });
    return distribution;
}
function getRecommendedMealTiming() {
    return {
        breakfast: '7:00 AM - 9:00 AM',
        morningSnack: '10:00 AM - 11:00 AM',
        lunch: '12:00 PM - 2:00 PM',
        eveningSnack: '4:00 PM - 5:00 PM',
        dinner: '7:00 PM - 9:00 PM'
    };
}
exports.default = {
    getDailyNutrition: exports.getDailyNutrition,
    getDayMealPlan: exports.getDayMealPlan,
    getNutritionLibrary: exports.getNutritionLibrary,
    getCurrentMacros: exports.getCurrentMacros
};
//# sourceMappingURL=nutrition.controller.js.map