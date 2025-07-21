"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceTokenSchema = exports.userPreferencesSchema = exports.updateActivitySchema = exports.activitySummarySchema = exports.activityTimelineSchema = exports.logActivitySchema = exports.performanceMetricsSchema = exports.aggregationSchema = exports.engagementMetricsSchema = exports.logEventSchema = exports.sessionHistorySchema = exports.updateSessionSchema = exports.createSessionSchema = exports.privacySettingsSchema = exports.bodyMetricsHistorySchema = exports.bodyMetricsSchema = exports.validateRequest = exports.changePasswordSchema = exports.resendVerificationSchema = exports.verifyEmailSchema = exports.updateProfileSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.refreshTokenSchema = exports.loginSchema = exports.registerSchema = exports.createUserSchema = exports.basicRegisterSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const passwordSchema = joi_1.default.string()
    .min(8)
    .max(128)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
    .required()
    .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password cannot exceed 128 characters',
    'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&)',
    'any.required': 'Password is required'
});
const emailSchema = joi_1.default.string()
    .email({ tlds: { allow: false } })
    .lowercase()
    .required()
    .messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
});
const usernameSchema = joi_1.default.string()
    .min(3)
    .max(30)
    .pattern(new RegExp('^[a-zA-Z0-9_]+$'))
    .required()
    .messages({
    'string.min': 'Username must be at least 3 characters long',
    'string.max': 'Username cannot exceed 30 characters',
    'string.pattern.base': 'Username can only contain letters, numbers, and underscores',
    'any.required': 'Username is required'
});
const nameSchema = joi_1.default.string()
    .trim()
    .min(1)
    .max(100)
    .pattern(new RegExp('^[a-zA-Z\\s-\']+$'))
    .required()
    .messages({
    'string.min': 'Name is required',
    'string.max': 'Name cannot exceed 100 characters',
    'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes',
    'any.required': 'Name is required'
});
exports.basicRegisterSchema = joi_1.default.object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: joi_1.default.string()
        .valid(joi_1.default.ref('password'))
        .required()
        .messages({
        'any.only': 'Password confirmation does not match password',
        'any.required': 'Password confirmation is required'
    }),
    name: nameSchema
});
exports.createUserSchema = joi_1.default.object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    name: nameSchema,
    demographics: joi_1.default.object({
        age: joi_1.default.number().integer().min(13).max(120).optional(),
        heightCm: joi_1.default.number().min(50).max(300).optional(),
        weightKg: joi_1.default.number().min(20).max(500).optional(),
        gender: joi_1.default.string().valid('Male', 'Female', 'Other').optional(),
        targetWeightKg: joi_1.default.number().min(20).max(500).optional(),
        bmi: joi_1.default.number().min(10).max(50).optional(),
        allergies: joi_1.default.array().items(joi_1.default.string()).optional(),
        activityLevel: joi_1.default.string().optional()
    }).optional(),
    fitnessProfile: joi_1.default.object({
        level: joi_1.default.string().valid('beginner', 'intermediate', 'advanced').optional(),
        restDay: joi_1.default.string().optional(),
        goal: joi_1.default.string().valid('weight_loss', 'weight_gain', 'muscle_building', 'maintenance').optional(),
        goalWeightDiff: joi_1.default.number().optional(),
        healthConditions: joi_1.default.array().items(joi_1.default.string()).optional()
    }).optional(),
    dietPreferences: joi_1.default.object({
        cuisinePreferences: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.array().items(joi_1.default.string())).optional()
    }).optional(),
    bodyComposition: joi_1.default.object({
        bodyAge: joi_1.default.number().optional(),
        fatMassKg: joi_1.default.number().optional(),
        skeletalMuscleMassKg: joi_1.default.number().optional(),
        rohrerIndex: joi_1.default.number().optional(),
        bodyFatPercentage: joi_1.default.number().min(0).max(100).optional(),
        waistToHipRatio: joi_1.default.number().optional(),
        visceralFatAreaCm2: joi_1.default.number().optional(),
        visceralFatLevel: joi_1.default.number().optional(),
        subcutaneousFatMassKg: joi_1.default.number().optional(),
        extracellularWaterL: joi_1.default.number().optional(),
        bodyCellMassKg: joi_1.default.number().optional(),
        bcmToEcwRatio: joi_1.default.number().optional(),
        ecwToTbwRatio: joi_1.default.number().optional(),
        tbwToFfmRatio: joi_1.default.number().optional(),
        basalMetabolicRateKcal: joi_1.default.number().optional(),
        proteinGrams: joi_1.default.number().optional(),
        mineralsMg: joi_1.default.number().optional()
    }).optional(),
    activePlans: joi_1.default.object({
        workoutPlanId: joi_1.default.string().optional(),
        dietPlanId: joi_1.default.string().optional()
    }).optional(),
    branches: joi_1.default.array().items(joi_1.default.object({
        branchId: joi_1.default.string().required(),
        branchName: joi_1.default.string().required(),
        joinedAt: joi_1.default.date().optional()
    })).optional(),
    currentMacros: joi_1.default.object({
        calories: joi_1.default.string().optional(),
        carbs: joi_1.default.string().optional(),
        protein: joi_1.default.string().optional(),
        fat: joi_1.default.string().optional(),
        fiber: joi_1.default.string().optional(),
        validTill: joi_1.default.date().optional()
    }).optional(),
    totalPoints: joi_1.default.number().min(0).optional()
});
exports.registerSchema = exports.basicRegisterSchema;
exports.loginSchema = joi_1.default.object({
    email: emailSchema,
    password: joi_1.default.string()
        .required()
        .messages({
        'any.required': 'Password is required'
    })
});
exports.refreshTokenSchema = joi_1.default.object({
    refreshToken: joi_1.default.string()
        .required()
        .messages({
        'any.required': 'Refresh token is required',
        'string.empty': 'Refresh token cannot be empty'
    })
});
exports.forgotPasswordSchema = joi_1.default.object({
    email: emailSchema
});
exports.resetPasswordSchema = joi_1.default.object({
    token: joi_1.default.string()
        .uuid()
        .required()
        .messages({
        'string.guid': 'Invalid reset token format',
        'any.required': 'Reset token is required'
    }),
    password: passwordSchema
});
exports.updateProfileSchema = joi_1.default.object({
    name: nameSchema.optional(),
    demographics: joi_1.default.object({
        age: joi_1.default.number().integer().min(13).max(120).optional(),
        heightCm: joi_1.default.number().min(50).max(300).optional(),
        weightKg: joi_1.default.number().min(20).max(500).optional(),
        gender: joi_1.default.string().valid('Male', 'Female', 'Other').optional(),
        targetWeightKg: joi_1.default.number().min(20).max(500).optional(),
        bmi: joi_1.default.number().min(10).max(50).optional(),
        allergies: joi_1.default.array().items(joi_1.default.string()).optional(),
        activityLevel: joi_1.default.string().optional()
    }).optional(),
    fitnessProfile: joi_1.default.object({
        level: joi_1.default.string().valid('beginner', 'intermediate', 'advanced').optional(),
        restDay: joi_1.default.string().optional(),
        goal: joi_1.default.string().valid('weight_loss', 'weight_gain', 'muscle_building', 'maintenance').optional(),
        goalWeightDiff: joi_1.default.number().optional(),
        healthConditions: joi_1.default.array().items(joi_1.default.string()).optional()
    }).optional(),
    dietPreferences: joi_1.default.object({
        cuisinePreferences: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.array().items(joi_1.default.string())).optional()
    }).optional(),
    bodyComposition: joi_1.default.object({
        bodyAge: joi_1.default.number().optional(),
        fatMassKg: joi_1.default.number().optional(),
        skeletalMuscleMassKg: joi_1.default.number().optional(),
        rohrerIndex: joi_1.default.number().optional(),
        bodyFatPercentage: joi_1.default.number().min(0).max(100).optional(),
        waistToHipRatio: joi_1.default.number().optional(),
        visceralFatAreaCm2: joi_1.default.number().optional(),
        visceralFatLevel: joi_1.default.number().optional(),
        subcutaneousFatMassKg: joi_1.default.number().optional(),
        extracellularWaterL: joi_1.default.number().optional(),
        bodyCellMassKg: joi_1.default.number().optional(),
        bcmToEcwRatio: joi_1.default.number().optional(),
        ecwToTbwRatio: joi_1.default.number().optional(),
        tbwToFfmRatio: joi_1.default.number().optional(),
        basalMetabolicRateKcal: joi_1.default.number().optional(),
        proteinGrams: joi_1.default.number().optional(),
        mineralsMg: joi_1.default.number().optional()
    }).optional(),
    activePlans: joi_1.default.object({
        workoutPlanId: joi_1.default.string().optional(),
        dietPlanId: joi_1.default.string().optional()
    }).optional(),
    branches: joi_1.default.array().items(joi_1.default.object({
        branchId: joi_1.default.string().required(),
        branchName: joi_1.default.string().required(),
        joinedAt: joi_1.default.date().optional()
    })).optional(),
    currentMacros: joi_1.default.object({
        calories: joi_1.default.string().optional(),
        carbs: joi_1.default.string().optional(),
        protein: joi_1.default.string().optional(),
        fat: joi_1.default.string().optional(),
        fiber: joi_1.default.string().optional(),
        validTill: joi_1.default.date().optional()
    }).optional(),
    totalPoints: joi_1.default.number().min(0).optional()
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});
exports.verifyEmailSchema = joi_1.default.object({
    email: emailSchema,
    token: joi_1.default.string()
        .uuid()
        .required()
        .messages({
        'string.uuid': 'Invalid verification token format',
        'any.required': 'Verification token is required'
    })
});
exports.resendVerificationSchema = joi_1.default.object({
    email: emailSchema
});
exports.changePasswordSchema = joi_1.default.object({
    currentPassword: joi_1.default.string()
        .required()
        .messages({
        'any.required': 'Current password is required'
    }),
    newPassword: passwordSchema.messages({
        'string.min': 'New password must be at least 8 characters long',
        'string.max': 'New password cannot exceed 128 characters',
        'string.pattern.base': 'New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&)',
        'any.required': 'New password is required'
    })
});
const validateRequest = (data, schema) => {
    const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: false,
        allowUnknown: true
    });
    if (error) {
        const validationErrors = {};
        error.details.forEach((detail) => {
            const key = detail.path.join('.');
            validationErrors[key] = detail.message;
        });
        return {
            isValid: false,
            errors: validationErrors,
            value: null
        };
    }
    return {
        isValid: true,
        errors: null,
        value
    };
};
exports.validateRequest = validateRequest;
exports.bodyMetricsSchema = joi_1.default.object({
    demographics: joi_1.default.object({
        heightCm: joi_1.default.number().min(50).max(300).optional(),
        weightKg: joi_1.default.number().min(20).max(500).optional(),
        age: joi_1.default.number().integer().min(13).max(120).optional(),
        gender: joi_1.default.string().valid('Male', 'Female', 'Other').optional(),
        targetWeightKg: joi_1.default.number().min(20).max(500).optional(),
        activityLevel: joi_1.default.string().optional()
    }).optional(),
    bodyComposition: joi_1.default.object({
        bodyAge: joi_1.default.number().min(10).max(120).optional(),
        fatMassKg: joi_1.default.number().min(0).max(200).optional(),
        skeletalMuscleMassKg: joi_1.default.number().min(0).max(100).optional(),
        rohrerIndex: joi_1.default.number().min(5).max(30).optional(),
        bodyFatPercentage: joi_1.default.number().min(0).max(100).optional(),
        waistToHipRatio: joi_1.default.number().min(0.5).max(2.0).optional(),
        visceralFatAreaCm2: joi_1.default.number().min(0).max(500).optional(),
        visceralFatLevel: joi_1.default.number().min(1).max(30).optional(),
        subcutaneousFatMassKg: joi_1.default.number().min(0).max(100).optional(),
        extracellularWaterL: joi_1.default.number().min(0).max(50).optional(),
        bodyCellMassKg: joi_1.default.number().min(0).max(100).optional(),
        bcmToEcwRatio: joi_1.default.number().min(0).max(5).optional(),
        ecwToTbwRatio: joi_1.default.number().min(0).max(1).optional(),
        tbwToFfmRatio: joi_1.default.number().min(0).max(1).optional(),
        basalMetabolicRateKcal: joi_1.default.number().min(800).max(5000).optional(),
        proteinGrams: joi_1.default.number().min(0).max(50000).optional(),
        mineralsMg: joi_1.default.number().min(0).max(10000).optional()
    }).optional()
}).min(1).messages({
    'object.min': 'At least one body metric field must be provided for update'
});
exports.bodyMetricsHistorySchema = joi_1.default.object({
    startDate: joi_1.default.date().iso().optional(),
    endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).optional(),
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
    metrics: joi_1.default.array().items(joi_1.default.string().valid('weight', 'bodyFat', 'muscleMass', 'bmi', 'visceralFat', 'bmr')).optional()
}).messages({
    'date.min': 'End date must be after start date'
});
exports.privacySettingsSchema = joi_1.default.object({
    shareBasicMetrics: joi_1.default.boolean().optional(),
    shareBodyComposition: joi_1.default.boolean().optional(),
    shareHealthConditions: joi_1.default.boolean().optional(),
    shareProgressPhotos: joi_1.default.boolean().optional(),
    shareWorkoutData: joi_1.default.boolean().optional(),
    shareNutritionData: joi_1.default.boolean().optional(),
    profileVisibility: joi_1.default.string().valid('public', 'friends', 'private').optional(),
    allowHealthDataExport: joi_1.default.boolean().optional()
}).min(1).messages({
    'object.min': 'At least one privacy setting must be provided for update'
});
exports.createSessionSchema = joi_1.default.object({
    deviceInfo: joi_1.default.object({
        deviceType: joi_1.default.string().max(100).required(),
        os: joi_1.default.string().max(50).required(),
        appVersion: joi_1.default.string().max(20).required(),
        userAgent: joi_1.default.string().max(500).required()
    }).required(),
    networkInfo: joi_1.default.object({
        ipAddress: joi_1.default.string().ip().required(),
        location: joi_1.default.object({
            city: joi_1.default.string().max(100).optional(),
            country: joi_1.default.string().max(100).optional()
        }).optional()
    }).required(),
    expirationHours: joi_1.default.number().integer().min(1).max(168).default(24)
});
exports.updateSessionSchema = joi_1.default.object({
    activityData: joi_1.default.object({
        type: joi_1.default.string().valid('app_interaction', 'api_call', 'background_sync').required(),
        metadata: joi_1.default.object().optional()
    }).optional()
});
exports.sessionHistorySchema = joi_1.default.object({
    startDate: joi_1.default.date().iso().optional(),
    endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).optional(),
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(50).default(10),
    deviceType: joi_1.default.string().optional(),
    isActive: joi_1.default.boolean().optional()
}).messages({
    'date.min': 'End date must be after start date'
});
exports.logEventSchema = joi_1.default.object({
    eventType: joi_1.default.string().valid('app_interaction', 'api_call', 'feature_usage', 'performance', 'error').required(),
    eventName: joi_1.default.string().max(100).required(),
    eventData: joi_1.default.object({
        feature: joi_1.default.string().max(50).optional(),
        action: joi_1.default.string().max(50).optional(),
        screen: joi_1.default.string().max(50).optional(),
        duration: joi_1.default.number().min(0).optional(),
        success: joi_1.default.boolean().optional(),
        errorCode: joi_1.default.string().max(20).optional(),
        metadata: joi_1.default.object().optional()
    }).optional(),
    sessionId: joi_1.default.string().optional(),
    deviceInfo: joi_1.default.object({
        deviceType: joi_1.default.string().max(50).optional(),
        os: joi_1.default.string().max(30).optional(),
        appVersion: joi_1.default.string().max(20).optional()
    }).optional(),
    ipAddress: joi_1.default.string().ip().optional()
});
exports.engagementMetricsSchema = joi_1.default.object({
    startDate: joi_1.default.date().iso().optional(),
    endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).optional(),
    period: joi_1.default.string().valid('daily', 'weekly', 'monthly').default('daily')
}).messages({
    'date.min': 'End date must be after start date'
});
exports.aggregationSchema = joi_1.default.object({
    period: joi_1.default.string().valid('daily', 'weekly', 'monthly').default('daily'),
    startDate: joi_1.default.date().iso().optional(),
    endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).optional(),
    limit: joi_1.default.number().integer().min(1).max(100).default(50)
}).messages({
    'date.min': 'End date must be after start date'
});
exports.performanceMetricsSchema = joi_1.default.object({
    startDate: joi_1.default.date().iso().optional(),
    endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).optional(),
    eventType: joi_1.default.string().valid('performance', 'api_call', 'app_interaction').default('performance')
}).messages({
    'date.min': 'End date must be after start date'
});
exports.logActivitySchema = joi_1.default.object({
    activityType: joi_1.default.string().valid('workout_completed', 'meal_logged', 'meal_uploaded', 'goal_achieved').required(),
    activityData: joi_1.default.object({
        workoutDetails: joi_1.default.object({
            exerciseId: joi_1.default.string().required(),
            exerciseName: joi_1.default.string().max(100).required(),
            machineId: joi_1.default.string().optional(),
            completedSets: joi_1.default.number().integer().min(0).required(),
            completedReps: joi_1.default.number().integer().min(0).optional(),
            completedSeconds: joi_1.default.number().min(0).optional(),
            performanceNotes: joi_1.default.string().max(500).optional()
        }).optional(),
        mealDetails: joi_1.default.object({
            mealType: joi_1.default.string().valid('Breakfast', 'Lunch', 'Dinner', 'Snack').required(),
            mealDescription: joi_1.default.string().max(500).required(),
            wasOnSchedule: joi_1.default.boolean().optional(),
            notes: joi_1.default.string().max(300).optional()
        }).optional(),
        uploadDetails: joi_1.default.object({
            imageUrl: joi_1.default.string().uri().required(),
            calories: joi_1.default.number().min(0).required(),
            macros: joi_1.default.object({
                carbs: joi_1.default.number().min(0).required(),
                fat: joi_1.default.number().min(0).required(),
                protein: joi_1.default.number().min(0).required(),
                fiber: joi_1.default.number().min(0).required()
            }).required(),
            aiVersion: joi_1.default.string().max(20).required(),
            mealDetected: joi_1.default.string().max(200).required(),
            isVerified: joi_1.default.boolean().optional()
        }).optional(),
        achievement: joi_1.default.object({
            achievementId: joi_1.default.string().max(50).required(),
            achievementName: joi_1.default.string().max(100).required()
        }).optional(),
        caloriesBurned: joi_1.default.number().min(0).optional(),
        activeMinutes: joi_1.default.number().min(0).optional(),
        pointsReason: joi_1.default.string().max(200).optional()
    }).required(),
    date: joi_1.default.date().iso().optional(),
    points: joi_1.default.number().min(0).default(0)
});
exports.activityTimelineSchema = joi_1.default.object({
    startDate: joi_1.default.date().iso().optional(),
    endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).optional(),
    activityType: joi_1.default.string().valid('workout', 'meal', 'achievement').optional(),
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(50).default(20)
}).messages({
    'date.min': 'End date must be after start date'
});
exports.activitySummarySchema = joi_1.default.object({
    period: joi_1.default.string().valid('day', 'week', 'month').default('week'),
    startDate: joi_1.default.date().iso().optional(),
    endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).optional()
}).messages({
    'date.min': 'End date must be after start date'
});
exports.updateActivitySchema = joi_1.default.object({
    workoutActivity: joi_1.default.object({
        assignedWorkouts: joi_1.default.number().min(0).optional(),
        completedWorkouts: joi_1.default.number().min(0).optional()
    }).optional(),
    dietActivity: joi_1.default.object({
        scheduledMeals: joi_1.default.number().min(0).optional(),
        completedMeals: joi_1.default.number().min(0).optional()
    }).optional(),
    goals: joi_1.default.object({
        dailyGoals: joi_1.default.object({
            workouts: joi_1.default.number().min(0).optional(),
            meals: joi_1.default.number().min(0).optional(),
            calories: joi_1.default.number().min(0).optional(),
            steps: joi_1.default.number().min(0).optional()
        }).optional()
    }).optional()
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});
exports.userPreferencesSchema = joi_1.default.object({
    notifications: joi_1.default.object({
        workoutReminders: joi_1.default.boolean().optional(),
        mealReminders: joi_1.default.boolean().optional(),
        achievementAlerts: joi_1.default.boolean().optional(),
        socialUpdates: joi_1.default.boolean().optional(),
        weeklyReports: joi_1.default.boolean().optional(),
        pushNotifications: joi_1.default.boolean().optional(),
        emailNotifications: joi_1.default.boolean().optional(),
        smsNotifications: joi_1.default.boolean().optional()
    }).optional(),
    appConfiguration: joi_1.default.object({
        theme: joi_1.default.string().valid('light', 'dark', 'auto').optional(),
        language: joi_1.default.string().min(2).max(5).optional(),
        timezone: joi_1.default.string().optional(),
        units: joi_1.default.string().valid('metric', 'imperial').optional(),
        startOfWeek: joi_1.default.string().valid('monday', 'sunday').optional(),
        autoSync: joi_1.default.boolean().optional()
    }).optional(),
    workout: joi_1.default.object({
        restTimerSound: joi_1.default.boolean().optional(),
        formTips: joi_1.default.boolean().optional(),
        autoProgressPhotos: joi_1.default.boolean().optional(),
        defaultRestTime: joi_1.default.number().integer().min(30).max(300).optional()
    }).optional(),
    diet: joi_1.default.object({
        calorieGoalReminders: joi_1.default.boolean().optional(),
        mealPlanNotifications: joi_1.default.boolean().optional(),
        nutritionInsights: joi_1.default.boolean().optional(),
        waterReminders: joi_1.default.boolean().optional()
    }).optional()
}).min(1).messages({
    'object.min': 'At least one preference category must be provided for update'
});
exports.deviceTokenSchema = joi_1.default.object({
    token: joi_1.default.string().max(500).required(),
    platform: joi_1.default.string().valid('ios', 'android', 'web').required(),
    deviceId: joi_1.default.string().max(100).required()
});
//# sourceMappingURL=validation.js.map