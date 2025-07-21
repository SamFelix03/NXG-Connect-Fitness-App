"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTokenExpired = exports.getTokenExpirationTime = exports.extractBearerToken = exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateTokenPair = exports.generateRefreshToken = exports.generateAccessToken = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const errors_1 = require("./errors");
const getJWTConfig = () => {
    const config = {
        accessTokenSecret: process.env['JWT_ACCESS_SECRET'] || 'your-access-token-secret',
        refreshTokenSecret: process.env['JWT_REFRESH_SECRET'] || 'your-refresh-token-secret',
        accessTokenExpiry: process.env['JWT_ACCESS_EXPIRY'] || '15m',
        refreshTokenExpiry: process.env['JWT_REFRESH_EXPIRY'] || '7d',
        algorithm: process.env['JWT_ALGORITHM'] || 'HS256',
        issuer: process.env['JWT_ISSUER'] || 'nxg-fitness-api',
        audience: process.env['JWT_AUDIENCE'] || 'nxg-fitness-app'
    };
    if (process.env['NODE_ENV'] === 'production') {
        if (!process.env['JWT_ACCESS_SECRET'] || !process.env['JWT_REFRESH_SECRET']) {
            throw new Error('JWT secrets must be configured in production environment');
        }
    }
    return config;
};
const generateAccessToken = (payload) => {
    const config = getJWTConfig();
    const tokenPayload = {
        ...payload
    };
    const options = {
        expiresIn: config.accessTokenExpiry,
        algorithm: config.algorithm,
        issuer: config.issuer,
        audience: config.audience
    };
    return (0, jsonwebtoken_1.sign)(tokenPayload, config.accessTokenSecret, options);
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (userId, tokenId) => {
    const config = getJWTConfig();
    const tokenPayload = {
        userId,
        tokenId
    };
    const options = {
        expiresIn: config.refreshTokenExpiry,
        algorithm: config.algorithm,
        issuer: config.issuer,
        audience: config.audience
    };
    return (0, jsonwebtoken_1.sign)(tokenPayload, config.refreshTokenSecret, options);
};
exports.generateRefreshToken = generateRefreshToken;
const generateTokenPair = (userPayload, tokenId) => {
    const config = getJWTConfig();
    const accessToken = (0, exports.generateAccessToken)(userPayload);
    const refreshToken = (0, exports.generateRefreshToken)(userPayload.userId, tokenId);
    const now = new Date();
    const accessTokenExpiresAt = new Date(now.getTime() + parseExpiry(config.accessTokenExpiry));
    const refreshTokenExpiresAt = new Date(now.getTime() + parseExpiry(config.refreshTokenExpiry));
    return {
        accessToken,
        refreshToken,
        accessTokenExpiresAt,
        refreshTokenExpiresAt
    };
};
exports.generateTokenPair = generateTokenPair;
const verifyAccessToken = (token) => {
    const config = getJWTConfig();
    try {
        const decoded = (0, jsonwebtoken_1.verify)(token, config.accessTokenSecret, {
            algorithms: [config.algorithm],
            issuer: config.issuer,
            audience: config.audience
        });
        return decoded;
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new errors_1.AuthenticationError('Access token has expired');
        }
        else if (error.name === 'JsonWebTokenError') {
            throw new errors_1.AuthenticationError('Invalid access token');
        }
        else if (error.name === 'NotBeforeError') {
            throw new errors_1.AuthenticationError('Access token not active yet');
        }
        throw new errors_1.AuthenticationError('Token verification failed');
    }
};
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = (token) => {
    const config = getJWTConfig();
    try {
        const decoded = (0, jsonwebtoken_1.verify)(token, config.refreshTokenSecret, {
            algorithms: [config.algorithm],
            issuer: config.issuer,
            audience: config.audience
        });
        return decoded;
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new errors_1.AuthenticationError('Refresh token has expired');
        }
        else if (error.name === 'JsonWebTokenError') {
            throw new errors_1.AuthenticationError('Invalid refresh token');
        }
        else if (error.name === 'NotBeforeError') {
            throw new errors_1.AuthenticationError('Refresh token not active yet');
        }
        throw new errors_1.AuthenticationError('Refresh token verification failed');
    }
};
exports.verifyRefreshToken = verifyRefreshToken;
const extractBearerToken = (authHeader) => {
    if (!authHeader) {
        throw new errors_1.AuthenticationError('Authorization header is required');
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        throw new errors_1.AuthenticationError('Invalid authorization header format. Expected "Bearer <token>"');
    }
    const token = parts[1];
    if (!token || token.trim() === '') {
        throw new errors_1.AuthenticationError('Token is required');
    }
    return token;
};
exports.extractBearerToken = extractBearerToken;
const getTokenExpirationTime = (token) => {
    try {
        const decoded = (0, jsonwebtoken_1.decode)(token);
        if (!decoded || !decoded.exp) {
            throw new Error('Invalid token format');
        }
        return new Date(decoded.exp * 1000);
    }
    catch (error) {
        throw new errors_1.AuthenticationError('Unable to decode token expiration');
    }
};
exports.getTokenExpirationTime = getTokenExpirationTime;
const isTokenExpired = (token) => {
    try {
        const expirationTime = (0, exports.getTokenExpirationTime)(token);
        return expirationTime.getTime() < Date.now();
    }
    catch (error) {
        return true;
    }
};
exports.isTokenExpired = isTokenExpired;
const parseExpiry = (expiry) => {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match || !match[1] || !match[2]) {
        throw new Error(`Invalid expiry format: ${expiry}`);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };
    return value * multipliers[unit];
};
//# sourceMappingURL=jwt.js.map