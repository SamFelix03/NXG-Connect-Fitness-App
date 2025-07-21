"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const database_config_1 = require("../config/database.config");
class Database {
    config;
    connectionState = database_config_1.DatabaseConnectionState.DISCONNECTED;
    retryCount = 0;
    retryTimeoutId = null;
    constructor() {
        this.config = (0, database_config_1.getDatabaseConfig)();
        this.setupEventListeners();
    }
    setupEventListeners() {
        mongoose_1.default.connection.on('connected', () => {
            this.connectionState = database_config_1.DatabaseConnectionState.CONNECTED;
            this.retryCount = 0;
            console.log(`✅ MongoDB connected to ${this.config.uri.replace(/\/\/.*@/, '//***:***@')}`);
        });
        mongoose_1.default.connection.on('error', (error) => {
            this.connectionState = database_config_1.DatabaseConnectionState.DISCONNECTED;
            console.error('❌ MongoDB connection error:', error.message);
        });
        mongoose_1.default.connection.on('disconnected', () => {
            this.connectionState = database_config_1.DatabaseConnectionState.DISCONNECTED;
            console.log('⚠️ MongoDB disconnected');
        });
        mongoose_1.default.connection.on('reconnected', () => {
            this.connectionState = database_config_1.DatabaseConnectionState.CONNECTED;
            console.log('🔄 MongoDB reconnected');
        });
        process.on('SIGINT', async () => {
            await this.disconnect();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            await this.disconnect();
            process.exit(0);
        });
    }
    async connect() {
        if (this.connectionState === database_config_1.DatabaseConnectionState.CONNECTED) {
            console.log('📡 Database already connected');
            return;
        }
        if (this.connectionState === database_config_1.DatabaseConnectionState.CONNECTING) {
            console.log('⏳ Database connection already in progress');
            return;
        }
        this.connectionState = database_config_1.DatabaseConnectionState.CONNECTING;
        try {
            console.log(`🔗 Connecting to MongoDB (attempt ${this.retryCount + 1}/${this.config.retryOptions.maxRetries + 1})...`);
            await mongoose_1.default.connect(this.config.uri, this.config.options);
            console.log('🎉 MongoDB connection established successfully');
        }
        catch (error) {
            this.connectionState = database_config_1.DatabaseConnectionState.DISCONNECTED;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ MongoDB connection failed: ${errorMessage}`);
            if (this.retryCount < this.config.retryOptions.maxRetries) {
                await this.scheduleRetry();
            }
            else {
                console.error(`💥 Maximum retry attempts (${this.config.retryOptions.maxRetries}) exceeded. Giving up.`);
                throw new Error(`Failed to connect to MongoDB after ${this.config.retryOptions.maxRetries + 1} attempts: ${errorMessage}`);
            }
        }
    }
    async scheduleRetry() {
        this.retryCount++;
        const delay = Math.min(this.config.retryOptions.initialRetryDelay * Math.pow(this.config.retryOptions.retryDelayMultiplier, this.retryCount - 1), this.config.retryOptions.maxRetryDelay);
        console.log(`🔄 Retrying connection in ${delay}ms (attempt ${this.retryCount}/${this.config.retryOptions.maxRetries})...`);
        return new Promise((resolve) => {
            this.retryTimeoutId = setTimeout(async () => {
                try {
                    await this.connect();
                    resolve();
                }
                catch (error) {
                    resolve();
                }
            }, delay);
        });
    }
    async disconnect() {
        if (this.retryTimeoutId) {
            clearTimeout(this.retryTimeoutId);
            this.retryTimeoutId = null;
        }
        if (this.connectionState === database_config_1.DatabaseConnectionState.DISCONNECTED) {
            console.log('📡 Database already disconnected');
            return;
        }
        this.connectionState = database_config_1.DatabaseConnectionState.DISCONNECTING;
        try {
            await mongoose_1.default.disconnect();
            this.connectionState = database_config_1.DatabaseConnectionState.DISCONNECTED;
            console.log('👋 MongoDB disconnected gracefully');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Error during MongoDB disconnection: ${errorMessage}`);
            throw error;
        }
    }
    getConnectionState() {
        return this.connectionState;
    }
    isConnected() {
        return this.connectionState === database_config_1.DatabaseConnectionState.CONNECTED && mongoose_1.default.connection.readyState === 1;
    }
    getHealthInfo() {
        return {
            connected: this.isConnected(),
            state: database_config_1.DatabaseConnectionState[this.connectionState],
            readyState: mongoose_1.default.connection.readyState,
            host: mongoose_1.default.connection.host,
            name: mongoose_1.default.connection.name,
        };
    }
    async ping() {
        try {
            if (!this.isConnected()) {
                return false;
            }
            const admin = mongoose_1.default.connection.db?.admin();
            if (admin) {
                await admin.ping();
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('❌ Database ping failed:', error);
            return false;
        }
    }
}
exports.Database = Database;
const database = new Database();
exports.default = database;
//# sourceMappingURL=database.js.map