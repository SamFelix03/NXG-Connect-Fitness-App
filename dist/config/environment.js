"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.environmentValidator = void 0;
const dotenv = __importStar(require("dotenv"));
const joi_1 = __importDefault(require("joi"));
dotenv.config();
const environmentSchema = joi_1.default.object({
    NODE_ENV: joi_1.default.string()
        .valid('development', 'test', 'production')
        .default('development'),
    PORT: joi_1.default.number()
        .integer()
        .min(1024)
        .max(65535)
        .default(3000),
    HOST: joi_1.default.string()
        .hostname()
        .default('localhost'),
    MONGODB_URI: joi_1.default.string()
        .uri({ scheme: ['mongodb', 'mongodb+srv'] })
        .required()
        .description('MongoDB connection URI'),
    MONGODB_DATABASE: joi_1.default.string()
        .min(1)
        .max(63)
        .pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/)
        .default('nxg_fitness'),
    MONGODB_MAX_POOL_SIZE: joi_1.default.number()
        .integer()
        .min(1)
        .max(100)
        .default(10),
    MONGODB_RETRY_ATTEMPTS: joi_1.default.number()
        .integer()
        .min(0)
        .max(10)
        .default(3),
    REDIS_URL: joi_1.default.string()
        .uri({ scheme: ['redis', 'rediss'] })
        .optional(),
    REDIS_HOST: joi_1.default.string()
        .hostname()
        .default('localhost'),
    REDIS_PORT: joi_1.default.number()
        .integer()
        .min(1024)
        .max(65535)
        .default(6379),
    REDIS_PASSWORD: joi_1.default.string()
        .optional(),
    REDIS_DATABASE: joi_1.default.number()
        .integer()
        .min(0)
        .max(15)
        .default(0),
    REDIS_CLUSTER_ENABLED: joi_1.default.boolean()
        .default(false),
    REDIS_CLUSTER_NODES: joi_1.default.array()
        .items(joi_1.default.string().pattern(/^[\w.-]+:\d+$/))
        .optional(),
    REDIS_MAX_RETRIES: joi_1.default.number()
        .integer()
        .min(0)
        .max(10)
        .default(3),
    REDIS_CONNECT_TIMEOUT: joi_1.default.number()
        .integer()
        .min(1000)
        .max(30000)
        .default(10000),
    REDIS_COMMAND_TIMEOUT: joi_1.default.number()
        .integer()
        .min(1000)
        .max(30000)
        .default(5000),
    JWT_SECRET: joi_1.default.string()
        .min(32)
        .when('NODE_ENV', {
        is: 'production',
        then: joi_1.default.required(),
        otherwise: joi_1.default.string().default('development-secret-key-change-in-production')
    }),
    JWT_EXPIRES_IN: joi_1.default.string()
        .pattern(/^\d+[smhd]$/)
        .default('1h'),
    JWT_REFRESH_SECRET: joi_1.default.string()
        .min(32)
        .when('NODE_ENV', {
        is: 'production',
        then: joi_1.default.required(),
        otherwise: joi_1.default.string().default('development-refresh-secret-key-change-in-production')
    }),
    JWT_REFRESH_EXPIRES_IN: joi_1.default.string()
        .pattern(/^\d+[smhd]$/)
        .default('7d'),
    BCRYPT_ROUNDS: joi_1.default.number()
        .integer()
        .min(8)
        .max(15)
        .default(12),
    CORS_ORIGIN: joi_1.default.array()
        .items(joi_1.default.string().uri())
        .optional(),
    RATE_LIMIT_WINDOW_MS: joi_1.default.number()
        .integer()
        .min(1000)
        .max(3600000)
        .default(900000),
    RATE_LIMIT_MAX_REQUESTS: joi_1.default.number()
        .integer()
        .min(1)
        .max(10000)
        .default(100),
    SENTRY_DSN: joi_1.default.string()
        .uri()
        .optional(),
    AWS_ACCESS_KEY_ID: joi_1.default.string()
        .when('NODE_ENV', {
        is: 'production',
        then: joi_1.default.optional(),
        otherwise: joi_1.default.optional()
    }),
    AWS_SECRET_ACCESS_KEY: joi_1.default.string()
        .when('NODE_ENV', {
        is: 'production',
        then: joi_1.default.optional(),
        otherwise: joi_1.default.optional()
    }),
    AWS_REGION: joi_1.default.string()
        .pattern(/^[a-z]{2}-[a-z]+-\d$/)
        .optional(),
    AWS_S3_BUCKET: joi_1.default.string()
        .pattern(/^[a-z0-9.-]{3,63}$/)
        .optional(),
    LOG_LEVEL: joi_1.default.string()
        .valid('error', 'warn', 'info', 'debug')
        .default('info'),
    LOG_FILE_ENABLED: joi_1.default.boolean()
        .default(true),
    LOG_FILE_PATH: joi_1.default.string()
        .default('./logs'),
    HEALTH_CHECK_ENABLED: joi_1.default.boolean()
        .default(true),
    HEALTH_CHECK_INTERVAL: joi_1.default.number()
        .integer()
        .min(1000)
        .max(300000)
        .default(30000)
}).unknown(false);
class EnvironmentValidator {
    static instance;
    config = null;
    validationErrors = [];
    constructor() { }
    static getInstance() {
        if (!EnvironmentValidator.instance) {
            EnvironmentValidator.instance = new EnvironmentValidator();
        }
        return EnvironmentValidator.instance;
    }
    validate() {
        try {
            const envVars = {
                NODE_ENV: process.env['NODE_ENV'],
                PORT: process.env['PORT'] ? parseInt(process.env['PORT'], 10) : undefined,
                HOST: process.env['HOST'],
                MONGODB_URI: process.env['MONGODB_URI'],
                MONGODB_DATABASE: process.env['MONGODB_DATABASE'],
                MONGODB_MAX_POOL_SIZE: process.env['MONGODB_MAX_POOL_SIZE'] ?
                    parseInt(process.env['MONGODB_MAX_POOL_SIZE'], 10) : undefined,
                MONGODB_RETRY_ATTEMPTS: process.env['MONGODB_RETRY_ATTEMPTS'] ?
                    parseInt(process.env['MONGODB_RETRY_ATTEMPTS'], 10) : undefined,
                REDIS_URL: process.env['REDIS_URL'],
                REDIS_HOST: process.env['REDIS_HOST'],
                REDIS_PORT: process.env['REDIS_PORT'] ? parseInt(process.env['REDIS_PORT'], 10) : undefined,
                REDIS_PASSWORD: process.env['REDIS_PASSWORD'],
                REDIS_DATABASE: process.env['REDIS_DATABASE'] ? parseInt(process.env['REDIS_DATABASE'], 10) : undefined,
                REDIS_CLUSTER_ENABLED: process.env['REDIS_CLUSTER_ENABLED'] === 'true',
                REDIS_CLUSTER_NODES: process.env['REDIS_CLUSTER_NODES'] ?
                    process.env['REDIS_CLUSTER_NODES'].split(',').map(node => node.trim()) : undefined,
                REDIS_MAX_RETRIES: process.env['REDIS_MAX_RETRIES'] ?
                    parseInt(process.env['REDIS_MAX_RETRIES'], 10) : undefined,
                REDIS_CONNECT_TIMEOUT: process.env['REDIS_CONNECT_TIMEOUT'] ?
                    parseInt(process.env['REDIS_CONNECT_TIMEOUT'], 10) : undefined,
                REDIS_COMMAND_TIMEOUT: process.env['REDIS_COMMAND_TIMEOUT'] ?
                    parseInt(process.env['REDIS_COMMAND_TIMEOUT'], 10) : undefined,
                JWT_SECRET: process.env['JWT_SECRET'],
                JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'],
                JWT_REFRESH_SECRET: process.env['JWT_REFRESH_SECRET'],
                JWT_REFRESH_EXPIRES_IN: process.env['JWT_REFRESH_EXPIRES_IN'],
                BCRYPT_ROUNDS: process.env['BCRYPT_ROUNDS'] ? parseInt(process.env['BCRYPT_ROUNDS'], 10) : undefined,
                CORS_ORIGIN: process.env['CORS_ORIGIN'] ?
                    process.env['CORS_ORIGIN'].split(',').map(origin => origin.trim()) :
                    ['http://localhost:3000', 'http://localhost:5173'],
                RATE_LIMIT_WINDOW_MS: process.env['RATE_LIMIT_WINDOW_MS'] ?
                    parseInt(process.env['RATE_LIMIT_WINDOW_MS'], 10) : undefined,
                RATE_LIMIT_MAX_REQUESTS: process.env['RATE_LIMIT_MAX_REQUESTS'] ?
                    parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'], 10) : undefined,
                SENTRY_DSN: process.env['SENTRY_DSN'],
                AWS_ACCESS_KEY_ID: process.env['AWS_ACCESS_KEY_ID'],
                AWS_SECRET_ACCESS_KEY: process.env['AWS_SECRET_ACCESS_KEY'],
                AWS_REGION: process.env['AWS_REGION'],
                AWS_S3_BUCKET: process.env['AWS_S3_BUCKET'],
                LOG_LEVEL: process.env['LOG_LEVEL'],
                LOG_FILE_ENABLED: process.env['LOG_FILE_ENABLED'] === 'true',
                LOG_FILE_PATH: process.env['LOG_FILE_PATH'],
                HEALTH_CHECK_ENABLED: process.env['HEALTH_CHECK_ENABLED'] !== 'false',
                HEALTH_CHECK_INTERVAL: process.env['HEALTH_CHECK_INTERVAL'] ?
                    parseInt(process.env['HEALTH_CHECK_INTERVAL'], 10) : undefined
            };
            const { error, value } = environmentSchema.validate(envVars, {
                abortEarly: false,
                allowUnknown: false,
                stripUnknown: false
            });
            if (error) {
                this.validationErrors = error.details.map(detail => `${detail.path.join('.')}: ${detail.message}`);
                return {
                    isValid: false,
                    errors: this.validationErrors
                };
            }
            this.config = value;
            this.validationErrors = [];
            return {
                isValid: true,
                config: this.config,
                errors: []
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
            this.validationErrors = [errorMessage];
            return {
                isValid: false,
                errors: this.validationErrors
            };
        }
    }
    getConfig() {
        if (!this.config) {
            const validation = this.validate();
            if (!validation.isValid) {
                throw new Error(`Environment validation failed: ${validation.errors.join(', ')}`);
            }
            this.config = validation.config;
        }
        return this.config;
    }
    getValidationErrors() {
        return [...this.validationErrors];
    }
    isProduction() {
        return this.getConfig().NODE_ENV === 'production';
    }
    isDevelopment() {
        return this.getConfig().NODE_ENV === 'development';
    }
    isTest() {
        return this.getConfig().NODE_ENV === 'test';
    }
    requiresAuth() {
        if (this.isProduction()) {
            const config = this.getConfig();
            return !!(config.JWT_SECRET && config.JWT_REFRESH_SECRET);
        }
        return true;
    }
    requiresExternalServices() {
        const config = this.getConfig();
        return !!(config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY);
    }
}
exports.environmentValidator = EnvironmentValidator.getInstance();
exports.default = exports.environmentValidator;
//# sourceMappingURL=environment.js.map