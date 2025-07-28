/// <reference types="qs" />
import { Request, Response } from 'express';
export declare const getDailyWorkout: (req: Request, res: Response) => Promise<void>;
export declare const getWorkoutDay: (req: Request, res: Response) => Promise<void>;
export declare const getWorkoutLibrary: (req: Request, res: Response) => Promise<void>;
export declare const getWorkoutProgress: (req: Request, res: Response) => Promise<void>;
declare const _default: {
    getDailyWorkout: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<void>;
    getWorkoutDay: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<void>;
    getWorkoutLibrary: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<void>;
    getWorkoutProgress: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<void>;
};
export default _default;
//# sourceMappingURL=workouts.controller.d.ts.map