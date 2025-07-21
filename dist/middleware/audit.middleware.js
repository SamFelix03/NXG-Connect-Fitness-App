"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditDataAccess = exports.auditSuccessfulAuth = exports.auditFailedAuth = exports.auditSensitiveOperation = exports.completeAudit = exports.auditAuth = void 0;
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
const createAuditLog = (auditEvent) => {
    logger_1.logger.info('AUDIT_EVENT', {
        correlationId: auditEvent.correlationId,
        event: auditEvent.event,
        ...(auditEvent.userId && { userId: auditEvent.userId }),
        ...(auditEvent.username && { username: auditEvent.username }),
        ipAddress: auditEvent.ipAddress,
        userAgent: auditEvent.userAgent,
        success: auditEvent.success,
        ...(auditEvent.details && { details: auditEvent.details }),
        timestamp: auditEvent.timestamp.toISOString()
    });
};
const auditAuth = (event) => {
    return (req, _res, next) => {
        const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
        const startTime = Date.now();
        req.auditContext = {
            event,
            correlationId,
            startTime,
            ipAddress: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown'
        };
        next();
    };
};
exports.auditAuth = auditAuth;
const completeAudit = (req, res, next) => {
    const auditContext = req.auditContext;
    if (!auditContext) {
        return next();
    }
    const success = res.statusCode >= 200 && res.statusCode < 400;
    const user = req.user;
    const auditEvent = {
        event: auditContext.event,
        ...(user?.id && { userId: user.id }),
        ...(user?.username && { username: user.username }),
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success,
        details: {
            statusCode: res.statusCode,
            responseTime: Date.now() - auditContext.startTime,
            endpoint: `${req.method} ${req.path}`,
            requestData: sanitizeForLogging(req.body)
        },
        timestamp: new Date(),
        correlationId: auditContext.correlationId
    };
    createAuditLog(auditEvent);
    next();
};
exports.completeAudit = completeAudit;
const auditSensitiveOperation = (operation, details) => {
    return (req, _res, next) => {
        const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
        const user = req.user;
        const auditEvent = {
            event: `SENSITIVE_OPERATION_${operation.toUpperCase()}`,
            ...(user?.id && { userId: user.id }),
            ...(user?.username && { username: user.username }),
            ipAddress: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            success: true,
            details: {
                operation,
                endpoint: `${req.method} ${req.path}`,
                ...details
            },
            timestamp: new Date(),
            correlationId
        };
        createAuditLog(auditEvent);
        next();
    };
};
exports.auditSensitiveOperation = auditSensitiveOperation;
const auditFailedAuth = (req, reason, username) => {
    const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
    const auditEvent = {
        event: 'AUTH_FAILURE',
        ...(username && { username }),
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        success: false,
        details: {
            reason,
            endpoint: `${req.method} ${req.path}`,
            attemptedUsername: username
        },
        timestamp: new Date(),
        correlationId
    };
    createAuditLog(auditEvent);
};
exports.auditFailedAuth = auditFailedAuth;
const auditSuccessfulAuth = (req, userId, username, event) => {
    const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
    const auditEvent = {
        event,
        userId,
        username,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        success: true,
        details: {
            endpoint: `${req.method} ${req.path}`
        },
        timestamp: new Date(),
        correlationId
    };
    createAuditLog(auditEvent);
};
exports.auditSuccessfulAuth = auditSuccessfulAuth;
const auditDataAccess = (req, dataType, recordIds) => {
    const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
    const user = req.user;
    const auditEvent = {
        event: 'DATA_ACCESS',
        ...(user?.id && { userId: user.id }),
        ...(user?.username && { username: user.username }),
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        success: true,
        details: {
            dataType,
            recordCount: recordIds.length,
            recordIds: recordIds.slice(0, 10),
            endpoint: `${req.method} ${req.path}`
        },
        timestamp: new Date(),
        correlationId
    };
    createAuditLog(auditEvent);
};
exports.auditDataAccess = auditDataAccess;
function sanitizeForLogging(data) {
    if (!data || typeof data !== 'object') {
        return data;
    }
    const sensitiveFields = ['password', 'confirmPassword', 'currentPassword', 'newPassword', 'token', 'refreshToken'];
    const sanitized = { ...data };
    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    }
    return sanitized;
}
//# sourceMappingURL=audit.middleware.js.map