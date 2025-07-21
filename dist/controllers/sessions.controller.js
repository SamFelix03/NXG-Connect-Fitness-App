"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionHistory = exports.terminateSession = exports.updateSession = exports.createSession = void 0;
const UserSession_1 = require("../models/UserSession");
const validation_1 = require("../utils/validation");
const validation_2 = require("../utils/validation");
const logger_1 = __importDefault(require("../utils/logger"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const createSession = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            res.status(400).json({
                success: false,
                message: 'User ID is required',
                code: 'VALIDATION_ERROR'
            });
            return;
        }
        const validation = (0, validation_1.validateRequest)(req.body, validation_2.createSessionSchema);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const { deviceInfo, networkInfo, expirationHours = 24 } = validation.value;
        const sessionToken = jsonwebtoken_1.default.sign({ userId, sessionId: new Date().getTime() }, process.env['JWT_ACCESS_SECRET'] || 'default-secret', { expiresIn: `${expirationHours}h` });
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expirationHours);
        const activeSessionsCount = await UserSession_1.UserSession.countDocuments({
            userId,
            isActive: true,
            expiresAt: { $gt: new Date() }
        });
        if (activeSessionsCount >= 5) {
            const oldestSession = await UserSession_1.UserSession.findOne({
                userId,
                isActive: true,
                expiresAt: { $gt: new Date() }
            }).sort({ createdAt: 1 });
            if (oldestSession) {
                oldestSession.isActive = false;
                await oldestSession.save();
            }
        }
        const session = new UserSession_1.UserSession({
            userId,
            sessionToken,
            deviceInfo,
            networkInfo,
            expiresAt
        });
        await session.save();
        logger_1.default.info('Session created successfully', {
            userId: userId,
            sessionId: session._id.toString(),
            deviceType: deviceInfo.deviceType
        });
        res.status(201).json({
            success: true,
            message: 'Session created successfully',
            data: {
                sessionId: session._id,
                sessionToken,
                expiresAt: session.expiresAt,
                deviceInfo: session.deviceInfo
            }
        });
    }
    catch (error) {
        logger_1.default.error('Error creating session', error instanceof Error ? error : new Error('Unknown error'), { userId: req.params['userId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
};
exports.createSession = createSession;
const updateSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            res.status(400).json({
                success: false,
                message: 'Session ID is required',
                code: 'VALIDATION_ERROR'
            });
            return;
        }
        const validation = (0, validation_1.validateRequest)(req.body, validation_2.updateSessionSchema);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const { activityData } = validation.value;
        const session = await UserSession_1.UserSession.findById(sessionId);
        if (!session) {
            res.status(404).json({
                success: false,
                message: 'Session not found',
                code: 'SESSION_NOT_FOUND'
            });
            return;
        }
        if (!session.isActive || session.expiresAt < new Date()) {
            res.status(401).json({
                success: false,
                message: 'Session is expired or inactive',
                code: 'SESSION_EXPIRED'
            });
            return;
        }
        session.lastAccessed = new Date();
        if (activityData) {
            logger_1.default.info('Session activity updated', {
                sessionId: session._id.toString(),
                userId: session.userId.toString(),
                activityType: activityData.type
            });
        }
        await session.save();
        res.status(200).json({
            success: true,
            message: 'Session updated successfully',
            data: {
                sessionId: session._id.toString(),
                lastAccessed: session.lastAccessed,
                isActive: session.isActive
            }
        });
    }
    catch (error) {
        logger_1.default.error('Error updating session', error instanceof Error ? error : new Error('Unknown error'), { sessionId: req.params['sessionId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
};
exports.updateSession = updateSession;
const terminateSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            res.status(400).json({
                success: false,
                message: 'Session ID is required',
                code: 'VALIDATION_ERROR'
            });
            return;
        }
        const session = await UserSession_1.UserSession.findById(sessionId);
        if (!session) {
            res.status(404).json({
                success: false,
                message: 'Session not found',
                code: 'SESSION_NOT_FOUND'
            });
            return;
        }
        session.isActive = false;
        await session.save();
        logger_1.default.info('Session terminated successfully', {
            sessionId: session._id.toString(),
            userId: session.userId.toString()
        });
        res.status(200).json({
            success: true,
            message: 'Session terminated successfully',
            data: {
                sessionId: session._id.toString(),
                terminatedAt: new Date()
            }
        });
    }
    catch (error) {
        logger_1.default.error('Error terminating session', error instanceof Error ? error : new Error('Unknown error'), { sessionId: req.params['sessionId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
};
exports.terminateSession = terminateSession;
const getSessionHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            res.status(400).json({
                success: false,
                message: 'User ID is required',
                code: 'VALIDATION_ERROR'
            });
            return;
        }
        const validation = (0, validation_1.validateRequest)(req.query, validation_2.sessionHistorySchema);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const { page = 1, limit = 10, startDate, endDate, deviceType, isActive } = validation.value;
        const query = { userId };
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate)
                query.createdAt.$gte = new Date(startDate);
            if (endDate)
                query.createdAt.$lte = new Date(endDate);
        }
        if (deviceType) {
            query['deviceInfo.deviceType'] = new RegExp(deviceType, 'i');
        }
        if (isActive !== undefined) {
            query.isActive = isActive;
        }
        const sessions = await UserSession_1.UserSession.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        const totalCount = await UserSession_1.UserSession.countDocuments(query);
        const totalPages = Math.ceil(totalCount / limit);
        const totalSessions = await UserSession_1.UserSession.countDocuments({ userId });
        const activeSessions = await UserSession_1.UserSession.countDocuments({
            userId,
            isActive: true,
            expiresAt: { $gt: new Date() }
        });
        res.status(200).json({
            success: true,
            message: 'Session history retrieved successfully',
            data: {
                sessions,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                },
                statistics: {
                    totalSessions,
                    activeSessions,
                    inactiveSessions: totalSessions - activeSessions
                }
            }
        });
    }
    catch (error) {
        logger_1.default.error('Error retrieving session history', error instanceof Error ? error : new Error('Unknown error'), { userId: req.params['userId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
};
exports.getSessionHistory = getSessionHistory;
//# sourceMappingURL=sessions.controller.js.map