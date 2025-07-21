import { Router } from 'express';
import { 
  register, 
  login, 
  refreshToken, 
  logout, 
  forgotPassword, 
  resetPassword, 
  getProfile,
  updateProfile,
  verifyEmail,
  resendVerification,
  changePassword,
  getSessions,
  revokeSession
} from '../controllers/auth.controller';
import { 
  authenticateToken
} from '../middleware/auth.middleware';
import { 
  authRateLimit, 
  loginRateLimit, 
  registerRateLimit, 
  passwordResetRateLimit, 
  emailRateLimit,
  progressiveDelay 
} from '../middleware/rateLimit.middleware';
import { validate, commonParamSchemas } from '../middleware/validation.middleware';
import { authSanitizer } from '../middleware/sanitization.middleware';
import { auditAuth, completeAudit } from '../middleware/audit.middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
  changePasswordSchema
} from '../utils/validation';

const router = Router();

/**
 * Authentication Routes
 * All routes are prefixed with /api/auth
 */

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  registerRateLimit,          // Rate limit: 3 attempts per hour
  progressiveDelay,           // Progressive delay for failed attempts
  auditAuth('USER_REGISTRATION'), // Audit middleware
  authSanitizer,              // Input sanitization
  validate({ body: registerSchema }), // Joi validation
  register,                   // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get tokens
 * @access  Public
 */
router.post(
  '/login',
  loginRateLimit,             // Rate limit: 5 attempts per 15 minutes
  progressiveDelay,           // Progressive delay for failed attempts
  auditAuth('USER_LOGIN'),    // Audit middleware
  authSanitizer,              // Input sanitization
  validate({ body: loginSchema }), // Joi validation
  login,                      // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post(
  '/refresh',
  authRateLimit,              // Rate limit: 5 attempts per 15 minutes
  auditAuth('TOKEN_REFRESH'), // Audit middleware
  validate({ body: refreshTokenSchema }), // Joi validation
  refreshToken,               // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate tokens
 * @access  Private
 */
router.post(
  '/logout',
  authenticateToken,          // Require valid JWT
  auditAuth('USER_LOGOUT'),   // Audit middleware
  logout,                     // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post(
  '/forgot-password',
  passwordResetRateLimit,     // Rate limit: 3 attempts per hour
  emailRateLimit,             // Email-specific rate limiting
  auditAuth('PASSWORD_RESET_REQUEST'), // Audit middleware
  authSanitizer,              // Input sanitization
  validate({ body: forgotPasswordSchema }), // Joi validation
  forgotPassword,             // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using reset token
 * @access  Public
 */
router.post(
  '/reset-password',
  passwordResetRateLimit,     // Rate limit: 3 attempts per hour
  auditAuth('PASSWORD_RESET'), // Audit middleware
  authSanitizer,              // Input sanitization
  validate({ body: resetPasswordSchema }), // Joi validation
  resetPassword,              // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/profile',
  authenticateToken,          // Require valid JWT
  getProfile                  // Controller function
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticateToken,          // Require valid JWT
  auditAuth('PROFILE_UPDATE'), // Audit middleware
  authSanitizer,              // Input sanitization
  validate({ body: updateProfileSchema }), // Joi validation
  updateProfile,              // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.post(
  '/verify-email',
  authRateLimit,              // Rate limit: 5 attempts per 15 minutes
  auditAuth('EMAIL_VERIFICATION'), // Audit middleware
  validate({ body: verifyEmailSchema }), // Joi validation
  verifyEmail,                // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification
 * @access  Private
 */
router.post(
  '/resend-verification',
  authenticateToken,          // Require valid JWT
  emailRateLimit,             // Email-specific rate limiting
  auditAuth('EMAIL_VERIFICATION_RESEND'), // Audit middleware
  resendVerification,         // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private
 */
router.post(
  '/change-password',
  authenticateToken,          // Require valid JWT
  authRateLimit,              // Rate limit: 5 attempts per 15 minutes
  auditAuth('PASSWORD_CHANGE'), // Audit middleware
  authSanitizer,              // Input sanitization
  validate({ body: changePasswordSchema }), // Joi validation
  changePassword,             // Controller function
  completeAudit               // Complete audit logging
);

/**
 * @route   GET /api/auth/sessions
 * @desc    Get all active sessions for user
 * @access  Private
 */
router.get(
  '/sessions',
  authenticateToken,          // Require valid JWT
  getSessions                 // Controller function
);

/**
 * @route   DELETE /api/auth/sessions/:sessionId
 * @desc    Revoke specific session
 * @access  Private
 */
router.delete(
  '/sessions/:sessionId',
  authenticateToken,          // Require valid JWT
  auditAuth('SESSION_REVOKE'), // Audit middleware
  validate({ params: commonParamSchemas.id }), // Validate session ID
  revokeSession,              // Controller function
  completeAudit               // Complete audit logging
);

export default router; 