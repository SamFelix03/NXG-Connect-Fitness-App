import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User, IUser } from '../models/User';
import { 
  generateTokenPair, 
  verifyRefreshToken, 
  RefreshTokenPayload,
  TokenPair 
} from '../utils/jwt';
import { 
  AuthenticationError, 
  ConflictError, 
  NotFoundError 
} from '../utils/errors';
import { redis } from '../utils/redis';

// Registration interface
export interface RegisterData {
  username: string;
  email: string;
  password: string;
  name: string;
  demographics?: any;
  fitnessProfile?: any;
}

// Login interface
export interface LoginData {
  email: string;
  password: string;
}

// Password reset interfaces
export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
}

// Update profile interface
export interface UpdateProfileData {
  name?: string;
  demographics?: any;
  fitnessProfile?: any;
}

// Change password interface
export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

// Session interface
export interface UserSession {
  sessionId: string;
  userId: string;
  tokenId: string;
  createdAt: Date;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

// Service response interfaces
export interface AuthResponse {
  user: Partial<IUser>;
  tokens: TokenPair;
}

export interface RefreshResponse {
  tokens: TokenPair;
}

/**
 * Authentication Service
 * Handles user authentication, registration, and token management
 */
export class AuthService {
  private static readonly BCRYPT_SALT_ROUNDS = 12;
  private static readonly REFRESH_TOKEN_PREFIX = 'auth:refresh:';
  private static readonly BLACKLIST_PREFIX = 'auth:blacklist:';
  private static readonly RESET_TOKEN_PREFIX = 'auth:reset:';
  private static readonly RESET_TOKEN_EXPIRY = 3600; // 1 hour in seconds

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: data.email.toLowerCase() },
          { username: data.username }
        ]
      });

      if (existingUser) {
        if (existingUser.email === data.email.toLowerCase()) {
          throw new ConflictError('Email address is already registered');
        }
        if (existingUser.username === data.username) {
          throw new ConflictError('Username is already taken');
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, AuthService.BCRYPT_SALT_ROUNDS);

      // Create new user
      const user = new User({
        username: data.username,
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        demographics: data.demographics || {},
        fitnessProfile: data.fitnessProfile || {},
        isActive: true,
        emailVerified: false,
        totalPoints: 0
      });

      await user.save();

      // Generate token pair
      const tokenId = uuidv4();
      const tokens = generateTokenPair({
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        isActive: user.isActive
      }, tokenId);

      // Store refresh token in Redis
      await this.storeRefreshToken(user._id.toString(), tokenId, tokens.refreshTokenExpiresAt);

      // Return user data without sensitive information
      const userData = {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        demographics: user.demographics,
        fitnessProfile: user.fitnessProfile,
        totalPoints: user.totalPoints,
        createdAt: user.createdAt
      };

      return {
        user: userData,
        tokens
      };
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Authenticate user login
   */
  async login(data: LoginData): Promise<AuthResponse> {
    try {
      // Find user by email
      const user = await User.findOne({ 
        email: data.email.toLowerCase(),
        isActive: true 
      });

      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
      if (!isPasswordValid) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate token pair
      const tokenId = uuidv4();
      const tokens = generateTokenPair({
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        isActive: user.isActive
      }, tokenId);

      // Store refresh token in Redis
      await this.storeRefreshToken(user._id.toString(), tokenId, tokens.refreshTokenExpiresAt);

      // Return user data without sensitive information
      const userData = {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        demographics: user.demographics,
        fitnessProfile: user.fitnessProfile,
        totalPoints: user.totalPoints,
        lastLogin: user.lastLogin
      };

      return {
        user: userData,
        tokens
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Login failed');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<RefreshResponse> {
    try {
      // Verify refresh token
      const payload: RefreshTokenPayload = verifyRefreshToken(refreshToken);

      // Check if refresh token exists in Redis
      const client = redis.getClient();
      const storedTokenId = await client.get(`${AuthService.REFRESH_TOKEN_PREFIX}${payload.userId}`);
      if (!storedTokenId || storedTokenId !== payload.tokenId) {
        throw new AuthenticationError('Invalid or expired refresh token');
      }

      // Check if token is blacklisted
      const isBlacklisted = await client.get(`${AuthService.BLACKLIST_PREFIX}${refreshToken}`);
      if (isBlacklisted) {
        throw new AuthenticationError('Token has been revoked');
      }

      // Get user data
      const user = await User.findById(payload.userId);
      if (!user || !user.isActive) {
        throw new AuthenticationError('User not found or inactive');
      }

      // Generate new token pair (token rotation)
      const newTokenId = uuidv4();
      const tokens = generateTokenPair({
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        isActive: user.isActive
      }, newTokenId);

      // Store new refresh token and invalidate old one
      await Promise.all([
        this.storeRefreshToken(user._id.toString(), newTokenId, tokens.refreshTokenExpiresAt),
        this.blacklistToken(refreshToken)
      ]);

      return { tokens };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Token refresh failed');
    }
  }

  /**
   * Logout user and blacklist tokens
   */
  async logout(userId: string, accessToken: string, refreshToken?: string): Promise<void> {
    try {
      const client = redis.getClient();
      const promises = [
        // Remove refresh token from storage
        client.del(`${AuthService.REFRESH_TOKEN_PREFIX}${userId}`),
        // Blacklist access token
        this.blacklistToken(accessToken)
      ];

      // Blacklist refresh token if provided
      if (refreshToken) {
        promises.push(this.blacklistToken(refreshToken));
      }

      await Promise.all(promises);
    } catch (error) {
      throw new Error(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate password reset token
   */
  async forgotPassword(data: ForgotPasswordData): Promise<string> {
    try {
      const user = await User.findOne({ 
        email: data.email.toLowerCase(),
        isActive: true 
      });

      if (!user) {
        // Don't reveal that email doesn't exist for security
        return 'If the email exists, a reset link has been sent';
      }

      // Generate reset token
      const resetToken = uuidv4();
      
      // Store reset token in Redis with expiration
      const client = redis.getClient();
      await client.setEx(
        `${AuthService.RESET_TOKEN_PREFIX}${resetToken}`,
        AuthService.RESET_TOKEN_EXPIRY,
        user._id.toString()
      );

      // TODO: Send reset email with token
      // This would integrate with email service
      
      return resetToken; // In production, don't return token directly
    } catch (error) {
      throw new Error(`Password reset request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(data: ResetPasswordData): Promise<void> {
    try {
      // Verify reset token
      const client = redis.getClient();
      const userId = await client.get(`${AuthService.RESET_TOKEN_PREFIX}${data.token}`);
      if (!userId) {
        throw new AuthenticationError('Invalid or expired reset token');
      }

      // Find user
      const user = await User.findById(userId);
      if (!user || !user.isActive) {
        throw new NotFoundError('User not found or inactive');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(data.password, AuthService.BCRYPT_SALT_ROUNDS);

      // Update user password
      user.passwordHash = passwordHash;
      await user.save();

      // Delete reset token
      await client.del(`${AuthService.RESET_TOKEN_PREFIX}${data.token}`);

      // Invalidate all user sessions
      await this.invalidateAllUserSessions(userId);
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Password reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store refresh token
   */
  private async storeRefreshToken(userId: string, tokenId: string, expiresAt: Date): Promise<void> {
    const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    const client = redis.getClient();
    
    // Store the individual session data
    const sessionKey = `${AuthService.REFRESH_TOKEN_PREFIX}${userId}:${tokenId}`;
    const sessionData = {
      tokenId,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      userAgent: '', // TODO: Pass from request
      ipAddress: ''  // TODO: Pass from request
    };
    await client.setEx(sessionKey, ttl, JSON.stringify(sessionData));
    
    // Maintain session list for the user
    const sessionListKey = `user_sessions:${userId}`;
    const existingSessions = await client.get(sessionListKey);
    let sessionIds: string[] = existingSessions ? JSON.parse(existingSessions) : [];
    
    // Add new session if not already present
    if (!sessionIds.includes(tokenId)) {
      sessionIds.push(tokenId);
      await client.setEx(sessionListKey, ttl, JSON.stringify(sessionIds));
    }
    
    // Also maintain backward compatibility with old key pattern
    await client.setEx(`${AuthService.REFRESH_TOKEN_PREFIX}${userId}`, ttl, tokenId);
  }

  /**
   * Blacklist a token
   */
  private async blacklistToken(token: string): Promise<void> {
    // Set TTL to token's expiration time to automatically clean up
    const ttl = 86400; // 24 hours default TTL for blacklisted tokens
    const client = redis.getClient();
    await client.setEx(`${AuthService.BLACKLIST_PREFIX}${token}`, ttl, '1');
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const client = redis.getClient();
    const result = await client.get(`${AuthService.BLACKLIST_PREFIX}${token}`);
    return result !== null;
  }

  /**
   * Invalidate all user sessions
   */
  private async invalidateAllUserSessions(userId: string): Promise<void> {
    const client = redis.getClient();
    await client.del(`${AuthService.REFRESH_TOKEN_PREFIX}${userId}`);
  }

  /**
   * Get user by ID (for middleware)
   */
  async getUserById(userId: string): Promise<IUser | null> {
    try {
      const user = await User.findById(userId).select('-passwordHash');
      return user as IUser | null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateProfileData): Promise<Partial<IUser>> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Update fields
      if (data.name) user.name = data.name;
      if (data.demographics) user.demographics = { ...user.demographics, ...data.demographics };
      if (data.fitnessProfile) user.fitnessProfile = { ...user.fitnessProfile, ...data.fitnessProfile };

      await user.save();

      // Return user without sensitive data
      const result: Partial<IUser> = {
        _id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        demographics: user.demographics,
        fitnessProfile: user.fitnessProfile,
        isActive: user.isActive,
        emailVerified: user.emailVerified
      };
      
      if (user.lastLogin) {
        result.lastLogin = user.lastLogin;
      }

      return result;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error('Failed to update profile');
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<void> {
    try {
      const client = redis.getClient();
      const data = await client.get(`${AuthService.EMAIL_VERIFICATION_PREFIX}${token}`);
      
      if (!data) {
        throw new NotFoundError('Invalid or expired verification token');
      }

      const { userId } = JSON.parse(data);
      const user = await User.findById(userId);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }

      user.emailVerified = true;
      await user.save();

      // Clean up verification token
      await client.del(`${AuthService.EMAIL_VERIFICATION_PREFIX}${token}`);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error('Failed to verify email');
    }
  }

  /**
   * Resend email verification
   */
  async resendVerification(userId: string): Promise<string> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (user.emailVerified) {
        throw new ConflictError('Email already verified');
      }

      // Generate verification token
      const token = uuidv4();
      const client = redis.getClient();
      
      // Store verification token (24 hour expiry)
      await client.setEx(
        `${AuthService.EMAIL_VERIFICATION_PREFIX}${token}`,
        24 * 60 * 60, // 24 hours
        JSON.stringify({ userId: user._id.toString(), email: user.email })
      );

      return token;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new Error('Failed to resend verification');
    }
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(userId: string, data: ChangePasswordData): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new AuthenticationError('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(data.newPassword, AuthService.BCRYPT_SALT_ROUNDS);
      user.passwordHash = hashedPassword;
      await user.save();

      // Invalidate all existing sessions for security
      await this.invalidateAllUserSessions(userId);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof AuthenticationError) {
        throw error;
      }
      throw new Error('Failed to change password');
    }
  }

  /**
   * Get all active sessions for user
   */
  async getSessions(userId: string): Promise<UserSession[]> {
    try {
      const client = redis.getClient();
      
      // For simplicity, we'll store session list in a separate key
      const sessionListKey = `user_sessions:${userId}`;
      const sessionData = await client.get(sessionListKey);
      
      if (!sessionData) {
        return [];
      }

      const sessionIds: string[] = JSON.parse(sessionData);
      const sessions: UserSession[] = [];
      
      for (const sessionId of sessionIds) {
        const sessionKey = `${AuthService.REFRESH_TOKEN_PREFIX}${userId}:${sessionId}`;
        const data = await client.get(sessionKey);
        if (data) {
          const session = JSON.parse(data);
          sessions.push({
            sessionId,
            userId,
            tokenId: sessionId,
            createdAt: new Date(session.createdAt),
            expiresAt: new Date(session.expiresAt),
            userAgent: session.userAgent,
            ipAddress: session.ipAddress
          });
        }
      }

      return sessions;
    } catch (error) {
      throw new Error('Failed to retrieve sessions');
    }
  }

  /**
   * Revoke specific session
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    try {
      const client = redis.getClient();
      const sessionKey = `${AuthService.REFRESH_TOKEN_PREFIX}${userId}:${sessionId}`;
      const result = await client.del(sessionKey);
      
      if (result === 0) {
        throw new NotFoundError('Session not found');
      }

      // Remove from session list
      const sessionListKey = `user_sessions:${userId}`;
      const existingSessions = await client.get(sessionListKey);
      if (existingSessions) {
        let sessionIds: string[] = JSON.parse(existingSessions);
        sessionIds = sessionIds.filter(id => id !== sessionId);
        
        if (sessionIds.length > 0) {
          await client.setEx(sessionListKey, 7 * 24 * 60 * 60, JSON.stringify(sessionIds)); // 7 days TTL
        } else {
          await client.del(sessionListKey);
        }
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error('Failed to revoke session');
    }
  }

  // Private constants
  private static readonly EMAIL_VERIFICATION_PREFIX = 'email_verification:';
}

// Export singleton instance
export const authService = new AuthService(); 