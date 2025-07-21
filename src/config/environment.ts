import * as dotenv from 'dotenv';
import Joi from 'joi';

// Load environment variables
dotenv.config();

export interface EnvironmentConfig {
  // Server configuration
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  HOST: string;
  
  // Database configuration
  MONGODB_URI: string;
  MONGODB_DATABASE: string;
  MONGODB_MAX_POOL_SIZE: number;
  MONGODB_RETRY_ATTEMPTS: number;
  
  // Redis configuration
  REDIS_URL?: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_DATABASE: number;
  REDIS_CLUSTER_ENABLED: boolean;
  REDIS_CLUSTER_NODES?: string[];
  REDIS_MAX_RETRIES: number;
  REDIS_CONNECT_TIMEOUT: number;
  REDIS_COMMAND_TIMEOUT: number;
  
  // JWT configuration
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  
  // Security configuration
  BCRYPT_ROUNDS: number;
  CORS_ORIGIN: string[];
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  
  // External services
  SENTRY_DSN?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  AWS_S3_BUCKET?: string;
  
  // Logging configuration
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  LOG_FILE_ENABLED: boolean;
  LOG_FILE_PATH: string;
  
  // Health check configuration
  HEALTH_CHECK_ENABLED: boolean;
  HEALTH_CHECK_INTERVAL: number;
}

const environmentSchema = Joi.object<EnvironmentConfig>({
  // Server configuration - required
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number()
    .integer()
    .min(1024)
    .max(65535)
    .default(3000),
  HOST: Joi.string()
    .hostname()
    .default('localhost'),
  
  // Database configuration - required
  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required()
    .description('MongoDB connection URI'),
  MONGODB_DATABASE: Joi.string()
    .min(1)
    .max(63)
    .pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .default('nxg_fitness'),
  MONGODB_MAX_POOL_SIZE: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10),
  MONGODB_RETRY_ATTEMPTS: Joi.number()
    .integer()
    .min(0)
    .max(10)
    .default(3),
  
  // Redis configuration
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .optional(),
  REDIS_HOST: Joi.string()
    .hostname()
    .default('localhost'),
  REDIS_PORT: Joi.number()
    .integer()
    .min(1024)
    .max(65535)
    .default(6379),
  REDIS_PASSWORD: Joi.string()
    .optional(),
  REDIS_DATABASE: Joi.number()
    .integer()
    .min(0)
    .max(15)
    .default(0),
  REDIS_CLUSTER_ENABLED: Joi.boolean()
    .default(false),
  REDIS_CLUSTER_NODES: Joi.array()
    .items(Joi.string().pattern(/^[\w.-]+:\d+$/))
    .optional(),
  REDIS_MAX_RETRIES: Joi.number()
    .integer()
    .min(0)
    .max(10)
    .default(3),
  REDIS_CONNECT_TIMEOUT: Joi.number()
    .integer()
    .min(1000)
    .max(30000)
    .default(10000),
  REDIS_COMMAND_TIMEOUT: Joi.number()
    .integer()
    .min(1000)
    .max(30000)
    .default(5000),
  
  // JWT configuration - required in production
  JWT_SECRET: Joi.string()
    .min(32)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('development-secret-key-change-in-production')
    }),
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('1h'),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('development-refresh-secret-key-change-in-production')
    }),
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('7d'),
  
  // Security configuration
  BCRYPT_ROUNDS: Joi.number()
    .integer()
    .min(8)
    .max(15)
    .default(12),
  CORS_ORIGIN: Joi.array()
    .items(Joi.string().uri())
    .optional(),
  RATE_LIMIT_WINDOW_MS: Joi.number()
    .integer()
    .min(1000)
    .max(3600000)
    .default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number()
    .integer()
    .min(1)
    .max(10000)
    .default(100),
  
  // External services - optional
  SENTRY_DSN: Joi.string()
    .uri()
    .optional(),
  AWS_ACCESS_KEY_ID: Joi.string()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.optional(),
      otherwise: Joi.optional()
    }),
  AWS_SECRET_ACCESS_KEY: Joi.string()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.optional(),
      otherwise: Joi.optional()
    }),
  AWS_REGION: Joi.string()
    .pattern(/^[a-z]{2}-[a-z]+-\d$/)
    .optional(),
  AWS_S3_BUCKET: Joi.string()
    .pattern(/^[a-z0-9.-]{3,63}$/)
    .optional(),
  
  // Logging configuration
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  LOG_FILE_ENABLED: Joi.boolean()
    .default(true),
  LOG_FILE_PATH: Joi.string()
    .default('./logs'),
  
  // Health check configuration
  HEALTH_CHECK_ENABLED: Joi.boolean()
    .default(true),
  HEALTH_CHECK_INTERVAL: Joi.number()
    .integer()
    .min(1000)
    .max(300000)
    .default(30000) // 30 seconds
}).unknown(false);

class EnvironmentValidator {
  private static instance: EnvironmentValidator;
  private config: EnvironmentConfig | null = null;
  private validationErrors: string[] = [];

  private constructor() {}

  public static getInstance(): EnvironmentValidator {
    if (!EnvironmentValidator.instance) {
      EnvironmentValidator.instance = new EnvironmentValidator();
    }
    return EnvironmentValidator.instance;
  }

  public validate(): { isValid: boolean; config?: EnvironmentConfig; errors: string[] } {
    try {
      // Prepare environment variables for validation
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
          ['http://localhost:3000', 'http://localhost:5173'], // Default value
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
        this.validationErrors = error.details.map(detail => 
          `${detail.path.join('.')}: ${detail.message}`
        );
        return {
          isValid: false,
          errors: this.validationErrors
        };
      }

      this.config = value as EnvironmentConfig;
      this.validationErrors = [];

      return {
        isValid: true,
        config: this.config,
        errors: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      this.validationErrors = [errorMessage];
      
      return {
        isValid: false,
        errors: this.validationErrors
      };
    }
  }

  public getConfig(): EnvironmentConfig {
    if (!this.config) {
      const validation = this.validate();
      if (!validation.isValid) {
        throw new Error(`Environment validation failed: ${validation.errors.join(', ')}`);
      }
      this.config = validation.config!;
    }
    return this.config;
  }

  public getValidationErrors(): string[] {
    return [...this.validationErrors];
  }

  public isProduction(): boolean {
    return this.getConfig().NODE_ENV === 'production';
  }

  public isDevelopment(): boolean {
    return this.getConfig().NODE_ENV === 'development';
  }

  public isTest(): boolean {
    return this.getConfig().NODE_ENV === 'test';
  }

  public requiresAuth(): boolean {
    // In production, all auth configuration must be present
    if (this.isProduction()) {
      const config = this.getConfig();
      return !!(config.JWT_SECRET && config.JWT_REFRESH_SECRET);
    }
    return true;
  }

  public requiresExternalServices(): boolean {
    // Check if external services are configured
    const config = this.getConfig();
    return !!(config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY);
  }
}

export const environmentValidator = EnvironmentValidator.getInstance();
export default environmentValidator; 