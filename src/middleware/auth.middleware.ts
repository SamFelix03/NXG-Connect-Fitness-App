import { Request, Response, NextFunction } from 'express';
import { 
  extractBearerToken, 
  verifyAccessToken, 
  JWTPayload 
} from '../utils/jwt';
import { authService } from '../services/auth.service';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { IUser } from '../models/User';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      token?: string;
      payload?: JWTPayload;
    }
  }
}

/**
 * Authentication middleware that validates JWT tokens and adds user context to request
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractBearerToken(authHeader);

    // Check if token is blacklisted
    const isBlacklisted = await authService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new AuthenticationError('Token has been revoked');
    }

    // Verify and decode the token
    const payload = verifyAccessToken(token);

    // Get user data from database
    const user = await authService.getUserById(payload.userId);
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Add user context to request
    req.user = user;
    req.token = token;
    req.payload = payload;

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
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

/**
 * Optional authentication middleware - doesn't fail if token is missing but validates if present
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    // If no auth header, continue without authentication
    if (!authHeader) {
      return next();
    }

    // If auth header exists, validate it
    const token = extractBearerToken(authHeader);
    
    // Check if token is blacklisted
    const isBlacklisted = await authService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return next();
    }

    // Verify and decode the token
    const payload = verifyAccessToken(token);

    // Get user data from database
    const user = await authService.getUserById(payload.userId);
    if (user && user.isActive) {
      req.user = user;
      req.token = token;
      req.payload = payload;
    }

    next();
  } catch (error) {
    // For optional auth, continue without user context if token is invalid
    next();
  }
};

/**
 * Middleware to require specific user roles or permissions
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    // Determine user role based on user properties
    let userRole = 'user';
    
    // Check if user is admin (multiple ways to determine admin status)
    const isAdmin = 
      req.user.email?.includes('admin') || // Email contains 'admin'
      (req.user as any).role === 'admin' || // Direct role property
      (req.user as any).isAdmin === true ||  // Admin flag
      req.user.email === 'admin@example.com'; // Default admin email
    
    if (isAdmin) {
      userRole = 'admin';
    } else if (!req.user.isActive) {
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

/**
 * Middleware to require email verification
 */
export const requireEmailVerification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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

/**
 * Middleware to check if user owns the resource
 */
export const requireOwnership = (userIdParam = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
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

/**
 * Middleware to validate request contains authenticated user
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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

/**
 * Helper function to determine if user is admin
 */
export const isUserAdmin = (user: IUser): boolean => {
  return (
    user.email?.includes('admin') || // Email contains 'admin'
    (user as any).role === 'admin' || // Direct role property
    (user as any).isAdmin === true ||  // Admin flag
    user.email === 'admin@example.com' // Default admin email
  );
};

/**
 * Middleware to require either user ownership OR admin role
 */
export const requireUserOrAdmin = (userIdParam = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    // Check if user is admin OR owns the resource
    const isAdmin = isUserAdmin(req.user);
    if (isAdmin) {
      return next();
    }
    
    // Validate ownership
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

/**
 * Error handler for authentication-related errors
 */
export const authErrorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof AuthenticationError) {
    res.status(401).json({
      success: false,
      message: error.message,
      code: 'AUTHENTICATION_ERROR'
    });
    return;
  }

  if (error instanceof AuthorizationError) {
    res.status(403).json({
      success: false,
      message: error.message,
      code: 'AUTHORIZATION_ERROR'
    });
    return;
  }

  next(error);
}; 