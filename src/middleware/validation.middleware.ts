import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

interface ValidationOptions {
  body?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
}

export const validate = (schemas: ValidationOptions) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const correlationId = req.headers['x-correlation-id'] as string;
    const validationErrors: Record<string, Record<string, string>> = {};

    // Validate request body
    if (schemas.body && req.body) {
      const { error } = schemas.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: false, // Don't strip unknown fields
        allowUnknown: true   // Allow unknown fields
      });

      if (error) {
        validationErrors['body'] = {};
        error.details.forEach((detail) => {
          const key = detail.path.join('.');
          validationErrors['body']![key] = detail.message;
        });
      }
    }

    // Validate request parameters
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
          validationErrors['params']![key] = detail.message;
        });
      }
    }

    // Validate query parameters
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
          validationErrors['query']![key] = detail.message;
        });
      }
    }

    // Validate headers
    if (schemas.headers && req.headers) {
      const { error } = schemas.headers.validate(req.headers, {
        abortEarly: false,
        stripUnknown: false, // Headers may contain other valid fields
        allowUnknown: true
      });

      if (error) {
        validationErrors['headers'] = {};
        error.details.forEach((detail) => {
          const key = detail.path.join('.');
          validationErrors['headers']![key] = detail.message;
        });
      }
    }

    // If validation errors exist, log and throw ValidationError
    if (Object.keys(validationErrors).length > 0) {
      // Flatten validation errors for logging and error response
      const flattenedErrors: Record<string, string> = {};
      Object.entries(validationErrors).forEach(([section, errors]) => {
        Object.entries(errors).forEach(([field, message]) => {
          flattenedErrors[`${section}.${field}`] = message;
        });
      });

      logger.warn('Validation failed', {
        correlationId,
        validationErrors: flattenedErrors,
        endpoint: `${req.method} ${req.path}`,
        userAgent: req.get('User-Agent') || 'unknown',
        ipAddress: req.ip || 'unknown'
      });

      const error = new ValidationError('Validation failed', flattenedErrors);
      return next(error);
    }

    // All validations passed
    logger.debug('Request validation successful', {
      correlationId,
      endpoint: `${req.method} ${req.path}`
    });

    next();
  };
};

// Common parameter validation schemas
export const commonParamSchemas = {
  id: Joi.object({
    id: Joi.string()
      .pattern(new RegExp('^[0-9a-fA-F]{24}$'))
      .required()
      .messages({
        'string.pattern.base': 'Invalid ID format',
        'any.required': 'ID is required'
      })
  }),
  
  userId: Joi.object({
    userId: Joi.string()
      .pattern(new RegExp('^[0-9a-fA-F]{24}$'))
      .required()
      .messages({
        'string.pattern.base': 'Invalid user ID format',
        'any.required': 'User ID is required'
      })
  })
};

// Common query validation schemas
export const commonQuerySchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  })
};

// API versioning header validation
export const apiVersionSchema = Joi.object({
  'x-api-version': Joi.string()
    .valid('1.0', '1.1')
    .default('1.0')
    .messages({
      'any.only': 'Unsupported API version. Supported versions: 1.0, 1.1'
    })
}); 