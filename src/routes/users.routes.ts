import { Router } from 'express';
import { 
  createUser,
  getProfile,
  updateProfile,
  deleteAccount,
  joinBranch,
  leaveBranch,
  getUserBranches,
  searchUsers,
  updateUserStatus,
  getUserById,
  getBodyMetrics,
  updateBodyMetrics,
  getBodyMetricsHistory,
  getPrivacySettings,
  updatePrivacySettings,
  exportHealthData,
  getUserPreferences,
  updateUserPreferences,
  registerDeviceToken,
  removeDeviceToken
} from '../controllers/users.controller';
import { 
  authenticateToken,
  requireRole,
  requireUserOrAdmin
} from '../middleware/auth.middleware';
import { 
  generalRateLimit,
  registerRateLimit
} from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validation.middleware';
import { sanitizationMiddleware } from '../middleware/sanitization.middleware';
import { auditAuth, completeAudit } from '../middleware/audit.middleware';
import {
  createUserSchema,
  updateProfileSchema,
  bodyMetricsSchema,
  bodyMetricsHistorySchema,
  privacySettingsSchema,
  userPreferencesSchema,
  deviceTokenSchema
} from '../utils/validation';

const router = Router();

/**
 * Administrative User Management Routes
 * All routes are prefixed with /api/users
 * All routes require admin access
 */

/**
 * @route   POST /api/users/create
 * @desc    Create a new user profile with comprehensive fitness data (Admin only)
 * @access  Private (Admin only)
 */
