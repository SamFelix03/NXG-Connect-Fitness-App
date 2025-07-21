import { Router } from 'express';
import { 
  logEvent,
  getEngagementMetrics,
  getAggregatedData,
  getPerformanceMetrics
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
  performanceMetricsSchema
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

export default router;