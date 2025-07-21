import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { authService } from './auth.service';
import { User } from '../models/User';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt';
import { 
  AuthenticationError, 
  ConflictError, 
  NotFoundError 
} from '../utils/errors';
import { redis } from '../utils/redis';

// Mock dependencies
jest.mock('bcrypt');
jest.mock('uuid');
jest.mock('../models/User');
jest.mock('../utils/jwt');
jest.mock('../utils/redis');

const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>;
const mockUser = User as jest.Mocked<typeof User>;
const mockGenerateTokenPair = generateTokenPair as jest.MockedFunction<typeof generateTokenPair>;
const mockVerifyRefreshToken = verifyRefreshToken as jest.MockedFunction<typeof verifyRefreshToken>;
const mockRedis = redis as jest.Mocked<typeof redis>;

describe('AuthService', () => {
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn()
    };
    mockRedis.getClient.mockReturnValue(mockRedisClient);
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
      name: 'Test User'
    };

    it('should register user successfully', async () => {
      const mockTokenPair = {
        accessToken: 'access123',
        refreshToken: 'refresh123',
        accessTokenExpiresAt: new Date(),
        refreshTokenExpiresAt: new Date()
      };

      const mockCreatedUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        emailVerified: false,
        totalPoints: 0,
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(true)
      };

      (mockUser.findOne as jest.Mock).mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue('hashedpassword' as never);
      
      // Mock the User constructor
      (mockUser as any).mockImplementation(() => mockCreatedUser);
      mockCreatedUser.save = jest.fn().mockResolvedValue(true);
      
      mockGenerateTokenPair.mockReturnValue(mockTokenPair);
      mockUuidv4.mockReturnValue('token-id-123');

      const result = await authService.register(registerData);

      expect(mockUser.findOne).toHaveBeenCalledWith({
        $or: [
          { email: 'test@example.com' },
          { username: 'testuser' }
        ]
      });
      expect(mockBcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens).toBe(mockTokenPair);
    });

    it('should throw ConflictError if user already exists', async () => {
      const existingUser = { email: 'test@example.com' };
      (mockUser.findOne as jest.Mock).mockResolvedValue(existingUser);

      await expect(authService.register(registerData)).rejects.toThrow(ConflictError);
      expect(mockUser.findOne).toHaveBeenCalledWith({
        $or: [
          { email: 'test@example.com' },
          { username: 'testuser' }
        ]
      });
    });

    it('should handle database errors', async () => {
      (mockUser.findOne as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(authService.register(registerData)).rejects.toThrow('Registration failed: Database error');
    });
  });

  describe('login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'Password123!'
    };

    it('should login user successfully', async () => {
      const mockUserDoc = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
        isActive: true,
        lastLogin: new Date(),
        save: jest.fn().mockResolvedValue(true)
      };

      const mockTokenPair = {
        accessToken: 'access123',
        refreshToken: 'refresh123',
        accessTokenExpiresAt: new Date(),
        refreshTokenExpiresAt: new Date()
      };

      (mockUser.findOne as jest.Mock).mockResolvedValue(mockUserDoc);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockGenerateTokenPair.mockReturnValue(mockTokenPair);
      mockUuidv4.mockReturnValue('token-id-123');

      const result = await authService.login(loginData);

      expect(mockUser.findOne).toHaveBeenCalledWith({ 
        email: 'test@example.com',
        isActive: true 
      });
      expect(mockBcrypt.compare).toHaveBeenCalledWith('Password123!', 'hashedpassword');
      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens).toBe(mockTokenPair);
      expect(mockUserDoc.save).toHaveBeenCalled();
    });

    it('should throw AuthenticationError for non-existent user', async () => {
      (mockUser.findOne as jest.Mock).mockResolvedValue(null);

      await expect(authService.login(loginData)).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for inactive user', async () => {
      const inactiveUser = { isActive: false };
      (mockUser.findOne as jest.Mock).mockResolvedValue(inactiveUser);

      await expect(authService.login(loginData)).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for wrong password', async () => {
      const mockUserDoc = {
        passwordHash: 'hashedpassword',
        isActive: true
      };

      (mockUser.findOne as jest.Mock).mockResolvedValue(mockUserDoc);
      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(authService.login(loginData)).rejects.toThrow(AuthenticationError);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'refresh123';
      const mockPayload = {
        userId: 'user123',
        tokenId: 'token-id-123'
      };

      const mockTokenPair = {
        accessToken: 'newaccess123',
        refreshToken: 'newrefresh123',
        accessTokenExpiresAt: new Date(),
        refreshTokenExpiresAt: new Date()
      };

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        isActive: true
      };

      mockVerifyRefreshToken.mockReturnValue(mockPayload);
      mockRedisClient.get.mockResolvedValueOnce('token-id-123'); // stored token
      mockRedisClient.get.mockResolvedValueOnce(null); // blacklist check
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      mockGenerateTokenPair.mockReturnValue(mockTokenPair);
      mockUuidv4.mockReturnValue('new-token-id');

      const result = await authService.refreshToken(refreshToken);

      expect(mockVerifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockRedisClient.get).toHaveBeenCalledWith('auth:refresh:user123');
      expect(result.tokens).toBe(mockTokenPair);
    });

    it('should throw AuthenticationError for invalid refresh token', async () => {
      const refreshToken = 'invalid123';
      mockVerifyRefreshToken.mockImplementation(() => {
        throw new AuthenticationError('Invalid token');
      });

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for non-existent token in Redis', async () => {
      const refreshToken = 'refresh123';
      const mockPayload = {
        userId: 'user123',
        tokenId: 'token-id-123'
      };

      mockVerifyRefreshToken.mockReturnValue(mockPayload);
      mockRedisClient.get.mockResolvedValue(null);

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for blacklisted token', async () => {
      const refreshToken = 'refresh123';
      const mockPayload = {
        userId: 'user123',
        tokenId: 'token-id-123'
      };

      mockVerifyRefreshToken.mockReturnValue(mockPayload);
      mockRedisClient.get
        .mockResolvedValueOnce('token-id-123') // stored token
        .mockResolvedValueOnce('1'); // blacklisted

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(AuthenticationError);
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const userId = 'user123';
      const accessToken = 'access123';
      const refreshToken = 'refresh123';

      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.del.mockResolvedValue(1);

      await authService.logout(userId, accessToken, refreshToken);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'auth:blacklist:access123',
        expect.any(Number),
        '1'
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith('auth:refresh:user123');
    });

    it('should handle logout without refresh token', async () => {
      const userId = 'user123';
      const accessToken = 'access123';

      mockRedisClient.setEx.mockResolvedValue('OK');
      mockRedisClient.del.mockResolvedValue(1);

      await authService.logout(userId, accessToken);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'auth:blacklist:access123',
        expect.any(Number),
        '1'
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith('auth:refresh:user123');
    });
  });

  describe('forgotPassword', () => {
    it('should generate password reset token', async () => {
      const email = 'test@example.com';
      const mockUserDoc = { _id: 'user123', email };

      (mockUser.findOne as jest.Mock).mockResolvedValue(mockUserDoc);
      mockUuidv4.mockReturnValue('reset-token-123');
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await authService.forgotPassword({ email });

      expect(mockUser.findOne).toHaveBeenCalledWith({ 
        email: 'test@example.com',
        isActive: true 
      });
      expect(result).toBe('reset-token-123');
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'auth:reset:reset-token-123',
        3600, // 1 hour
        'user123'
      );
    });

    it('should return success message for non-existent user', async () => {
      const email = 'nonexistent@example.com';
      (mockUser.findOne as jest.Mock).mockResolvedValue(null);

      const result = await authService.forgotPassword({ email });

      expect(result).toBe('If the email exists, a reset link has been sent');
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const token = 'reset-token-123';
      const newPassword = 'NewPassword123!';
      const mockUserDoc = {
        _id: 'user123',
        isActive: true,
        save: jest.fn().mockResolvedValue(true)
      };

      mockRedisClient.get.mockResolvedValue('user123');
      (mockUser.findById as jest.Mock).mockResolvedValue(mockUserDoc);
      mockBcrypt.hash.mockResolvedValue('newhashedpassword' as never);
      mockRedisClient.del.mockResolvedValue(1);

      await authService.resetPassword({ token, password: newPassword });

      expect(mockRedisClient.get).toHaveBeenCalledWith('auth:reset:reset-token-123');
      expect(mockUser.findById).toHaveBeenCalledWith('user123');
      expect(mockBcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockUserDoc.save).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalledWith('auth:reset:reset-token-123');
    });

    it('should throw AuthenticationError for invalid token', async () => {
      const token = 'invalid-token';
      mockRedisClient.get.mockResolvedValue(null);

      await expect(authService.resetPassword({ 
        token, 
        password: 'NewPassword123!' 
      })).rejects.toThrow('Invalid or expired reset token');
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const userId = 'user123';
      const updateData = { name: 'Updated Name' };
      const mockUserDoc = {
        _id: userId,
        name: 'Old Name',
        username: 'testuser',
        email: 'test@example.com',
        save: jest.fn().mockResolvedValue(true)
      };

      (mockUser.findById as jest.Mock).mockResolvedValue(mockUserDoc);

      const result = await authService.updateProfile(userId, updateData);

      expect(mockUser.findById).toHaveBeenCalledWith(userId);
      expect(mockUserDoc.save).toHaveBeenCalled();
      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundError for non-existent user', async () => {
      const userId = 'nonexistent';
      (mockUser.findById as jest.Mock).mockResolvedValue(null);

      await expect(authService.updateProfile(userId, { name: 'Test' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const token = 'verify-token-123';
      const mockUserDoc = {
        emailVerified: false,
        save: jest.fn().mockResolvedValue(true)
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        userId: 'user123',
        email: 'test@example.com'
      }));
      (mockUser.findById as jest.Mock).mockResolvedValue(mockUserDoc);
      mockRedisClient.del.mockResolvedValue(1);

      await authService.verifyEmail(token);

      expect(mockUserDoc.emailVerified).toBe(true);
      expect(mockUserDoc.save).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalledWith('email_verification:verify-token-123');
    });

    it('should throw NotFoundError for invalid token', async () => {
      const token = 'invalid-token';
      mockRedisClient.get.mockResolvedValue(null);

      await expect(authService.verifyEmail(token)).rejects.toThrow(NotFoundError);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const userId = 'user123';
      const changeData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!'
      };
      const mockUserDoc = {
        passwordHash: 'oldhashedpassword',
        save: jest.fn().mockResolvedValue(true)
      };

      (mockUser.findById as jest.Mock).mockResolvedValue(mockUserDoc);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockBcrypt.hash.mockResolvedValue('newhashedpassword' as never);

      await authService.changePassword(userId, changeData);

      expect(mockBcrypt.compare).toHaveBeenCalledWith('OldPassword123!', 'oldhashedpassword');
      expect(mockBcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 12);
      expect(mockUserDoc.save).toHaveBeenCalled();
    });

    it('should throw AuthenticationError for incorrect current password', async () => {
      const userId = 'user123';
      const changeData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!'
      };
      const mockUserDoc = { passwordHash: 'hashedpassword' };

      (mockUser.findById as jest.Mock).mockResolvedValue(mockUserDoc);
      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(authService.changePassword(userId, changeData)).rejects.toThrow(AuthenticationError);
    });
  });

  describe('getSessions', () => {
    it('should get sessions successfully', async () => {
      const userId = 'user123';
      const mockSessions = ['session1', 'session2'];
      const mockSessionData = {
        tokenId: 'session1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString()
      };

      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(mockSessions))
        .mockResolvedValueOnce(JSON.stringify(mockSessionData))
        .mockResolvedValueOnce(JSON.stringify({ ...mockSessionData, tokenId: 'session2' }));

      const result = await authService.getSessions(userId);

      expect(result).toHaveLength(2);
      expect(result[0]?.sessionId).toBe('session1');
    });

    it('should return empty array if no sessions', async () => {
      const userId = 'user123';
      mockRedisClient.get.mockResolvedValue(null);

      const result = await authService.getSessions(userId);

      expect(result).toEqual([]);
    });
  });

  describe('revokeSession', () => {
    it('should revoke session successfully', async () => {
      const userId = 'user123';
      const sessionId = 'session1';

      mockRedisClient.del.mockResolvedValueOnce(1); // session deleted
      mockRedisClient.get.mockResolvedValue(JSON.stringify(['session1', 'session2']));
      mockRedisClient.setEx.mockResolvedValue('OK');

      await authService.revokeSession(userId, sessionId);

      expect(mockRedisClient.del).toHaveBeenCalledWith('auth:refresh:user123:session1');
    });

    it('should throw NotFoundError for non-existent session', async () => {
      const userId = 'user123';
      const sessionId = 'nonexistent';

      mockRedisClient.del.mockResolvedValue(0);

      await expect(authService.revokeSession(userId, sessionId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getUserById', () => {
    it('should get user by ID successfully', async () => {
      const userId = 'user123';
      const mockUserDoc = {
        _id: userId,
        username: 'testuser',
        email: 'test@example.com'
      };

      (mockUser.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUserDoc)
      });

      const result = await authService.getUserById(userId);

      expect(mockUser.findById).toHaveBeenCalledWith(userId);
      expect(result).toBe(mockUserDoc);
    });

    it('should return null for non-existent user', async () => {
      const userId = 'nonexistent';

      (mockUser.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      const result = await authService.getUserById(userId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const userId = 'user123';

      (mockUser.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      const result = await authService.getUserById(userId);

      expect(result).toBeNull();
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted token', async () => {
      const token = 'blacklisted-token';
      mockRedisClient.get.mockResolvedValue('1');

      const result = await authService.isTokenBlacklisted(token);

      expect(result).toBe(true);
      expect(mockRedisClient.get).toHaveBeenCalledWith('auth:blacklist:blacklisted-token');
    });

    it('should return false for non-blacklisted token', async () => {
      const token = 'valid-token';
      mockRedisClient.get.mockResolvedValue(null);

      const result = await authService.isTokenBlacklisted(token);

      expect(result).toBe(false);
    });
  });
}); 