router.post(
  '/create',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  registerRateLimit,          // Rate limit: 3 attempts per hour
  auditAuth('USER_CREATION'), // Audit middleware
  sanitizationMiddleware,     // Input sanitization
  validate({ body: createUserSchema }), // Joi validation
  createUser,                 // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   GET /api/users/search
 * @desc    Search users with filtering
 * @access  Private (Admin only)
 */
router.get(
  '/search',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  searchUsers                 // Controller function
);

/**
 * @route   GET /api/users/:userId
 * @desc    Get user details by ID
 * @access  Private (Admin only)
 */
router.get(
  '/:userId',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  getUserById                 // Controller function
);

/**
 * @route   GET /api/users/:userId/profile
 * @desc    Get user profile by ID (Admin only)
 * @access  Private (Admin only)
 */
router.get(
  '/:userId/profile',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  getProfile                  // Controller function
);

/**
 * @route   PUT /api/users/:userId/profile
 * @desc    Update user profile by ID (Admin only)
 * @access  Private (Admin only)
 */
router.put(
  '/:userId/profile',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  auditAuth('PROFILE_UPDATE'), // Audit middleware
  sanitizationMiddleware,     // Input sanitization
  validate({ body: updateProfileSchema }), // Joi validation
  updateProfile,              // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   PUT /api/users/:userId/status
 * @desc    Update user account status
 * @access  Private (Admin only)
 */
router.put(
  '/:userId/status',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  auditAuth('USER_STATUS_UPDATE'), // Audit middleware
  sanitizationMiddleware,     // Input sanitization
  updateUserStatus,           // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   DELETE /api/users/:userId/account
 * @desc    Delete user account with GDPR compliance (Admin only)
 * @access  Private (Admin only)
 */
router.delete(
  '/:userId/account',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  auditAuth('ACCOUNT_DELETION'), // Audit middleware
  deleteAccount,              // Controller function
  completeAudit               // Complete audit logging
);

/**
 * Branch Management Routes (Admin only)
 */

/**
 * @route   GET /api/users/:userId/branches
 * @desc    Get user's branch memberships
 * @access  Private (User can view own, Admin can view any)
 */
router.get(
  '/:userId/branches',
  authenticateToken,          // Require valid JWT
  requireUserOrAdmin(),       // User owns resource OR admin
  getUserBranches             // Controller function
);

/**
 * @route   POST /api/users/:userId/branches/join
 * @desc    Add user to a branch (Admin only)
 * @access  Private (Admin only)
 */
router.post(
  '/:userId/branches/join',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  generalRateLimit,           // Rate limit: General rate limit
  sanitizationMiddleware,     // Input sanitization
  joinBranch                  // Controller function
);

/**
 * @route   DELETE /api/users/:userId/branches/:branchId
 * @desc    Remove user from a branch (Admin only)
 * @access  Private (Admin only)
 */
router.delete(
  '/:userId/branches/:branchId',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  leaveBranch                 // Controller function
);

/**
 * Body Metrics Management Routes (Admin only)
 */

/**
 * @route   GET /api/users/:userId/body-metrics
 * @desc    Get user's current body metrics
 * @access  Private (User can access own, Admin can access any)
 */
router.get(
  '/:userId/body-metrics',
  authenticateToken,          // Require valid JWT
  requireUserOrAdmin(),       // User owns resource OR admin
  getBodyMetrics              // Controller function
);

/**
 * @route   PUT /api/users/:userId/body-metrics
 * @desc    Update user's body metrics
 * @access  Private (User can update own, Admin can update any)
 */
router.put(
  '/:userId/body-metrics',
  authenticateToken,          // Require valid JWT
  requireUserOrAdmin(),       // User owns resource OR admin
  auditAuth('BODY_METRICS_UPDATE'), // Audit middleware
  sanitizationMiddleware,     // Input sanitization
  validate({ body: bodyMetricsSchema }), // Joi validation
  updateBodyMetrics,          // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   GET /api/users/:userId/body-metrics/history
 * @desc    Get user's body metrics history with filtering
 * @access  Private (User can access own, Admin can access any)
 */
router.get(
  '/:userId/body-metrics/history',
  authenticateToken,          // Require valid JWT
  requireUserOrAdmin(),       // User owns resource OR admin
  validate({ query: bodyMetricsHistorySchema }), // Query parameter validation
  getBodyMetricsHistory       // Controller function
);

/**
 * Privacy & Health Data Export Routes (Admin only)
 */

/**
 * @route   GET /api/users/:userId/privacy
 * @desc    Get user's privacy settings
 * @access  Private (User can access own, Admin can access any)
 */
router.get(
  '/:userId/privacy',
  authenticateToken,          // Require valid JWT
  requireUserOrAdmin(),       // User owns resource OR admin
  getPrivacySettings          // Controller function
);

/**
 * @route   PUT /api/users/:userId/privacy
 * @desc    Update user's privacy settings
 * @access  Private (User can update own, Admin can update any)
 */
router.put(
  '/:userId/privacy',
  authenticateToken,          // Require valid JWT
  requireUserOrAdmin(),       // User owns resource OR admin
  auditAuth('PRIVACY_SETTINGS_UPDATE'), // Audit middleware
  sanitizationMiddleware,     // Input sanitization
  validate({ body: privacySettingsSchema }), // Joi validation
  updatePrivacySettings,      // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   GET /api/users/:userId/health-data/export
 * @desc    Export user's health data (GDPR compliance)
 * @access  Private (Admin only)
 */
router.get(
  '/:userId/health-data/export',
  authenticateToken,          // Require valid JWT
  requireRole(['admin']),     // Admin access only
  auditAuth('HEALTH_DATA_EXPORT'), // Audit middleware
  exportHealthData,           // Controller function
  completeAudit               // Complete audit logging
);

/**
 * User Preferences Management Routes (User Access)
 */

/**
 * @route   GET /api/users/:userId/preferences
 * @desc    Get user preferences and settings (User can access own, Admin can access any)
 * @access  Private (User or Admin)
 */
router.get(
  '/:userId/preferences',
  authenticateToken,          // Require valid JWT
  requireUserOrAdmin(),       // User owns resource OR admin
  getUserPreferences          // Controller function
);

/**
 * @route   PUT /api/users/:userId/preferences
 * @desc    Update user preferences with validation (User can update own, Admin can update any)
 * @access  Private (User or Admin)
 */
router.put(
  '/:userId/preferences',
  authenticateToken,          // Require valid JWT
  requireUserOrAdmin(),       // User owns resource OR admin
  auditAuth('USER_PREFERENCES_UPDATE'), // Audit middleware
  sanitizationMiddleware,     // Input sanitization
  validate({ body: userPreferencesSchema }), // Joi validation
  updateUserPreferences,      // Controller function
  completeAudit               // Complete audit logging
);

/**
 * Device Token Management Routes (User Access)
 */

/**
 * @route   POST /api/users/:userId/devices
 * @desc    Register device token for push notifications (User can register own, Admin can register any)
 * @access  Private (User or Admin)
 */
router.post(
  '/:userId/devices',
  authenticateToken,          // Require valid JWT
  requireUserOrAdmin(),       // User owns resource OR admin
  generalRateLimit,           // Rate limit: General rate limit
  auditAuth('DEVICE_TOKEN_REGISTER'), // Audit middleware
  sanitizationMiddleware,     // Input sanitization
  validate({ body: deviceTokenSchema }), // Joi validation
  registerDeviceToken,        // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   DELETE /api/users/:userId/devices/:tokenId
 * @desc    Remove device token (User can remove own, Admin can remove any)
 * @access  Private (User or Admin)
 */
router.delete(
  '/:userId/devices/:tokenId',
  authenticateToken,          // Require valid JWT
  requireUserOrAdmin(),       // User owns resource OR admin
  auditAuth('DEVICE_TOKEN_REMOVE'), // Audit middleware
  removeDeviceToken,          // Controller function
  completeAudit               // Complete audit logging
);

export default router; 