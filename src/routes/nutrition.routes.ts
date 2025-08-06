import { Router } from 'express';
import { 
  getDailyNutrition,
  getDayMealPlan,
  getNutritionLibrary,
  getCurrentMacros,
  uploadMeal,
  getMealHistory,
  logPreviousMeal,
  correctMeal
} from '../controllers/nutrition.controller';
import { 
  authenticateToken
} from '../middleware/auth.middleware';
import { 
  generalRateLimit,
  nutritionRateLimit
} from '../middleware/rateLimit.middleware';
import { sanitizationMiddleware } from '../middleware/sanitization.middleware';
import { auditAuth, completeAudit } from '../middleware/audit.middleware';
import multer from 'multer';

const router = Router();

// Configure multer for meal image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * Nutrition Routes
 * All routes are prefixed with /api/nutrition
 * 
 * These routes handle nutrition-related functionality including daily meal plans,
 * nutrition library, macro tracking, and dietary recommendations.
 */

/**
 * GET /api/nutrition/daily
 * Get user's complete daily nutrition plan with all days
 * 
 * Returns the user's active diet plan with weekly meal plan including:
 * - Complete meal plan for all 7 days
 * - Total macro targets
 * - Daily calorie distribution
 * - Meal timing recommendations
 * 
 * Authentication: Required (user access to their own data)
 * Rate Limiting: General rate limit applied
 */
router.get(
  '/daily',
  authenticateToken,
  auditAuth('read-daily-nutrition'),
  generalRateLimit,
  sanitizationMiddleware,
  getDailyNutrition,
  completeAudit
);

/**
 * GET /api/nutrition/daily/:day
 * Get specific day's meal plan from user's active diet plan
 * 
 * Path Parameters:
 * - day: Day number (1-7, where 1 = Monday, 7 = Sunday)
 * 
 * Returns detailed meal information for the specified day including:
 * - All meals with descriptions and calories
 * - Meal timing recommendations
 * - Preparation time estimates
 * - Nutritional distribution
 * 
 * Authentication: Required (user access to their own data)
 * Rate Limiting: General rate limit applied
 */
router.get(
  '/daily/:day',
  authenticateToken,
  auditAuth('read-day-meal-plan'),
  generalRateLimit,
  sanitizationMiddleware,
  getDayMealPlan,
  completeAudit
);

/**
 * GET /api/nutrition/library
 * Get nutrition library with dietary options and meal categories
 * 
 * Query Parameters:
 * - category (optional): Filter by category ('meals', 'cuisines', 'dietary_restrictions')
 * - filter (optional): Search filter string
 * - limit (optional): Number of items to return (default: 20, max: 100)
 * - offset (optional): Number of items to skip (default: 0)
 * 
 * Returns comprehensive nutrition library including:
 * - Cuisine types and dietary options
 * - Meal categories with recommended timings
 * - Dietary restrictions and alternatives
 * - Nutrition tips and recommendations
 * 
 * Authentication: Required (user access to their own data)
 * Rate Limiting: Nutrition-specific rate limit (higher frequency allowed)
 */
router.get(
  '/library',
  authenticateToken,
  auditAuth('read-nutrition-library'),
  nutritionRateLimit,
  sanitizationMiddleware,
  getNutritionLibrary,
  completeAudit
);

/**
 * GET /api/nutrition/macros
 * Get user's current macro targets and progress
 * 
 * Returns detailed macro information including:
 * - Current macro targets (calories, carbs, protein, fat, fiber)
 * - Macro percentages and calorie breakdown
 * - Diet plan information
 * - Nutrition recommendations
 * 
 * Authentication: Required (user access to their own data)
 * Rate Limiting: General rate limit applied
 */
router.get(
  '/macros',
  authenticateToken,
  auditAuth('read-current-macros'),
  generalRateLimit,
  sanitizationMiddleware,
  getCurrentMacros,
  completeAudit
);

/**
 * POST /api/nutrition/upload-meal
 * Upload and analyze meal image using AI detection service
 * 
 * Body Parameters:
 * - image: Image file (multipart/form-data) - Required
 * - mealType (optional): Type of meal ('breakfast', 'lunch', 'dinner', 'snack')
 * - notes (optional): Additional notes about the meal (max 500 chars)
 * 
 * Returns meal analysis including:
 * - Detected food items with nutritional breakdown
 * - Total calories and macro distribution
 * - Meal ID for future reference
 * - Suggestions for corrections
 * 
 * Authentication: Required (user access to their own data)
 * Rate Limiting: Nutrition-specific rate limit (AI processing intensive)
 */
