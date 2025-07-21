"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const uuid_1 = require("uuid");
const User_1 = require("../models/User");
const jwt_1 = require("../utils/jwt");
const errors_1 = require("../utils/errors");
const redis_1 = require("../utils/redis");
class AuthService {
    static BCRYPT_SALT_ROUNDS = 12;
    static REFRESH_TOKEN_PREFIX = 'auth:refresh:';
    static BLACKLIST_PREFIX = 'auth:blacklist:';
    static RESET_TOKEN_PREFIX = 'auth:reset:';
    static RESET_TOKEN_EXPIRY = 3600;
    async register(data) {
        try {
            const existingUser = await User_1.User.findOne({
                $or: [
                    { email: data.email.toLowerCase() },
                    { username: data.username }
                ]
            });
            if (existingUser) {
                if (existingUser.email === data.email.toLowerCase()) {
                    throw new errors_1.ConflictError('Email address is already registered');
                }
                if (existingUser.username === data.username) {
                    throw new errors_1.ConflictError('Username is already taken');
                }
            }
            const passwordHash = await bcrypt_1.default.hash(data.password, AuthService.BCRYPT_SALT_ROUNDS);
            const user = new User_1.User({
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
            const tokenId = (0, uuid_1.v4)();
            const tokens = (0, jwt_1.generateTokenPair)({
                userId: user._id.toString(),
                email: user.email,
                username: user.username,
                isActive: user.isActive
            }, tokenId);
            await this.storeRefreshToken(user._id.toString(), tokenId, tokens.refreshTokenExpiresAt);
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
        }
        catch (error) {
            if (error instanceof errors_1.ConflictError) {
                throw error;
            }
            throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async login(data) {
        try {
            const user = await User_1.User.findOne({
                email: data.email.toLowerCase(),
                isActive: true
            });
            if (!user) {
                throw new errors_1.AuthenticationError('Invalid email or password');
            }
            const isPasswordValid = await bcrypt_1.default.compare(data.password, user.passwordHash);
            if (!isPasswordValid) {
                throw new errors_1.AuthenticationError('Invalid email or password');
            }
            user.lastLogin = new Date();
            await user.save();
            const tokenId = (0, uuid_1.v4)();
            const tokens = (0, jwt_1.generateTokenPair)({
                userId: user._id.toString(),
                email: user.email,
                username: user.username,
                isActive: user.isActive
            }, tokenId);
            await this.storeRefreshToken(user._id.toString(), tokenId, tokens.refreshTokenExpiresAt);
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
        }
        catch (error) {
            if (error instanceof errors_1.AuthenticationError) {
                throw error;
            }
            throw new errors_1.AuthenticationError('Login failed');
        }
    }
    async refreshToken(refreshToken) {
        try {
            const payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
            const client = redis_1.redis.getClient();
            const storedTokenId = await client.get(`${AuthService.REFRESH_TOKEN_PREFIX}${payload.userId}`);
            if (!storedTokenId || storedTokenId !== payload.tokenId) {
                throw new errors_1.AuthenticationError('Invalid or expired refresh token');
            }
            const isBlacklisted = await client.get(`${AuthService.BLACKLIST_PREFIX}${refreshToken}`);
            if (isBlacklisted) {
                throw new errors_1.AuthenticationError('Token has been revoked');
            }
            const user = await User_1.User.findById(payload.userId);
            if (!user || !user.isActive) {
                throw new errors_1.AuthenticationError('User not found or inactive');
            }
            const newTokenId = (0, uuid_1.v4)();
            const tokens = (0, jwt_1.generateTokenPair)({
                userId: user._id.toString(),
                email: user.email,
                username: user.username,
                isActive: user.isActive
            }, newTokenId);
            await Promise.all([
                this.storeRefreshToken(user._id.toString(), newTokenId, tokens.refreshTokenExpiresAt),
                this.blacklistToken(refreshToken)
            ]);
            return { tokens };
        }
        catch (error) {
            if (error instanceof errors_1.AuthenticationError) {
                throw error;
            }
            throw new errors_1.AuthenticationError('Token refresh failed');
        }
    }
    async logout(userId, accessToken, refreshToken) {
        try {
            const client = redis_1.redis.getClient();
            const promises = [
                client.del(`${AuthService.REFRESH_TOKEN_PREFIX}${userId}`),
                this.blacklistToken(accessToken)
            ];
            if (refreshToken) {
                promises.push(this.blacklistToken(refreshToken));
            }
            await Promise.all(promises);
        }
        catch (error) {
            throw new Error(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async forgotPassword(data) {
        try {
            const user = await User_1.User.findOne({
                email: data.email.toLowerCase(),
                isActive: true
            });
            if (!user) {
                return 'If the email exists, a reset link has been sent';
            }
            const resetToken = (0, uuid_1.v4)();
            const client = redis_1.redis.getClient();
            await client.setEx(`${AuthService.RESET_TOKEN_PREFIX}${resetToken}`, AuthService.RESET_TOKEN_EXPIRY, user._id.toString());
            return resetToken;
        }
        catch (error) {
            throw new Error(`Password reset request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async resetPassword(data) {
        try {
            const client = redis_1.redis.getClient();
            const userId = await client.get(`${AuthService.RESET_TOKEN_PREFIX}${data.token}`);
            if (!userId) {
                throw new errors_1.AuthenticationError('Invalid or expired reset token');
            }
            const user = await User_1.User.findById(userId);
            if (!user || !user.isActive) {
                throw new errors_1.NotFoundError('User not found or inactive');
            }
            const passwordHash = await bcrypt_1.default.hash(data.password, AuthService.BCRYPT_SALT_ROUNDS);
            user.passwordHash = passwordHash;
            await user.save();
            await client.del(`${AuthService.RESET_TOKEN_PREFIX}${data.token}`);
            await this.invalidateAllUserSessions(userId);
        }
        catch (error) {
            if (error instanceof errors_1.AuthenticationError || error instanceof errors_1.NotFoundError) {
                throw error;
            }
            throw new Error(`Password reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async storeRefreshToken(userId, tokenId, expiresAt) {
        const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
        const client = redis_1.redis.getClient();
        const sessionKey = `${AuthService.REFRESH_TOKEN_PREFIX}${userId}:${tokenId}`;
        const sessionData = {
            tokenId,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            userAgent: '',
            ipAddress: ''
        };
        await client.setEx(sessionKey, ttl, JSON.stringify(sessionData));
        const sessionListKey = `user_sessions:${userId}`;
        const existingSessions = await client.get(sessionListKey);
        let sessionIds = existingSessions ? JSON.parse(existingSessions) : [];
        if (!sessionIds.includes(tokenId)) {
            sessionIds.push(tokenId);
            await client.setEx(sessionListKey, ttl, JSON.stringify(sessionIds));
        }
        await client.setEx(`${AuthService.REFRESH_TOKEN_PREFIX}${userId}`, ttl, tokenId);
    }
    async blacklistToken(token) {
        const ttl = 86400;
        const client = redis_1.redis.getClient();
        await client.setEx(`${AuthService.BLACKLIST_PREFIX}${token}`, ttl, '1');
    }
    async isTokenBlacklisted(token) {
        const client = redis_1.redis.getClient();
        const result = await client.get(`${AuthService.BLACKLIST_PREFIX}${token}`);
        return result !== null;
    }
    async invalidateAllUserSessions(userId) {
        const client = redis_1.redis.getClient();
        await client.del(`${AuthService.REFRESH_TOKEN_PREFIX}${userId}`);
    }
    async getUserById(userId) {
        try {
            const user = await User_1.User.findById(userId).select('-passwordHash');
            return user;
        }
        catch (error) {
            return null;
        }
    }
    async updateProfile(userId, data) {
        try {
            const user = await User_1.User.findById(userId);
            if (!user) {
                throw new errors_1.NotFoundError('User not found');
            }
            if (data.name)
                user.name = data.name;
            if (data.demographics)
                user.demographics = { ...user.demographics, ...data.demographics };
            if (data.fitnessProfile)
                user.fitnessProfile = { ...user.fitnessProfile, ...data.fitnessProfile };
            await user.save();
            const result = {
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
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError) {
                throw error;
            }
            throw new Error('Failed to update profile');
        }
    }
    async verifyEmail(token) {
        try {
            const client = redis_1.redis.getClient();
            const data = await client.get(`${AuthService.EMAIL_VERIFICATION_PREFIX}${token}`);
            if (!data) {
                throw new errors_1.NotFoundError('Invalid or expired verification token');
            }
            const { userId } = JSON.parse(data);
            const user = await User_1.User.findById(userId);
            if (!user) {
                throw new errors_1.NotFoundError('User not found');
            }
            user.emailVerified = true;
            await user.save();
            await client.del(`${AuthService.EMAIL_VERIFICATION_PREFIX}${token}`);
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError) {
                throw error;
            }
            throw new Error('Failed to verify email');
        }
    }
    async resendVerification(userId) {
        try {
            const user = await User_1.User.findById(userId);
            if (!user) {
                throw new errors_1.NotFoundError('User not found');
            }
            if (user.emailVerified) {
                throw new errors_1.ConflictError('Email already verified');
            }
            const token = (0, uuid_1.v4)();
            const client = redis_1.redis.getClient();
            await client.setEx(`${AuthService.EMAIL_VERIFICATION_PREFIX}${token}`, 24 * 60 * 60, JSON.stringify({ userId: user._id.toString(), email: user.email }));
            return token;
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError || error instanceof errors_1.ConflictError) {
                throw error;
            }
            throw new Error('Failed to resend verification');
        }
    }
    async changePassword(userId, data) {
        try {
            const user = await User_1.User.findById(userId);
            if (!user) {
                throw new errors_1.NotFoundError('User not found');
            }
            const isCurrentPasswordValid = await bcrypt_1.default.compare(data.currentPassword, user.passwordHash);
            if (!isCurrentPasswordValid) {
                throw new errors_1.AuthenticationError('Current password is incorrect');
            }
            const hashedPassword = await bcrypt_1.default.hash(data.newPassword, AuthService.BCRYPT_SALT_ROUNDS);
            user.passwordHash = hashedPassword;
            await user.save();
            await this.invalidateAllUserSessions(userId);
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError || error instanceof errors_1.AuthenticationError) {
                throw error;
            }
            throw new Error('Failed to change password');
        }
    }
    async getSessions(userId) {
        try {
            const client = redis_1.redis.getClient();
            const sessionListKey = `user_sessions:${userId}`;
            const sessionData = await client.get(sessionListKey);
            if (!sessionData) {
                return [];
            }
            const sessionIds = JSON.parse(sessionData);
            const sessions = [];
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
        }
        catch (error) {
            throw new Error('Failed to retrieve sessions');
        }
    }
    async revokeSession(userId, sessionId) {
        try {
            const client = redis_1.redis.getClient();
            const sessionKey = `${AuthService.REFRESH_TOKEN_PREFIX}${userId}:${sessionId}`;
            const result = await client.del(sessionKey);
            if (result === 0) {
                throw new errors_1.NotFoundError('Session not found');
            }
            const sessionListKey = `user_sessions:${userId}`;
            const existingSessions = await client.get(sessionListKey);
            if (existingSessions) {
                let sessionIds = JSON.parse(existingSessions);
                sessionIds = sessionIds.filter(id => id !== sessionId);
                if (sessionIds.length > 0) {
                    await client.setEx(sessionListKey, 7 * 24 * 60 * 60, JSON.stringify(sessionIds));
                }
                else {
                    await client.del(sessionListKey);
                }
            }
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError) {
                throw error;
            }
            throw new Error('Failed to revoke session');
        }
    }
    static EMAIL_VERIFICATION_PREFIX = 'email_verification:';
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map