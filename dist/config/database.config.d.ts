/// <reference types="mongoose/types/aggregate" />
/// <reference types="mongoose/types/callback" />
/// <reference types="mongoose/types/collection" />
/// <reference types="mongoose/types/connection" />
/// <reference types="mongoose/types/cursor" />
/// <reference types="mongoose/types/document" />
/// <reference types="mongoose/types/error" />
/// <reference types="mongoose/types/expressions" />
/// <reference types="mongoose/types/helpers" />
/// <reference types="mongoose/types/middlewares" />
/// <reference types="mongoose/types/indexes" />
/// <reference types="mongoose/types/models" />
/// <reference types="mongoose/types/mongooseoptions" />
/// <reference types="mongoose/types/pipelinestage" />
/// <reference types="mongoose/types/populate" />
/// <reference types="mongoose/types/query" />
/// <reference types="mongoose/types/schemaoptions" />
/// <reference types="mongoose/types/schematypes" />
/// <reference types="mongoose/types/session" />
/// <reference types="mongoose/types/types" />
/// <reference types="mongoose/types/utility" />
/// <reference types="mongoose/types/validation" />
/// <reference types="mongoose/types/virtuals" />
/// <reference types="mongoose/types/inferschematype" />
import { ConnectOptions } from 'mongoose';
export interface DatabaseConfig {
    uri: string;
    options: ConnectOptions;
    retryOptions: RetryOptions;
}
export interface RetryOptions {
    maxRetries: number;
    initialRetryDelay: number;
    maxRetryDelay: number;
    retryDelayMultiplier: number;
}
export declare const getDatabaseConfig: () => DatabaseConfig;
export declare enum DatabaseConnectionState {
    DISCONNECTED = 0,
    CONNECTED = 1,
    CONNECTING = 2,
    DISCONNECTING = 3
}
export default getDatabaseConfig;
//# sourceMappingURL=database.config.d.ts.map