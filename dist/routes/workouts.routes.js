"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const workouts_controller_1 = require("../controllers/workouts.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const sanitization_middleware_1 = require("../middleware/sanitization.middleware");
const audit_middleware_1 = require("../middleware/audit.middleware");
const router = (0, express_1.Router)();
router.get('/daily', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireUserOrAdmin)(), (0, audit_middleware_1.auditAuth)('read-daily-workout'), rateLimit_middleware_1.generalRateLimit, sanitization_middleware_1.sanitizationMiddleware, workouts_controller_1.getDailyWorkout, audit_middleware_1.completeAudit);
router.get('/days/:muscleGroup', auth_middleware_1.authenticateToken, (0, audit_middleware_1.auditAuth)('read-workout-day'), rateLimit_middleware_1.generalRateLimit, sanitization_middleware_1.sanitizationMiddleware, workouts_controller_1.getWorkoutDay, audit_middleware_1.completeAudit);
router.get('/library', (req, res, next) => {
    if (req.headers.authorization) {
        (0, auth_middleware_1.authenticateToken)(req, res, (_err) => {
            next();
        });
    }
    else {
        next();
    }
}, (0, audit_middleware_1.auditAuth)('read-workout-library'), rateLimit_middleware_1.generalRateLimit, sanitization_middleware_1.sanitizationMiddleware, workouts_controller_1.getWorkoutLibrary, audit_middleware_1.completeAudit);
router.get('/progress', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireUserOrAdmin)(), (0, audit_middleware_1.auditAuth)('read-workout-progress'), rateLimit_middleware_1.generalRateLimit, sanitization_middleware_1.sanitizationMiddleware, workouts_controller_1.getWorkoutProgress, audit_middleware_1.completeAudit);
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
exports.default = router;
//# sourceMappingURL=workouts.routes.js.map