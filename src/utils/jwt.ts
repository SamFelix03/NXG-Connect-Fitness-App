import { sign, verify, decode, Algorithm, SignOptions } from 'jsonwebtoken';
import { AuthenticationError } from './errors';

// JWT configuration interface
interface JWTConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  algorithm: Algorithm;
  issuer: string;
  audience: string;
}

// JWT payload interface
export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  isActive: boolean;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

// Refresh token payload interface
export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

// Token pair interface
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

// JWT configuration from environment variables
const getJWTConfig = (): JWTConfig => {
  const config = {
    accessTokenSecret: process.env['JWT_ACCESS_SECRET'] || 'your-access-token-secret',
    refreshTokenSecret: process.env['JWT_REFRESH_SECRET'] || 'your-refresh-token-secret',
    accessTokenExpiry: process.env['JWT_ACCESS_EXPIRY'] || '15m',
    refreshTokenExpiry: process.env['JWT_REFRESH_EXPIRY'] || '7d',
    algorithm: (process.env['JWT_ALGORITHM'] as Algorithm) || 'HS256',
    issuer: process.env['JWT_ISSUER'] || 'nxg-fitness-api',
    audience: process.env['JWT_AUDIENCE'] || 'nxg-fitness-app'
  };

  // Validate required secrets in production
  if (process.env['NODE_ENV'] === 'production') {
    if (!process.env['JWT_ACCESS_SECRET'] || !process.env['JWT_REFRESH_SECRET']) {
      throw new Error('JWT secrets must be configured in production environment');
    }
  }

  return config;
};

/**
 * Generate access token with user payload
 */
export const generateAccessToken = (payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>): string => {
  const config = getJWTConfig();
  
  const tokenPayload = {
    ...payload
    // Remove iss and aud from payload since they're set in options
  };

  const options: SignOptions = {
    expiresIn: config.accessTokenExpiry as any, // Cast to any to bypass TypeScript StringValue requirement
    algorithm: config.algorithm,
    issuer: config.issuer,
    audience: config.audience
  };

  return sign(tokenPayload, config.accessTokenSecret, options);
};

/**
 * Generate refresh token with token rotation support
 */
export const generateRefreshToken = (userId: string, tokenId: string): string => {
  const config = getJWTConfig();
  
  const tokenPayload = {
    userId,
    tokenId
    // Remove iss and aud from payload since they're set in options
  };

  const options: SignOptions = {
    expiresIn: config.refreshTokenExpiry as any, // Cast to any to bypass TypeScript StringValue requirement
    algorithm: config.algorithm,
    issuer: config.issuer,
    audience: config.audience
  };

  return sign(tokenPayload, config.refreshTokenSecret, options);
};

/**
 * Generate both access and refresh tokens
 */
export const generateTokenPair = (
  userPayload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>,
  tokenId: string
): TokenPair => {
  const config = getJWTConfig();
  
  const accessToken = generateAccessToken(userPayload);
  const refreshToken = generateRefreshToken(userPayload.userId, tokenId);
  
  // Calculate expiration times
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

/**
 * Verify and decode access token
 */
export const verifyAccessToken = (token: string): JWTPayload => {
  const config = getJWTConfig();
  
  try {
    const decoded = verify(token, config.accessTokenSecret, {
      algorithms: [config.algorithm],
      issuer: config.issuer,
      audience: config.audience
    }) as JWTPayload;
    
    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Access token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid access token');
    } else if (error.name === 'NotBeforeError') {
      throw new AuthenticationError('Access token not active yet');
    }
    
    throw new AuthenticationError('Token verification failed');
  }
};

/**
 * Verify and decode refresh token
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const config = getJWTConfig();
  
  try {
    const decoded = verify(token, config.refreshTokenSecret, {
      algorithms: [config.algorithm],
      issuer: config.issuer,
      audience: config.audience
    }) as RefreshTokenPayload;
    
    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Refresh token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid refresh token');
    } else if (error.name === 'NotBeforeError') {
      throw new AuthenticationError('Refresh token not active yet');
    }
    
    throw new AuthenticationError('Refresh token verification failed');
  }
};

/**
 * Extract token from Authorization header (Bearer token)
 */
export const extractBearerToken = (authHeader?: string): string => {
  if (!authHeader) {
    throw new AuthenticationError('Authorization header is required');
  }
  
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthenticationError('Invalid authorization header format. Expected "Bearer <token>"');
  }
  
  const token = parts[1];
  
  if (!token || token.trim() === '') {
    throw new AuthenticationError('Token is required');
  }
  
  return token;
};

/**
 * Get token expiration time
 */
export const getTokenExpirationTime = (token: string): Date => {
  try {
    const decoded = decode(token) as any;
    
    if (!decoded || !decoded.exp) {
      throw new Error('Invalid token format');
    }
    
    return new Date(decoded.exp * 1000);
  } catch (error) {
    throw new AuthenticationError('Unable to decode token expiration');
  }
};

/**
 * Check if token is expired (without verification)
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const expirationTime = getTokenExpirationTime(token);
    return expirationTime.getTime() < Date.now();
  } catch (error) {
    return true; // Treat invalid tokens as expired
  }
};

/**
 * Parse expiry string to milliseconds
 */
const parseExpiry = (expiry: string): number => {
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
  
  return value * multipliers[unit as keyof typeof multipliers];
}; 