import { IUser } from '../models/User';
import { TokenPair } from '../utils/jwt';
export interface RegisterData {
    username: string;
    email: string;
    password: string;
    name: string;
    demographics?: any;
    fitnessProfile?: any;
}
export interface LoginData {
    email: string;
    password: string;
}
export interface ForgotPasswordData {
    email: string;
}
export interface ResetPasswordData {
    token: string;
    password: string;
}
export interface UpdateProfileData {
    name?: string;
    demographics?: any;
    fitnessProfile?: any;
}
export interface ChangePasswordData {
    currentPassword: string;
    newPassword: string;
}
export interface UserSession {
    sessionId: string;
    userId: string;
    tokenId: string;
    createdAt: Date;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
}
export interface AuthResponse {
    user: Partial<IUser>;
    tokens: TokenPair;
}
export interface RefreshResponse {
    tokens: TokenPair;
}
export declare class AuthService {
    private static readonly BCRYPT_SALT_ROUNDS;
    private static readonly REFRESH_TOKEN_PREFIX;
    private static readonly BLACKLIST_PREFIX;
    private static readonly RESET_TOKEN_PREFIX;
    private static readonly RESET_TOKEN_EXPIRY;
    register(data: RegisterData): Promise<AuthResponse>;
    login(data: LoginData): Promise<AuthResponse>;
    refreshToken(refreshToken: string): Promise<RefreshResponse>;
    logout(userId: string, accessToken: string, refreshToken?: string): Promise<void>;
    forgotPassword(data: ForgotPasswordData): Promise<string>;
    resetPassword(data: ResetPasswordData): Promise<void>;
    private storeRefreshToken;
    private blacklistToken;
    isTokenBlacklisted(token: string): Promise<boolean>;
    private invalidateAllUserSessions;
    getUserById(userId: string): Promise<IUser | null>;
    updateProfile(userId: string, data: UpdateProfileData): Promise<Partial<IUser>>;
    verifyEmail(token: string): Promise<void>;
    resendVerification(userId: string): Promise<string>;
    changePassword(userId: string, data: ChangePasswordData): Promise<void>;
    getSessions(userId: string): Promise<UserSession[]>;
    revokeSession(userId: string, sessionId: string): Promise<void>;
    private static readonly EMAIL_VERIFICATION_PREFIX;
}
export declare const authService: AuthService;
//# sourceMappingURL=auth.service.d.ts.map