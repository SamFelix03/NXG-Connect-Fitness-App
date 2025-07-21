import express, { Application } from 'express';
import { Server } from 'http';

// Import middleware
import securityMiddleware from './middleware/security.middleware';
import corsMiddleware from './middleware/cors.middleware';
import compressionMiddleware from './middleware/compression.middleware';
import loggingMiddleware, { correlationIdMiddleware } from './middleware/logging.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

// Import configuration
import { initializeSentry } from './config/sentry.config';
import { environmentValidator } from './config/environment';
import database from './utils/database';
import { redis } from './utils/redis';
import { logger } from './utils/logger';

// Import routes
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import activityRoutes from './routes/activity.routes';
import analyticsRoutes from './routes/analytics.routes';
import sessionsRoutes from './routes/sessions.routes';

// Import rate limiting middleware
import { generalRateLimit } from './middleware/rateLimit.middleware';

class App {
  public app: Application;
  public port: number;
  private server: Server | null = null;
  private isShuttingDown = false;

  constructor(port = 3000) {
    this.app = express();
    this.port = port;
    this.initializeSentry();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.setupGracefulShutdown();
  }

  private initializeSentry(): void {
    // Initialize Sentry before any other middleware
    initializeSentry();
  }

  private initializeMiddlewares(): void {
    // 1. Correlation ID middleware (must be first for logging)
    this.app.use(correlationIdMiddleware);
    
    // 2. Security middleware (Helmet.js)
    this.app.use(securityMiddleware);
    
    // 3. CORS middleware
    this.app.use(corsMiddleware);
    
    // 4. Compression middleware
    this.app.use(compressionMiddleware);
    
    // 5. General rate limiting (before auth-specific rate limits)
    this.app.use(generalRateLimit);
    
    // 6. HTTP request logging middleware
    this.app.use(loggingMiddleware);
    
    // 7. Body parsing middleware with size limits
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, _res, buf) => {
        // Store raw body for potential audit logging
        (req as any).rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb',
      verify: (req, _res, buf) => {
        // Store raw body for potential audit logging
        (req as any).rawBody = buf;
      }
    }));
    
  }

  private initializeRoutes(): void {
    // Basic API info route
    this.app.get('/', (_req, res) => {
      res.status(200).json({ 
        message: 'NXG Fitness Backend API',
        status: 'running',
        version: process.env['npm_package_version'] || '1.0.0',
        environment: process.env['NODE_ENV'] || 'development',
        timestamp: new Date().toISOString()
      });
    });

    // Mount health check routes
    this.app.use('/', healthRoutes);

    // Mount authentication routes
    this.app.use('/api/auth', authRoutes);

    // Mount user management routes
    this.app.use('/api/users', usersRoutes);

    // Mount activity tracking routes
    this.app.use('/api/activity', activityRoutes);

    // Mount analytics routes
    this.app.use('/api/analytics', analyticsRoutes);

    // Mount session management routes
    this.app.use('/api/sessions', sessionsRoutes);

    // API route prefix for future routes
    // this.app.use('/api/v1', apiRoutes); // Will be added in future stories
  }

  private initializeErrorHandling(): void {
    // 404 handler for unmatched routes (must be after all route definitions)
    this.app.use(notFoundHandler);
    
    // Global error handler (must be last middleware)
    this.app.use(errorHandler);
  }

  private setupGracefulShutdown(): void {
    // Handle graceful shutdown signals
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('SIGUSR2', this.gracefulShutdown.bind(this)); // nodemon restarts

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception', error, {
        service: 'express-app',
        event: 'uncaught-exception',
      });
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Promise Rejection', new Error(String(reason)), {
        service: 'express-app',
        event: 'unhandled-rejection',
        promise: promise.toString(),
      });
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });
  }

  private async gracefulShutdown(signal: string = 'SIGTERM'): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, forcing exit');
      process.exit(1);
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}. Starting graceful shutdown...`, {
      service: 'express-app',
      signal,
    });

    // Set a timeout for forceful shutdown
    const shutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit', undefined, {
        service: 'express-app',
        event: 'shutdown-timeout',
      });
      process.exit(1);
    }, 30000); // 30 seconds timeout

    try {
      // Stop accepting new connections
      if (this.server) {
        logger.info('Closing HTTP server...');
        await new Promise<void>((resolve, reject) => {
          this.server!.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
        logger.info('HTTP server closed');
      }

      // Close database connections
      logger.info('Closing database connections...');
      await database.disconnect();
      logger.info('Database connections closed');

      // Close Redis connections
      logger.info('Closing Redis connections...');
      await redis.disconnect();
      logger.info('Redis connections closed');

      // Close logger (flush any pending logs)
      logger.info('Closing logger...');
      await logger.close();

      clearTimeout(shutdownTimeout);
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      clearTimeout(shutdownTimeout);
      logger.error('Error during graceful shutdown', error as Error, {
        service: 'express-app',
        event: 'shutdown-error',
      });
      process.exit(1);
    }
  }

  public async start(): Promise<void> {
    try {
      // Validate environment configuration
      logger.info('Validating environment configuration...', {
        service: 'express-app',
        environment: process.env['NODE_ENV'] || 'development',
      });
      
      const envValidation = environmentValidator.validate();
      if (!envValidation.isValid) {
        throw new Error(`Environment validation failed: ${envValidation.errors.join(', ')}`);
      }
      
      logger.info('Environment configuration validated successfully');

      // Connect to database
      logger.info('Connecting to database...', {
        service: 'express-app',
        event: 'database-connection-start',
      });
      
      await database.connect();
      logger.info('Database connected successfully');

      // Connect to Redis
      logger.info('Connecting to Redis...', {
        service: 'express-app',
        event: 'redis-connection-start',
      });
      
      await redis.connect();
      logger.info('Redis connected successfully');

      // Start HTTP server
      logger.info('Starting HTTP server...', {
        service: 'express-app',
        port: this.port,
        environment: process.env['NODE_ENV'] || 'development',
      });

      await new Promise<void>((resolve, reject) => {
        this.server = this.app.listen(this.port, (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      logger.info('🚀 NXG Fitness Backend API started successfully', {
        service: 'express-app',
        port: this.port,
        environment: process.env['NODE_ENV'] || 'development',
        version: process.env['npm_package_version'] || '1.0.0',
        nodeVersion: process.version,
        uptime: process.uptime(),
        event: 'server-start-success',
      });

    } catch (error) {
      logger.error('Failed to start server', error as Error, {
        service: 'express-app',
        port: this.port,
        event: 'server-start-failure',
      });
      
      // Attempt graceful cleanup on startup failure
      await this.gracefulShutdown('STARTUP_FAILURE');
    }
  }

  // Legacy method for backward compatibility
  public listen(): void {
    this.start().catch((error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
  }

  public getServer(): Server | null {
    return this.server;
  }

  public isHealthy(): boolean {
    return !this.isShuttingDown && this.server !== null;
  }
}

// Only start the server if this file is run directly (not imported)
if (require.main === module) {
  const port = parseInt(process.env['PORT'] || '3000', 10);
  const app = new App(port);
  app.start();
}

export default App; 