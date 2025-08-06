import Joi from 'joi';

// Simple password validation schema
const passwordSchema = Joi.string()
  .min(3)
  .max(128)
  .required()
  .messages({
    'string.min': 'Password must be at least 3 characters long',
    'string.max': 'Password cannot exceed 128 characters',
    'any.required': 'Password is required'
  });

// Email validation schema
const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .required()
  .messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  });

// Username validation schema
const usernameSchema = Joi.string()
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

// Name validation schema
const nameSchema = Joi.string()
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

// Basic user registration validation schema (User self-registration)
export const basicRegisterSchema = Joi.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Password confirmation does not match password',
      'any.required': 'Password confirmation is required'
    }),
  name: nameSchema
});

// User creation validation schema (Admin only)
export const createUserSchema = Joi.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  demographics: Joi.object({
    age: Joi.number().integer().min(13).max(120).optional(),
    heightCm: Joi.number().min(50).max(300).optional(),
    weightKg: Joi.number().min(20).max(500).optional(),
    gender: Joi.string().valid('Male', 'Female', 'Other').optional(),
    targetWeightKg: Joi.number().min(20).max(500).optional(),
    bmi: Joi.number().min(10).max(50).optional(),
    allergies: Joi.array().items(Joi.string()).optional(),
    activityLevel: Joi.string().optional()
  }).optional(),
  fitnessProfile: Joi.object({
    level: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
    restDay: Joi.string().optional(),
    goal: Joi.string().valid('weight_loss', 'weight_gain', 'muscle_building', 'maintenance').optional(),
    goalWeightDiff: Joi.number().optional(),
    healthConditions: Joi.array().items(Joi.string()).optional()
  }).optional(),
  dietPreferences: Joi.object({
    cuisinePreferences: Joi.object().pattern(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional()
  }).optional(),
  bodyComposition: Joi.object({
    bodyAge: Joi.number().optional(),
    fatMassKg: Joi.number().optional(),
    skeletalMuscleMassKg: Joi.number().optional(),
    rohrerIndex: Joi.number().optional(),
    bodyFatPercentage: Joi.number().min(0).max(100).optional(),
    waistToHipRatio: Joi.number().optional(),
    visceralFatAreaCm2: Joi.number().optional(),
    visceralFatLevel: Joi.number().optional(),
    subcutaneousFatMassKg: Joi.number().optional(),
    extracellularWaterL: Joi.number().optional(),
    bodyCellMassKg: Joi.number().optional(),
    bcmToEcwRatio: Joi.number().optional(),
    ecwToTbwRatio: Joi.number().optional(),
    tbwToFfmRatio: Joi.number().optional(),
    basalMetabolicRateKcal: Joi.number().optional(),
    proteinGrams: Joi.number().optional(),
    mineralsMg: Joi.number().optional()
  }).optional(),
  activePlans: Joi.object({
    workoutPlanId: Joi.string().optional(),
    dietPlanId: Joi.string().optional()
  }).optional(),
  branches: Joi.array().items(Joi.object({
    branchId: Joi.string().required(),
    branchName: Joi.string().required(),
    joinedAt: Joi.date().optional()
  })).optional(),
  currentMacros: Joi.object({
    calories: Joi.string().optional(),
    carbs: Joi.string().optional(),
    protein: Joi.string().optional(),
    fat: Joi.string().optional(),
    fiber: Joi.string().optional(),
    validTill: Joi.date().optional()
  }).optional(),
  totalPoints: Joi.number().min(0).optional()
});

// User registration validation schema (keeping for backward compatibility if needed)
export const registerSchema = basicRegisterSchema;

// User login validation schema
export const loginSchema = Joi.object({
  email: emailSchema,
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});

// Refresh token validation schema
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token is required',
      'string.empty': 'Refresh token cannot be empty'
    })
});

// Password reset request validation schema
export const forgotPasswordSchema = Joi.object({
  email: emailSchema
});

// Reset password schema
export const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid reset token format',
      'any.required': 'Reset token is required'
    }),
  password: passwordSchema
});

