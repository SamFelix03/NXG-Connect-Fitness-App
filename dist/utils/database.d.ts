import { DatabaseConnectionState } from '../config/database.config';
export declare class Database {
    private config;
    private connectionState;
    private retryCount;
    private retryTimeoutId;
    constructor();
    private setupEventListeners;
    connect(): Promise<void>;
    private scheduleRetry;
    disconnect(): Promise<void>;
    getConnectionState(): DatabaseConnectionState;
    isConnected(): boolean;
    getHealthInfo(): {
        connected: boolean;
        state: string;
        readyState: number;
        host?: string;
        name?: string;
    };
    ping(): Promise<boolean>;
}
declare const database: Database;
export default database;
//# sourceMappingURL=database.d.ts.map