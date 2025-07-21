import { Router } from 'express';
import { 
  createSession,
  updateSession,
  terminateSession,
  getSessionHistory
} from '../controllers/sessions.controller';
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
  createSessionSchema,
  updateSessionSchema,
  sessionHistorySchema
} from '../utils/validation';

const router = Router();

/**
 * Session Management Routes
 * All routes are prefixed with /api/sessions
 * User routes for own sessions, Admin routes for managing any user's sessions
 */

/**
 * User Session Management Routes (User can access own sessions)
 */

/**
 * @route   GET /api/sessions/history
 * @desc    Retrieve own session history with filtering
 * @access  Private (User - own data only)
 */
router.get(
  '/history',
  authenticateToken,          // Require valid JWT
  validate({ query: sessionHistorySchema }), // Query parameter validation
  getSessionHistory           // Controller function
);

/**
 * Admin Routes for Managing Any User's Session Data
 * All routes require admin access
 */

/**
 * @route   POST /api/sessions/:userId/create
 * @desc    Create new user session with device information
 * @access  Private (Admin only)
 */
router.post(
  '/:userId/create',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  generalRateLimit,           // Rate limit: General rate limit
  auditAuth('SESSION_CREATE'), // Audit middleware
  sanitizationMiddleware,     // Input sanitization
  validate({ body: createSessionSchema }), // Joi validation
  createSession,              // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   PUT /api/sessions/:sessionId/update
 * @desc    Update session activity and last accessed time
 * @access  Private (Admin only)
 */
router.put(
  '/:sessionId/update',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  generalRateLimit,           // Rate limit: General rate limit
  auditAuth('SESSION_UPDATE'), // Audit middleware
  sanitizationMiddleware,     // Input sanitization
  validate({ body: updateSessionSchema }), // Joi validation
  updateSession,              // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   DELETE /api/sessions/:sessionId
 * @desc    Terminate session and cleanup
 * @access  Private (Admin only)
 */
router.delete(
  '/:sessionId',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  auditAuth('SESSION_TERMINATE'), // Audit middleware
  terminateSession,           // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   GET /api/sessions/:userId/history
 * @desc    Retrieve user session history with filtering
 * @access  Private (Admin only)
 */
router.get(
  '/:userId/history',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  validate({ query: sessionHistorySchema }), // Query parameter validation
  getSessionHistory           // Controller function
);

export default router;