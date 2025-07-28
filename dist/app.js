"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const security_middleware_1 = __importDefault(require("./middleware/security.middleware"));
const cors_middleware_1 = __importDefault(require("./middleware/cors.middleware"));
const compression_middleware_1 = __importDefault(require("./middleware/compression.middleware"));
const logging_middleware_1 = __importStar(require("./middleware/logging.middleware"));
const error_middleware_1 = require("./middleware/error.middleware");
const sentry_config_1 = require("./config/sentry.config");
const environment_1 = require("./config/environment");
const database_1 = __importDefault(require("./utils/database"));
const redis_1 = require("./utils/redis");
const logger_1 = require("./utils/logger");
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const activity_routes_1 = __importDefault(require("./routes/activity.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const sessions_routes_1 = __importDefault(require("./routes/sessions.routes"));
const workouts_routes_1 = __importDefault(require("./routes/workouts.routes"));
const integrations_routes_1 = __importDefault(require("./routes/integrations.routes"));
const rateLimit_middleware_1 = require("./middleware/rateLimit.middleware");
require("./jobs/workout-plan-refresh.job");
class App {
    app;
    port;
    server = null;
    isShuttingDown = false;
    constructor(port = 3000) {
        this.app = (0, express_1.default)();
        this.port = port;
        this.initializeSentry();
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorHandling();
        this.setupGracefulShutdown();
    }
    initializeSentry() {
        (0, sentry_config_1.initializeSentry)();
    }
    initializeMiddlewares() {
        this.app.use(logging_middleware_1.correlationIdMiddleware);
        this.app.use(security_middleware_1.default);
        this.app.use(cors_middleware_1.default);
        this.app.use(compression_middleware_1.default);
        this.app.use(rateLimit_middleware_1.generalRateLimit);
        this.app.use(logging_middleware_1.default);
        this.app.use(express_1.default.json({
            limit: '10mb',
            verify: (req, _res, buf) => {
                req.rawBody = buf;
            }
        }));
        this.app.use(express_1.default.urlencoded({
            extended: true,
            limit: '10mb',
            verify: (req, _res, buf) => {
                req.rawBody = buf;
            }
        }));
    }
    initializeRoutes() {
        this.app.get('/', (_req, res) => {
            res.status(200).json({
                message: 'NXG Fitness Backend API',
                status: 'running',
                version: process.env['npm_package_version'] || '1.0.0',
                environment: process.env['NODE_ENV'] || 'development',
                timestamp: new Date().toISOString()
            });
        });
        this.app.use('/', health_routes_1.default);
        this.app.use('/api/auth', auth_routes_1.default);
        this.app.use('/api/users', users_routes_1.default);
        this.app.use('/api/activity', activity_routes_1.default);
        this.app.use('/api/analytics', analytics_routes_1.default);
        this.app.use('/api/sessions', sessions_routes_1.default);
        this.app.use('/api/workouts', workouts_routes_1.default);
        this.app.use('/api/integrations', integrations_routes_1.default);
    }
    initializeErrorHandling() {
        this.app.use(error_middleware_1.notFoundHandler);
        this.app.use(error_middleware_1.errorHandler);
    }
    setupGracefulShutdown() {
        process.on('SIGTERM', this.gracefulShutdown.bind(this));
        process.on('SIGINT', this.gracefulShutdown.bind(this));
        process.on('SIGUSR2', this.gracefulShutdown.bind(this));
        process.on('uncaughtException', (error) => {
            logger_1.logger.error('Uncaught Exception', error, {
                service: 'express-app',
                event: 'uncaught-exception',
            });
            this.gracefulShutdown('UNCAUGHT_EXCEPTION');
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.logger.error('Unhandled Promise Rejection', new Error(String(reason)), {
                service: 'express-app',
                event: 'unhandled-rejection',
                promise: promise.toString(),
            });
            this.gracefulShutdown('UNHANDLED_REJECTION');
        });
    }
    async gracefulShutdown(signal = 'SIGTERM') {
        if (this.isShuttingDown) {
            logger_1.logger.warn('Shutdown already in progress, forcing exit');
            process.exit(1);
        }
        this.isShuttingDown = true;
        logger_1.logger.info(`Received ${signal}. Starting graceful shutdown...`, {
            service: 'express-app',
            signal,
        });
        const shutdownTimeout = setTimeout(() => {
            logger_1.logger.error('Graceful shutdown timed out, forcing exit', undefined, {
                service: 'express-app',
                event: 'shutdown-timeout',
            });
            process.exit(1);
        }, 30000);
        try {
            if (this.server) {
                logger_1.logger.info('Closing HTTP server...');
                await new Promise((resolve, reject) => {
                    this.server.close((error) => {
                        if (error) {
                            reject(error);
                        }
                        else {
                            resolve();
                        }
                    });
                });
                logger_1.logger.info('HTTP server closed');
            }
            logger_1.logger.info('Closing database connections...');
            await database_1.default.disconnect();
            logger_1.logger.info('Database connections closed');
            logger_1.logger.info('Closing Redis connections...');
            await redis_1.redis.disconnect();
            logger_1.logger.info('Redis connections closed');
            logger_1.logger.info('Closing logger...');
            await logger_1.logger.close();
            clearTimeout(shutdownTimeout);
            logger_1.logger.info('Graceful shutdown completed');
            process.exit(0);
        }
        catch (error) {
            clearTimeout(shutdownTimeout);
            logger_1.logger.error('Error during graceful shutdown', error, {
                service: 'express-app',
                event: 'shutdown-error',
            });
            process.exit(1);
        }
    }
    async start() {
        try {
            logger_1.logger.info('Validating environment configuration...', {
                service: 'express-app',
                environment: process.env['NODE_ENV'] || 'development',
            });
            const envValidation = environment_1.environmentValidator.validate();
            if (!envValidation.isValid) {
                throw new Error(`Environment validation failed: ${envValidation.errors.join(', ')}`);
            }
            logger_1.logger.info('Environment configuration validated successfully');
            logger_1.logger.info('Connecting to database...', {
                service: 'express-app',
                event: 'database-connection-start',
            });
            await database_1.default.connect();
            logger_1.logger.info('Database connected successfully');
            logger_1.logger.info('Connecting to Redis...', {
                service: 'express-app',
                event: 'redis-connection-start',
            });
            await redis_1.redis.connect();
            logger_1.logger.info('Redis connected successfully');
            logger_1.logger.info('Starting HTTP server...', {
                service: 'express-app',
                port: this.port,
                environment: process.env['NODE_ENV'] || 'development',
            });
            await new Promise((resolve, reject) => {
                this.server = this.app.listen(this.port, (error) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve();
                    }
                });
            });
            logger_1.logger.info('🚀 NXG Fitness Backend API started successfully', {
                service: 'express-app',
                port: this.port,
                environment: process.env['NODE_ENV'] || 'development',
                version: process.env['npm_package_version'] || '1.0.0',
                nodeVersion: process.version,
                uptime: process.uptime(),
                event: 'server-start-success',
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to start server', error, {
                service: 'express-app',
                port: this.port,
                event: 'server-start-failure',
            });
            await this.gracefulShutdown('STARTUP_FAILURE');
        }
    }
    listen() {
        this.start().catch((error) => {
            console.error('Failed to start server:', error);
            process.exit(1);
        });
    }
    getServer() {
        return this.server;
    }
    isHealthy() {
        return !this.isShuttingDown && this.server !== null;
    }
}
if (require.main === module) {
    const port = parseInt(process.env['PORT'] || '3000', 10);
    const app = new App(port);
    app.start();
}
exports.default = App;
//# sourceMappingURL=app.js.map