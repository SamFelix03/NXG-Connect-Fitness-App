import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import database from '../utils/database';
import { redis } from '../utils/redis';
import { logger } from '../utils/logger';
import { LogContext } from '../utils/logger';

// Health check response interface
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    memory: ServiceHealth;
    [key: string]: ServiceHealth;
  };
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  message?: string;
  details?: Record<string, any>;
}

class HealthController {
  // Main health check endpoint
  public checkHealth = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    const debugContext: LogContext = {};
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
    
    logger.debug('Health check requested', debugContext);

    try {
      // Check all services in parallel
      const [databaseHealth, redisHealth, memoryHealth] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkMemory(),
      ]);

      // Process results
      const services = {
        database: this.processServiceResult(databaseHealth),
        redis: this.processServiceResult(redisHealth),
        memory: this.processServiceResult(memoryHealth),
      };

      // Calculate summary
      const serviceStatuses = Object.values(services);
      const summary = {
        total: serviceStatuses.length,
        healthy: serviceStatuses.filter(s => s.status === 'healthy').length,
        degraded: serviceStatuses.filter(s => s.status === 'degraded').length,
        unhealthy: serviceStatuses.filter(s => s.status === 'unhealthy').length,
      };

      // Determine overall status
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (summary.unhealthy > 0) {
        overallStatus = 'unhealthy';
      } else if (summary.degraded > 0) {
        overallStatus = 'degraded';
      }

      const response: HealthCheckResponse = {
        status: overallStatus,
        timestamp,
        uptime: process.uptime(),
        version: process.env['npm_package_version'] || '1.0.0',
        environment: process.env['NODE_ENV'] || 'development',
        services,
        summary,
      };

      // Log health check result
      const totalTime = Date.now() - startTime;
      logger.info('Health check completed', {
        ...(req.correlationId && { correlationId: req.correlationId }),
        status: overallStatus,
        responseTime: totalTime,
        summary,
      });

      // Set appropriate HTTP status code
      let httpStatus = 200;
      if (overallStatus === 'degraded') {
        httpStatus = 200; // Still OK but with warnings
      } else if (overallStatus === 'unhealthy') {
        httpStatus = 503; // Service Unavailable
      }

      res.status(httpStatus).json(response);
    } catch (error) {
      logger.error('Health check failed', error as Error, {
        ...(req.correlationId && { correlationId: req.correlationId }),
        responseTime: Date.now() - startTime,
      });

      // Return unhealthy status on unexpected errors
      const errorResponse: HealthCheckResponse = {
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

  // Check database connectivity and performance
  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Check if database is connected
      if (!database.isConnected()) {
        return {
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          message: 'Database not connected',
        };
      }

      // Perform ping test
      const pingResult = await database.ping();
      const responseTime = Date.now() - startTime;

      if (!pingResult) {
        return {
          status: 'unhealthy',
          responseTime,
          message: 'Database ping failed',
        };
      }

      // Get health information
      const healthInfo = database.getHealthInfo();
      
      // Determine status based on response time
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (responseTime > 1000) {
        status = 'degraded'; // Slow response
      } else if (responseTime > 5000) {
        status = 'unhealthy'; // Very slow response
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
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Database check failed: ${(error as Error).message}`,
      };
    }
  }

  // Check Redis connectivity and performance
  private async checkRedis(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Check Redis connectivity
      const pingResult = await redis.ping();
      const responseTime = Date.now() - startTime;

      if (!pingResult || pingResult !== 'PONG') {
        return {
          status: 'unhealthy',
          responseTime,
          message: 'Redis ping failed',
        };
      }

      // Get health status
      const healthStatus = await redis.getHealthStatus();
      
      // Determine status based on response time
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (responseTime > 500) {
        status = 'degraded'; // Slow response
      } else if (responseTime > 2000) {
        status = 'unhealthy'; // Very slow response
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
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Redis check failed: ${(error as Error).message}`,
      };
    }
  }

  // Check memory usage
  private async checkMemory(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const responseTime = Date.now() - startTime;
      
      // Convert bytes to MB
      const usedHeapMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const totalHeapMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      const externalMB = Math.round(memoryUsage.external / 1024 / 1024);
      
      // Calculate heap usage percentage
      const heapUsagePercent = (usedHeapMB / totalHeapMB) * 100;
      
      // Determine status based on memory usage
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
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
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Memory check failed: ${(error as Error).message}`,
      };
    }
  }

  // Process Promise.allSettled results
  private processServiceResult(result: PromiseSettledResult<ServiceHealth>): ServiceHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'unhealthy',
        responseTime: 0,
        message: `Service check failed: ${result.reason}`,
      };
    }
  }

  // Liveness probe - simple endpoint for container orchestration
  public liveness = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Readiness probe - checks if service is ready to receive traffic
  public readiness = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      // Quick checks for essential services
      const isDatabaseReady = database.isConnected();
      let isRedisReady = false;
      
      try {
        const pingResult = await redis.ping();
        isRedisReady = pingResult === 'PONG';
      } catch {
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
      } else {
        res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          services: {
            database: isDatabaseReady ? 'ready' : 'not ready',
            redis: isRedisReady ? 'ready' : 'not ready',
          },
        });
      }
    } catch (error) {
      const errorContext: LogContext = {};
      if (req.correlationId) {
        errorContext.correlationId = req.correlationId;
      }
      
      logger.error('Readiness check failed', error as Error, errorContext);
      
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: 'Readiness check failed',
      });
    }
  });
}

export default new HealthController(); 