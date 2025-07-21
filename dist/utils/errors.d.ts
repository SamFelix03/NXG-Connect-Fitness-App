export declare abstract class BaseError extends Error {
    readonly statusCode: number;
    readonly isOperational: boolean;
    readonly timestamp: string;
    constructor(message: string, statusCode: number, isOperational?: boolean);
}
export declare class ValidationError extends BaseError {
    readonly validationErrors: Record<string, string> | undefined;
    constructor(message: string, validationErrors?: Record<string, string>);
}
export declare class AuthenticationError extends BaseError {
    constructor(message?: string);
}
export declare class AuthorizationError extends BaseError {
    constructor(message?: string);
}
export declare class NotFoundError extends BaseError {
    readonly resource: string | undefined;
    constructor(message?: string, resource?: string);
}
export declare class ConflictError extends BaseError {
    constructor(message?: string);
}
export declare class RateLimitError extends BaseError {
    readonly retryAfter: number | undefined;
    constructor(message?: string, retryAfter?: number);
}
export declare class InternalServerError extends BaseError {
    constructor(message?: string);
}
export declare class ServiceUnavailableError extends BaseError {
    readonly service: string | undefined;
    constructor(message?: string, service?: string);
}
export declare const isOperationalError: (error: Error) => error is BaseError;
export declare const shouldReportError: (error: Error) => boolean;
//# sourceMappingURL=errors.d.ts.map