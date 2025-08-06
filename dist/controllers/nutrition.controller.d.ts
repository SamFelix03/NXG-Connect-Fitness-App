/// <reference types="qs" />
import { Request, Response } from 'express';
export declare const getDailyNutrition: (req: Request, res: Response) => Promise<void>;
export declare const getDayMealPlan: (req: Request, res: Response) => Promise<void>;
export declare const getNutritionLibrary: (req: Request, res: Response) => Promise<void>;
export declare const getCurrentMacros: (req: Request, res: Response) => Promise<void>;
declare const _default: {
    getDailyNutrition: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<void>;
    getDayMealPlan: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<void>;
    getNutritionLibrary: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<void>;
    getCurrentMacros: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>) => Promise<void>;
};
export default _default;
//# sourceMappingURL=nutrition.controller.d.ts.map