router.post(
  '/upload-meal',
  authenticateToken,
  auditAuth('upload-meal'),
  nutritionRateLimit,
  upload.single('image'),
  sanitizationMiddleware,
  uploadMeal,
  completeAudit
);

/**
 * GET /api/nutrition/meal-history
 * Retrieve user's meal history with pagination and filtering
 * 
 * Query Parameters:
 * - page (optional): Page number (default: 1)
 * - limit (optional): Items per page (default: 20, max: 50)
 * - startDate (optional): Filter meals from this date
 * - endDate (optional): Filter meals to this date
 * 
 * Returns meal history including:
 * - Paginated list of uploaded meals
 * - Meal images and detected nutrition data
 * - Correction history for each meal
 * - Reusability options
 * 
 * Authentication: Required (user access to their own data)
 * Rate Limiting: General rate limit applied
 */
router.get(
  '/meal-history',
  authenticateToken,
  auditAuth('read-meal-history'),
  generalRateLimit,
  sanitizationMiddleware,
  getMealHistory,
  completeAudit
);

/**
 * POST /api/nutrition/log-previous-meal
 * Log a meal from history without re-scanning the image
 * 
 * Body Parameters:
 * - mealId: Unique meal identifier from history - Required
 * - mealType (optional): Type of meal ('breakfast', 'lunch', 'dinner', 'snack')
 * - notes (optional): Additional notes about logging this meal
 * 
 * Returns logging confirmation including:
 * - Logged meal details and nutrition
 * - Updated meal history entry
 * - Daily nutrition progress
 * 
 * Authentication: Required (user access to their own data)
 * Rate Limiting: General rate limit applied
 */
router.post(
  '/log-previous-meal',
  authenticateToken,
  auditAuth('log-previous-meal'),
  generalRateLimit,
  sanitizationMiddleware,
  logPreviousMeal,
  completeAudit
);

/**
 * POST /api/nutrition/correct-meal
 * Correct a meal detection and trigger re-analysis using AI service
 * 
 * Body Parameters:
 * - mealId: Unique meal identifier to correct - Required
 * - correction: Correction description (min: 10, max: 1000 chars) - Required
 * - mealType (optional): Updated meal type if needed
 * 
 * Returns corrected meal data including:
 * - Re-analyzed food items and nutrition
 * - Comparison with previous detection
 * - Updated meal history with correction
 * - Change summary and impact
 * 
 * Authentication: Required (user access to their own data)
 * Rate Limiting: Nutrition-specific rate limit (AI processing intensive)
 */
router.post(
  '/correct-meal',
  authenticateToken,
  auditAuth('correct-meal'),
  nutritionRateLimit,
  sanitizationMiddleware,
  correctMeal,
  completeAudit
);

/**
 * Health Check for Nutrition Service
 * GET /api/nutrition/health
 */
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Nutrition service is healthy',
    data: {
      service: 'nutrition',
      status: 'operational',
      timestamp: new Date().toISOString(),
      availableEndpoints: [
        'GET /api/nutrition/daily',
        'GET /api/nutrition/daily/:day',
        'GET /api/nutrition/library',
        'GET /api/nutrition/macros',
        'POST /api/nutrition/upload-meal',
        'GET /api/nutrition/meal-history',
        'POST /api/nutrition/log-previous-meal',
        'POST /api/nutrition/correct-meal'
      ],
      features: {
        dailyMealPlans: 'enabled',
        nutritionLibrary: 'enabled',
        macroTracking: 'enabled',
        dietaryPreferences: 'enabled',
        mealImageAnalysis: 'enabled',
        mealHistory: 'enabled',
        mealCorrection: 'enabled',
        mealReuse: 'enabled'
      },
      dependencies: {
        dietPlanCacheService: 'connected',
        database: 'connected',
        redisCache: 'connected',
        mealDetectionService: 'connected',
        mealCacheService: 'connected'
      }
    }
  });
});

export default router;