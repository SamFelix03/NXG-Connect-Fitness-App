import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import mongoSanitize from 'mongo-sanitize';

// XSS sanitization middleware
export const xssSanitizer = () => {
  return [
    // Only sanitize fields that are actually present in the request
    body('username').if(body('username').exists()).trim().escape(),
    body('email').if(body('email').exists()).trim().escape(),
    body('name').if(body('name').exists()).trim().escape(),
    body('password').if(body('password').exists()).trim(),
    body('confirmPassword').if(body('confirmPassword').exists()).trim(),
    body('currentPassword').if(body('currentPassword').exists()).trim(),
    body('newPassword').if(body('newPassword').exists()).trim(),
    body('token').if(body('token').exists()).trim().escape(),
    body('refreshToken').if(body('refreshToken').exists()).trim().escape(),
    body('reason').if(body('reason').exists()).trim().escape(),
    body('query').if(body('query').exists()).trim().escape(),
    body('gender').if(body('gender').exists()).trim().escape(),
    body('fitnessLevel').if(body('fitnessLevel').exists()).trim().escape(),
    body('city').if(body('city').exists()).trim().escape(),
    body('branchId').if(body('branchId').exists()).trim().escape(),
    body('workoutPlanId').if(body('workoutPlanId').exists()).trim().escape(),
    body('dietPlanId').if(body('dietPlanId').exists()).trim().escape(),
    body('calories').if(body('calories').exists()).trim().escape(),
    body('carbs').if(body('carbs').exists()).trim().escape(),
    body('protein').if(body('protein').exists()).trim().escape(),
    body('fat').if(body('fat').exists()).trim().escape(),
    body('fiber').if(body('fiber').exists()).trim().escape(),
    body('restDay').if(body('restDay').exists()).trim().escape(),
    body('goal').if(body('goal').exists()).trim().escape(),
    body('activityLevel').if(body('activityLevel').exists()).trim().escape(),
    body('level').if(body('level').exists()).trim().escape(),
    body('age').if(body('age').exists()).toInt(),
    body('heightCm').if(body('heightCm').exists()).toFloat(),
    body('weightKg').if(body('weightKg').exists()).toFloat(),
    body('targetWeightKg').if(body('targetWeightKg').exists()).toFloat(),
    body('bmi').if(body('bmi').exists()).toFloat(),
    body('goalWeightDiff').if(body('goalWeightDiff').exists()).toFloat(),
    body('bodyAge').if(body('bodyAge').exists()).toFloat(),
    body('fatMassKg').if(body('fatMassKg').exists()).toFloat(),
    body('skeletalMuscleMassKg').if(body('skeletalMuscleMassKg').exists()).toFloat(),
    body('rohrerIndex').if(body('rohrerIndex').exists()).toFloat(),
    body('bodyFatPercentage').if(body('bodyFatPercentage').exists()).toFloat(),
    body('waistToHipRatio').if(body('waistToHipRatio').exists()).toFloat(),
    body('visceralFatAreaCm2').if(body('visceralFatAreaCm2').exists()).toFloat(),
    body('visceralFatLevel').if(body('visceralFatLevel').exists()).toFloat(),
    body('subcutaneousFatMassKg').if(body('subcutaneousFatMassKg').exists()).toFloat(),
    body('extracellularWaterL').if(body('extracellularWaterL').exists()).toFloat(),
    body('bodyCellMassKg').if(body('bodyCellMassKg').exists()).toFloat(),
    body('bcmToEcwRatio').if(body('bcmToEcwRatio').exists()).toFloat(),
    body('ecwToTbwRatio').if(body('ecwToTbwRatio').exists()).toFloat(),
    body('tbwToFfmRatio').if(body('tbwToFfmRatio').exists()).toFloat(),
    body('basalMetabolicRateKcal').if(body('basalMetabolicRateKcal').exists()).toFloat(),
    body('proteinGrams').if(body('proteinGrams').exists()).toFloat(),
    body('mineralsMg').if(body('mineralsMg').exists()).toFloat(),
    body('totalPoints').if(body('totalPoints').exists()).toInt(),
    body('isActive').if(body('isActive').exists()).toBoolean(),
    body('emailVerified').if(body('emailVerified').exists()).toBoolean(),
    body('validTill').if(body('validTill').exists()).toDate(),
    body('joinedAt').if(body('joinedAt').exists()).toDate(),
    body('allergies').if(body('allergies').exists()).isArray(),
    body('healthConditions').if(body('healthConditions').exists()).isArray(),
    
    // Handle nested objects - only process if they exist and are objects
    body('demographics').custom((value) => {
      if (value && typeof value === 'object') {
        return value;
      }
      return undefined;
    }),
    body('fitnessProfile').custom((value) => {
      if (value && typeof value === 'object') {
        return value;
      }
      return undefined;
    }),
    body('dietPreferences').custom((value) => {
      if (value && typeof value === 'object') {
        return value;
      }
      return undefined;
    }),
    body('bodyComposition').custom((value) => {
      if (value && typeof value === 'object') {
        return value;
      }
      return undefined;
    }),
    body('activePlans').custom((value) => {
      if (value && typeof value === 'object') {
        return value;
      }
      return undefined;
    }),
    body('branches').custom((value) => {
      if (value && Array.isArray(value)) {
        return value;
      }
      return undefined;
    }),
    body('currentMacros').custom((value) => {
      if (value && typeof value === 'object') {
        return value;
      }
      return undefined;
    }),
    
    query('*').trim().escape(),
    param('*').trim().escape(),
    
    // Handle validation results
    (req: Request, _res: Response, next: NextFunction) => {
      const errors = validationResult(req);
      const correlationId = req.headers['x-correlation-id'] as string;
      
      if (!errors.isEmpty()) {
        logger.warn('Input sanitization failed', {
          correlationId,
          errors: errors.array(),
          endpoint: `${req.method} ${req.path}`,
          ipAddress: req.ip || 'unknown'
        });
      }
      
      // Continue regardless of sanitization warnings
      next();
    }
  ];
};

