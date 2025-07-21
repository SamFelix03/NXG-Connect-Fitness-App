import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { redis } from '../utils/redis';

// Extend Express Request interface to include rate limit info
declare global {
  namespace Express {
    interface Request {
      rateLimit?: {
        limit: number;
        remaining: number;
        resetTime: number;
      };
    }
  }
}

/**
 * Custom Redis store for rate limiting
 */
class RedisStore {
  private prefix: string;
  private client: any;

  constructor(prefix = 'rate_limit:') {
    this.prefix = prefix;
    this.client = redis.getClient();
  }

  /**
   * Increment the counter for a key
   */
  async incr(key: string): Promise<{ totalHits: number; timeToExpire?: number }> {
    const fullKey = this.prefix + key;
    
    const multi = this.client.multi();
    multi.incr(fullKey);
    multi.ttl(fullKey);
    
    const results = await multi.exec();
    const totalHits = results[0] as number;
    const ttl = results[1] as number;
    
    const result: { totalHits: number; timeToExpire?: number } = {
      totalHits
    };

    if (ttl > 0) {
      result.timeToExpire = ttl * 1000;
    }
    
    return result;
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<void> {
    const fullKey = this.prefix + key;
    await this.client.expire(fullKey, seconds);
  }

  /**
   * Get current count for a key
   */
  async get(key: string): Promise<number> {
    const fullKey = this.prefix + key;
    const count = await this.client.get(fullKey);
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Reset counter for a key
   */
  async reset(key: string): Promise<void> {
    const fullKey = this.prefix + key;
    await this.client.del(fullKey);
  }
}

/**
 * Custom error handler for rate limit
 */
const rateLimitHandler = (req: Request, res: Response): void => {
  const retryAfter = req.rateLimit?.resetTime ? Math.round(req.rateLimit.resetTime) : Math.round(Date.now() + 60000);
  
  res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter,
    limit: req.rateLimit?.limit,
    remaining: req.rateLimit?.remaining,
    resetTime: req.rateLimit?.resetTime
  });
};

/**
 * General rate limiting middleware (100 requests per 15 minutes)
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: rateLimitHandler,
  // Remove custom keyGenerator to use default IP handling
  skip: (_req: Request) => {
    // Skip rate limiting for successful requests (2xx status codes)
    return false;
  }
});

/**
 * Strict rate limiting for authentication endpoints (5 attempts per 15 minutes)
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (_req: Request) => {
    // Skip rate limiting for successful requests (2xx status codes)
    return false;
  }
});

/**
 * Rate limiting for login attempts (5 attempts per 15 minutes per IP)
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again later',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true // Don't count successful logins against the limit
});

/**
 * Rate limiting for registration attempts (3 attempts per hour per IP)
 */
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registration attempts per hour
  message: {
    success: false,
    message: 'Too many registration attempts, please try again later',
    code: 'REGISTER_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true // Don't count successful registrations against the limit
});

/**
 * Rate limiting for password reset requests (3 attempts per hour per IP)
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later',
    code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true
});

/**
 * Progressive delay middleware for repeated failed attempts
 */
export const progressiveDelay = async (
  req: Request,
  res: Response,
  next: Function
): Promise<void> => {
  try {
    // Use simple IP-based key without custom generateKey function
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `progressive_delay:${ip}`;
    const store = new RedisStore('delay:');
    
    const failureCount = await store.get(key);
    
    if (failureCount > 0) {
      // Calculate delay: More conservative delays
      const delay = Math.min(failureCount * 1000, 5000); // Max 5 seconds, linear not exponential
      
      console.log(`⏱️ Progressive delay: ${delay}ms for ${failureCount} previous failures`);
      
      // Add delay before processing request
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      // Only increment on 4xx errors (client errors), not 5xx (server errors)
      if (res.statusCode >= 400 && res.statusCode < 500) {
        store.incr(key).then(() => {
          store.expire(key, 5 * 60); // Expire in 5 minutes (shorter window)
        });
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        // Reset counter on successful response
        store.reset(key);
      }
      
      return originalJson(data);
    };
    
    next();
  } catch (error) {
    console.warn('⚠️ Progressive delay middleware error:', error instanceof Error ? error.message : 'Unknown error');
    // Don't fail the request if delay tracking fails
    next();
  }
};

/**
 * Email-based rate limiting for password reset and email verification
 */
export const emailRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 attempts per hour
  message: {
    success: false,
    message: 'Too many requests for this email, please try again later',
    code: 'EMAIL_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true
});

/**
 * Bypass rate limiting for testing/development
 */
export const bypassRateLimit = (_req: Request, _res: Response, next: Function): void => {
  if (process.env['NODE_ENV'] === 'test' || process.env['BYPASS_RATE_LIMIT'] === 'true') {
    return next();
  }
  next();
};

export { RedisStore }; 