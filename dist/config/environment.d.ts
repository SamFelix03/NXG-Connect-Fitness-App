export interface EnvironmentConfig {
    NODE_ENV: 'development' | 'test' | 'production';
    PORT: number;
    HOST: string;
    MONGODB_URI: string;
    MONGODB_DATABASE: string;
    MONGODB_MAX_POOL_SIZE: number;
    MONGODB_RETRY_ATTEMPTS: number;
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
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    JWT_REFRESH_SECRET: string;
    JWT_REFRESH_EXPIRES_IN: string;
    BCRYPT_ROUNDS: number;
    CORS_ORIGIN: string[];
    RATE_LIMIT_WINDOW_MS: number;
    RATE_LIMIT_MAX_REQUESTS: number;
    SENTRY_DSN?: string;
    AWS_ACCESS_KEY_ID?: string;
    AWS_SECRET_ACCESS_KEY?: string;
    AWS_REGION?: string;
    AWS_S3_BUCKET?: string;
    LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
    LOG_FILE_ENABLED: boolean;
    LOG_FILE_PATH: string;
    HEALTH_CHECK_ENABLED: boolean;
    HEALTH_CHECK_INTERVAL: number;
}
declare class EnvironmentValidator {
    private static instance;
    private config;
    private validationErrors;
    private constructor();
    static getInstance(): EnvironmentValidator;
    validate(): {
        isValid: boolean;
        config?: EnvironmentConfig;
        errors: string[];
    };
    getConfig(): EnvironmentConfig;
    getValidationErrors(): string[];
    isProduction(): boolean;
    isDevelopment(): boolean;
    isTest(): boolean;
    requiresAuth(): boolean;
    requiresExternalServices(): boolean;
}
export declare const environmentValidator: EnvironmentValidator;
export default environmentValidator;
//# sourceMappingURL=environment.d.ts.map