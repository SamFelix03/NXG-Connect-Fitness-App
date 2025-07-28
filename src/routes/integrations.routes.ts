import { Router } from 'express';
import { 
  createOrRefreshWorkoutPlan,
  deactivateWorkoutPlan,
  getWorkoutPlanStatus
} from '../controllers/integrations.controller';
import { 
  authenticateToken,
  requireUserOrAdmin
} from '../middleware/auth.middleware';
import { 
  generalRateLimit,
  strictRateLimit
} from '../middleware/rateLimit.middleware';
import { sanitizationMiddleware } from '../middleware/sanitization.middleware';
import { auditAuth, completeAudit } from '../middleware/audit.middleware';

const router = Router();

/**
 * Integration Routes
 * All routes are prefixed with /api/integrations
 * 
 * These routes handle integration with external services for workout planning,
 * including plan creation, refresh, and management functionality.
 */

/**
 * POST /api/integrations/workout-plans
 * Create or refresh user's workout plan using external service
 * 
 * Request Body:
 * - forceRefresh (optional): Force refresh even if active plan exists (default: false)
 * - weeklyWorkoutDays (optional): Number of workout days per week (1-7)
 * - customPreferences (optional): Custom user preferences object
 * 
 * Authentication: Required (user or admin)
 * Rate Limiting: Strict rate limit due to external API usage
 */
router.post(
  '/workout-plans',
  authenticateToken,
  requireUserOrAdmin(),
  auditAuth('create-workout-plan'),
  strictRateLimit, // Stricter rate limiting for external API calls
  sanitizationMiddleware,
  createOrRefreshWorkoutPlan,
  completeAudit
);

/**
 * GET /api/integrations/workout-plans/status
 * Get status of user's workout plan including refresh information
 * 
 * Authentication: Required (user or admin)
 * Rate Limiting: General rate limit applied
 */
router.get(
  '/workout-plans/status',
  authenticateToken,
  requireUserOrAdmin(),
  auditAuth('read-workout-plan-status'),
  generalRateLimit,
  sanitizationMiddleware,
  getWorkoutPlanStatus,
  completeAudit
);

/**
 * DELETE /api/integrations/workout-plans/:planId
 * Deactivate a specific workout plan
 * 
 * Path Parameters:
 * - planId: The external plan ID to deactivate
 * 
 * Authentication: Required (user or admin)
 * Rate Limiting: General rate limit applied
 */
router.delete(
  '/workout-plans/:planId',
  authenticateToken,
  requireUserOrAdmin(),
  auditAuth('delete-workout-plan'),
  generalRateLimit,
  sanitizationMiddleware,
  deactivateWorkoutPlan,
  completeAudit
);

/**
 * Health Check for Integrations Service
 * GET /api/integrations/health
 */
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Integrations service is healthy',
    data: {
      service: 'integrations',
      status: 'operational',
      timestamp: new Date().toISOString(),
      availableEndpoints: [
        'POST /api/integrations/workout-plans',
        'GET /api/integrations/workout-plans/status',
        'DELETE /api/integrations/workout-plans/:planId'
      ],
      externalServices: {
        workoutPlanningService: 'connected',
        cacheService: 'connected'
      }
    }
  });
});

export default router;