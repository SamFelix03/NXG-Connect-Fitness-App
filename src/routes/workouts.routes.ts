import { Router, Request, Response, NextFunction } from 'express';
import { 
  getDailyWorkout,
  getWorkoutDay,
  getWorkoutLibrary,
  getWorkoutProgress
} from '../controllers/workouts.controller';
import { 
  authenticateToken,
  requireUserOrAdmin
} from '../middleware/auth.middleware';
import { 
  generalRateLimit
} from '../middleware/rateLimit.middleware';
import { sanitizationMiddleware } from '../middleware/sanitization.middleware';
import { auditAuth, completeAudit } from '../middleware/audit.middleware';

const router = Router();

/**
 * Workout Routes
 * All routes are prefixed with /api/workouts
 * 
 * These routes provide access to workout plans, exercise libraries,
 * and workout-related functionality with machine availability integration.
 */

/**
 * GET /api/workouts/daily
 * Get user's active daily workout plan
 * 
 * Query parameters:
 * - branchId (optional): Branch ID to include machine availability
 * - includeAvailability (optional): Whether to include machine availability (default: true)
 * 
 * Authentication: Required (user or admin)
 * Rate Limiting: General rate limit applied
 */
router.get(
  '/daily',
  authenticateToken,
  requireUserOrAdmin(),
  auditAuth('read-daily-workout'),
  generalRateLimit,
  sanitizationMiddleware,
  getDailyWorkout,
  completeAudit
);

/**
 * GET /api/workouts/days/:muscleGroup
 * Get exercises for a specific muscle group (Chest, Lat, Shoulder, Arms, Legs)
 * User's workout plan is the same everywhere - branch only affects machine availability
 * 
 * Path parameters:
 * - muscleGroup (required): The muscle group (chest, lat, shoulder, arms, legs)
 * 
 * Query parameters:
 * - branchId (optional): Branch ID to check machine availability at current location
 * - includeAvailability (optional): Whether to include machine availability (default: true)
 * 
 * Authentication: Required (user or admin)
 * Rate Limiting: General rate limit applied
 */
router.get(
  '/days/:muscleGroup',
  authenticateToken,
  auditAuth('read-workout-day'),
  generalRateLimit,
  sanitizationMiddleware,
  getWorkoutDay,
  completeAudit
);

/**
 * GET /api/workouts/library
 * Get exercise library with optional filtering and machine availability
 * 
 * Query parameters:
 * - muscleGroup (optional): Filter by muscle group
 * - equipment (optional): Filter by equipment type
 * - difficulty (optional): Filter by difficulty level (beginner/intermediate/advanced)
 * - branchId (optional): Branch ID to include machine availability
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Items per page (default: 20, max: 100)
 * 
 * Authentication: Optional (public access with limited features, authenticated for full features)
 * Rate Limiting: General rate limit applied
 */
router.get(
  '/library',
  // Authentication is optional for library access
  (req: Request, res: Response, next: NextFunction) => {
    // Try to authenticate but don't require it
    if (req.headers.authorization) {
      authenticateToken(req, res, (_err: any) => {
        // Continue even if authentication fails for library access
        next();
      });
    } else {
      next();
    }
  },
  auditAuth('read-workout-library'),
  generalRateLimit,
  sanitizationMiddleware,
  getWorkoutLibrary,
  completeAudit
);

/**
 * GET /api/workouts/progress
 * Get user's workout progress and analytics
 * 
 * Authentication: Required (user or admin)
 * Rate Limiting: General rate limit applied
 * 
 * Note: This endpoint is placeholder for future implementation
 */
router.get(
  '/progress',
  authenticateToken,
  requireUserOrAdmin(),
  auditAuth('read-workout-progress'),
  generalRateLimit,
  sanitizationMiddleware,
  getWorkoutProgress,
  completeAudit
);

/**
 * Health Check for Workouts Service
 * GET /api/workouts/health
 */
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Workouts service is healthy',
    data: {
      service: 'workouts',
      status: 'operational',
      timestamp: new Date().toISOString(),
      availableEndpoints: [
        'GET /api/workouts/daily',
        'GET /api/workouts/days/:muscleGroup',
        'GET /api/workouts/library',
        'GET /api/workouts/progress'
      ]
    }
  });
});

export default router;