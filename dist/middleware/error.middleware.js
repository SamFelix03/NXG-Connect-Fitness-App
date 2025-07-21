"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createValidationError = exports.asyncHandler = exports.notFoundHandler = exports.errorHandler = void 0;
const sentry_config_1 = require("../config/sentry.config");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const errorHandler = (error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }
    const correlationId = req.correlationId || 'unknown';
    const timestamp = new Date().toISOString();
    let statusCode = 500;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details;
    if (error instanceof errors_1.BaseError) {
        statusCode = error.statusCode;
        message = error.message;
        code = error.name.toUpperCase().replace('ERROR', '');
        if (error.name === 'ValidationError') {
            const validationError = error;
            details = validationError.validationErrors;
        }
        if (error.name === 'NotFoundError') {
            const notFoundError = error;
            if (notFoundError.resource) {
                details = { resource: notFoundError.resource };
            }
        }
        if (error.name === 'RateLimitError') {
            const rateLimitError = error;
            if (rateLimitError.retryAfter) {
                res.setHeader('Retry-After', rateLimitError.retryAfter);
                details = { retryAfter: rateLimitError.retryAfter };
            }
        }
    }
    const errorContext = {
        correlationId,
        method: req.method,
        url: req.url,
        statusCode,
    };
    if (req.ip) {
        errorContext.ipAddress = req.ip;
    }
    const userAgent = req.get('User-Agent');
    if (userAgent) {
        errorContext.userAgent = userAgent;
    }
    if (statusCode >= 500) {
        logger_1.logger.error('Server error occurred', error, errorContext);
    }
    else if (statusCode >= 400) {
        logger_1.logger.warn('Client error occurred', errorContext);
    }
    else {
        logger_1.logger.info('Error handled', errorContext);
    }
    if ((0, errors_1.shouldReportError)(error)) {
        sentry_config_1.Sentry.withScope((scope) => {
            scope.setTag('correlationId', correlationId);
            scope.setContext('request', {
                method: req.method,
                url: req.url,
                headers: req.headers,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
            });
            scope.setLevel('error');
            sentry_config_1.Sentry.captureException(error);
        });
    }
    const errorResponse = {
        error: {
            message,
            code,
            timestamp,
            correlationId,
            ...(details && { details }),
        },
    };
    res.status(statusCode).json(errorResponse);
};
exports.errorHandler = errorHandler;
const notFoundHandler = (req, res, _next) => {
    const correlationId = req.correlationId || 'unknown';
    const timestamp = new Date().toISOString();
    const errorResponse = {
        error: {
            message: `Route ${req.method} ${req.path} not found`,
            code: 'ROUTE_NOT_FOUND',
            timestamp,
            correlationId,
            details: {
                method: req.method,
                path: req.path,
            },
        },
    };
    const notFoundContext = {
        method: req.method,
        correlationId,
    };
    if (req.ip) {
        notFoundContext.ipAddress = req.ip;
    }
    const userAgent404 = req.get('User-Agent');
    if (userAgent404) {
        notFoundContext.userAgent = userAgent404;
    }
    logger_1.logger.warn('Route not found', notFoundContext);
    res.status(404).json(errorResponse);
};
exports.notFoundHandler = notFoundHandler;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
const createValidationError = (message, validationErrors) => {
    const error = new Error(message);
    error.name = 'ValidationError';
    error.statusCode = 400;
    error.validationErrors = validationErrors;
    return error;
};
exports.createValidationError = createValidationError;
//# sourceMappingURL=error.middleware.js.map