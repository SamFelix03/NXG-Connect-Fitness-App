import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  service?: string;
  version?: string;
  environment?: string;
  [key: string]: any;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private static instance: Logger;
  private logger: winston.Logger;
  private logDir: string;

  private constructor() {
    this.logDir = process.env['LOG_FILE_PATH'] || './logs';
    this.ensureLogDirectory();
    this.logger = this.createLogger();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private createLogger(): winston.Logger {
    const logLevel = process.env['LOG_LEVEL'] || 'info';
    const logFileEnabled = process.env['LOG_FILE_ENABLED'] !== 'false';
    const nodeEnv = process.env['NODE_ENV'] || 'development';

    // Custom format for structured logging
    const structuredFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf((info: any) => {
        const entry: StructuredLogEntry = {
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
      })
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.colorize(),
      winston.format.printf((info: any) => {
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
      })
    );

    const transports: winston.transport[] = [];

    // Console transport
    transports.push(
      new winston.transports.Console({
        level: logLevel,
        format: nodeEnv === 'production' ? structuredFormat : consoleFormat,
        silent: nodeEnv === 'test'
      })
    );

    // File transports
    if (logFileEnabled) {
      // Application logs
      transports.push(
        new winston.transports.File({
          filename: path.join(this.logDir, 'application.log'),
          level: logLevel,
          format: structuredFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        })
      );

      // Error logs
      transports.push(
        new winston.transports.File({
          filename: path.join(this.logDir, 'error.log'),
          level: 'error',
          format: structuredFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        })
      );

      // Access logs for HTTP requests
      transports.push(
        new winston.transports.File({
          filename: path.join(this.logDir, 'access.log'),
          level: 'info',
          format: structuredFormat,
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 10,
          tailable: true
        })
      );
    }

    return winston.createLogger({
      level: logLevel,
      format: structuredFormat,
      transports,
      exitOnError: false,
      handleExceptions: true,
      handleRejections: true
    });
  }

  public generateCorrelationId(): string {
    return uuidv4();
  }

  public info(message: string, context: LogContext = {}): void {
    this.logger.info(message, { context });
  }

  public warn(message: string, context: LogContext = {}): void {
    this.logger.warn(message, { context });
  }

  public error(message: string, error?: Error, context: LogContext = {}): void {
    this.logger.error(message, { error, context });
  }

  public debug(message: string, context: LogContext = {}): void {
    this.logger.debug(message, { context });
  }

  public http(message: string, context: LogContext = {}): void {
    this.logger.http(message, { context });
  }

  // Specific logging methods for common scenarios
  public logRequest(req: any, res: any, responseTime: number): void {
    const context: LogContext = {
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
    } else {
      this.http(message, context);
    }
  }

  public logDatabaseOperation(operation: string, collection: string, duration: number, context: LogContext = {}): void {
    this.debug(`Database ${operation} on ${collection}`, {
      ...context,
      operation,
      collection,
      duration
    });
  }

  public logAuthEvent(event: string, userId?: string, success: boolean = true, context: LogContext = {}): void {
    const message = `Authentication ${event}: ${success ? 'SUCCESS' : 'FAILED'}`;
    const logContext: LogContext = {
      ...context,
      event,
      success
    };

    if (userId) {
      logContext.userId = userId;
    }

    if (success) {
      this.info(message, logContext);
    } else {
      this.warn(message, logContext);
    }
  }

  public logBusinessLogic(operation: string, context: LogContext = {}): void {
    this.info(`Business operation: ${operation}`, {
      ...context,
      operation
    });
  }

  public logExternalService(service: string, operation: string, duration: number, success: boolean, context: LogContext = {}): void {
    const message = `External service ${service} ${operation}: ${success ? 'SUCCESS' : 'FAILED'}`;
    const logContext: LogContext = {
      ...context,
      service,
      operation,
      duration,
      success
    };

    if (success) {
      this.info(message, logContext);
    } else {
      this.error(message, undefined, logContext);
    }
  }

  public logPerformance(operation: string, duration: number, context: LogContext = {}): void {
    const message = `Performance: ${operation} completed in ${duration}ms`;
    const logContext: LogContext = {
      ...context,
      operation,
      duration
    };

    if (duration > 5000) { // Slow operation threshold
      this.warn(message, logContext);
    } else {
      this.debug(message, logContext);
    }
  }

  public logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context: LogContext = {}): void {
    const message = `Security event: ${event} [${severity.toUpperCase()}]`;
    const logContext: LogContext = {
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

  // Get the underlying Winston logger instance
  public getWinstonLogger(): winston.Logger {
    return this.logger;
  }

  // Update log level dynamically
  public setLogLevel(level: string): void {
    this.logger.level = level;
    this.logger.transports.forEach(transport => {
      transport.level = level;
    });
  }

  // Graceful shutdown
  public async close(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.end(() => {
        resolve();
      });
    });
  }
}

export const logger = Logger.getInstance();
export default logger; 