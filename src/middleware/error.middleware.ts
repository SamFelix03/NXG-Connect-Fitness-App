import { Request, Response, NextFunction } from 'express';
import { Sentry } from '../config/sentry.config';
import { BaseError, shouldReportError } from '../utils/errors';
import { logger, LogContext } from '../utils/logger';

// Error response interface
interface ErrorResponse {
  error: {
    message: string;
    code: string;
    timestamp: string;
    correlationId: string;
    details?: Record<string, any>;
  };
}

// Central error handling middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  const correlationId = req.correlationId || 'unknown';
  const timestamp = new Date().toISOString();
  
  // Determine error details
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details: Record<string, any> | undefined;

  if (error instanceof BaseError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.name.toUpperCase().replace('ERROR', '');
    
    // Add specific details for certain error types
    if (error.name === 'ValidationError') {
      const validationError = error as any;
      details = validationError.validationErrors;
    }
    if (error.name === 'NotFoundError') {
      const notFoundError = error as any;
      if (notFoundError.resource) {
        details = { resource: notFoundError.resource };
      }
    }
    if (error.name === 'RateLimitError') {
      const rateLimitError = error as any;
      if (rateLimitError.retryAfter) {
        res.setHeader('Retry-After', rateLimitError.retryAfter);
        details = { retryAfter: rateLimitError.retryAfter };
      }
    }
  }

  // Log error with context
  const errorContext: LogContext = {
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

  // Log based on severity
  if (statusCode >= 500) {
    logger.error('Server error occurred', error, errorContext);
  } else if (statusCode >= 400) {
    logger.warn('Client error occurred', errorContext);
  } else {
    logger.info('Error handled', errorContext);
  }

  // Report to Sentry if it's a server error or unexpected error
  if (shouldReportError(error)) {
    Sentry.withScope((scope) => {
      scope.setTag('correlationId', correlationId);
      scope.setContext('request', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      scope.setLevel('error');
      Sentry.captureException(error);
    });
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: {
      message,
      code,
      timestamp,
      correlationId,
      ...(details && { details }),
    },
  };

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// 404 Not Found handler for unmatched routes
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const correlationId = req.correlationId || 'unknown';
  const timestamp = new Date().toISOString();

  const errorResponse: ErrorResponse = {
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

  // Log 404 errors
  const notFoundContext: LogContext = {
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
  
  logger.warn('Route not found', notFoundContext);

  res.status(404).json(errorResponse);
};

// Async error wrapper utility
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error helper
export const createValidationError = (
  message: string,
  validationErrors: Record<string, string>
): Error => {
  const error = new Error(message) as any;
  error.name = 'ValidationError';
  error.statusCode = 400;
  error.validationErrors = validationErrors;
  return error;
}; 