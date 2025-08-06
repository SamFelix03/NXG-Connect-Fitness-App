import { Request, Response } from 'express';
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
declare class RedisStore {
    private prefix;
    private client;
    constructor(prefix?: string);
    incr(key: string): Promise<{
        totalHits: number;
        timeToExpire?: number;
    }>;
    expire(key: string, seconds: number): Promise<void>;
    get(key: string): Promise<number>;
    reset(key: string): Promise<void>;
}
export declare const generalRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const authRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const strictRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const nutritionRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const loginRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const registerRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const passwordResetRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const progressiveDelay: (req: Request, res: Response, next: Function) => Promise<void>;
export declare const emailRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const bypassRateLimit: (_req: Request, _res: Response, next: Function) => void;
export { RedisStore };
//# sourceMappingURL=rateLimit.middleware.d.ts.map