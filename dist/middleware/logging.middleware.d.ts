/// <reference types="qs" />
import { Request, Response } from 'express';
declare global {
    namespace Express {
        interface Request {
            correlationId?: string;
        }
    }
}
export declare const correlationIdMiddleware: (req: Request, res: Response, next: Function) => void;
declare const loggingMiddleware: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, callback: (err?: Error | undefined) => void) => void;
export default loggingMiddleware;
//# sourceMappingURL=logging.middleware.d.ts.map