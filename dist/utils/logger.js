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
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const uuid_1 = require("uuid");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class Logger {
    static instance;
    logger;
    logDir;
    constructor() {
        this.logDir = process.env['LOG_FILE_PATH'] || './logs';
        this.ensureLogDirectory();
        this.logger = this.createLogger();
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }
    createLogger() {
        const logLevel = process.env['LOG_LEVEL'] || 'info';
        const logFileEnabled = process.env['LOG_FILE_ENABLED'] !== 'false';
        const nodeEnv = process.env['NODE_ENV'] || 'development';
        const structuredFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf((info) => {
            const entry = {
                timestamp: info.timestamp,
                level: info.level,
                message: info.message,
                context: {
                    service: 'nxg-fitness-backend',
                    version: process.env['npm_package_version'] || '1.0.0',
                    environment: nodeEnv,
                    ...info.context
                }
            };
            if (info.error && info.error instanceof Error) {
                entry.error = {
                    name: info.error.name,
                    message: info.error.message,
                    stack: info.error.stack
                };
            }
            return JSON.stringify(entry);
        }));
        const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
            format: 'HH:mm:ss'
        }), winston_1.default.format.colorize(), winston_1.default.format.printf((info) => {
            const correlationId = info.context?.correlationId ?
                `[${info.context.correlationId.substring(0, 8)}]` : '';
            let message = `${info.timestamp} ${correlationId} ${info.level}: ${info.message}`;
            if (info.context && Object.keys(info.context).length > 1) {
                const contextStr = JSON.stringify(info.context, null, 2);
                message += `\nContext: ${contextStr}`;
            }
            if (info.error && info.error instanceof Error) {
                message += `\nError: ${info.error.stack}`;
            }
            return message;
        }));
        const transports = [];
        transports.push(new winston_1.default.transports.Console({
            level: logLevel,
            format: nodeEnv === 'production' ? structuredFormat : consoleFormat,
            silent: nodeEnv === 'test'
        }));
        if (logFileEnabled) {
            transports.push(new winston_1.default.transports.File({
                filename: path.join(this.logDir, 'application.log'),
                level: logLevel,
                format: structuredFormat,
                maxsize: 10 * 1024 * 1024,
                maxFiles: 5,
                tailable: true
            }));
            transports.push(new winston_1.default.transports.File({
                filename: path.join(this.logDir, 'error.log'),
                level: 'error',
                format: structuredFormat,
                maxsize: 10 * 1024 * 1024,
                maxFiles: 5,
                tailable: true
            }));
            transports.push(new winston_1.default.transports.File({
                filename: path.join(this.logDir, 'access.log'),
                level: 'info',
                format: structuredFormat,
                maxsize: 50 * 1024 * 1024,
                maxFiles: 10,
                tailable: true
            }));
        }
        return winston_1.default.createLogger({
            level: logLevel,
            format: structuredFormat,
            transports,
            exitOnError: false,
            handleExceptions: true,
            handleRejections: true
        });
    }
    generateCorrelationId() {
        return (0, uuid_1.v4)();
    }
    info(message, context = {}) {
        this.logger.info(message, { context });
    }
    warn(message, context = {}) {
        this.logger.warn(message, { context });
    }
    error(message, error, context = {}) {
        this.logger.error(message, { error, context });
    }
    debug(message, context = {}) {
        this.logger.debug(message, { context });
    }
    http(message, context = {}) {
        this.logger.http(message, { context });
    }
    logRequest(req, res, responseTime) {
        const context = {
            correlationId: req.correlationId,
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            responseTime,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id
        };
        const message = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${responseTime}ms`;
        if (res.statusCode >= 400) {
            this.warn(message, context);
        }
        else {
            this.http(message, context);
        }
    }
    logDatabaseOperation(operation, collection, duration, context = {}) {
        this.debug(`Database ${operation} on ${collection}`, {
            ...context,
            operation,
            collection,
            duration
        });
    }
    logAuthEvent(event, userId, success = true, context = {}) {
        const message = `Authentication ${event}: ${success ? 'SUCCESS' : 'FAILED'}`;
        const logContext = {
            ...context,
            event,
            success
        };
        if (userId) {
            logContext.userId = userId;
        }
        if (success) {
            this.info(message, logContext);
        }
        else {
            this.warn(message, logContext);
        }
    }
    logBusinessLogic(operation, context = {}) {
        this.info(`Business operation: ${operation}`, {
            ...context,
            operation
        });
    }
    logExternalService(service, operation, duration, success, context = {}) {
        const message = `External service ${service} ${operation}: ${success ? 'SUCCESS' : 'FAILED'}`;
        const logContext = {
            ...context,
            service,
            operation,
            duration,
            success
        };
        if (success) {
            this.info(message, logContext);
        }
        else {
            this.error(message, undefined, logContext);
        }
    }
    logPerformance(operation, duration, context = {}) {
        const message = `Performance: ${operation} completed in ${duration}ms`;
        const logContext = {
            ...context,
            operation,
            duration
        };
        if (duration > 5000) {
            this.warn(message, logContext);
        }
        else {
            this.debug(message, logContext);
        }
    }
    logSecurityEvent(event, severity, context = {}) {
        const message = `Security event: ${event} [${severity.toUpperCase()}]`;
        const logContext = {
            ...context,
            event,
            severity,
            security: true
        };
        switch (severity) {
            case 'critical':
            case 'high':
                this.error(message, undefined, logContext);
                break;
            case 'medium':
                this.warn(message, logContext);
                break;
            case 'low':
            default:
                this.info(message, logContext);
                break;
        }
    }
    getWinstonLogger() {
        return this.logger;
    }
    setLogLevel(level) {
        this.logger.level = level;
        this.logger.transports.forEach(transport => {
            transport.level = level;
        });
    }
    async close() {
        return new Promise((resolve) => {
            this.logger.end(() => {
                resolve();
            });
        });
    }
}
exports.logger = Logger.getInstance();
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map