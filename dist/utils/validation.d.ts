import Joi from 'joi';
export declare const basicRegisterSchema: Joi.ObjectSchema<any>;
export declare const createUserSchema: Joi.ObjectSchema<any>;
export declare const registerSchema: Joi.ObjectSchema<any>;
export declare const loginSchema: Joi.ObjectSchema<any>;
export declare const refreshTokenSchema: Joi.ObjectSchema<any>;
export declare const forgotPasswordSchema: Joi.ObjectSchema<any>;
export declare const resetPasswordSchema: Joi.ObjectSchema<any>;
export declare const updateProfileSchema: Joi.ObjectSchema<any>;
export declare const verifyEmailSchema: Joi.ObjectSchema<any>;
export declare const resendVerificationSchema: Joi.ObjectSchema<any>;
export declare const changePasswordSchema: Joi.ObjectSchema<any>;
export declare const validateRequest: (data: any, schema: Joi.ObjectSchema) => {
    isValid: boolean;
    errors: Record<string, string>;
    value: null;
} | {
    isValid: boolean;
    errors: null;
    value: any;
};
export declare const bodyMetricsSchema: Joi.ObjectSchema<any>;
export declare const bodyMetricsHistorySchema: Joi.ObjectSchema<any>;
export declare const privacySettingsSchema: Joi.ObjectSchema<any>;
export declare const createSessionSchema: Joi.ObjectSchema<any>;
export declare const updateSessionSchema: Joi.ObjectSchema<any>;
export declare const sessionHistorySchema: Joi.ObjectSchema<any>;
export declare const logEventSchema: Joi.ObjectSchema<any>;
export declare const engagementMetricsSchema: Joi.ObjectSchema<any>;
export declare const aggregationSchema: Joi.ObjectSchema<any>;
export declare const performanceMetricsSchema: Joi.ObjectSchema<any>;
export declare const logActivitySchema: Joi.ObjectSchema<any>;
export declare const activityTimelineSchema: Joi.ObjectSchema<any>;
export declare const activitySummarySchema: Joi.ObjectSchema<any>;
export declare const updateActivitySchema: Joi.ObjectSchema<any>;
export declare const userPreferencesSchema: Joi.ObjectSchema<any>;
export declare const deviceTokenSchema: Joi.ObjectSchema<any>;
//# sourceMappingURL=validation.d.ts.map