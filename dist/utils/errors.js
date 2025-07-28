"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldReportError = exports.isOperationalError = exports.ServiceUnavailableError = exports.InternalServerError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.AppError = exports.BaseError = void 0;
class BaseError extends Error {
    statusCode;
    isOperational;
    timestamp;
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.BaseError = BaseError;
class AppError extends BaseError {
    constructor(statusCode, message, isOperational = true) {
        super(message, statusCode, isOperational);
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
class ValidationError extends BaseError {
    validationErrors;
    constructor(message, validationErrors) {
        super(message, 400);
        this.name = 'ValidationError';
        this.validationErrors = validationErrors;
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends BaseError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends BaseError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403);
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends BaseError {
    resource;
    constructor(message = 'Resource not found', resource) {
        super(message, 404);
        this.name = 'NotFoundError';
        this.resource = resource;
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends BaseError {
    constructor(message = 'Resource conflict') {
        super(message, 409);
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends BaseError {
    retryAfter;
    constructor(message = 'Too many requests', retryAfter) {
        super(message, 429);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}
exports.RateLimitError = RateLimitError;
class InternalServerError extends BaseError {
    constructor(message = 'Internal server error') {
        super(message, 500, false);
        this.name = 'InternalServerError';
    }
}
exports.InternalServerError = InternalServerError;
class ServiceUnavailableError extends BaseError {
    service;
    constructor(message = 'Service temporarily unavailable', service) {
        super(message, 503);
        this.name = 'ServiceUnavailableError';
        this.service = service;
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
const isOperationalError = (error) => {
    return error instanceof BaseError && error.isOperational;
};
exports.isOperationalError = isOperationalError;
const shouldReportError = (error) => {
    if (error instanceof BaseError) {
        return !error.isOperational;
    }
    return true;
};
exports.shouldReportError = shouldReportError;
//# sourceMappingURL=errors.js.map