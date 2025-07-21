"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("../controllers/analytics.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const sanitization_middleware_1 = require("../middleware/sanitization.middleware");
const audit_middleware_1 = require("../middleware/audit.middleware");
const validation_1 = require("../utils/validation");
const router = (0, express_1.Router)();
router.post('/:userId/events', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)(['admin']), rateLimit_middleware_1.generalRateLimit, (0, audit_middleware_1.auditAuth)('ANALYTICS_EVENT_LOG'), sanitization_middleware_1.sanitizationMiddleware, (0, validation_middleware_1.validate)({ body: validation_1.logEventSchema }), analytics_controller_1.logEvent, audit_middleware_1.completeAudit);
router.get('/:userId/engagement', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)(['admin']), (0, validation_middleware_1.validate)({ query: validation_1.engagementMetricsSchema }), analytics_controller_1.getEngagementMetrics);
router.get('/:userId/aggregation', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)(['admin']), (0, validation_middleware_1.validate)({ query: validation_1.aggregationSchema }), analytics_controller_1.getAggregatedData);
router.get('/performance', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)(['admin']), (0, validation_middleware_1.validate)({ query: validation_1.performanceMetricsSchema }), analytics_controller_1.getPerformanceMetrics);
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map