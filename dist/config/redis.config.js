"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConfig = void 0;
class RedisConfiguration {
    static instance;
    constructor() { }
    static getInstance() {
        if (!RedisConfiguration.instance) {
            RedisConfiguration.instance = new RedisConfiguration();
        }
        return RedisConfiguration.instance;
    }
    getConfig() {
        const clusterNodes = process.env['REDIS_CLUSTER_NODES'];
        const config = {
            url: this.getRedisUrl(),
            password: process.env['REDIS_PASSWORD'],
            database: parseInt(process.env['REDIS_DATABASE'] || 'connectapp', 10),
            maxRetriesPerRequest: parseInt(process.env['REDIS_MAX_RETRIES'] || '3', 10),
            retryDelayOnFailover: parseInt(process.env['REDIS_RETRY_DELAY'] || '100', 10),
            maxRetriesPerFailover: parseInt(process.env['REDIS_MAX_RETRIES_FAILOVER'] || '3', 10),
            connectTimeout: parseInt(process.env['REDIS_CONNECT_TIMEOUT'] || '10000', 10),
            commandTimeout: parseInt(process.env['REDIS_COMMAND_TIMEOUT'] || '5000', 10),
            keyPrefixes: {
                auth: 'auth:',
                cache: 'cache:',
                session: 'session:'
            }
        };
        if (process.env['REDIS_CLUSTER_ENABLED'] === 'true') {
            config.cluster = {
                enabled: true,
                nodes: clusterNodes ? clusterNodes.split(',').map(node => node.trim()) : []
            };
        }
        else {
            config.cluster = {
                enabled: false
            };
        }
        return config;
    }
    getConnectionOptions() {
        const config = this.getConfig();
        const options = {
            socket: {
                host: process.env['REDIS_HOST'] || 'localhost',
                port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
                connectTimeout: config.connectTimeout,
                commandTimeout: config.commandTimeout,
                reconnectStrategy: this.getReconnectStrategy(config)
            },
            database: config.database
        };
        if (config.password) {
            options.password = config.password;
        }
        return options;
    }
    getRedisUrl() {
        if (process.env['REDIS_URL']) {
            return process.env['REDIS_URL'];
        }
        const host = process.env['REDIS_HOST'] || 'localhost';
        const port = process.env['REDIS_PORT'] || '6379';
        const password = process.env['REDIS_PASSWORD'];
        const database = process.env['REDIS_DATABASE'] || '0';
        const auth = password ? `:${password}@` : '';
        return `redis://${auth}${host}:${port}/${database}`;
    }
    getReconnectStrategy(config) {
        return (retries) => {
            if (retries >= config.maxRetriesPerFailover) {
                return new Error(`Max retries (${config.maxRetriesPerFailover}) exceeded`);
            }
            const baseDelay = config.retryDelayOnFailover;
            const exponentialDelay = baseDelay * Math.pow(2, retries);
            const jitter = Math.random() * 0.1 * exponentialDelay;
            return Math.min(exponentialDelay + jitter, 30000);
        };
    }
    validateEnvironment() {
        const requiredVars = [];
        const missingVars = [];
        if (process.env['NODE_ENV'] === 'production') {
            requiredVars.push('REDIS_URL', 'REDIS_PASSWORD');
        }
        if (process.env['REDIS_CLUSTER_ENABLED'] === 'true') {
            requiredVars.push('REDIS_CLUSTER_NODES');
        }
        for (const varName of requiredVars) {
            if (!process.env[varName]) {
                missingVars.push(varName);
            }
        }
        return {
            isValid: missingVars.length === 0,
            missingVars
        };
    }
}
exports.redisConfig = RedisConfiguration.getInstance();
exports.default = exports.redisConfig;
//# sourceMappingURL=redis.config.js.map