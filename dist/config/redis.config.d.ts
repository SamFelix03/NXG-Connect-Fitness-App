import { RedisClientOptions } from 'redis';
export interface RedisConfig {
    url: string;
    password: string | undefined;
    database: number;
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
    maxRetriesPerFailover: number;
    connectTimeout: number;
    commandTimeout: number;
    keyPrefixes: {
        auth: string;
        cache: string;
        session: string;
    };
    cluster?: {
        enabled: boolean;
        nodes?: string[];
    };
}
export interface RedisConnectionOptions extends RedisClientOptions {
    socket?: {
        host?: string;
        port?: number;
        connectTimeout?: number;
        commandTimeout?: number;
        reconnectStrategy?: (retries: number) => number | Error;
    };
    password?: string;
    database?: number;
}
declare class RedisConfiguration {
    private static instance;
    private constructor();
    static getInstance(): RedisConfiguration;
    getConfig(): RedisConfig;
    getConnectionOptions(): RedisConnectionOptions;
    private getRedisUrl;
    private getReconnectStrategy;
    validateEnvironment(): {
        isValid: boolean;
        missingVars: string[];
    };
}
export declare const redisConfig: RedisConfiguration;
export default redisConfig;
//# sourceMappingURL=redis.config.d.ts.map