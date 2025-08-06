/// <reference types="qs" />
import { Request, Response } from 'express';
export declare const createOrRefreshWorkoutPlan: (req: Request, res: Response) => Promise<void>;
export declare const deactivateWorkoutPlan: (req: Request, res: Response) => Promise<void>;
export declare const getWorkoutPlanStatus: (req: Request, res: Response) => Promise<void>;
export declare const createOrRefreshDietPlan: (req: Request, res: Response) => Promise<void>;
export declare const deactivateDietPlan: (req: Request, res: Response) => Promise<void>;
export declare const getDietPlanStatus: (req: Request, res: Response) => Promise<void>;
declare const _default: {
    createOrRefreshWorkoutPlan: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<void>;
    deactivateWorkoutPlan: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<void>;
    getWorkoutPlanStatus: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<void>;
    createOrRefreshDietPlan: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<void>;
    deactivateDietPlan: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<void>;
    getDietPlanStatus: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<void>;
};
export default _default;
//# sourceMappingURL=integrations.controller.d.ts.map