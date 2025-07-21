"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisStore = exports.bypassRateLimit = exports.emailRateLimit = exports.progressiveDelay = exports.passwordResetRateLimit = exports.registerRateLimit = exports.loginRateLimit = exports.authRateLimit = exports.generalRateLimit = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const redis_1 = require("../utils/redis");
class RedisStore {
    prefix;
    client;
    constructor(prefix = 'rate_limit:') {
        this.prefix = prefix;
        this.client = redis_1.redis.getClient();
    }
    async incr(key) {
        const fullKey = this.prefix + key;
        const multi = this.client.multi();
        multi.incr(fullKey);
        multi.ttl(fullKey);
        const results = await multi.exec();
        const totalHits = results[0];
        const ttl = results[1];
        const result = {
            totalHits
        };
        if (ttl > 0) {
            result.timeToExpire = ttl * 1000;
        }
        return result;
    }
    async expire(key, seconds) {
        const fullKey = this.prefix + key;
        await this.client.expire(fullKey, seconds);
    }
    async get(key) {
        const fullKey = this.prefix + key;
        const count = await this.client.get(fullKey);
        return count ? parseInt(count, 10) : 0;
    }
    async reset(key) {
        const fullKey = this.prefix + key;
        await this.client.del(fullKey);
    }
}
exports.RedisStore = RedisStore;
const rateLimitHandler = (req, res) => {
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
exports.generalRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skip: (_req) => {
        return false;
    }
});
exports.authRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again later',
        code: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skip: (_req) => {
        return false;
    }
});
exports.loginRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Too many login attempts, please try again later',
        code: 'LOGIN_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skipSuccessfulRequests: true
});
exports.registerRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: {
        success: false,
        message: 'Too many registration attempts, please try again later',
        code: 'REGISTER_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skipSuccessfulRequests: true
});
exports.passwordResetRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 3,
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
const progressiveDelay = async (req, res, next) => {
    try {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const key = `progressive_delay:${ip}`;
        const store = new RedisStore('delay:');
        const failureCount = await store.get(key);
        if (failureCount > 0) {
            const delay = Math.min(failureCount * 1000, 5000);
            console.log(`⏱️ Progressive delay: ${delay}ms for ${failureCount} previous failures`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        const originalJson = res.json.bind(res);
        res.json = function (data) {
            if (res.statusCode >= 400 && res.statusCode < 500) {
                store.incr(key).then(() => {
                    store.expire(key, 5 * 60);
                });
            }
            else if (res.statusCode >= 200 && res.statusCode < 300) {
                store.reset(key);
            }
            return originalJson(data);
        };
        next();
    }
    catch (error) {
        console.warn('⚠️ Progressive delay middleware error:', error instanceof Error ? error.message : 'Unknown error');
        next();
    }
};
exports.progressiveDelay = progressiveDelay;
exports.emailRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
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
const bypassRateLimit = (_req, _res, next) => {
    if (process.env['NODE_ENV'] === 'test' || process.env['BYPASS_RATE_LIMIT'] === 'true') {
        return next();
    }
    next();
};
exports.bypassRateLimit = bypassRateLimit;
//# sourceMappingURL=rateLimit.middleware.js.map