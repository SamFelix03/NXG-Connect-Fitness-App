import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler, asyncHandler, createValidationError } from './error.middleware';
import { ValidationError, AuthenticationError, NotFoundError, InternalServerError } from '../utils/errors';
import { logger } from '../utils/logger';
import { Sentry } from '../config/sentry.config';

// Mock dependencies
jest.mock('../utils/logger');
jest.mock('../config/sentry.config');

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockSentry = Sentry as jest.Mocked<typeof Sentry>;

describe('Error Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      correlationId: 'test-correlation-id',
      method: 'GET',
      url: '/test',
      path: '/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
    };

    mockResponse = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('errorHandler', () => {
    it('should handle ValidationError correctly', () => {
      const validationErrors = { field1: 'error1', field2: 'error2' };
      const error = new ValidationError('Validation failed', validationErrors);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION',
          timestamp: expect.any(String),
          correlationId: 'test-correlation-id',
          details: validationErrors,
        },
      });
      expect(mockLogger.warn).toHaveBeenCalledWith('Client error occurred', expect.any(Object));
    });

    it('should handle AuthenticationError correctly', () => {
      const error = new AuthenticationError('Invalid credentials');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Invalid credentials',
          code: 'AUTHENTICATION',
          timestamp: expect.any(String),
          correlationId: 'test-correlation-id',
        },
      });
      expect(mockLogger.warn).toHaveBeenCalledWith('Client error occurred', expect.any(Object));
    });

    it('should handle NotFoundError with resource details', () => {
      const error = new NotFoundError('User not found', 'User');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'User not found',
          code: 'NOTFOUND',
          timestamp: expect.any(String),
          correlationId: 'test-correlation-id',
          details: { resource: 'User' },
        },
      });
    });

    it('should handle InternalServerError and report to Sentry', () => {
      const error = new InternalServerError('Database connection failed');
      const mockWithScope = jest.fn();
      const mockCaptureException = jest.fn();
      
      mockSentry.withScope = mockWithScope;
      mockSentry.captureException = mockCaptureException;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Database connection failed',
          code: 'INTERNALSERVER',
          timestamp: expect.any(String),
          correlationId: 'test-correlation-id',
        },
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Server error occurred', error, expect.any(Object));
      expect(mockWithScope).toHaveBeenCalled();
    });

    it('should handle generic Error as 500 Internal Server Error', () => {
      const error = new Error('Unexpected error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
          timestamp: expect.any(String),
          correlationId: 'test-correlation-id',
        },
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Server error occurred', error, expect.any(Object));
    });

    it('should call next if response headers already sent', () => {
      mockResponse.headersSent = true;
      const error = new Error('Test error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should use fallback correlation ID if not present', () => {
      delete (mockRequest as any).correlationId;
      const error = new ValidationError('Test error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Test error',
          code: 'VALIDATION',
          timestamp: expect.any(String),
          correlationId: 'unknown',
        },
      });
    });
  });

  describe('notFoundHandler', () => {
    it('should handle 404 for unmatched routes', () => {
      notFoundHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Route GET /test not found',
          code: 'ROUTE_NOT_FOUND',
          timestamp: expect.any(String),
          correlationId: 'test-correlation-id',
          details: {
            method: 'GET',
            path: '/test',
          },
        },
      });
      expect(mockLogger.warn).toHaveBeenCalledWith('Route not found', expect.any(Object));
    });

    it('should handle missing correlation ID', () => {
      delete (mockRequest as any).correlationId;

      notFoundHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Route GET /test not found',
          code: 'ROUTE_NOT_FOUND',
          timestamp: expect.any(String),
          correlationId: 'unknown',
          details: {
            method: 'GET',
            path: '/test',
          },
        },
      });
    });
  });

  describe('asyncHandler', () => {
    it('should call the function and handle success', async () => {
      const mockAsyncFunction = jest.fn().mockResolvedValue('success');
      const wrappedFunction = asyncHandler(mockAsyncFunction);

      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAsyncFunction).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch async errors and call next', async () => {
      const error = new Error('Async error');
      const mockAsyncFunction = jest.fn().mockRejectedValue(error);
      const wrappedFunction = asyncHandler(mockAsyncFunction);

      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAsyncFunction).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createValidationError', () => {
    it('should create a validation error with custom properties', () => {
      const validationErrors = { field1: 'Required field missing' };
      const error = createValidationError('Validation failed', validationErrors);

      expect(error.message).toBe('Validation failed');
      expect((error as any).name).toBe('ValidationError');
      expect((error as any).statusCode).toBe(400);
      expect((error as any).validationErrors).toEqual(validationErrors);
    });
  });
}); 