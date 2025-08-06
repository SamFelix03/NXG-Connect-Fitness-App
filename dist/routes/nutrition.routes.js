"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const nutrition_controller_1 = require("../controllers/nutrition.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const sanitization_middleware_1 = require("../middleware/sanitization.middleware");
const audit_middleware_1 = require("../middleware/audit.middleware");
const router = (0, express_1.Router)();
router.get('/daily', auth_middleware_1.authenticateToken, (0, audit_middleware_1.auditAuth)('read-daily-nutrition'), rateLimit_middleware_1.generalRateLimit, sanitization_middleware_1.sanitizationMiddleware, nutrition_controller_1.getDailyNutrition, audit_middleware_1.completeAudit);
router.get('/daily/:day', auth_middleware_1.authenticateToken, (0, audit_middleware_1.auditAuth)('read-day-meal-plan'), rateLimit_middleware_1.generalRateLimit, sanitization_middleware_1.sanitizationMiddleware, nutrition_controller_1.getDayMealPlan, audit_middleware_1.completeAudit);
router.get('/library', auth_middleware_1.authenticateToken, (0, audit_middleware_1.auditAuth)('read-nutrition-library'), rateLimit_middleware_1.nutritionRateLimit, sanitization_middleware_1.sanitizationMiddleware, nutrition_controller_1.getNutritionLibrary, audit_middleware_1.completeAudit);
router.get('/macros', auth_middleware_1.authenticateToken, (0, audit_middleware_1.auditAuth)('read-current-macros'), rateLimit_middleware_1.generalRateLimit, sanitization_middleware_1.sanitizationMiddleware, nutrition_controller_1.getCurrentMacros, audit_middleware_1.completeAudit);
router.get('/health', (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'Nutrition service is healthy',
        data: {
            service: 'nutrition',
            status: 'operational',
            timestamp: new Date().toISOString(),
            availableEndpoints: [
                'GET /api/nutrition/daily',
                'GET /api/nutrition/daily/:day',
                'GET /api/nutrition/library',
                'GET /api/nutrition/macros'
            ],
            features: {
                dailyMealPlans: 'enabled',
                nutritionLibrary: 'enabled',
                macroTracking: 'enabled',
                dietaryPreferences: 'enabled'
            },
            dependencies: {
                dietPlanCacheService: 'connected',
                database: 'connected',
                redisCache: 'connected'
            }
        }
    });
});
exports.default = router;
//# sourceMappingURL=nutrition.routes.js.map