// Update profile schema
export const updateProfileSchema = Joi.object({
  name: nameSchema.optional(),
  demographics: Joi.object({
    age: Joi.number().integer().min(13).max(120).optional(),
    heightCm: Joi.number().min(50).max(300).optional(),
    weightKg: Joi.number().min(20).max(500).optional(),
    gender: Joi.string().valid('Male', 'Female', 'Other').optional(),
    targetWeightKg: Joi.number().min(20).max(500).optional(),
    bmi: Joi.number().min(10).max(50).optional(),
    allergies: Joi.array().items(Joi.string()).optional(),
    activityLevel: Joi.string().optional()
  }).optional(),
  fitnessProfile: Joi.object({
    level: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
    restDay: Joi.string().optional(),
    goal: Joi.string().valid('weight_loss', 'weight_gain', 'muscle_building', 'maintenance').optional(),
    goalWeightDiff: Joi.number().optional(),
    healthConditions: Joi.array().items(Joi.string()).optional()
  }).optional(),
  dietPreferences: Joi.object({
    cuisinePreferences: Joi.object().pattern(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional()
  }).optional(),
  bodyComposition: Joi.object({
    bodyAge: Joi.number().optional(),
    fatMassKg: Joi.number().optional(),
    skeletalMuscleMassKg: Joi.number().optional(),
    rohrerIndex: Joi.number().optional(),
    bodyFatPercentage: Joi.number().min(0).max(100).optional(),
    waistToHipRatio: Joi.number().optional(),
    visceralFatAreaCm2: Joi.number().optional(),
    visceralFatLevel: Joi.number().optional(),
    subcutaneousFatMassKg: Joi.number().optional(),
    extracellularWaterL: Joi.number().optional(),
    bodyCellMassKg: Joi.number().optional(),
    bcmToEcwRatio: Joi.number().optional(),
    ecwToTbwRatio: Joi.number().optional(),
    tbwToFfmRatio: Joi.number().optional(),
    basalMetabolicRateKcal: Joi.number().optional(),
    proteinGrams: Joi.number().optional(),
    mineralsMg: Joi.number().optional()
  }).optional(),
  activePlans: Joi.object({
    workoutPlanId: Joi.string().optional(),
    dietPlanId: Joi.string().optional()
  }).optional(),
  branches: Joi.array().items(Joi.object({
    branchId: Joi.string().required(),
    branchName: Joi.string().required(),
    joinedAt: Joi.date().optional()
  })).optional(),
  currentMacros: Joi.object({
    calories: Joi.string().optional(),
    carbs: Joi.string().optional(),
    protein: Joi.string().optional(),
    fat: Joi.string().optional(),
    fiber: Joi.string().optional(),
    validTill: Joi.date().optional()
  }).optional(),
  totalPoints: Joi.number().min(0).optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Email verification validation schema
export const verifyEmailSchema = Joi.object({
  email: emailSchema,
  token: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.uuid': 'Invalid verification token format',
      'any.required': 'Verification token is required'
    })
});

// Resend verification validation schema
export const resendVerificationSchema = Joi.object({
  email: emailSchema
});

// Change password schema
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
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

// Helper function to validate request data
export const validateRequest = (data: any, schema: Joi.ObjectSchema) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: false,
    allowUnknown: true
  });

  if (error) {
    const validationErrors: Record<string, string> = {};
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

// Body metrics validation schema
export const bodyMetricsSchema = Joi.object({
  demographics: Joi.object({
    heightCm: Joi.number().min(50).max(300).optional(),
    weightKg: Joi.number().min(20).max(500).optional(),
    age: Joi.number().integer().min(13).max(120).optional(),
    gender: Joi.string().valid('Male', 'Female', 'Other').optional(),
    targetWeightKg: Joi.number().min(20).max(500).optional(),
    activityLevel: Joi.string().optional()
  }).optional(),
  bodyComposition: Joi.object({
    bodyAge: Joi.number().min(10).max(120).optional(),
    fatMassKg: Joi.number().min(0).max(200).optional(),
    skeletalMuscleMassKg: Joi.number().min(0).max(100).optional(),
    rohrerIndex: Joi.number().min(5).max(30).optional(),
    bodyFatPercentage: Joi.number().min(0).max(100).optional(),
    waistToHipRatio: Joi.number().min(0.5).max(2.0).optional(),
    visceralFatAreaCm2: Joi.number().min(0).max(500).optional(),
    visceralFatLevel: Joi.number().min(1).max(30).optional(),
    subcutaneousFatMassKg: Joi.number().min(0).max(100).optional(),
    extracellularWaterL: Joi.number().min(0).max(50).optional(),
    bodyCellMassKg: Joi.number().min(0).max(100).optional(),
    bcmToEcwRatio: Joi.number().min(0).max(5).optional(),
    ecwToTbwRatio: Joi.number().min(0).max(1).optional(),
    tbwToFfmRatio: Joi.number().min(0).max(1).optional(),
    basalMetabolicRateKcal: Joi.number().min(800).max(5000).optional(),
    proteinGrams: Joi.number().min(0).max(50000).optional(),
    mineralsMg: Joi.number().min(0).max(10000).optional()
  }).optional()
}).min(1).messages({
  'object.min': 'At least one body metric field must be provided for update'
});

// Body metrics history query schema
export const bodyMetricsHistorySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  metrics: Joi.array().items(
    Joi.string().valid(
      'weight', 'bodyFat', 'muscleMass', 'bmi', 'visceralFat', 'bmr'
    )
  ).optional()
}).messages({
  'date.min': 'End date must be after start date'
});

