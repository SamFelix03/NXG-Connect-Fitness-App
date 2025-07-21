import { sign, verify } from 'jsonwebtoken';
import {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  JWTPayload,
  RefreshTokenPayload,
  TokenPair
} from './jwt';

// Mock jsonwebtoken
jest.mock('jsonwebtoken');

const mockSign = sign as jest.MockedFunction<typeof sign>;
const mockVerify = verify as jest.MockedFunction<typeof verify>;

describe('JWT Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default environment variables for testing
    process.env['JWT_ACCESS_SECRET'] = 'test-access-secret';
    process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret';
    process.env['JWT_ACCESS_EXPIRY'] = '15m';
    process.env['JWT_REFRESH_EXPIRY'] = '7d';
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens with correct payloads', () => {
      const userPayload = {
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        isActive: true
      };
      const tokenId = 'token-id-123';

      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';

      mockSign
        .mockReturnValueOnce(mockAccessToken as any)
        .mockReturnValueOnce(mockRefreshToken as any);

      const result: TokenPair = generateTokenPair(userPayload, tokenId);

      // Verify access token generation
      expect(mockSign).toHaveBeenNthCalledWith(1, 
        expect.objectContaining({
          userId: 'user123',
          email: 'test@example.com',
          username: 'testuser',
          isActive: true,
          iss: 'nxg-fitness-api',
          aud: 'nxg-fitness-app'
        }),
        'test-access-secret',
        expect.objectContaining({
          expiresIn: '15m',
          algorithm: 'HS256',
          issuer: 'nxg-fitness-api',
          audience: 'nxg-fitness-app'
        })
      );

      // Verify refresh token generation
      expect(mockSign).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          userId: 'user123',
          tokenId: 'token-id-123',
          iss: 'nxg-fitness-api',
          aud: 'nxg-fitness-app'
        }),
        'test-refresh-secret',
        expect.objectContaining({
          expiresIn: '7d',
          algorithm: 'HS256',
          issuer: 'nxg-fitness-api',
          audience: 'nxg-fitness-app'
        })
      );

      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(result.accessTokenExpiresAt).toBeInstanceOf(Date);
      expect(result.refreshTokenExpiresAt).toBeInstanceOf(Date);
      
      // Verify expiration times
      const now = Date.now();
      const accessExpiry = result.accessTokenExpiresAt.getTime();
      const refreshExpiry = result.refreshTokenExpiresAt.getTime();
      
      expect(accessExpiry).toBeGreaterThan(now);
      expect(refreshExpiry).toBeGreaterThan(accessExpiry);
    });

    it('should use default values when environment variables are missing', () => {
      delete process.env['JWT_ACCESS_SECRET'];
      delete process.env['JWT_REFRESH_SECRET'];
      delete process.env['JWT_ACCESS_EXPIRY'];
      delete process.env['JWT_REFRESH_EXPIRY'];

      const userPayload = {
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        isActive: true
      };
      const tokenId = 'token-id-123';

      mockSign
        .mockReturnValueOnce('access-token' as any)
        .mockReturnValueOnce('refresh-token' as any);

      generateTokenPair(userPayload, tokenId);

      expect(mockSign).toHaveBeenNthCalledWith(1, 
        expect.any(Object),
        'your-access-token-secret',
        expect.objectContaining({ expiresIn: '15m' })
      );

      expect(mockSign).toHaveBeenNthCalledWith(2,
        expect.any(Object),
        'your-refresh-token-secret',
        expect.objectContaining({ expiresIn: '7d' })
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify and return valid access token payload', () => {
      const token = 'valid-access-token';
      const mockPayload: JWTPayload = {
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        isActive: true,
        iat: 1234567890,
        exp: 1234567890 + 900, // 15 minutes later
        iss: 'nxg-connect',
        aud: 'nxg-connect-app'
      };

      mockVerify.mockReturnValue(mockPayload as any);

      const result = verifyAccessToken(token);

      expect(mockVerify).toHaveBeenCalledWith(
        token,
        'test-access-secret',
        expect.objectContaining({
          algorithms: ['HS256'],
          issuer: 'nxg-fitness-api',
          audience: 'nxg-fitness-app'
        })
      );

      expect(result).toEqual(mockPayload);
    });

    it('should throw error for invalid access token', () => {
      const token = 'invalid-access-token';
      const error = new Error('Invalid token');

      mockVerify.mockImplementation(() => {
        throw error;
      });

      expect(() => verifyAccessToken(token)).toThrow('Token verification failed');
      expect(mockVerify).toHaveBeenCalledWith(
        token,
        'test-access-secret',
        expect.any(Object)
      );
    });

    it('should throw error for expired access token', () => {
      const token = 'expired-access-token';
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';

      mockVerify.mockImplementation(() => {
        throw error;
      });

      expect(() => verifyAccessToken(token)).toThrow('Access token has expired');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify and return valid refresh token payload', () => {
      const token = 'valid-refresh-token';
      const mockPayload: RefreshTokenPayload = {
        userId: 'user123',
        tokenId: 'token-id-123',
        iat: 1234567890,
        exp: 1234567890 + 604800, // 7 days later
        iss: 'nxg-connect',
        aud: 'nxg-connect-app'
      };

      mockVerify.mockReturnValue(mockPayload as any);

      const result = verifyRefreshToken(token);

      expect(mockVerify).toHaveBeenCalledWith(
        token,
        'test-refresh-secret',
        expect.objectContaining({
          algorithms: ['HS256'],
          issuer: 'nxg-fitness-api',
          audience: 'nxg-fitness-app'
        })
      );

      expect(result).toEqual(mockPayload);
    });

    it('should throw error for invalid refresh token', () => {
      const token = 'invalid-refresh-token';
      const error = new Error('Invalid refresh token');

      mockVerify.mockImplementation(() => {
        throw error;
      });

      expect(() => verifyRefreshToken(token)).toThrow('Refresh token verification failed');
      expect(mockVerify).toHaveBeenCalledWith(
        token,
        'test-refresh-secret',
        expect.any(Object)
      );
    });

    it('should throw error for expired refresh token', () => {
      const token = 'expired-refresh-token';
      const error = new Error('Refresh token expired');
      error.name = 'TokenExpiredError';

      mockVerify.mockImplementation(() => {
        throw error;
      });

      expect(() => verifyRefreshToken(token)).toThrow('Refresh token has expired');
    });

    it('should throw error for malformed refresh token', () => {
      const token = 'malformed-refresh-token';
      const error = new Error('Malformed token');
      error.name = 'JsonWebTokenError';

      mockVerify.mockImplementation(() => {
        throw error;
      });

      expect(() => verifyRefreshToken(token)).toThrow('Invalid refresh token');
    });
  });

  describe('Token expiration calculation', () => {
    it('should calculate correct expiration times for different durations', () => {
      process.env['JWT_ACCESS_EXPIRY'] = '30m';
      process.env['JWT_REFRESH_EXPIRY'] = '14d';

      const userPayload = {
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        isActive: true
      };

      mockSign
        .mockReturnValueOnce('access-token' as any)
        .mockReturnValueOnce('refresh-token' as any);

      const result = generateTokenPair(userPayload, 'token-id');

      // Access token should expire in approximately 30 minutes
      const accessExpiry = result.accessTokenExpiresAt.getTime();
      const now = Date.now();
      const expectedAccessExpiry = now + (30 * 60 * 1000); // 30 minutes
      
      expect(accessExpiry).toBeGreaterThan(now);
      expect(accessExpiry).toBeLessThan(expectedAccessExpiry + 5000); // Allow 5 second buffer

      // Refresh token should expire in approximately 14 days
      const refreshExpiry = result.refreshTokenExpiresAt.getTime();
      const expectedRefreshExpiry = now + (14 * 24 * 60 * 60 * 1000); // 14 days
      
      expect(refreshExpiry).toBeGreaterThan(accessExpiry);
      expect(refreshExpiry).toBeLessThan(expectedRefreshExpiry + 5000); // Allow 5 second buffer
    });
  });

  describe('Configuration handling', () => {
    it('should handle missing configuration gracefully', () => {
      // Remove all JWT environment variables
      delete process.env['JWT_ACCESS_SECRET'];
      delete process.env['JWT_REFRESH_SECRET'];
      delete process.env['JWT_ACCESS_EXPIRY'];
      delete process.env['JWT_REFRESH_EXPIRY'];

      mockSign
        .mockReturnValueOnce('access-token' as any)
        .mockReturnValueOnce('refresh-token' as any);

      const userPayload = {
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        isActive: true
      };

      expect(() => generateTokenPair(userPayload, 'token-id')).not.toThrow();
      expect(mockSign).toHaveBeenCalledTimes(2);
    });
  });
}); 