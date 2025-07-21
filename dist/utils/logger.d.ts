import winston from 'winston';
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
declare class Logger {
    private static instance;
    private logger;
    private logDir;
    private constructor();
    static getInstance(): Logger;
    private ensureLogDirectory;
    private createLogger;
    generateCorrelationId(): string;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, error?: Error, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
    http(message: string, context?: LogContext): void;
    logRequest(req: any, res: any, responseTime: number): void;
    logDatabaseOperation(operation: string, collection: string, duration: number, context?: LogContext): void;
    logAuthEvent(event: string, userId?: string, success?: boolean, context?: LogContext): void;
    logBusinessLogic(operation: string, context?: LogContext): void;
    logExternalService(service: string, operation: string, duration: number, success: boolean, context?: LogContext): void;
    logPerformance(operation: string, duration: number, context?: LogContext): void;
    logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: LogContext): void;
    getWinstonLogger(): winston.Logger;
    setLogLevel(level: string): void;
    close(): Promise<void>;
}
export declare const logger: Logger;
export default logger;
//# sourceMappingURL=logger.d.ts.map