// Privacy settings validation schema
export const privacySettingsSchema = Joi.object({
  shareBasicMetrics: Joi.boolean().optional(),
  shareBodyComposition: Joi.boolean().optional(),
  shareHealthConditions: Joi.boolean().optional(),
  shareProgressPhotos: Joi.boolean().optional(),
  shareWorkoutData: Joi.boolean().optional(),
  shareNutritionData: Joi.boolean().optional(),
  profileVisibility: Joi.string().valid('public', 'friends', 'private').optional(),
  allowHealthDataExport: Joi.boolean().optional()
}).min(1).messages({
  'object.min': 'At least one privacy setting must be provided for update'
});

// Session management validation schemas
export const createSessionSchema = Joi.object({
  deviceInfo: Joi.object({
    deviceType: Joi.string().max(100).required(),
    os: Joi.string().max(50).required(),
    appVersion: Joi.string().max(20).required(),
    userAgent: Joi.string().max(500).required()
  }).required(),
  networkInfo: Joi.object({
    ipAddress: Joi.string().ip().required(),
    location: Joi.object({
      city: Joi.string().max(100).optional(),
      country: Joi.string().max(100).optional()
    }).optional()
  }).required(),
  expirationHours: Joi.number().integer().min(1).max(168).default(24) // Max 7 days
});

export const updateSessionSchema = Joi.object({
  activityData: Joi.object({
    type: Joi.string().valid('app_interaction', 'api_call', 'background_sync').required(),
    metadata: Joi.object().optional()
  }).optional()
});

export const sessionHistorySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  deviceType: Joi.string().optional(),
  isActive: Joi.boolean().optional()
}).messages({
  'date.min': 'End date must be after start date'
});

// Analytics validation schemas
export const logEventSchema = Joi.object({
  eventType: Joi.string().valid('app_interaction', 'api_call', 'feature_usage', 'performance', 'error').required(),
  eventName: Joi.string().max(100).required(),
  eventData: Joi.object({
    feature: Joi.string().max(50).optional(),
    action: Joi.string().max(50).optional(),
    screen: Joi.string().max(50).optional(),
    duration: Joi.number().min(0).optional(),
    success: Joi.boolean().optional(),
    errorCode: Joi.string().max(20).optional(),
    metadata: Joi.object().optional()
  }).optional(),
  sessionId: Joi.string().optional(),
  deviceInfo: Joi.object({
    deviceType: Joi.string().max(50).optional(),
    os: Joi.string().max(30).optional(),
    appVersion: Joi.string().max(20).optional()
  }).optional(),
  ipAddress: Joi.string().ip().optional()
});

export const engagementMetricsSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  period: Joi.string().valid('daily', 'weekly', 'monthly').default('daily')
}).messages({
  'date.min': 'End date must be after start date'
});

export const aggregationSchema = Joi.object({
  period: Joi.string().valid('daily', 'weekly', 'monthly').default('daily'),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  limit: Joi.number().integer().min(1).max(100).default(50)
}).messages({
  'date.min': 'End date must be after start date'
});

export const performanceMetricsSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  eventType: Joi.string().valid('performance', 'api_call', 'app_interaction').default('performance')
}).messages({
  'date.min': 'End date must be after start date'
});

