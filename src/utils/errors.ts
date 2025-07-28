// Custom error classes for structured error handling
export abstract class BaseError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: string;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    // Maintain proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

// Generic application error
export class AppError extends BaseError {
  constructor(statusCode: number, message: string, isOperational = true) {
    super(message, statusCode, isOperational);
    this.name = 'AppError';
  }
}

// 400 - Bad Request
export class ValidationError extends BaseError {
  public readonly validationErrors: Record<string, string> | undefined;

  constructor(message: string, validationErrors?: Record<string, string>) {
    super(message, 400);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

// 401 - Unauthorized
export class AuthenticationError extends BaseError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

// 403 - Forbidden
export class AuthorizationError extends BaseError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

// 404 - Not Found
export class NotFoundError extends BaseError {
  public readonly resource: string | undefined;

  constructor(message = 'Resource not found', resource?: string) {
    super(message, 404);
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

// 409 - Conflict
export class ConflictError extends BaseError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

// 429 - Too Many Requests
export class RateLimitError extends BaseError {
  public readonly retryAfter: number | undefined;

  constructor(message = 'Too many requests', retryAfter?: number) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// 500 - Internal Server Error
export class InternalServerError extends BaseError {
  constructor(message = 'Internal server error') {
    super(message, 500, false); // Not operational - indicates a bug
    this.name = 'InternalServerError';
  }
}

// 503 - Service Unavailable
export class ServiceUnavailableError extends BaseError {
  public readonly service: string | undefined;

  constructor(message = 'Service temporarily unavailable', service?: string) {
    super(message, 503);
    this.name = 'ServiceUnavailableError';
    this.service = service;
  }
}

// Type guard to check if error is a custom error
export const isOperationalError = (error: Error): error is BaseError => {
  return error instanceof BaseError && error.isOperational;
};

// Helper function to determine if error should be reported to monitoring
export const shouldReportError = (error: Error): boolean => {
  if (error instanceof BaseError) {
    // Don't report operational errors (client errors)
    return !error.isOperational;
  }
  // Report all other errors (unexpected errors)
  return true;
}; 