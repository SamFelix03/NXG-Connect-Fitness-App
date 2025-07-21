import { Request, Response, NextFunction } from 'express';
import { auditAuth, completeAudit, auditSensitiveOperation, auditFailedAuth, auditSuccessfulAuth, auditDataAccess } from './audit.middleware';
import { logger } from '../utils/logger';

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn()
  }
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-1234')
}));

describe('Audit Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: { 'x-correlation-id': 'test-correlation-id' },
      ip: '127.0.0.1',
      method: 'POST',
      path: '/api/auth/login',
      get: jest.fn().mockReturnValue('test-user-agent'),
      body: { email: 'test@example.com' },
      user: {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com'
      } as any
    };
    mockResponse = {
      statusCode: 200
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('auditAuth middleware', () => {
    it('should set audit context on request', () => {
      const middleware = auditAuth('USER_LOGIN');
      const startTime = Date.now();
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.auditContext).toBeDefined();
      expect(mockRequest.auditContext?.event).toBe('USER_LOGIN');
      expect(mockRequest.auditContext?.correlationId).toBe('test-correlation-id');
      expect(mockRequest.auditContext?.ipAddress).toBe('127.0.0.1');
      expect(mockRequest.auditContext?.userAgent).toBe('test-user-agent');
      expect(mockRequest.auditContext?.startTime).toBeGreaterThanOrEqual(startTime);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should generate correlation ID if not present', () => {
      mockRequest.headers = {};
      const middleware = auditAuth('USER_REGISTRATION');
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.auditContext?.correlationId).toBe('mock-uuid-1234');
    });

    it('should handle missing IP address', () => {
      mockRequest = {
        ...mockRequest,
        ip: undefined
      };
      const middleware = auditAuth('PASSWORD_RESET');
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.auditContext?.ipAddress).toBe('unknown');
    });

    it('should handle missing user agent', () => {
      (mockRequest.get as jest.Mock).mockReturnValue(undefined);
      const middleware = auditAuth('TOKEN_REFRESH');
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.auditContext?.userAgent).toBe('unknown');
    });
  });

  describe('completeAudit middleware', () => {
    beforeEach(() => {
      mockRequest.auditContext = {
        event: 'USER_LOGIN',
        correlationId: 'test-correlation-id',
        startTime: Date.now() - 100,
        ipAddress: '127.0.0.1',
        userAgent: 'test-user-agent'
      };
    });

    it('should log successful audit event', () => {
      mockResponse.statusCode = 200;
      
      completeAudit(mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.info).toHaveBeenCalledWith('AUDIT_EVENT', expect.objectContaining({
        correlationId: 'test-correlation-id',
        event: 'USER_LOGIN',
        userId: 'user123',
        username: 'testuser',
        ipAddress: '127.0.0.1',
        userAgent: 'test-user-agent',
        success: true,
        details: expect.objectContaining({
          statusCode: 200,
          responseTime: expect.any(Number),
          endpoint: 'POST /api/auth/login',
          requestData: expect.objectContaining({
            email: 'test@example.com'
          })
        })
      }));
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should log failed audit event', () => {
      mockResponse.statusCode = 401;
      
      completeAudit(mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.info).toHaveBeenCalledWith('AUDIT_EVENT', expect.objectContaining({
        success: false,
        details: expect.objectContaining({
          statusCode: 401
        })
      }));
    });

    it('should handle missing audit context', () => {
      delete (mockRequest as any).auditContext;
      
      completeAudit(mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.info).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle missing user', () => {
      delete (mockRequest as any).user;
      
      completeAudit(mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.info).toHaveBeenCalledWith('AUDIT_EVENT', expect.objectContaining({
        event: 'USER_LOGIN'
      }));
      // Should not include userId or username in the log
      const logCall = (logger.info as jest.Mock).mock.calls[0][1];
      expect(logCall).not.toHaveProperty('userId');
      expect(logCall).not.toHaveProperty('username');
    });

    it('should sanitize sensitive data from request body', () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'secret123',
        confirmPassword: 'secret123'
      };
      
      completeAudit(mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.info).toHaveBeenCalledWith('AUDIT_EVENT', expect.objectContaining({
        details: expect.objectContaining({
          requestData: {
            email: 'test@example.com',
            password: '[REDACTED]',
            confirmPassword: '[REDACTED]'
          }
        })
      }));
    });
  });

  describe('auditSensitiveOperation middleware', () => {
    it('should log sensitive operation', () => {
      const middleware = auditSensitiveOperation('PASSWORD_CHANGE', { reason: 'user request' });
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.info).toHaveBeenCalledWith('AUDIT_EVENT', expect.objectContaining({
        correlationId: 'test-correlation-id',
        event: 'SENSITIVE_OPERATION_PASSWORD_CHANGE',
        userId: 'user123',
        username: 'testuser',
        success: true,
        details: expect.objectContaining({
          operation: 'PASSWORD_CHANGE',
          endpoint: 'POST /api/auth/login',
          reason: 'user request'
        })
      }));
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle missing user', () => {
      delete (mockRequest as any).user;
      const middleware = auditSensitiveOperation('DATA_EXPORT');
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      const logCall = (logger.info as jest.Mock).mock.calls[0][1];
      expect(logCall).not.toHaveProperty('userId');
      expect(logCall).not.toHaveProperty('username');
    });
  });

  describe('auditFailedAuth function', () => {
    it('should log failed authentication attempt', () => {
      auditFailedAuth(mockRequest as Request, 'Invalid credentials', 'testuser');

      expect(logger.info).toHaveBeenCalledWith('AUDIT_EVENT', expect.objectContaining({
        correlationId: 'test-correlation-id',
        event: 'AUTH_FAILURE',
        username: 'testuser',
        ipAddress: '127.0.0.1',
        userAgent: 'test-user-agent',
        success: false,
        details: expect.objectContaining({
          reason: 'Invalid credentials',
          endpoint: 'POST /api/auth/login',
          attemptedUsername: 'testuser'
        })
      }));
    });

    it('should handle missing username', () => {
      auditFailedAuth(mockRequest as Request, 'Account locked');

      const logCall = (logger.info as jest.Mock).mock.calls[0][1];
      expect(logCall).not.toHaveProperty('username');
      expect(logCall.details.attemptedUsername).toBeUndefined();
    });

    it('should generate correlation ID if missing', () => {
      mockRequest.headers = {};
      auditFailedAuth(mockRequest as Request, 'Token expired');

      expect(logger.info).toHaveBeenCalledWith('AUDIT_EVENT', expect.objectContaining({
        correlationId: 'mock-uuid-1234'
      }));
    });
  });

  describe('auditSuccessfulAuth function', () => {
    it('should log successful authentication', () => {
      auditSuccessfulAuth(mockRequest as Request, 'user123', 'testuser', 'USER_LOGIN');

      expect(logger.info).toHaveBeenCalledWith('AUDIT_EVENT', expect.objectContaining({
        correlationId: 'test-correlation-id',
        event: 'USER_LOGIN',
        userId: 'user123',
        username: 'testuser',
        success: true,
        details: expect.objectContaining({
          endpoint: 'POST /api/auth/login'
        })
      }));
    });
  });

  describe('auditDataAccess function', () => {
    it('should log data access with record IDs', () => {
      const recordIds = ['id1', 'id2', 'id3'];
      auditDataAccess(mockRequest as Request, 'USER_PROFILES', recordIds);

      expect(logger.info).toHaveBeenCalledWith('AUDIT_EVENT', expect.objectContaining({
        event: 'DATA_ACCESS',
        userId: 'user123',
        username: 'testuser',
        details: expect.objectContaining({
          dataType: 'USER_PROFILES',
          recordCount: 3,
          recordIds: ['id1', 'id2', 'id3']
        })
      }));
    });

    it('should limit logged record IDs to first 10', () => {
      const recordIds = Array.from({ length: 15 }, (_, i) => `id${i + 1}`);
      auditDataAccess(mockRequest as Request, 'WORKOUT_DATA', recordIds);

      const logCall = (logger.info as jest.Mock).mock.calls[0][1];
      expect(logCall.details.recordCount).toBe(15);
      expect(logCall.details.recordIds).toHaveLength(10);
      expect(logCall.details.recordIds).toEqual(recordIds.slice(0, 10));
    });

    it('should handle missing user', () => {
      delete (mockRequest as any).user;
      auditDataAccess(mockRequest as Request, 'PUBLIC_DATA', ['id1']);

      const logCall = (logger.info as jest.Mock).mock.calls[0][1];
      expect(logCall).not.toHaveProperty('userId');
      expect(logCall).not.toHaveProperty('username');
    });
  });

  describe('Data sanitization', () => {
    it('should sanitize password fields', () => {
      const sensitiveData = {
        email: 'test@example.com',
        password: 'secret123',
        confirmPassword: 'secret123',
        currentPassword: 'old123',
        newPassword: 'new123',
        token: 'jwt-token',
        refreshToken: 'refresh-token',
        normalField: 'normal-value'
      };

      mockRequest.body = sensitiveData;
      mockRequest.auditContext = {
        event: 'PROFILE_UPDATE',
        correlationId: 'test-id',
        startTime: Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'test'
      };

      completeAudit(mockRequest as Request, mockResponse as Response, mockNext);

      const logCall = (logger.info as jest.Mock).mock.calls[0][1];
      expect(logCall.details.requestData).toEqual({
        email: 'test@example.com',
        password: '[REDACTED]',
        confirmPassword: '[REDACTED]',
        currentPassword: '[REDACTED]',
        newPassword: '[REDACTED]',
        token: '[REDACTED]',
        refreshToken: '[REDACTED]',
        normalField: 'normal-value'
      });
    });

    it('should handle non-object data', () => {
      mockRequest.body = 'string-data';
      mockRequest.auditContext = {
        event: 'TEST',
        correlationId: 'test-id',
        startTime: Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'test'
      };

      completeAudit(mockRequest as Request, mockResponse as Response, mockNext);

      const logCall = (logger.info as jest.Mock).mock.calls[0][1];
      expect(logCall.details.requestData).toBe('string-data');
    });
  });
}); 