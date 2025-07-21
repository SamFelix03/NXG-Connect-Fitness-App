import {
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
  isOperationalError,
  shouldReportError,
} from './errors';

describe('Custom Error Classes', () => {
  describe('BaseError', () => {
    class TestError extends BaseError {
      constructor(message: string, statusCode: number, isOperational = true) {
        super(message, statusCode, isOperational);
        this.name = 'TestError';
      }
    }

    it('should create a base error with required properties', () => {
      const error = new TestError('Test message', 400);

      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeDefined();
      expect(error.name).toBe('TestError');
      expect(error.stack).toBeDefined();
    });

    it('should handle non-operational errors', () => {
      const error = new TestError('Test message', 500, false);

      expect(error.isOperational).toBe(false);
    });

    it('should capture stack trace', () => {
      const error = new TestError('Test message', 400);

      expect(error.stack).toContain('TestError: Test message');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with 400 status code', () => {
      const validationErrors = { field1: 'Required', field2: 'Invalid format' };
      const error = new ValidationError('Validation failed', validationErrors);

      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ValidationError');
      expect(error.isOperational).toBe(true);
      expect(error.validationErrors).toEqual(validationErrors);
    });

    it('should create validation error without validation details', () => {
      const error = new ValidationError('Validation failed');

      expect(error.validationErrors).toBeUndefined();
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error with default message', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Authentication failed');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthenticationError');
      expect(error.isOperational).toBe(true);
    });

    it('should create authentication error with custom message', () => {
      const error = new AuthenticationError('Invalid token');

      expect(error.message).toBe('Invalid token');
    });
  });

  describe('AuthorizationError', () => {
    it('should create authorization error with default message', () => {
      const error = new AuthorizationError();

      expect(error.message).toBe('Insufficient permissions');
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('AuthorizationError');
      expect(error.isOperational).toBe(true);
    });

    it('should create authorization error with custom message', () => {
      const error = new AuthorizationError('Access denied to admin panel');

      expect(error.message).toBe('Access denied to admin panel');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with default message', () => {
      const error = new NotFoundError();

      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
      expect(error.isOperational).toBe(true);
      expect(error.resource).toBeUndefined();
    });

    it('should create not found error with resource information', () => {
      const error = new NotFoundError('User not found', 'User');

      expect(error.message).toBe('User not found');
      expect(error.resource).toBe('User');
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error with default message', () => {
      const error = new ConflictError();

      expect(error.message).toBe('Resource conflict');
      expect(error.statusCode).toBe(409);
      expect(error.name).toBe('ConflictError');
      expect(error.isOperational).toBe(true);
    });

    it('should create conflict error with custom message', () => {
      const error = new ConflictError('Email already exists');

      expect(error.message).toBe('Email already exists');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with default message', () => {
      const error = new RateLimitError();

      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(429);
      expect(error.name).toBe('RateLimitError');
      expect(error.isOperational).toBe(true);
      expect(error.retryAfter).toBeUndefined();
    });

    it('should create rate limit error with retry after information', () => {
      const error = new RateLimitError('Rate limit exceeded', 60);

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('InternalServerError', () => {
    it('should create internal server error with default message', () => {
      const error = new InternalServerError();

      expect(error.message).toBe('Internal server error');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('InternalServerError');
      expect(error.isOperational).toBe(false); // Not operational by default
    });

    it('should create internal server error with custom message', () => {
      const error = new InternalServerError('Database connection failed');

      expect(error.message).toBe('Database connection failed');
      expect(error.isOperational).toBe(false);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create service unavailable error with default message', () => {
      const error = new ServiceUnavailableError();

      expect(error.message).toBe('Service temporarily unavailable');
      expect(error.statusCode).toBe(503);
      expect(error.name).toBe('ServiceUnavailableError');
      expect(error.isOperational).toBe(true);
      expect(error.service).toBeUndefined();
    });

    it('should create service unavailable error with service information', () => {
      const error = new ServiceUnavailableError('Payment service down', 'PaymentGateway');

      expect(error.message).toBe('Payment service down');
      expect(error.service).toBe('PaymentGateway');
    });
  });

  describe('isOperationalError', () => {
    it('should return true for operational custom errors', () => {
      const error = new ValidationError('Test error');

      expect(isOperationalError(error)).toBe(true);
    });

    it('should return false for non-operational custom errors', () => {
      const error = new InternalServerError('Test error');

      expect(isOperationalError(error)).toBe(false);
    });

    it('should return false for standard Error objects', () => {
      const error = new Error('Test error');

      expect(isOperationalError(error)).toBe(false);
    });
  });

  describe('shouldReportError', () => {
    it('should return false for operational custom errors', () => {
      const error = new ValidationError('Test error');

      expect(shouldReportError(error)).toBe(false);
    });

    it('should return true for non-operational custom errors', () => {
      const error = new InternalServerError('Test error');

      expect(shouldReportError(error)).toBe(true);
    });

    it('should return true for standard Error objects', () => {
      const error = new Error('Test error');

      expect(shouldReportError(error)).toBe(true);
    });

    it('should return true for TypeError', () => {
      const error = new TypeError('Cannot read property of undefined');

      expect(shouldReportError(error)).toBe(true);
    });

    it('should return true for ReferenceError', () => {
      const error = new ReferenceError('Variable is not defined');

      expect(shouldReportError(error)).toBe(true);
    });
  });
}); 