// Activity logging validation schemas
export const logActivitySchema = Joi.object({
  activityType: Joi.string().valid('workout_completed', 'meal_logged', 'meal_uploaded', 'goal_achieved').required(),
  activityData: Joi.object({
    workoutDetails: Joi.object({
      exerciseId: Joi.string().required(),
      exerciseName: Joi.string().max(100).required(),
      machineId: Joi.string().optional(),
      completedSets: Joi.number().integer().min(0).required(),
      completedReps: Joi.number().integer().min(0).optional(),
      completedSeconds: Joi.number().min(0).optional(),
      performanceNotes: Joi.string().max(500).optional()
    }).optional(),
    mealDetails: Joi.object({
      mealType: Joi.string().valid('Breakfast', 'Lunch', 'Dinner', 'Snack').required(),
      mealDescription: Joi.string().max(500).required(),
      wasOnSchedule: Joi.boolean().optional(),
      notes: Joi.string().max(300).optional()
    }).optional(),
    uploadDetails: Joi.object({
      imageUrl: Joi.string().uri().required(),
      calories: Joi.number().min(0).required(),
      macros: Joi.object({
        carbs: Joi.number().min(0).required(),
        fat: Joi.number().min(0).required(),
        protein: Joi.number().min(0).required(),
        fiber: Joi.number().min(0).required()
      }).required(),
      aiVersion: Joi.string().max(20).required(),
      mealDetected: Joi.string().max(200).required(),
      isVerified: Joi.boolean().optional()
    }).optional(),
    achievement: Joi.object({
      achievementId: Joi.string().max(50).required(),
      achievementName: Joi.string().max(100).required()
    }).optional(),
    caloriesBurned: Joi.number().min(0).optional(),
    activeMinutes: Joi.number().min(0).optional(),
    pointsReason: Joi.string().max(200).optional()
  }).required(),
  date: Joi.date().iso().optional(),
  points: Joi.number().min(0).default(0)
});

export const activityTimelineSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  activityType: Joi.string().valid('workout', 'meal', 'achievement').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20)
}).messages({
  'date.min': 'End date must be after start date'
});

export const activitySummarySchema = Joi.object({
  period: Joi.string().valid('day', 'week', 'month').default('week'),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
}).messages({
  'date.min': 'End date must be after start date'
});

export const updateActivitySchema = Joi.object({
  workoutActivity: Joi.object({
    assignedWorkouts: Joi.number().min(0).optional(),
    completedWorkouts: Joi.number().min(0).optional()
  }).optional(),
  dietActivity: Joi.object({
    scheduledMeals: Joi.number().min(0).optional(),
    completedMeals: Joi.number().min(0).optional()
  }).optional(),
  goals: Joi.object({
    dailyGoals: Joi.object({
      workouts: Joi.number().min(0).optional(),
      meals: Joi.number().min(0).optional(),
      calories: Joi.number().min(0).optional(),
      steps: Joi.number().min(0).optional()
    }).optional()
  }).optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// User preferences validation schemas
export const userPreferencesSchema = Joi.object({
  notifications: Joi.object({
    workoutReminders: Joi.boolean().optional(),
    mealReminders: Joi.boolean().optional(),
    achievementAlerts: Joi.boolean().optional(),
    socialUpdates: Joi.boolean().optional(),
    weeklyReports: Joi.boolean().optional(),
    pushNotifications: Joi.boolean().optional(),
    emailNotifications: Joi.boolean().optional(),
    smsNotifications: Joi.boolean().optional()
  }).optional(),
  appConfiguration: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'auto').optional(),
    language: Joi.string().min(2).max(5).optional(),
    timezone: Joi.string().optional(),
    units: Joi.string().valid('metric', 'imperial').optional(),
    startOfWeek: Joi.string().valid('monday', 'sunday').optional(),
    autoSync: Joi.boolean().optional()
  }).optional(),
  workout: Joi.object({
    restTimerSound: Joi.boolean().optional(),
    formTips: Joi.boolean().optional(),
    autoProgressPhotos: Joi.boolean().optional(),
    defaultRestTime: Joi.number().integer().min(30).max(300).optional()
  }).optional(),
  diet: Joi.object({
    calorieGoalReminders: Joi.boolean().optional(),
    mealPlanNotifications: Joi.boolean().optional(),
    nutritionInsights: Joi.boolean().optional(),
    waterReminders: Joi.boolean().optional()
  }).optional()
}).min(1).messages({
  'object.min': 'At least one preference category must be provided for update'
});

// Device token validation schema
export const deviceTokenSchema = Joi.object({
  token: Joi.string().max(500).required(),
  platform: Joi.string().valid('ios', 'android', 'web').required(),
  deviceId: Joi.string().max(100).required()
});

// Workout Analytics validation schemas
export const dailyAnalyticsSchema = Joi.object({
  date: Joi.date().iso().optional()
});

export const weeklyAnalyticsSchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  weeks: Joi.number().integer().min(1).max(52).default(4)
}).messages({
  'date.min': 'End date must be after start date'
});

export const workoutHistorySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  exerciseId: Joi.string().optional(),
  muscleGroup: Joi.string().valid('Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio').optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0)
}).messages({
  'date.min': 'End date must be after start date'
});

export const goalTrackingSchema = Joi.object({
  goalType: Joi.string().valid('strength', 'endurance', 'consistency', 'weight_loss', 'muscle_building').optional(),
  period: Joi.string().valid('weekly', 'monthly', 'quarterly').default('monthly')
});