// MongoDB injection prevention middleware
export const mongoSanitizer = (req: Request, _res: Response, next: NextFunction): void => {
  const correlationId = req.headers['x-correlation-id'] as string;
  
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = mongoSanitize(req.body);
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = mongoSanitize(req.query);
    }
    
    // Sanitize route parameters
    if (req.params && typeof req.params === 'object') {
      req.params = mongoSanitize(req.params);
    }
    
    logger.debug('MongoDB sanitization completed', {
      correlationId,
      endpoint: `${req.method} ${req.path}`
    });
    
    next();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('MongoDB sanitization failed', err instanceof Error ? err : undefined, {
      correlationId,
      error: errorMessage,
      endpoint: `${req.method} ${req.path}`,
      ipAddress: req.ip || 'unknown'
    });
    
    next(err);
  }
};

// Input normalization middleware
export const inputNormalizer = (req: Request, _res: Response, next: NextFunction): void => {
  const correlationId = req.headers['x-correlation-id'] as string;
  
  try {
    // Normalize strings in request body
    if (req.body && typeof req.body === 'object') {
      req.body = normalizeObject(req.body);
    }
    
    // Normalize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = normalizeObject(req.query);
    }
    
    logger.debug('Input normalization completed', {
      correlationId,
      endpoint: `${req.method} ${req.path}`
    });
    
    next();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Input normalization failed', err instanceof Error ? err : undefined, {
      correlationId,
      error: errorMessage,
      endpoint: `${req.method} ${req.path}`,
      ipAddress: req.ip || 'unknown'
    });
    
    next(err);
  }
};

// Helper function to normalize object properties
function normalizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return obj.trim();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(normalizeObject);
  }
  
  if (typeof obj === 'object') {
    const normalized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      normalized[key] = normalizeObject(value);
    }
    return normalized;
  }
  
  return obj;
}

// Combined sanitization middleware
export const sanitizationMiddleware = [
  mongoSanitizer,
  inputNormalizer,
  ...xssSanitizer()
];

// Specific sanitizers for authentication endpoints
export const authSanitizer = [
  // Email normalization
  body('email').trim().normalizeEmail().escape(),
  
  // Username sanitization
  body('username').trim().escape(),
  
  // Name sanitization
  body('name').trim().escape(),
  
  // Password fields (no escaping to preserve special characters)
  body('password').trim(),
  body('confirmPassword').trim(),
  body('currentPassword').trim(),
  body('newPassword').trim(),
  
  mongoSanitizer,
  
  (req: Request, _res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    const correlationId = req.headers['x-correlation-id'] as string;
    
    if (!errors.isEmpty()) {
      logger.warn('Authentication input sanitization warnings', {
        correlationId,
        warnings: errors.array(),
        endpoint: `${req.method} ${req.path}`,
        ipAddress: req.ip || 'unknown'
      });
    }
    
    next();
  }
]; 