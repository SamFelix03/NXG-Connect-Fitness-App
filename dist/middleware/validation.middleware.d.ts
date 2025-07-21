import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
interface ValidationOptions {
    body?: Joi.ObjectSchema;
    params?: Joi.ObjectSchema;
    query?: Joi.ObjectSchema;
    headers?: Joi.ObjectSchema;
}
export declare const validate: (schemas: ValidationOptions) => (req: Request, _res: Response, next: NextFunction) => void;
export declare const commonParamSchemas: {
    id: Joi.ObjectSchema<any>;
    userId: Joi.ObjectSchema<any>;
};
export declare const commonQuerySchemas: {
    pagination: Joi.ObjectSchema<any>;
};
export declare const apiVersionSchema: Joi.ObjectSchema<any>;
export {};
//# sourceMappingURL=validation.middleware.d.ts.map