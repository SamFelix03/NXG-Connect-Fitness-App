import { Request, Response } from 'express';
import { authService, RegisterData, LoginData, ForgotPasswordData, ResetPasswordData, UpdateProfileData, ChangePasswordData } from '../services/auth.service';
import { 
  validateRequest, 
  registerSchema, 
  loginSchema, 
  refreshTokenSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
  changePasswordSchema
} from '../utils/validation';
import { 
  AuthenticationError, 
  ConflictError, 
  NotFoundError 
} from '../utils/errors';

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request data
    const validation = validateRequest(req.body, registerSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const registerData: RegisterData = {
      username: validation.value.username,
      email: validation.value.email,
      password: validation.value.password,
      name: validation.value.name,
      demographics: validation.value.demographics,
      fitnessProfile: validation.value.fitnessProfile
    };

    // Register user
    const result = await authService.register(registerData);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          accessTokenExpiresAt: result.tokens.accessTokenExpiresAt,
          refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt
        }
      }
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      res.status(409).json({
        success: false,
        message: error.message,
        code: 'CONFLICT_ERROR'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during registration',
      code: 'REGISTRATION_ERROR'
    });
  }
};

/**
 * Authenticate user login
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request data
    const validation = validateRequest(req.body, loginSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const loginData: LoginData = {
      email: validation.value.email,
      password: validation.value.password
    };

    // Authenticate user
    const result = await authService.login(loginData);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          accessTokenExpiresAt: result.tokens.accessTokenExpiresAt,
          refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt
        }
      }
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(401).json({
        success: false,
        message: error.message,
        code: 'AUTHENTICATION_ERROR'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during login',
      code: 'LOGIN_ERROR'
    });
  }
};

/**
 * Refresh access token using refresh token
 * POST /api/auth/refresh
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request data
    const validation = validateRequest(req.body, refreshTokenSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const refreshTokenValue = validation.value.refreshToken;

    // Refresh tokens
    const result = await authService.refreshToken(refreshTokenValue);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens: {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          accessTokenExpiresAt: result.tokens.accessTokenExpiresAt,
          refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt
        }
      }
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(401).json({
        success: false,
        message: error.message,
        code: 'AUTHENTICATION_ERROR'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during token refresh',
      code: 'TOKEN_REFRESH_ERROR'
    });
  }
};

/**
 * Logout user and invalidate tokens
 * POST /api/auth/logout
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const accessToken = req.token;
    const refreshTokenValue = req.body.refreshToken;

    if (!user || !accessToken) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    // Logout user
    await authService.logout(user._id.toString(), accessToken, refreshTokenValue);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout',
      code: 'LOGOUT_ERROR'
    });
  }
};

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request data
    const validation = validateRequest(req.body, forgotPasswordSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const forgotPasswordData: ForgotPasswordData = {
      email: validation.value.email
    };

    // Generate password reset token
    const message = await authService.forgotPassword(forgotPasswordData);

    res.status(200).json({
      success: true,
      message: 'If the email exists, a password reset link has been sent',
      data: {
        // In development, you might want to return the token for testing
        ...(process.env['NODE_ENV'] === 'development' && { resetToken: message })
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error during password reset request',
      code: 'PASSWORD_RESET_REQUEST_ERROR'
    });
  }
};

/**
 * Reset password using reset token
 * POST /api/auth/reset-password
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request data
    const validation = validateRequest(req.body, resetPasswordSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const resetPasswordData: ResetPasswordData = {
      token: validation.value.token,
      password: validation.value.password
    };

    // Reset password
    await authService.resetPassword(resetPasswordData);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(401).json({
        success: false,
        message: error.message,
        code: 'AUTHENTICATION_ERROR'
      });
      return;
    }

    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        message: error.message,
        code: 'NOT_FOUND_ERROR'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during password reset',
      code: 'PASSWORD_RESET_ERROR'
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/profile
 */
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    const user = await authService.getUserById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          name: user.name,
          demographics: user.demographics,
          fitnessProfile: user.fitnessProfile,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          lastLogin: user.lastLogin
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 */
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request data
    const validation = validateRequest(req.body, updateProfileSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    const updateData: UpdateProfileData = validation.value;
    const updatedUser = await authService.updateProfile(userId, updateData);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        message: error.message,
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Verify email address
 * POST /api/auth/verify-email
 */
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request data
    const validation = validateRequest(req.body, verifyEmailSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    await authService.verifyEmail(validation.value.token);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      data: null
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: 'INVALID_TOKEN'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Resend email verification
 * POST /api/auth/resend-verification
 */
export const resendVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    const token = await authService.resendVerification(userId);

    res.status(200).json({
      success: true,
      message: 'Verification email sent successfully',
      data: {
        token // In production, this would be sent via email
      }
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        message: error.message,
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    if (error instanceof ConflictError) {
      res.status(409).json({
        success: false,
        message: error.message,
        code: 'EMAIL_ALREADY_VERIFIED'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Change password for authenticated user
 * POST /api/auth/change-password
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request data
    const validation = validateRequest(req.body, changePasswordSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    const changeData: ChangePasswordData = validation.value;
    await authService.changePassword(userId, changeData);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      data: null
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        message: error.message,
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    if (error instanceof AuthenticationError) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: 'INVALID_CURRENT_PASSWORD'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Get all active sessions for user
 * GET /api/auth/sessions
 */
export const getSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    const sessions = await authService.getSessions(userId);

    res.status(200).json({
      success: true,
      message: 'Sessions retrieved successfully',
      data: {
        sessions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Revoke specific session
 * DELETE /api/auth/sessions/:sessionId
 */
export const revokeSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    const { sessionId } = req.params;
    if (!sessionId) {
      res.status(400).json({
        success: false,
        message: 'Session ID is required',
        code: 'MISSING_SESSION_ID'
      });
      return;
    }

    await authService.revokeSession(userId, sessionId);

    res.status(200).json({
      success: true,
      message: 'Session revoked successfully',
      data: null
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        message: error.message,
        code: 'SESSION_NOT_FOUND'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}; 