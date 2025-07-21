"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeSession = exports.getSessions = exports.changePassword = exports.resendVerification = exports.verifyEmail = exports.updateProfile = exports.getProfile = exports.resetPassword = exports.forgotPassword = exports.logout = exports.refreshToken = exports.login = exports.register = void 0;
const auth_service_1 = require("../services/auth.service");
const validation_1 = require("../utils/validation");
const errors_1 = require("../utils/errors");
const register = async (req, res) => {
    try {
        const validation = (0, validation_1.validateRequest)(req.body, validation_1.registerSchema);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const registerData = {
            username: validation.value.username,
            email: validation.value.email,
            password: validation.value.password,
            name: validation.value.name,
            demographics: validation.value.demographics,
            fitnessProfile: validation.value.fitnessProfile
        };
        const result = await auth_service_1.authService.register(registerData);
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
    }
    catch (error) {
        if (error instanceof errors_1.ConflictError) {
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
exports.register = register;
const login = async (req, res) => {
    try {
        const validation = (0, validation_1.validateRequest)(req.body, validation_1.loginSchema);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const loginData = {
            email: validation.value.email,
            password: validation.value.password
        };
        const result = await auth_service_1.authService.login(loginData);
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
    }
    catch (error) {
        if (error instanceof errors_1.AuthenticationError) {
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
exports.login = login;
const refreshToken = async (req, res) => {
    try {
        const validation = (0, validation_1.validateRequest)(req.body, validation_1.refreshTokenSchema);
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
        const result = await auth_service_1.authService.refreshToken(refreshTokenValue);
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
    }
    catch (error) {
        if (error instanceof errors_1.AuthenticationError) {
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
exports.refreshToken = refreshToken;
const logout = async (req, res) => {
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
        await auth_service_1.authService.logout(user._id.toString(), accessToken, refreshTokenValue);
        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error during logout',
            code: 'LOGOUT_ERROR'
        });
    }
};
exports.logout = logout;
const forgotPassword = async (req, res) => {
    try {
        const validation = (0, validation_1.validateRequest)(req.body, validation_1.forgotPasswordSchema);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const forgotPasswordData = {
            email: validation.value.email
        };
        const message = await auth_service_1.authService.forgotPassword(forgotPasswordData);
        res.status(200).json({
            success: true,
            message: 'If the email exists, a password reset link has been sent',
            data: {
                ...(process.env['NODE_ENV'] === 'development' && { resetToken: message })
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error during password reset request',
            code: 'PASSWORD_RESET_REQUEST_ERROR'
        });
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    try {
        const validation = (0, validation_1.validateRequest)(req.body, validation_1.resetPasswordSchema);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const resetPasswordData = {
            token: validation.value.token,
            password: validation.value.password
        };
        await auth_service_1.authService.resetPassword(resetPasswordData);
        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });
    }
    catch (error) {
        if (error instanceof errors_1.AuthenticationError) {
            res.status(401).json({
                success: false,
                message: error.message,
                code: 'AUTHENTICATION_ERROR'
            });
            return;
        }
        if (error instanceof errors_1.NotFoundError) {
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
exports.resetPassword = resetPassword;
const getProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED'
            });
            return;
        }
        const user = await auth_service_1.authService.getUserById(userId);
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res) => {
    try {
        const validation = (0, validation_1.validateRequest)(req.body, validation_1.updateProfileSchema);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED'
            });
            return;
        }
        const updateData = validation.value;
        const updatedUser = await auth_service_1.authService.updateProfile(userId, updateData);
        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: updatedUser
            }
        });
    }
    catch (error) {
        if (error instanceof errors_1.NotFoundError) {
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
exports.updateProfile = updateProfile;
const verifyEmail = async (req, res) => {
    try {
        const validation = (0, validation_1.validateRequest)(req.body, validation_1.verifyEmailSchema);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        await auth_service_1.authService.verifyEmail(validation.value.token);
        res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            data: null
        });
    }
    catch (error) {
        if (error instanceof errors_1.NotFoundError) {
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
exports.verifyEmail = verifyEmail;
const resendVerification = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED'
            });
            return;
        }
        const token = await auth_service_1.authService.resendVerification(userId);
        res.status(200).json({
            success: true,
            message: 'Verification email sent successfully',
            data: {
                token
            }
        });
    }
    catch (error) {
        if (error instanceof errors_1.NotFoundError) {
            res.status(404).json({
                success: false,
                message: error.message,
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        if (error instanceof errors_1.ConflictError) {
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
exports.resendVerification = resendVerification;
const changePassword = async (req, res) => {
    try {
        const validation = (0, validation_1.validateRequest)(req.body, validation_1.changePasswordSchema);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED'
            });
            return;
        }
        const changeData = validation.value;
        await auth_service_1.authService.changePassword(userId, changeData);
        res.status(200).json({
            success: true,
            message: 'Password changed successfully',
            data: null
        });
    }
    catch (error) {
        if (error instanceof errors_1.NotFoundError) {
            res.status(404).json({
                success: false,
                message: error.message,
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        if (error instanceof errors_1.AuthenticationError) {
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
exports.changePassword = changePassword;
const getSessions = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED'
            });
            return;
        }
        const sessions = await auth_service_1.authService.getSessions(userId);
        res.status(200).json({
            success: true,
            message: 'Sessions retrieved successfully',
            data: {
                sessions
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};
exports.getSessions = getSessions;
const revokeSession = async (req, res) => {
    try {
        const userId = req.user?.id;
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
        await auth_service_1.authService.revokeSession(userId, sessionId);
        res.status(200).json({
            success: true,
            message: 'Session revoked successfully',
            data: null
        });
    }
    catch (error) {
        if (error instanceof errors_1.NotFoundError) {
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
exports.revokeSession = revokeSession;
//# sourceMappingURL=auth.controller.js.map