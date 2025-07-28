"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sessions_controller_1 = require("../controllers/sessions.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const sanitization_middleware_1 = require("../middleware/sanitization.middleware");
const audit_middleware_1 = require("../middleware/audit.middleware");
const validation_1 = require("../utils/validation");
const router = (0, express_1.Router)();
router.get('/history', auth_middleware_1.authenticateToken, (0, validation_middleware_1.validate)({ query: validation_1.sessionHistorySchema }), sessions_controller_1.getSessionHistory);
router.post('/:userId/create', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)(['admin']), rateLimit_middleware_1.generalRateLimit, (0, audit_middleware_1.auditAuth)('SESSION_CREATE'), sanitization_middleware_1.sanitizationMiddleware, (0, validation_middleware_1.validate)({ body: validation_1.createSessionSchema }), sessions_controller_1.createSession, audit_middleware_1.completeAudit);
router.put('/:sessionId/update', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)(['admin']), rateLimit_middleware_1.generalRateLimit, (0, audit_middleware_1.auditAuth)('SESSION_UPDATE'), sanitization_middleware_1.sanitizationMiddleware, (0, validation_middleware_1.validate)({ body: validation_1.updateSessionSchema }), sessions_controller_1.updateSession, audit_middleware_1.completeAudit);
router.delete('/:sessionId', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)(['admin']), (0, audit_middleware_1.auditAuth)('SESSION_TERMINATE'), sessions_controller_1.terminateSession, audit_middleware_1.completeAudit);
router.get('/:userId/history', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)(['admin']), (0, validation_middleware_1.validate)({ query: validation_1.sessionHistorySchema }), sessions_controller_1.getSessionHistory);
exports.default = router;
//# sourceMappingURL=sessions.routes.js.map