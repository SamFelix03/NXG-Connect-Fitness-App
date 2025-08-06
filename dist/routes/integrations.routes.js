"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const integrations_controller_1 = require("../controllers/integrations.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const sanitization_middleware_1 = require("../middleware/sanitization.middleware");
const audit_middleware_1 = require("../middleware/audit.middleware");
const router = (0, express_1.Router)();
router.post('/workout-plans', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireUserOrAdmin)(), (0, audit_middleware_1.auditAuth)('create-workout-plan'), rateLimit_middleware_1.strictRateLimit, sanitization_middleware_1.sanitizationMiddleware, integrations_controller_1.createOrRefreshWorkoutPlan, audit_middleware_1.completeAudit);
router.get('/workout-plans/status', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireUserOrAdmin)(), (0, audit_middleware_1.auditAuth)('read-workout-plan-status'), rateLimit_middleware_1.generalRateLimit, sanitization_middleware_1.sanitizationMiddleware, integrations_controller_1.getWorkoutPlanStatus, audit_middleware_1.completeAudit);
router.delete('/workout-plans/:planId', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireUserOrAdmin)(), (0, audit_middleware_1.auditAuth)('delete-workout-plan'), rateLimit_middleware_1.generalRateLimit, sanitization_middleware_1.sanitizationMiddleware, integrations_controller_1.deactivateWorkoutPlan, audit_middleware_1.completeAudit);
router.post('/diet-plans', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireUserOrAdmin)(), (0, audit_middleware_1.auditAuth)('create-diet-plan'), rateLimit_middleware_1.strictRateLimit, sanitization_middleware_1.sanitizationMiddleware, integrations_controller_1.createOrRefreshDietPlan, audit_middleware_1.completeAudit);
router.get('/diet-plans/status', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireUserOrAdmin)(), (0, audit_middleware_1.auditAuth)('read-diet-plan-status'), rateLimit_middleware_1.generalRateLimit, sanitization_middleware_1.sanitizationMiddleware, integrations_controller_1.getDietPlanStatus, audit_middleware_1.completeAudit);
router.delete('/diet-plans/:planId', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireUserOrAdmin)(), (0, audit_middleware_1.auditAuth)('delete-diet-plan'), rateLimit_middleware_1.generalRateLimit, sanitization_middleware_1.sanitizationMiddleware, integrations_controller_1.deactivateDietPlan, audit_middleware_1.completeAudit);
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
                'DELETE /api/integrations/workout-plans/:planId',
                'POST /api/integrations/diet-plans',
                'GET /api/integrations/diet-plans/status',
                'DELETE /api/integrations/diet-plans/:planId'
            ],
            externalServices: {
                workoutPlanningService: 'connected',
                dietPlanningService: 'connected',
                cacheService: 'connected'
            }
        }
    });
});
exports.default = router;
//# sourceMappingURL=integrations.routes.js.map