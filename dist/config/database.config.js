"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConnectionState = exports.getDatabaseConfig = void 0;
const getDatabaseConfig = () => {
    const env = process.env['NODE_ENV'] || 'development';
    const getMongoUri = () => {
        switch (env) {
            case 'production':
                return process.env['MONGODB_URI'] || process.env['DATABASE_URL'] || '';
            case 'test':
                return process.env['MONGODB_TEST_URI'] || 'mongodb://localhost:27017/connect_app';
            case 'development':
            default:
                return process.env['MONGODB_DEV_URI'] || 'mongodb://localhost:27017/connect_app';
        }
    };
    const uri = getMongoUri();
    if (!uri) {
        throw new Error(`MongoDB URI is required for environment: ${env}. Please set MONGODB_URI environment variable.`);
    }
    const options = {
        minPoolSize: parseInt(process.env['DB_MIN_POOL_SIZE'] || '5', 10),
        maxPoolSize: parseInt(process.env['DB_MAX_POOL_SIZE'] || '10', 10),
        connectTimeoutMS: parseInt(process.env['DB_CONNECT_TIMEOUT'] || '10000', 10),
        socketTimeoutMS: parseInt(process.env['DB_SOCKET_TIMEOUT'] || '45000', 10),
        serverSelectionTimeoutMS: parseInt(process.env['DB_SERVER_SELECTION_TIMEOUT'] || '5000', 10),
        bufferCommands: process.env['DB_BUFFER_COMMANDS'] !== 'false',
        writeConcern: {
            w: 'majority',
            j: true,
            wtimeout: parseInt(process.env['DB_WRITE_TIMEOUT'] || '10000', 10)
        },
        readPreference: 'primary',
        family: 4,
        appName: `nxg-fitness-${env}`,
    };
    const retryOptions = {
        maxRetries: parseInt(process.env['DB_MAX_RETRIES'] || '5', 10),
        initialRetryDelay: parseInt(process.env['DB_INITIAL_RETRY_DELAY'] || '1000', 10),
        maxRetryDelay: parseInt(process.env['DB_MAX_RETRY_DELAY'] || '30000', 10),
        retryDelayMultiplier: parseFloat(process.env['DB_RETRY_DELAY_MULTIPLIER'] || '2'),
    };
    return {
        uri,
        options,
        retryOptions,
    };
};
exports.getDatabaseConfig = getDatabaseConfig;
var DatabaseConnectionState;
(function (DatabaseConnectionState) {
    DatabaseConnectionState[DatabaseConnectionState["DISCONNECTED"] = 0] = "DISCONNECTED";
    DatabaseConnectionState[DatabaseConnectionState["CONNECTED"] = 1] = "CONNECTED";
    DatabaseConnectionState[DatabaseConnectionState["CONNECTING"] = 2] = "CONNECTING";
    DatabaseConnectionState[DatabaseConnectionState["DISCONNECTING"] = 3] = "DISCONNECTING";
})(DatabaseConnectionState || (exports.DatabaseConnectionState = DatabaseConnectionState = {}));
exports.default = exports.getDatabaseConfig;
//# sourceMappingURL=database.config.js.map