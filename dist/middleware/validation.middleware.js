"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiVersionSchema = exports.commonQuerySchemas = exports.commonParamSchemas = exports.validate = void 0;
const joi_1 = __importDefault(require("joi"));
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const validate = (schemas) => {
    return (req, _res, next) => {
        const correlationId = req.headers['x-correlation-id'];
        const validationErrors = {};
        if (schemas.body && req.body) {
            const { error } = schemas.body.validate(req.body, {
                abortEarly: false,
                stripUnknown: false,
                allowUnknown: true
            });
            if (error) {
                validationErrors['body'] = {};
                error.details.forEach((detail) => {
                    const key = detail.path.join('.');
                    validationErrors['body'][key] = detail.message;
                });
            }
        }
        if (schemas.params && req.params) {
            const { error } = schemas.params.validate(req.params, {
                abortEarly: false,
                stripUnknown: true,
                allowUnknown: false
            });
            if (error) {
                validationErrors['params'] = {};
                error.details.forEach((detail) => {
                    const key = detail.path.join('.');
                    validationErrors['params'][key] = detail.message;
                });
            }
        }
        if (schemas.query && req.query) {
            const { error } = schemas.query.validate(req.query, {
                abortEarly: false,
                stripUnknown: true,
                allowUnknown: false
            });
            if (error) {
                validationErrors['query'] = {};
                error.details.forEach((detail) => {
                    const key = detail.path.join('.');
                    validationErrors['query'][key] = detail.message;
                });
            }
        }
        if (schemas.headers && req.headers) {
            const { error } = schemas.headers.validate(req.headers, {
                abortEarly: false,
                stripUnknown: false,
                allowUnknown: true
            });
            if (error) {
                validationErrors['headers'] = {};
                error.details.forEach((detail) => {
                    const key = detail.path.join('.');
                    validationErrors['headers'][key] = detail.message;
                });
            }
        }
        if (Object.keys(validationErrors).length > 0) {
            const flattenedErrors = {};
            Object.entries(validationErrors).forEach(([section, errors]) => {
                Object.entries(errors).forEach(([field, message]) => {
                    flattenedErrors[`${section}.${field}`] = message;
                });
            });
            logger_1.logger.warn('Validation failed', {
                correlationId,
                validationErrors: flattenedErrors,
                endpoint: `${req.method} ${req.path}`,
                userAgent: req.get('User-Agent') || 'unknown',
                ipAddress: req.ip || 'unknown'
            });
            const error = new errors_1.ValidationError('Validation failed', flattenedErrors);
            return next(error);
        }
        logger_1.logger.debug('Request validation successful', {
            correlationId,
            endpoint: `${req.method} ${req.path}`
        });
        next();
    };
};
exports.validate = validate;
exports.commonParamSchemas = {
    id: joi_1.default.object({
        id: joi_1.default.string()
            .pattern(new RegExp('^[0-9a-fA-F]{24}$'))
            .required()
            .messages({
            'string.pattern.base': 'Invalid ID format',
            'any.required': 'ID is required'
        })
    }),
    userId: joi_1.default.object({
        userId: joi_1.default.string()
            .pattern(new RegExp('^[0-9a-fA-F]{24}$'))
            .required()
            .messages({
            'string.pattern.base': 'Invalid user ID format',
            'any.required': 'User ID is required'
        })
    })
};
exports.commonQuerySchemas = {
    pagination: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(100).default(20),
        sortBy: joi_1.default.string().optional(),
        sortOrder: joi_1.default.string().valid('asc', 'desc').default('desc')
    })
};
exports.apiVersionSchema = joi_1.default.object({
    'x-api-version': joi_1.default.string()
        .valid('1.0', '1.1')
        .default('1.0')
        .messages({
        'any.only': 'Unsupported API version. Supported versions: 1.0, 1.1'
    })
});
//# sourceMappingURL=validation.middleware.js.map