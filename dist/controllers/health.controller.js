"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const error_middleware_1 = require("../middleware/error.middleware");
const database_1 = __importDefault(require("../utils/database"));
const redis_1 = require("../utils/redis");
const logger_1 = require("../utils/logger");
class HealthController {
    checkHealth = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const startTime = Date.now();
        const timestamp = new Date().toISOString();
        const debugContext = {};
        if (req.correlationId) {
            debugContext.correlationId = req.correlationId;
        }
        const userAgent = req.get('User-Agent');
        if (userAgent) {
            debugContext.userAgent = userAgent;
        }
        if (req.ip) {
            debugContext.ipAddress = req.ip;
        }
        logger_1.logger.debug('Health check requested', debugContext);
        try {
            const [databaseHealth, redisHealth, memoryHealth] = await Promise.allSettled([
                this.checkDatabase(),
                this.checkRedis(),
                this.checkMemory(),
            ]);
            const services = {
                database: this.processServiceResult(databaseHealth),
                redis: this.processServiceResult(redisHealth),
                memory: this.processServiceResult(memoryHealth),
            };
            const serviceStatuses = Object.values(services);
            const summary = {
                total: serviceStatuses.length,
                healthy: serviceStatuses.filter(s => s.status === 'healthy').length,
                degraded: serviceStatuses.filter(s => s.status === 'degraded').length,
                unhealthy: serviceStatuses.filter(s => s.status === 'unhealthy').length,
            };
            let overallStatus = 'healthy';
            if (summary.unhealthy > 0) {
                overallStatus = 'unhealthy';
            }
            else if (summary.degraded > 0) {
                overallStatus = 'degraded';
            }
            const response = {
                status: overallStatus,
                timestamp,
                uptime: process.uptime(),
                version: process.env['npm_package_version'] || '1.0.0',
                environment: process.env['NODE_ENV'] || 'development',
                services,
                summary,
            };
            const totalTime = Date.now() - startTime;
            logger_1.logger.info('Health check completed', {
                ...(req.correlationId && { correlationId: req.correlationId }),
                status: overallStatus,
                responseTime: totalTime,
                summary,
            });
            let httpStatus = 200;
            if (overallStatus === 'degraded') {
                httpStatus = 200;
            }
            else if (overallStatus === 'unhealthy') {
                httpStatus = 503;
            }
            res.status(httpStatus).json(response);
        }
        catch (error) {
            logger_1.logger.error('Health check failed', error, {
                ...(req.correlationId && { correlationId: req.correlationId }),
                responseTime: Date.now() - startTime,
            });
            const errorResponse = {
                status: 'unhealthy',
                timestamp,
                uptime: process.uptime(),
                version: process.env['npm_package_version'] || '1.0.0',
                environment: process.env['NODE_ENV'] || 'development',
                services: {
                    database: { status: 'unhealthy', responseTime: 0, message: 'Check failed' },
                    redis: { status: 'unhealthy', responseTime: 0, message: 'Check failed' },
                    memory: { status: 'unhealthy', responseTime: 0, message: 'Check failed' },
                },
                summary: { total: 3, healthy: 0, degraded: 0, unhealthy: 3 },
            };
            res.status(503).json(errorResponse);
        }
    });
    async checkDatabase() {
        const startTime = Date.now();
        try {
            if (!database_1.default.isConnected()) {
                return {
                    status: 'unhealthy',
                    responseTime: Date.now() - startTime,
                    message: 'Database not connected',
                };
            }
            const pingResult = await database_1.default.ping();
            const responseTime = Date.now() - startTime;
            if (!pingResult) {
                return {
                    status: 'unhealthy',
                    responseTime,
                    message: 'Database ping failed',
                };
            }
            const healthInfo = database_1.default.getHealthInfo();
            let status = 'healthy';
            if (responseTime > 1000) {
                status = 'degraded';
            }
            else if (responseTime > 5000) {
                status = 'unhealthy';
            }
            return {
                status,
                responseTime,
                message: `Database ${healthInfo.state}`,
                details: {
                    state: healthInfo.state,
                    host: healthInfo.host,
                    name: healthInfo.name,
                },
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                message: `Database check failed: ${error.message}`,
            };
        }
    }
    async checkRedis() {
        const startTime = Date.now();
        try {
            const pingResult = await redis_1.redis.ping();
            const responseTime = Date.now() - startTime;
            if (!pingResult || pingResult !== 'PONG') {
                return {
                    status: 'unhealthy',
                    responseTime,
                    message: 'Redis ping failed',
                };
            }
            const healthStatus = await redis_1.redis.getHealthStatus();
            let status = 'healthy';
            if (responseTime > 500) {
                status = 'degraded';
            }
            else if (responseTime > 2000) {
                status = 'unhealthy';
            }
            return {
                status,
                responseTime,
                message: `Redis ${healthStatus.state}`,
                details: {
                    state: healthStatus.state,
                    uptime: healthStatus.uptime,
                    connectedClients: healthStatus.connectedClients,
                    lastError: healthStatus.lastError,
                    clusterInfo: healthStatus.clusterInfo,
                },
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                message: `Redis check failed: ${error.message}`,
            };
        }
    }
    async checkMemory() {
        const startTime = Date.now();
        try {
            const memoryUsage = process.memoryUsage();
            const responseTime = Date.now() - startTime;
            const usedHeapMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
            const totalHeapMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
            const externalMB = Math.round(memoryUsage.external / 1024 / 1024);
            const heapUsagePercent = (usedHeapMB / totalHeapMB) * 100;
            let status = 'healthy';
            let message = 'Memory usage normal';
            if (heapUsagePercent > 80) {
                status = 'degraded';
                message = 'High memory usage';
            }
            if (heapUsagePercent > 95) {
                status = 'unhealthy';
                message = 'Critical memory usage';
            }
            return {
                status,
                responseTime,
                message,
                details: {
                    heapUsed: `${usedHeapMB}MB`,
                    heapTotal: `${totalHeapMB}MB`,
                    external: `${externalMB}MB`,
                    heapUsagePercent: `${heapUsagePercent.toFixed(1)}%`,
                },
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                message: `Memory check failed: ${error.message}`,
            };
        }
    }
    processServiceResult(result) {
        if (result.status === 'fulfilled') {
            return result.value;
        }
        else {
            return {
                status: 'unhealthy',
                responseTime: 0,
                message: `Service check failed: ${result.reason}`,
            };
        }
    }
    liveness = (0, error_middleware_1.asyncHandler)(async (_req, res) => {
        res.status(200).json({
            status: 'alive',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    });
    readiness = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        try {
            const isDatabaseReady = database_1.default.isConnected();
            let isRedisReady = false;
            try {
                const pingResult = await redis_1.redis.ping();
                isRedisReady = pingResult === 'PONG';
            }
            catch {
                isRedisReady = false;
            }
            if (isDatabaseReady && isRedisReady) {
                res.status(200).json({
                    status: 'ready',
                    timestamp: new Date().toISOString(),
                    services: {
                        database: 'ready',
                        redis: 'ready',
                    },
                });
            }
            else {
                res.status(503).json({
                    status: 'not ready',
                    timestamp: new Date().toISOString(),
                    services: {
                        database: isDatabaseReady ? 'ready' : 'not ready',
                        redis: isRedisReady ? 'ready' : 'not ready',
                    },
                });
            }
        }
        catch (error) {
            const errorContext = {};
            if (req.correlationId) {
                errorContext.correlationId = req.correlationId;
            }
            logger_1.logger.error('Readiness check failed', error, errorContext);
            res.status(503).json({
                status: 'not ready',
                timestamp: new Date().toISOString(),
                error: 'Readiness check failed',
            });
        }
    });
}
exports.default = new HealthController();
//# sourceMappingURL=health.controller.js.map