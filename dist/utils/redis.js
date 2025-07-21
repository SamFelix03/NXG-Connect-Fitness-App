"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.RedisConnectionState = void 0;
const redis_1 = require("redis");
const redis_config_1 = require("../config/redis.config");
var RedisConnectionState;
(function (RedisConnectionState) {
    RedisConnectionState["DISCONNECTED"] = "disconnected";
    RedisConnectionState["CONNECTED"] = "connected";
    RedisConnectionState["CONNECTING"] = "connecting";
    RedisConnectionState["DISCONNECTING"] = "disconnecting";
    RedisConnectionState["ERROR"] = "error";
})(RedisConnectionState || (exports.RedisConnectionState = RedisConnectionState = {}));
class RedisConnection {
    static instance;
    client = null;
    config = null;
    connectionState = RedisConnectionState.DISCONNECTED;
    lastError = null;
    reconnectAttempts = 0;
    maxReconnectAttempts = 10;
    constructor() {
        this.setupProcessHandlers();
    }
    static getInstance() {
        if (!RedisConnection.instance) {
            RedisConnection.instance = new RedisConnection();
        }
        return RedisConnection.instance;
    }
    async connect() {
        if (this.connectionState === RedisConnectionState.CONNECTED) {
            return;
        }
        if (this.connectionState === RedisConnectionState.CONNECTING) {
            throw new Error('Redis connection already in progress');
        }
        this.connectionState = RedisConnectionState.CONNECTING;
        try {
            this.config = redis_config_1.redisConfig.getConfig();
            const validation = redis_config_1.redisConfig.validateEnvironment();
            if (!validation.isValid) {
                throw new Error(`Missing required Redis environment variables: ${validation.missingVars.join(', ')}`);
            }
            if (this.config.cluster?.enabled && this.config.cluster.nodes) {
                await this.connectCluster();
            }
            else {
                await this.connectSingle();
            }
            this.connectionState = RedisConnectionState.CONNECTED;
            this.lastError = null;
            this.reconnectAttempts = 0;
            console.log('✅ Redis connection established successfully');
        }
        catch (error) {
            this.connectionState = RedisConnectionState.ERROR;
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ Redis connection failed:', this.lastError);
            await this.handleReconnection();
            throw error;
        }
    }
    async connectSingle() {
        const options = redis_config_1.redisConfig.getConnectionOptions();
        this.client = (0, redis_1.createClient)(options);
        this.setupClientEventHandlers(this.client);
        await this.client.connect();
    }
    async connectCluster() {
        if (!this.config?.cluster?.nodes || this.config.cluster.nodes.length === 0) {
            throw new Error('Redis cluster nodes not configured');
        }
        const clusterOptions = {
            rootNodes: this.config.cluster.nodes.map(node => {
                const [host, port] = node.split(':');
                return {
                    socket: {
                        host: host || 'localhost',
                        port: parseInt(port || '6379', 10)
                    }
                };
            }),
            defaults: {
                socket: {
                    connectTimeout: this.config.connectTimeout,
                    commandTimeout: this.config.commandTimeout
                }
            }
        };
        if (this.config.password) {
            clusterOptions.defaults.password = this.config.password;
        }
        this.client = (0, redis_1.createCluster)(clusterOptions);
        this.setupClientEventHandlers(this.client);
        await this.client.connect();
    }
    setupClientEventHandlers(client) {
        client.on('error', (error) => {
            this.connectionState = RedisConnectionState.ERROR;
            this.lastError = error.message;
            console.error('Redis client error:', error.message);
        });
        client.on('connect', () => {
            console.log('Redis client connected');
        });
        client.on('ready', () => {
            this.connectionState = RedisConnectionState.CONNECTED;
            console.log('Redis client ready');
        });
        client.on('end', () => {
            this.connectionState = RedisConnectionState.DISCONNECTED;
            console.log('Redis client disconnected');
        });
        client.on('reconnecting', () => {
            this.connectionState = RedisConnectionState.CONNECTING;
            console.log('Redis client reconnecting...');
        });
    }
    async handleReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Attempting Redis reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        setTimeout(async () => {
            try {
                await this.connect();
            }
            catch (error) {
                console.error('Redis reconnection failed:', error);
            }
        }, delay);
    }
    async disconnect() {
        if (!this.client || this.connectionState === RedisConnectionState.DISCONNECTED) {
            return;
        }
        this.connectionState = RedisConnectionState.DISCONNECTING;
        try {
            await this.client.quit();
            this.connectionState = RedisConnectionState.DISCONNECTED;
            console.log('✅ Redis disconnected gracefully');
        }
        catch (error) {
            console.error('❌ Error during Redis disconnection:', error);
            this.connectionState = RedisConnectionState.ERROR;
            throw error;
        }
        finally {
            this.client = null;
        }
    }
    getClient() {
        if (!this.client || this.connectionState !== RedisConnectionState.CONNECTED) {
            throw new Error('Redis client not connected');
        }
        return this.client;
    }
    getConnectionState() {
        return this.connectionState;
    }
    async ping() {
        if (!this.client || this.connectionState !== RedisConnectionState.CONNECTED) {
            throw new Error('Redis client not connected');
        }
        try {
            if ('ping' in this.client) {
                const result = await this.client.ping();
                return result;
            }
            else {
                const result = await this.client.sendCommand(['PING']);
                return result;
            }
        }
        catch (error) {
            this.lastError = error instanceof Error ? error.message : 'Ping failed';
            throw error;
        }
    }
    async getHealthStatus() {
        const healthStatus = {
            state: this.connectionState
        };
        if (this.lastError) {
            healthStatus.lastError = this.lastError;
        }
        if (this.connectionState === RedisConnectionState.CONNECTED && this.client) {
            try {
                let info;
                if ('info' in this.client) {
                    info = await this.client.info();
                }
                else {
                    info = await this.client.sendCommand(['INFO']);
                }
                const infoLines = info.split('\r\n');
                const uptimeLine = infoLines.find((line) => line.startsWith('uptime_in_seconds:'));
                if (uptimeLine) {
                    const uptimeValue = uptimeLine.split(':')[1];
                    if (uptimeValue) {
                        healthStatus.uptime = parseInt(uptimeValue, 10);
                    }
                }
                const clientsLine = infoLines.find((line) => line.startsWith('connected_clients:'));
                if (clientsLine) {
                    const clientsValue = clientsLine.split(':')[1];
                    if (clientsValue) {
                        healthStatus.connectedClients = parseInt(clientsValue, 10);
                    }
                }
                if (this.config?.cluster?.enabled) {
                    healthStatus.clusterInfo = {
                        clusterEnabled: true
                    };
                    try {
                        const clusterInfo = await this.client.sendCommand(['CLUSTER', 'INFO']);
                        const clusterState = clusterInfo.split('\r\n').find((line) => line.startsWith('cluster_state:'))?.split(':')[1];
                        const clusterSizeLine = clusterInfo.split('\r\n').find((line) => line.startsWith('cluster_size:'))?.split(':')[1];
                        healthStatus.clusterInfo.clusterState = clusterState;
                        if (clusterSizeLine) {
                            healthStatus.clusterInfo.clusterSize = parseInt(clusterSizeLine, 10);
                        }
                    }
                    catch (clusterError) {
                        console.error('Error getting cluster info:', clusterError);
                    }
                }
                else {
                    healthStatus.clusterInfo = {
                        clusterEnabled: false
                    };
                }
            }
            catch (error) {
                console.error('Error getting Redis health status:', error);
                healthStatus.lastError = error instanceof Error ? error.message : 'Health check failed';
            }
        }
        return healthStatus;
    }
    buildKey(prefix, key) {
        if (!this.config) {
            this.config = redis_config_1.redisConfig.getConfig();
        }
        return `${this.config.keyPrefixes[prefix]}${key}`;
    }
    setupProcessHandlers() {
        const handleShutdown = async (signal) => {
            console.log(`Received ${signal}. Shutting down Redis connection gracefully...`);
            try {
                await this.disconnect();
                process.exit(0);
            }
            catch (error) {
                console.error('Error during Redis shutdown:', error);
                process.exit(1);
            }
        };
        process.on('SIGINT', () => handleShutdown('SIGINT'));
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    }
}
exports.redis = RedisConnection.getInstance();
exports.default = exports.redis;
//# sourceMappingURL=redis.js.map