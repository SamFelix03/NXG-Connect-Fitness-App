import { Request, Response } from 'express';
import { UserSession } from '../models/UserSession';
import { validateRequest } from '../utils/validation';
import { 
  createSessionSchema,
  updateSessionSchema,
  sessionHistorySchema
} from '../utils/validation';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';

export const createSession = async (req: Request, res: Response): Promise<void> => {
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

    // Validate request body
    const validation = validateRequest(req.body, createSessionSchema);
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

    // Generate session token
    const sessionToken = jwt.sign(
      { userId, sessionId: new Date().getTime() },
      process.env['JWT_ACCESS_SECRET'] || 'default-secret',
      { expiresIn: `${expirationHours}h` }
    );

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expirationHours);

    // Check for concurrent session limit (max 5 active sessions per user)
    const activeSessionsCount = await UserSession.countDocuments({
      userId,
      isActive: true,
      expiresAt: { $gt: new Date() }
    });

    if (activeSessionsCount >= 5) {
      // Deactivate oldest session
      const oldestSession = await UserSession.findOne({
        userId,
        isActive: true,
        expiresAt: { $gt: new Date() }
      }).sort({ createdAt: 1 });

      if (oldestSession) {
        oldestSession.isActive = false;
        await oldestSession.save();
      }
    }

    // Create new session
    const session = new UserSession({
      userId,
      sessionToken,
      deviceInfo,
      networkInfo,
      expiresAt
    });

    await session.save();

    logger.info('Session created successfully', { 
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

  } catch (error) {
    logger.error('Error creating session', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

export const updateSession = async (req: Request, res: Response): Promise<void> => {
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

    // Validate request body
    const validation = validateRequest(req.body, updateSessionSchema);
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

    // Find and update session
    const session = await UserSession.findById(sessionId);
    
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

    // Update last accessed time
    session.lastAccessed = new Date();
    
    // Update activity data if provided
    if (activityData) {
      // Add any activity-specific updates here
      logger.info('Session activity updated', { 
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

  } catch (error) {
    logger.error('Error updating session', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { sessionId: req.params['sessionId'] || 'unknown' }
    );
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

export const terminateSession = async (req: Request, res: Response): Promise<void> => {
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

    // Find and deactivate session
    const session = await UserSession.findById(sessionId);
    
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

    logger.info('Session terminated successfully', { 
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

  } catch (error) {
    logger.error('Error terminating session', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { sessionId: req.params['sessionId'] || 'unknown' }
    );
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

export const getSessionHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get userId from params (admin route) or from JWT token (user route)
    const { userId: paramUserId } = req.params;
    const jwtUserId = (req as any).user?._id?.toString();
    const userId = paramUserId || jwtUserId;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Validate query parameters
    const validation = validateRequest(req.query, sessionHistorySchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const { 
      page = 1, 
      limit = 10, 
      startDate, 
      endDate, 
      deviceType,
      isActive 
    } = validation.value;

    // Build query filters
    const query: any = { userId };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (deviceType) {
      query['deviceInfo.deviceType'] = new RegExp(deviceType, 'i');
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    // Execute query with pagination
    const sessions = await UserSession.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalCount = await UserSession.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    // Calculate session statistics
    const totalSessions = await UserSession.countDocuments({ userId });
    const activeSessions = await UserSession.countDocuments({ 
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

  } catch (error) {
    logger.error('Error retrieving session history', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};