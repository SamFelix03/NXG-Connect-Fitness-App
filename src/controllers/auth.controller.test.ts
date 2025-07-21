import { Request, Response } from 'express';
import { 
  register, 
  login, 
  refreshToken, 
  logout, 
  getProfile,
  updateProfile,
  verifyEmail,
  changePassword,
  getSessions,
  revokeSession
} from './auth.controller';
import { authService } from '../services/auth.service';
import { validateRequest } from '../utils/validation';
import { 
  AuthenticationError, 
  ConflictError, 
  NotFoundError 
} from '../utils/errors';

// Mock dependencies
jest.mock('../services/auth.service');
jest.mock('../utils/validation');

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockValidateRequest = validateRequest as jest.MockedFunction<typeof validateRequest>;

describe('Auth Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn().mockReturnThis();
    mockStatus = jest.fn().mockReturnThis();
    
    mockResponse = {
      status: mockStatus,
      json: mockJson
    };

    mockRequest = {
      body: {},
      params: {}
    };

    jest.clearAllMocks();
  });

  describe('register', () => {
    const validRegisterData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
      name: 'Test User'
    };

    it('should register user successfully', async () => {
      mockRequest.body = validRegisterData;
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: validRegisterData
      });

      const mockAuthResponse = {
        user: { _id: '123', username: 'testuser', email: 'test@example.com' },
        tokens: { 
          accessToken: 'token123', 
          refreshToken: 'refresh123',
          accessTokenExpiresAt: new Date(),
          refreshTokenExpiresAt: new Date()
        }
      };

      mockAuthService.register.mockResolvedValue(mockAuthResponse);

      await register(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully',
        data: {
          user: mockAuthResponse.user,
          tokens: mockAuthResponse.tokens
        }
      });
    });

    it('should return validation error for invalid data', async () => {
      mockRequest.body = { email: 'invalid-email' };
      mockValidateRequest.mockReturnValue({
        isValid: false,
        errors: { email: 'Invalid email format' },
        value: null
      });

      await register(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: { email: 'Invalid email format' }
      });
    });

    it('should handle existing user conflict', async () => {
      mockRequest.body = validRegisterData;
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: validRegisterData
      });

      mockAuthService.register.mockRejectedValue(new ConflictError('User already exists'));

      await register(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'User already exists',
        code: 'CONFLICT_ERROR'
      });
    });

    it('should handle internal server error', async () => {
      mockRequest.body = validRegisterData;
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: validRegisterData
      });

      mockAuthService.register.mockRejectedValue(new Error('Database error'));

      await register(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error during registration',
        code: 'REGISTRATION_ERROR'
      });
    });
  });

  describe('login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'Password123!'
    };

    it('should login user successfully', async () => {
      mockRequest.body = validLoginData;
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: validLoginData
      });

      const mockAuthResponse = {
        user: { _id: '123', username: 'testuser', email: 'test@example.com' },
        tokens: { 
          accessToken: 'token123', 
          refreshToken: 'refresh123',
          accessTokenExpiresAt: new Date(),
          refreshTokenExpiresAt: new Date()
        }
      };

      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      await login(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        data: {
          user: mockAuthResponse.user,
          tokens: mockAuthResponse.tokens
        }
      });
    });

    it('should return validation error for invalid credentials format', async () => {
      mockRequest.body = { email: 'invalid' };
      mockValidateRequest.mockReturnValue({
        isValid: false,
        errors: { email: 'Invalid email format' },
        value: null
      });

      await login(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: { email: 'Invalid email format' }
      });
    });

    it('should handle authentication error for wrong credentials', async () => {
      mockRequest.body = validLoginData;
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: validLoginData
      });

      mockAuthService.login.mockRejectedValue(new AuthenticationError('Invalid credentials'));

      await login(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid credentials',
        code: 'AUTHENTICATION_ERROR'
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      mockRequest.body = { refreshToken: 'refresh123' };
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: { refreshToken: 'refresh123' }
      });

      const mockTokens = { 
        accessToken: 'newtoken123', 
        refreshToken: 'newrefresh123',
        accessTokenExpiresAt: new Date(),
        refreshTokenExpiresAt: new Date()
      };
      mockAuthService.refreshToken.mockResolvedValue({ tokens: mockTokens });

      await refreshToken(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Token refreshed successfully',
        data: { tokens: mockTokens }
      });
    });

    it('should handle invalid refresh token', async () => {
      mockRequest.body = { refreshToken: 'invalid' };
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: { refreshToken: 'invalid' }
      });

      mockAuthService.refreshToken.mockRejectedValue(new AuthenticationError('Invalid refresh token'));

      await refreshToken(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid refresh token',
        code: 'AUTHENTICATION_ERROR'
      });
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      (mockRequest as any).user = { _id: '123' };
      (mockRequest as any).token = 'access-token-123';
      mockRequest.body = { refreshToken: 'refresh123' };

      mockAuthService.logout.mockResolvedValue(undefined);

      await logout(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });

    it('should handle missing authentication', async () => {
      mockRequest.body = { refreshToken: 'refresh123' };

      await logout(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    });
  });

  describe('getProfile', () => {
    it('should get user profile successfully', async () => {
      (mockRequest as any).user = { id: '123' };
      const mockUser = {
        _id: '123',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        emailVerified: true
      };

      mockAuthService.getUserById.mockResolvedValue(mockUser as any);

      await getProfile(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: mockUser
        }
      });
    });

    it('should handle missing authentication', async () => {
      await getProfile(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    });

    it('should handle user not found', async () => {
      (mockRequest as any).user = { id: '123' };
      mockAuthService.getUserById.mockResolvedValue(null);

      await getProfile(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      (mockRequest as any).user = { id: '123' };
      mockRequest.body = { name: 'Updated Name' };
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: { name: 'Updated Name' }
      });

      const mockUpdatedUser = { _id: '123', name: 'Updated Name' };
      mockAuthService.updateProfile.mockResolvedValue(mockUpdatedUser);

      await updateProfile(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: mockUpdatedUser
        }
      });
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      mockRequest.body = { token: 'verification-token' };
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: { token: 'verification-token' }
      });

      mockAuthService.verifyEmail.mockResolvedValue(undefined);

      await verifyEmail(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Email verified successfully',
        data: null
      });
    });

    it('should handle invalid verification token', async () => {
      mockRequest.body = { token: 'invalid-token' };
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: { token: 'invalid-token' }
      });

      mockAuthService.verifyEmail.mockRejectedValue(new NotFoundError('Invalid token'));

      await verifyEmail(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      (mockRequest as any).user = { id: '123' };
      mockRequest.body = { currentPassword: 'old123', newPassword: 'New123!' };
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: { currentPassword: 'old123', newPassword: 'New123!' }
      });

      mockAuthService.changePassword.mockResolvedValue(undefined);

      await changePassword(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully',
        data: null
      });
    });

    it('should handle incorrect current password', async () => {
      (mockRequest as any).user = { id: '123' };
      mockRequest.body = { currentPassword: 'wrong', newPassword: 'New123!' };
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: { currentPassword: 'wrong', newPassword: 'New123!' }
      });

      mockAuthService.changePassword.mockRejectedValue(new AuthenticationError('Current password is incorrect'));

      await changePassword(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    });
  });

  describe('getSessions', () => {
    it('should get sessions successfully', async () => {
      (mockRequest as any).user = { id: '123' };
      const mockSessions = [
        {
          sessionId: 'session1',
          userId: '123',
          tokenId: 'token1',
          createdAt: new Date(),
          expiresAt: new Date()
        }
      ];

      mockAuthService.getSessions.mockResolvedValue(mockSessions);

      await getSessions(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Sessions retrieved successfully',
        data: {
          sessions: mockSessions
        }
      });
    });
  });

  describe('revokeSession', () => {
    it('should revoke session successfully', async () => {
      (mockRequest as any).user = { id: '123' };
      mockRequest.params = { sessionId: 'session1' };

      mockAuthService.revokeSession.mockResolvedValue(undefined);

      await revokeSession(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Session revoked successfully',
        data: null
      });
    });

    it('should handle session not found', async () => {
      (mockRequest as any).user = { id: '123' };
      mockRequest.params = { sessionId: 'nonexistent' };

      mockAuthService.revokeSession.mockRejectedValue(new NotFoundError('Session not found'));

      await revokeSession(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    });
  });
}); 