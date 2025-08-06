import { Router } from 'express';
import { 
  logEvent,
  getEngagementMetrics,
  getAggregatedData,
  getPerformanceMetrics,
  getDailyWorkoutAnalytics,
  getWeeklyWorkoutProgress,
  getWorkoutHistoryAnalytics,
  getWorkoutGoalTracking,
  getPerformanceComparison,
  getAutoProgressionSuggestions,
  getExerciseSpecificAnalytics
} from '../controllers/analytics.controller';
import { 
  authenticateToken,
  requireRole
} from '../middleware/auth.middleware';
import { 
  generalRateLimit
} from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validation.middleware';
import { sanitizationMiddleware } from '../middleware/sanitization.middleware';
import { auditAuth, completeAudit } from '../middleware/audit.middleware';
import {
  logEventSchema,
  engagementMetricsSchema,
  aggregationSchema,
  performanceMetricsSchema,
  dailyAnalyticsSchema,
  weeklyAnalyticsSchema,
  workoutHistorySchema,
  goalTrackingSchema
} from '../utils/validation';

const router = Router();

/**
 * Analytics Management Routes
 * All routes are prefixed with /api/analytics
 * All routes require admin access
 */

/**
 * @route   POST /api/analytics/:userId/events
 * @desc    Log user interaction events and feature usage
 * @access  Private (Admin only)
 */
router.post(
  '/:userId/events',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  generalRateLimit,           // Rate limit: General rate limit
  auditAuth('ANALYTICS_EVENT_LOG'), // Audit middleware
  sanitizationMiddleware,     // Input sanitization
  validate({ body: logEventSchema }), // Joi validation
  logEvent,                   // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   GET /api/analytics/:userId/engagement
 * @desc    Retrieve engagement metrics and usage statistics
 * @access  Private (Admin only)
 */
router.get(
  '/:userId/engagement',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  validate({ query: engagementMetricsSchema }), // Query parameter validation
  getEngagementMetrics        // Controller function
);

/**
 * @route   GET /api/analytics/:userId/aggregation
 * @desc    Get daily, weekly, monthly activity summaries
 * @access  Private (Admin only)
 */
router.get(
  '/:userId/aggregation',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  validate({ query: aggregationSchema }), // Query parameter validation
  getAggregatedData           // Controller function
);

/**
 * @route   GET /api/analytics/performance
 * @desc    Retrieve app performance and API metrics
 * @access  Private (Admin only)
 */
router.get(
  '/performance',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  validate({ query: performanceMetricsSchema }), // Query parameter validation
  getPerformanceMetrics       // Controller function
);

/**
 * Workout Analytics Routes
 * These routes provide workout-specific analytics and insights
 * Access: Private (User can access their own data, Admin can access any user's data)
 */

/**
 * @route   GET /api/analytics/workout/daily
 * @desc    Get daily workout analytics - completion percentages, consistency scores, and performance metrics
 * @access  Private (User)
 */
router.get(
  '/workout/daily',
  authenticateToken,                    // Require valid JWT
  generalRateLimit,                     // Rate limiting
  validate({ query: dailyAnalyticsSchema }), // Query parameter validation
  getDailyWorkoutAnalytics              // Controller function
);

/**
 * @route   GET /api/analytics/workout/weekly
 * @desc    Get weekly workout progress - strength gains, endurance improvements, and workout streaks
 * @access  Private (User)
 */
router.get(
  '/workout/weekly',
  authenticateToken,                    // Require valid JWT
  generalRateLimit,                     // Rate limiting
  validate({ query: weeklyAnalyticsSchema }), // Query parameter validation
  getWeeklyWorkoutProgress              // Controller function
);

/**
 * @route   GET /api/analytics/workout/history
 * @desc    Get workout history analytics with filterable exercise logs and performance trends
 * @access  Private (User)
 */
router.get(
  '/workout/history',
  authenticateToken,                    // Require valid JWT
  generalRateLimit,                     // Rate limiting
  validate({ query: workoutHistorySchema }), // Query parameter validation
  getWorkoutHistoryAnalytics            // Controller function
);

/**
 * @route   GET /api/analytics/goals/workout
 * @desc    Get workout goal tracking - progress toward strength, endurance, and consistency targets
 * @access  Private (User)
 */
router.get(
  '/goals/workout',
  authenticateToken,                    // Require valid JWT
  generalRateLimit,                     // Rate limiting
  validate({ query: goalTrackingSchema }), // Query parameter validation
  getWorkoutGoalTracking                // Controller function
);

/**
 * @route   GET /api/analytics/workout/comparison
 * @desc    Get performance comparison analytics with anonymized benchmarking
 * @access  Private (User)
 */
router.get(
  '/workout/comparison',
  authenticateToken,                    // Require valid JWT
  generalRateLimit,                     // Rate limiting
  getPerformanceComparison              // Controller function
);

/**
 * @route   GET /api/analytics/workout/progression
 * @desc    Get auto-progression suggestions for weight/rep adjustments
 * @access  Private (User)
 */
router.get(
  '/workout/progression',
  authenticateToken,                    // Require valid JWT
  generalRateLimit,                     // Rate limiting
  getAutoProgressionSuggestions         // Controller function
);

/**
 * @route   GET /api/analytics/workout/exercise/:exerciseId
 * @desc    Get exercise-specific analytics - personal records, volume progression, technique improvements
 * @access  Private (User)
 */
router.get(
  '/workout/exercise/:exerciseId',
  authenticateToken,                    // Require valid JWT
  generalRateLimit,                     // Rate limiting
  getExerciseSpecificAnalytics          // Controller function
);

export default router;