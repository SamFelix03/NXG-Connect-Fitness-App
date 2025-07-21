/// <reference types="qs" />
import { Request, Response } from 'express';
declare class HealthController {
    checkHealth: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, next: import("express").NextFunction) => void;
    private checkDatabase;
    private checkRedis;
    private checkMemory;
    private processServiceResult;
    liveness: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, next: import("express").NextFunction) => void;
    readiness: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, next: import("express").NextFunction) => void;
}
declare const _default: HealthController;
export default _default;
//# sourceMappingURL=health.controller.d.ts.map