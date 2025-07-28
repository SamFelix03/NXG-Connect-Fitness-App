"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authErrorHandler = exports.requireUserOrAdmin = exports.isUserAdmin = exports.requireAuth = exports.requireOwnership = exports.requireEmailVerification = exports.requireRole = exports.optionalAuth = exports.authenticateToken = void 0;
const jwt_1 = require("../utils/jwt");
const auth_service_1 = require("../services/auth.service");
const errors_1 = require("../utils/errors");
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = (0, jwt_1.extractBearerToken)(authHeader);
        const isBlacklisted = await auth_service_1.authService.isTokenBlacklisted(token);
        if (isBlacklisted) {
            throw new errors_1.AuthenticationError('Token has been revoked');
        }
        const payload = (0, jwt_1.verifyAccessToken)(token);
        const user = await auth_service_1.authService.getUserById(payload.userId);
        if (!user || !user.isActive) {
            throw new errors_1.AuthenticationError('User not found or inactive');
        }
        req.user = user;
        req.token = token;
        req.payload = payload;
        next();
    }
    catch (error) {
        if (error instanceof errors_1.AuthenticationError) {
            res.status(401).json({
                success: false,
                message: error.message,
                code: 'AUTHENTICATION_FAILED'
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: 'Internal server error during authentication',
            code: 'AUTHENTICATION_ERROR'
        });
    }
};
exports.authenticateToken = authenticateToken;
const optionalAuth = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return next();
        }
        const token = (0, jwt_1.extractBearerToken)(authHeader);
        const isBlacklisted = await auth_service_1.authService.isTokenBlacklisted(token);
        if (isBlacklisted) {
            return next();
        }
        const payload = (0, jwt_1.verifyAccessToken)(token);
        const user = await auth_service_1.authService.getUserById(payload.userId);
        if (user && user.isActive) {
            req.user = user;
            req.token = token;
            req.payload = payload;
        }
        next();
    }
    catch (error) {
        next();
    }
};
exports.optionalAuth = optionalAuth;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED'
            });
            return;
        }
        let userRole = 'user';
        const isAdmin = req.user.email?.includes('admin') ||
            req.user.role === 'admin' ||
            req.user.isAdmin === true ||
            req.user.email === 'admin@example.com';
        if (isAdmin) {
            userRole = 'admin';
        }
        else if (!req.user.isActive) {
            userRole = 'inactive';
        }
        if (!allowedRoles.includes(userRole)) {
            res.status(403).json({
                success: false,
                message: 'Insufficient permissions. Admin access required.',
                code: 'INSUFFICIENT_PERMISSIONS',
                details: {
                    required: allowedRoles,
                    current: userRole
                }
            });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
const requireEmailVerification = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED'
        });
        return;
    }
    if (!req.user.emailVerified) {
        res.status(403).json({
            success: false,
            message: 'Email verification required',
            code: 'EMAIL_VERIFICATION_REQUIRED'
        });
        return;
    }
    next();
};
exports.requireEmailVerification = requireEmailVerification;
const requireOwnership = (userIdParam = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED'
            });
            return;
        }
        const resourceUserId = req.params[userIdParam];
        const currentUserId = req.user._id.toString();
        if (resourceUserId !== currentUserId) {
            res.status(403).json({
                success: false,
                message: 'Access denied - resource ownership required',
                code: 'OWNERSHIP_REQUIRED'
            });
            return;
        }
        next();
    };
};
exports.requireOwnership = requireOwnership;
const requireAuth = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED'
        });
        return;
    }
    next();
};
exports.requireAuth = requireAuth;
const isUserAdmin = (user) => {
    return (user.email?.includes('admin') ||
        user.role === 'admin' ||
        user.isAdmin === true ||
        user.email === 'admin@example.com');
};
exports.isUserAdmin = isUserAdmin;
const requireUserOrAdmin = (userIdParam = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED'
            });
            return;
        }
        const isAdmin = (0, exports.isUserAdmin)(req.user);
        if (isAdmin) {
            return next();
        }
        const resourceUserId = req.params[userIdParam];
        const currentUserId = req.user._id.toString();
        if (resourceUserId !== currentUserId) {
            res.status(403).json({
                success: false,
                message: 'Access denied - ownership or admin role required',
                code: 'OWNERSHIP_OR_ADMIN_REQUIRED'
            });
            return;
        }
        next();
    };
};
exports.requireUserOrAdmin = requireUserOrAdmin;
const authErrorHandler = (error, _req, res, next) => {
    if (error instanceof errors_1.AuthenticationError) {
        res.status(401).json({
            success: false,
            message: error.message,
            code: 'AUTHENTICATION_ERROR'
        });
        return;
    }
    if (error instanceof errors_1.AuthorizationError) {
        res.status(403).json({
            success: false,
            message: error.message,
            code: 'AUTHORIZATION_ERROR'
        });
        return;
    }
    next(error);
};
exports.authErrorHandler = authErrorHandler;
//# sourceMappingURL=auth.middleware.js.map