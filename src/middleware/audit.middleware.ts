import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

interface AuditEvent {
  event: string;
  userId?: string;
  username?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details?: Record<string, any>;
  timestamp: Date;
  correlationId: string;
}

// Create audit log entry
const createAuditLog = (auditEvent: AuditEvent): void => {
  logger.info('AUDIT_EVENT', {
    correlationId: auditEvent.correlationId,
    event: auditEvent.event,
    ...(auditEvent.userId && { userId: auditEvent.userId }),
    ...(auditEvent.username && { username: auditEvent.username }),
    ipAddress: auditEvent.ipAddress,
    userAgent: auditEvent.userAgent,
    success: auditEvent.success,
    ...(auditEvent.details && { details: auditEvent.details }),
    timestamp: auditEvent.timestamp.toISOString()
  });
};

// Authentication event audit middleware
export const auditAuth = (event: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    const startTime = Date.now();
    
    // Store audit context on request for later use
    req.auditContext = {
      event,
      correlationId,
      startTime,
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    };
    
    // Continue processing
    next();
  };
};

// Audit completion middleware (call after route handler)
export const completeAudit = (req: Request, res: Response, next: NextFunction): void => {
  const auditContext = req.auditContext;
  
  if (!auditContext) {
    return next();
  }
  
  const success = res.statusCode >= 200 && res.statusCode < 400;
  const user = req.user; // Assuming user is attached to request by auth middleware
  
  const auditEvent: AuditEvent = {
    event: auditContext.event,
    ...(user?.id && { userId: user.id }),
    ...(user?.username && { username: user.username }),
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
    success,
    details: {
      statusCode: res.statusCode,
      responseTime: Date.now() - auditContext.startTime,
      endpoint: `${req.method} ${req.path}`,
      requestData: sanitizeForLogging(req.body)
    },
    timestamp: new Date(),
    correlationId: auditContext.correlationId
  };
  
  createAuditLog(auditEvent);
  next();
};

// Sensitive operation audit middleware
export const auditSensitiveOperation = (operation: string, details?: Record<string, any>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    const user = req.user;
    
    const auditEvent: AuditEvent = {
      event: `SENSITIVE_OPERATION_${operation.toUpperCase()}`,
      ...(user?.id && { userId: user.id }),
      ...(user?.username && { username: user.username }),
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      success: true, // Logged at start of operation
      details: {
        operation,
        endpoint: `${req.method} ${req.path}`,
        ...details
      },
      timestamp: new Date(),
      correlationId
    };
    
    createAuditLog(auditEvent);
    next();
  };
};

// Failed authentication attempt audit
export const auditFailedAuth = (req: Request, reason: string, username?: string): void => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  const auditEvent: AuditEvent = {
    event: 'AUTH_FAILURE',
    ...(username && { username }),
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    success: false,
    details: {
      reason,
      endpoint: `${req.method} ${req.path}`,
      attemptedUsername: username
    },
    timestamp: new Date(),
    correlationId
  };
  
  createAuditLog(auditEvent);
};

// Successful authentication audit
export const auditSuccessfulAuth = (req: Request, userId: string, username: string, event: string): void => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  const auditEvent: AuditEvent = {
    event,
    userId,
    username,
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    success: true,
    details: {
      endpoint: `${req.method} ${req.path}`
    },
    timestamp: new Date(),
    correlationId
  };
  
  createAuditLog(auditEvent);
};

// Data access audit for sensitive data queries
export const auditDataAccess = (req: Request, dataType: string, recordIds: string[]): void => {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  const user = req.user;
  
  const auditEvent: AuditEvent = {
    event: 'DATA_ACCESS',
    ...(user?.id && { userId: user.id }),
    ...(user?.username && { username: user.username }),
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    success: true,
    details: {
      dataType,
      recordCount: recordIds.length,
      recordIds: recordIds.slice(0, 10), // Limit logged IDs to first 10
      endpoint: `${req.method} ${req.path}`
    },
    timestamp: new Date(),
    correlationId
  };
  
  createAuditLog(auditEvent);
};

// Sanitize sensitive data from logs
function sanitizeForLogging(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const sensitiveFields = ['password', 'confirmPassword', 'currentPassword', 'newPassword', 'token', 'refreshToken'];
  const sanitized = { ...data };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

// Extend Express Request interface for audit context
declare global {
  namespace Express {
    interface Request {
      auditContext?: {
        event: string;
        correlationId: string;
        startTime: number;
        ipAddress: string;
        userAgent: string;
      };
    }
  }
} 