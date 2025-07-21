import { Request, Response, NextFunction } from 'express';
export declare const xssSanitizer: () => (import("express-validator").ValidationChain | ((req: Request, _res: Response, next: NextFunction) => void))[];
export declare const mongoSanitizer: (req: Request, _res: Response, next: NextFunction) => void;
export declare const inputNormalizer: (req: Request, _res: Response, next: NextFunction) => void;
export declare const sanitizationMiddleware: (((req: Request, _res: Response, next: NextFunction) => void) | import("express-validator").ValidationChain)[];
export declare const authSanitizer: (((req: Request, _res: Response, next: NextFunction) => void) | import("express-validator").ValidationChain)[];
//# sourceMappingURL=sanitization.middleware.d.ts.map