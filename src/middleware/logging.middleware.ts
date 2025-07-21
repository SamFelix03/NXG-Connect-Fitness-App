import morgan from 'morgan';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request interface to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

// Correlation ID middleware - must be applied before logging middleware
export const correlationIdMiddleware = (req: Request, res: Response, next: Function): void => {
  // Generate or use existing correlation ID
  const existingCorrelationId = req.headers['x-correlation-id'];
  req.correlationId = (typeof existingCorrelationId === 'string' ? existingCorrelationId : uuidv4());
  
  // Set correlation ID in response headers
  res.setHeader('X-Correlation-ID', req.correlationId);
  
  next();
};

// Custom Morgan token for correlation ID
morgan.token('correlation-id', (req: Request) => req.correlationId || 'unknown');

// Custom Morgan token for user ID (when authentication is implemented)
morgan.token('user-id', (req: Request) => {
  // This will be populated when authentication middleware is implemented
  return (req as any).user?.id || 'anonymous';
});

// Custom format for structured logging
const logFormat = process.env['NODE_ENV'] === 'production'
  ? ':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :correlation-id :response-time ms'
  : ':method :url :status :response-time ms - :correlation-id';

// Create Morgan middleware with custom format
const loggingMiddleware = morgan(logFormat, {
  // Custom stream for integration with Winston (will be implemented in Task 6)
  stream: {
    write: (message: string) => {
      // For now, use console.log - will be replaced with Winston logger
      console.log(message.trim());
    }
  },
  
  // Skip logging for health check endpoints in production
  skip: (req: Request, _res: Response) => {
    if (process.env['NODE_ENV'] === 'production') {
      return req.url === '/health' || req.url === '/';
    }
    return false;
  }
});

export default loggingMiddleware; 