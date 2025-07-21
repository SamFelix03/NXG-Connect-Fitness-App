import { Request, Response, NextFunction } from 'express';
import { authenticateToken } from './auth.middleware';
import { extractBearerToken, verifyAccessToken } from '../utils/jwt';
import { authService } from '../services/auth.service';

// Mock dependencies
jest.mock('../utils/jwt');
jest.mock('../services/auth.service');

const mockExtractBearerToken = extractBearerToken as jest.MockedFunction<typeof extractBearerToken>;
const mockVerifyAccessToken = verifyAccessToken as jest.MockedFunction<typeof verifyAccessToken>;
const mockAuthService = authService as jest.Mocked<typeof authService>;

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn().mockReturnThis();
    mockStatus = jest.fn().mockReturnThis();
    mockNext = jest.fn();
    
    mockResponse = {
      status: mockStatus,
      json: mockJson
    };

    mockRequest = {
      headers: {}
    };

    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token successfully', async () => {
      const mockToken = 'Bearer valid-token-123';
      const mockPayload = {
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        isActive: true
      };
      const mockUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        isActive: true,
        emailVerified: true
      };

      mockRequest.headers = { authorization: mockToken };
      mockExtractBearerToken.mockReturnValue('valid-token-123');
      mockAuthService.isTokenBlacklisted.mockResolvedValue(false);
      mockVerifyAccessToken.mockReturnValue(mockPayload);
      mockAuthService.getUserById.mockResolvedValue(mockUser as any);

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockExtractBearerToken).toHaveBeenCalledWith(mockToken);
      expect(mockAuthService.isTokenBlacklisted).toHaveBeenCalledWith('valid-token-123');
      expect(mockVerifyAccessToken).toHaveBeenCalledWith('valid-token-123');
      expect(mockAuthService.getUserById).toHaveBeenCalledWith('user123');
      expect(mockRequest.user).toBe(mockUser);
      expect(mockRequest.token).toBe('valid-token-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing or invalid authorization header', async () => {
      mockExtractBearerToken.mockImplementation(() => {
        throw new Error('Authorization header missing or invalid');
      });

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error during authentication',
        code: 'AUTHENTICATION_ERROR'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject blacklisted token', async () => {
      const mockToken = 'Bearer blacklisted-token';
      
      mockRequest.headers = { authorization: mockToken };
      mockExtractBearerToken.mockReturnValue('blacklisted-token');
      mockAuthService.isTokenBlacklisted.mockResolvedValue(true);

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Token has been revoked',
        code: 'AUTHENTICATION_FAILED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      const mockToken = 'Bearer invalid-token';
      
      mockRequest.headers = { authorization: mockToken };
      mockExtractBearerToken.mockReturnValue('invalid-token');
      mockAuthService.isTokenBlacklisted.mockResolvedValue(false);
      mockVerifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error during authentication',
        code: 'AUTHENTICATION_ERROR'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token for non-existent user', async () => {
      const mockToken = 'Bearer valid-token-123';
      const mockPayload = {
        userId: 'nonexistent',
        email: 'test@example.com',
        username: 'testuser',
        isActive: true
      };

      mockRequest.headers = { authorization: mockToken };
      mockExtractBearerToken.mockReturnValue('valid-token-123');
      mockAuthService.isTokenBlacklisted.mockResolvedValue(false);
      mockVerifyAccessToken.mockReturnValue(mockPayload);
      mockAuthService.getUserById.mockResolvedValue(null);

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'User not found or inactive',
        code: 'AUTHENTICATION_FAILED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token for inactive user', async () => {
      const mockToken = 'Bearer valid-token-123';
      const mockPayload = {
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        isActive: true
      };
      const mockUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        isActive: false,
        emailVerified: true
      };

      mockRequest.headers = { authorization: mockToken };
      mockExtractBearerToken.mockReturnValue('valid-token-123');
      mockAuthService.isTokenBlacklisted.mockResolvedValue(false);
      mockVerifyAccessToken.mockReturnValue(mockPayload);
      mockAuthService.getUserById.mockResolvedValue(mockUser as any);

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'User not found or inactive',
        code: 'AUTHENTICATION_FAILED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      const mockToken = 'Bearer valid-token-123';
      
      mockRequest.headers = { authorization: mockToken };
      mockExtractBearerToken.mockReturnValue('valid-token-123');
      mockAuthService.isTokenBlacklisted.mockRejectedValue(new Error('Redis error'));

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error during authentication',
        code: 'AUTHENTICATION_ERROR'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
}); 