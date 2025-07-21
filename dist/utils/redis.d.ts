import { RedisClientType, RedisClusterType } from 'redis';
export declare enum RedisConnectionState {
    DISCONNECTED = "disconnected",
    CONNECTED = "connected",
    CONNECTING = "connecting",
    DISCONNECTING = "disconnecting",
    ERROR = "error"
}
export interface RedisHealthStatus {
    state: RedisConnectionState;
    uptime?: number;
    connectedClients?: number;
    lastError?: string;
    clusterInfo?: {
        clusterEnabled: boolean;
        clusterSize?: number;
        clusterState?: string;
    };
}
declare class RedisConnection {
    private static instance;
    private client;
    private config;
    private connectionState;
    private lastError;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private constructor();
    static getInstance(): RedisConnection;
    connect(): Promise<void>;
    private connectSingle;
    private connectCluster;
    private setupClientEventHandlers;
    private handleReconnection;
    disconnect(): Promise<void>;
    getClient(): RedisClientType | RedisClusterType;
    getConnectionState(): RedisConnectionState;
    ping(): Promise<string>;
    getHealthStatus(): Promise<RedisHealthStatus>;
    buildKey(prefix: 'auth' | 'cache' | 'session', key: string): string;
    private setupProcessHandlers;
}
export declare const redis: RedisConnection;
export default redis;
//# sourceMappingURL=redis.d.ts.map