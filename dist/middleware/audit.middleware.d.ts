import { Request, Response, NextFunction } from 'express';
export declare const auditAuth: (event: string) => (req: Request, _res: Response, next: NextFunction) => void;
export declare const completeAudit: (req: Request, res: Response, next: NextFunction) => void;
export declare const auditSensitiveOperation: (operation: string, details?: Record<string, any>) => (req: Request, _res: Response, next: NextFunction) => void;
export declare const auditFailedAuth: (req: Request, reason: string, username?: string) => void;
export declare const auditSuccessfulAuth: (req: Request, userId: string, username: string, event: string) => void;
export declare const auditDataAccess: (req: Request, dataType: string, recordIds: string[]) => void;
declare global {
    namespace Express {
        interface Request {
            auditContext?: {
                event: string;
                correlationId: string;
                startTime: number;
                ipAddress: string;
                userAgent: string;
            };
        }
    }
}
//# sourceMappingURL=audit.middleware.d.ts.map