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
export interface RefreshTokenPayload {
    userId: string;
    tokenId: string;
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string;
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
    refreshTokenExpiresAt: Date;
}
export declare const generateAccessToken: (payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>) => string;
export declare const generateRefreshToken: (userId: string, tokenId: string) => string;
export declare const generateTokenPair: (userPayload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>, tokenId: string) => TokenPair;
export declare const verifyAccessToken: (token: string) => JWTPayload;
export declare const verifyRefreshToken: (token: string) => RefreshTokenPayload;
export declare const extractBearerToken: (authHeader?: string) => string;
export declare const getTokenExpirationTime: (token: string) => Date;
export declare const isTokenExpired: (token: string) => boolean;
//# sourceMappingURL=jwt.d.ts.map