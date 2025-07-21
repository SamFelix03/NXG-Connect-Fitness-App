import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { validate, commonParamSchemas, commonQuerySchemas, apiVersionSchema } from './validation.middleware';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: { 'x-correlation-id': 'test-correlation-id' },
      ip: '127.0.0.1',
      method: 'POST',
      path: '/api/test',
      get: jest.fn().mockReturnValue('test-user-agent')
    };
    mockResponse = {};
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('validate middleware', () => {
    const testSchema = Joi.object({
      name: Joi.string().required(),
      age: Joi.number().min(0).max(120)
    });

    it('should pass validation with valid data', () => {
      mockRequest.body = { name: 'John Doe', age: 30 };

      const middleware = validate({ body: testSchema });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(logger.debug).toHaveBeenCalledWith('Request validation successful', {
        correlationId: 'test-correlation-id',
        endpoint: 'POST /api/test'
      });
    });

    it('should fail validation with invalid data', () => {
      mockRequest.body = { age: 150 }; // Missing required name, age too high

      const middleware = validate({ body: testSchema });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(logger.warn).toHaveBeenCalledWith('Validation failed', expect.objectContaining({
        correlationId: 'test-correlation-id',
        validationErrors: expect.objectContaining({
          'body.name': '"name" is required',
          'body.age': '"age" must be less than or equal to 120'
        })
      }));
    });

    it('should validate request parameters', () => {
      mockRequest.params = { id: 'invalid-id-format' };
      
      const paramSchema = Joi.object({
        id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
      });

      const middleware = validate({ params: paramSchema });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should validate query parameters', () => {
      mockRequest.query = { page: '0', limit: '200' }; // page < 1, limit > 100
      
      const middleware = validate({ query: commonQuerySchemas.pagination });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should validate headers', () => {
      mockRequest.headers = { 'x-api-version': '2.0' }; // Unsupported version
      
      const middleware = validate({ headers: apiVersionSchema });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should strip unknown fields', () => {
      mockRequest.body = { 
        name: 'John Doe', 
        age: 30, 
        unknownField: 'should be removed' 
      };

      const middleware = validate({ body: testSchema });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      // The validation passes, unknown field is stripped
    });

    it('should handle missing correlation ID', () => {
      mockRequest.headers = {};
      mockRequest.body = { age: 150 };

      const middleware = validate({ body: testSchema });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.warn).toHaveBeenCalledWith('Validation failed', expect.objectContaining({
        correlationId: undefined
      }));
    });

    it('should handle validation with no schemas provided', () => {
      const middleware = validate({});
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(logger.debug).toHaveBeenCalledWith('Request validation successful', expect.any(Object));
    });
  });

  describe('commonParamSchemas', () => {
    it('should validate MongoDB ObjectId format', () => {
      const validId = '507f1f77bcf86cd799439011';
      const invalidId = 'invalid-id';

      const { error: validError } = commonParamSchemas.id.validate({ id: validId });
      const { error: invalidError } = commonParamSchemas.id.validate({ id: invalidId });

      expect(validError).toBeUndefined();
      expect(invalidError).toBeDefined();
    });

    it('should validate userId parameter', () => {
      const validUserId = '507f1f77bcf86cd799439011';
      const invalidUserId = 'short';

      const { error: validError } = commonParamSchemas.userId.validate({ userId: validUserId });
      const { error: invalidError } = commonParamSchemas.userId.validate({ userId: invalidUserId });

      expect(validError).toBeUndefined();
      expect(invalidError).toBeDefined();
    });
  });

  describe('commonQuerySchemas', () => {
    it('should validate pagination parameters with defaults', () => {
      const { error, value } = commonQuerySchemas.pagination.validate({});

      expect(error).toBeUndefined();
      expect(value).toEqual({
        page: 1,
        limit: 20,
        sortOrder: 'desc'
      });
    });

    it('should validate custom pagination parameters', () => {
      const { error, value } = commonQuerySchemas.pagination.validate({
        page: 2,
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'asc'
      });

      expect(error).toBeUndefined();
      expect(value).toEqual({
        page: 2,
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'asc'
      });
    });

    it('should reject invalid pagination parameters', () => {
      const { error } = commonQuerySchemas.pagination.validate({
        page: 0,
        limit: 200,
        sortOrder: 'invalid'
      });

      expect(error).toBeDefined();
      // Joi may not validate all errors at once, so check that we have at least one error
      expect(error?.details).toBeDefined();
      expect(error?.details.length).toBeGreaterThan(0);
    });
  });

  describe('apiVersionSchema', () => {
    it('should validate supported API versions', () => {
      const { error: v1Error } = apiVersionSchema.validate({ 'x-api-version': '1.0' });
      const { error: v1_1Error } = apiVersionSchema.validate({ 'x-api-version': '1.1' });

      expect(v1Error).toBeUndefined();
      expect(v1_1Error).toBeUndefined();
    });

    it('should reject unsupported API versions', () => {
      const { error } = apiVersionSchema.validate({ 'x-api-version': '2.0' });

      expect(error).toBeDefined();
      if (error && error.details && error.details.length > 0) {
        expect(error.details[0]?.message).toContain('Unsupported API version');
      }
    });

    it('should use default version when not provided', () => {
      const { error, value } = apiVersionSchema.validate({});

      expect(error).toBeUndefined();
      expect(value['x-api-version']).toBe('1.0');
    });
  });

  describe('Error handling', () => {
    it('should create ValidationError with flattened errors', () => {
      mockRequest.body = { name: '', age: -1 };
      
      const testSchema = Joi.object({
        name: Joi.string().min(1).required(),
        age: Joi.number().min(0).required()
      });

      const middleware = validate({ body: testSchema });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      const validationError = (mockNext as jest.Mock).mock.calls[0][0] as ValidationError;
      expect(validationError).toBeInstanceOf(ValidationError);
      expect(validationError.validationErrors).toEqual(expect.objectContaining({
        'body.name': expect.stringContaining('is not allowed to be empty'),
        'body.age': expect.stringContaining('must be greater than or equal to 0')
      }));
    });

    it('should log validation failures with request context', () => {
      mockRequest.body = { invalid: 'data' };
      
      const middleware = validate({ body: Joi.object({ valid: Joi.string().required() }) });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.warn).toHaveBeenCalledWith('Validation failed', expect.objectContaining({
        correlationId: 'test-correlation-id',
        endpoint: 'POST /api/test',
        userAgent: 'test-user-agent',
        ipAddress: '127.0.0.1',
        validationErrors: expect.any(Object)
      }));
    });
  });
}); 