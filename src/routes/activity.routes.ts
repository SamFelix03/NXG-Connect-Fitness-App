import { Router } from 'express';
import { 
  logActivity,
  getActivityTimeline,
  getActivitySummary,
  updateActivity
} from '../controllers/activity.controller';
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
  logActivitySchema,
  activityTimelineSchema,
  activitySummarySchema,
  updateActivitySchema
} from '../utils/validation';

const router = Router();

/**
 * User Activity Management Routes
 * All routes are prefixed with /api/activity
 * Users can access their own data, admins can access any user's data
 */

/**
 * @route   POST /api/activity/log
 * @desc    Log own activity (workout, meal, achievement)
 * @access  Private (User - own data only)
 */
router.post(
  '/log',
  authenticateToken,          // Require valid JWT
  generalRateLimit,           // Rate limit: General rate limit
  auditAuth('ACTIVITY_LOG'),  // Audit middleware
  sanitizationMiddleware,     // Input sanitization
  validate({ body: logActivitySchema }), // Joi validation
  logActivity,                // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   GET /api/activity/timeline
 * @desc    Retrieve own activity timeline with filtering
 * @access  Private (User - own data only)
 */
router.get(
  '/timeline',
  authenticateToken,          // Require valid JWT
  validate({ query: activityTimelineSchema }), // Query parameter validation
  getActivityTimeline         // Controller function
);

/**
 * @route   GET /api/activity/summary
 * @desc    Get own activity summary and progress analytics
 * @access  Private (User - own data only)
 */
router.get(
  '/summary',
  authenticateToken,          // Require valid JWT
  validate({ query: activitySummarySchema }), // Query parameter validation
  getActivitySummary          // Controller function
);

/**
 * @route   PUT /api/activity/:activityId
 * @desc    Update own activity entry with additional data
 * @access  Private (User - own data only)
 */
router.put(
  '/:activityId',
  authenticateToken,          // Require valid JWT
  auditAuth('ACTIVITY_UPDATE'), // Audit middleware
  sanitizationMiddleware,     // Input sanitization
  validate({ body: updateActivitySchema }), // Joi validation
  updateActivity,             // Controller function
  completeAudit               // Complete audit logging
);

/**
 * Admin Routes for Managing Any User's Activity Data
 * All routes require admin access
 */

/**
 * @route   POST /api/activity/:userId/log
 * @desc    Log user activity (workout, meal, achievement) - Admin only
 * @access  Private (Admin only)
 */
router.post(
  '/:userId/log',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  generalRateLimit,           // Rate limit: General rate limit
  auditAuth('ADMIN_ACTIVITY_LOG'),  // Audit middleware
  sanitizationMiddleware,     // Input sanitization
  validate({ body: logActivitySchema }), // Joi validation
  logActivity,                // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   GET /api/activity/:userId/timeline
 * @desc    Retrieve user activity timeline with filtering - Admin only
 * @access  Private (Admin only)
 */
router.get(
  '/:userId/timeline',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  validate({ query: activityTimelineSchema }), // Query parameter validation
  getActivityTimeline         // Controller function
);

/**
 * @route   GET /api/activity/:userId/summary
 * @desc    Get user activity summary and progress analytics - Admin only
 * @access  Private (Admin only)
 */
router.get(
  '/:userId/summary',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  validate({ query: activitySummarySchema }), // Query parameter validation
  getActivitySummary          // Controller function
);

/**
 * @route   PUT /api/activity/:userId/:activityId
 * @desc    Update user activity entry with additional data - Admin only
 * @access  Private (Admin only)
 */
router.put(
  '/:userId/:activityId',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  auditAuth('ADMIN_ACTIVITY_UPDATE'), // Audit middleware
  sanitizationMiddleware,     // Input sanitization
  validate({ body: updateActivitySchema }), // Joi validation
  updateActivity,             // Controller function
  completeAudit               // Complete audit logging
);

export default router;