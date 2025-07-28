import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from '../utils/jwt';
import { IUser } from '../models/User';
declare global {
    namespace Express {
        interface Request {
            user?: IUser;
            token?: string;
            payload?: JWTPayload;
        }
    }
}
export declare const authenticateToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const optionalAuth: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const requireRole: (allowedRoles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const requireEmailVerification: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireOwnership: (userIdParam?: string) => (req: Request, res: Response, next: NextFunction) => void;
export declare const requireAuth: (req: Request, res: Response, next: NextFunction) => void;
export declare const isUserAdmin: (user: IUser) => boolean;
export declare const requireUserOrAdmin: (userIdParam?: string) => (req: Request, res: Response, next: NextFunction) => void;
export declare const authErrorHandler: (error: Error, _req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map