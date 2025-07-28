"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authSanitizer = exports.sanitizationMiddleware = exports.inputNormalizer = exports.mongoSanitizer = exports.xssSanitizer = void 0;
const express_validator_1 = require("express-validator");
const logger_1 = require("../utils/logger");
const mongo_sanitize_1 = __importDefault(require("mongo-sanitize"));
const xssSanitizer = () => {
    return [
        (0, express_validator_1.body)('username').if((0, express_validator_1.body)('username').exists()).trim().escape(),
        (0, express_validator_1.body)('email').if((0, express_validator_1.body)('email').exists()).trim().escape(),
        (0, express_validator_1.body)('name').if((0, express_validator_1.body)('name').exists()).trim().escape(),
        (0, express_validator_1.body)('password').if((0, express_validator_1.body)('password').exists()).trim(),
        (0, express_validator_1.body)('confirmPassword').if((0, express_validator_1.body)('confirmPassword').exists()).trim(),
        (0, express_validator_1.body)('currentPassword').if((0, express_validator_1.body)('currentPassword').exists()).trim(),
        (0, express_validator_1.body)('newPassword').if((0, express_validator_1.body)('newPassword').exists()).trim(),
        (0, express_validator_1.body)('token').if((0, express_validator_1.body)('token').exists()).trim().escape(),
        (0, express_validator_1.body)('refreshToken').if((0, express_validator_1.body)('refreshToken').exists()).trim().escape(),
        (0, express_validator_1.body)('reason').if((0, express_validator_1.body)('reason').exists()).trim().escape(),
        (0, express_validator_1.body)('query').if((0, express_validator_1.body)('query').exists()).trim().escape(),
        (0, express_validator_1.body)('gender').if((0, express_validator_1.body)('gender').exists()).trim().escape(),
        (0, express_validator_1.body)('fitnessLevel').if((0, express_validator_1.body)('fitnessLevel').exists()).trim().escape(),
        (0, express_validator_1.body)('city').if((0, express_validator_1.body)('city').exists()).trim().escape(),
        (0, express_validator_1.body)('branchId').if((0, express_validator_1.body)('branchId').exists()).trim().escape(),
        (0, express_validator_1.body)('workoutPlanId').if((0, express_validator_1.body)('workoutPlanId').exists()).trim().escape(),
        (0, express_validator_1.body)('dietPlanId').if((0, express_validator_1.body)('dietPlanId').exists()).trim().escape(),
        (0, express_validator_1.body)('calories').if((0, express_validator_1.body)('calories').exists()).trim().escape(),
        (0, express_validator_1.body)('carbs').if((0, express_validator_1.body)('carbs').exists()).trim().escape(),
        (0, express_validator_1.body)('protein').if((0, express_validator_1.body)('protein').exists()).trim().escape(),
        (0, express_validator_1.body)('fat').if((0, express_validator_1.body)('fat').exists()).trim().escape(),
        (0, express_validator_1.body)('fiber').if((0, express_validator_1.body)('fiber').exists()).trim().escape(),
        (0, express_validator_1.body)('restDay').if((0, express_validator_1.body)('restDay').exists()).trim().escape(),
        (0, express_validator_1.body)('goal').if((0, express_validator_1.body)('goal').exists()).trim().escape(),
        (0, express_validator_1.body)('activityLevel').if((0, express_validator_1.body)('activityLevel').exists()).trim().escape(),
        (0, express_validator_1.body)('level').if((0, express_validator_1.body)('level').exists()).trim().escape(),
        (0, express_validator_1.body)('age').if((0, express_validator_1.body)('age').exists()).toInt(),
        (0, express_validator_1.body)('heightCm').if((0, express_validator_1.body)('heightCm').exists()).toFloat(),
        (0, express_validator_1.body)('weightKg').if((0, express_validator_1.body)('weightKg').exists()).toFloat(),
        (0, express_validator_1.body)('targetWeightKg').if((0, express_validator_1.body)('targetWeightKg').exists()).toFloat(),
        (0, express_validator_1.body)('bmi').if((0, express_validator_1.body)('bmi').exists()).toFloat(),
        (0, express_validator_1.body)('goalWeightDiff').if((0, express_validator_1.body)('goalWeightDiff').exists()).toFloat(),
        (0, express_validator_1.body)('bodyAge').if((0, express_validator_1.body)('bodyAge').exists()).toFloat(),
        (0, express_validator_1.body)('fatMassKg').if((0, express_validator_1.body)('fatMassKg').exists()).toFloat(),
        (0, express_validator_1.body)('skeletalMuscleMassKg').if((0, express_validator_1.body)('skeletalMuscleMassKg').exists()).toFloat(),
        (0, express_validator_1.body)('rohrerIndex').if((0, express_validator_1.body)('rohrerIndex').exists()).toFloat(),
        (0, express_validator_1.body)('bodyFatPercentage').if((0, express_validator_1.body)('bodyFatPercentage').exists()).toFloat(),
        (0, express_validator_1.body)('waistToHipRatio').if((0, express_validator_1.body)('waistToHipRatio').exists()).toFloat(),
        (0, express_validator_1.body)('visceralFatAreaCm2').if((0, express_validator_1.body)('visceralFatAreaCm2').exists()).toFloat(),
        (0, express_validator_1.body)('visceralFatLevel').if((0, express_validator_1.body)('visceralFatLevel').exists()).toFloat(),
        (0, express_validator_1.body)('subcutaneousFatMassKg').if((0, express_validator_1.body)('subcutaneousFatMassKg').exists()).toFloat(),
        (0, express_validator_1.body)('extracellularWaterL').if((0, express_validator_1.body)('extracellularWaterL').exists()).toFloat(),
        (0, express_validator_1.body)('bodyCellMassKg').if((0, express_validator_1.body)('bodyCellMassKg').exists()).toFloat(),
        (0, express_validator_1.body)('bcmToEcwRatio').if((0, express_validator_1.body)('bcmToEcwRatio').exists()).toFloat(),
        (0, express_validator_1.body)('ecwToTbwRatio').if((0, express_validator_1.body)('ecwToTbwRatio').exists()).toFloat(),
        (0, express_validator_1.body)('tbwToFfmRatio').if((0, express_validator_1.body)('tbwToFfmRatio').exists()).toFloat(),
        (0, express_validator_1.body)('basalMetabolicRateKcal').if((0, express_validator_1.body)('basalMetabolicRateKcal').exists()).toFloat(),
        (0, express_validator_1.body)('proteinGrams').if((0, express_validator_1.body)('proteinGrams').exists()).toFloat(),
        (0, express_validator_1.body)('mineralsMg').if((0, express_validator_1.body)('mineralsMg').exists()).toFloat(),
        (0, express_validator_1.body)('totalPoints').if((0, express_validator_1.body)('totalPoints').exists()).toInt(),
        (0, express_validator_1.body)('isActive').if((0, express_validator_1.body)('isActive').exists()).toBoolean(),
        (0, express_validator_1.body)('emailVerified').if((0, express_validator_1.body)('emailVerified').exists()).toBoolean(),
        (0, express_validator_1.body)('validTill').if((0, express_validator_1.body)('validTill').exists()).toDate(),
        (0, express_validator_1.body)('joinedAt').if((0, express_validator_1.body)('joinedAt').exists()).toDate(),
        (0, express_validator_1.body)('allergies').if((0, express_validator_1.body)('allergies').exists()).isArray(),
        (0, express_validator_1.body)('healthConditions').if((0, express_validator_1.body)('healthConditions').exists()).isArray(),
        (0, express_validator_1.body)('demographics').custom((value) => {
            if (value && typeof value === 'object') {
                return value;
            }
            return undefined;
        }),
        (0, express_validator_1.body)('fitnessProfile').custom((value) => {
            if (value && typeof value === 'object') {
                return value;
            }
            return undefined;
        }),
        (0, express_validator_1.body)('dietPreferences').custom((value) => {
            if (value && typeof value === 'object') {
                return value;
            }
            return undefined;
        }),
        (0, express_validator_1.body)('bodyComposition').custom((value) => {
            if (value && typeof value === 'object') {
                return value;
            }
            return undefined;
        }),
        (0, express_validator_1.body)('activePlans').custom((value) => {
            if (value && typeof value === 'object') {
                return value;
            }
            return undefined;
        }),
        (0, express_validator_1.body)('branches').custom((value) => {
            if (value && Array.isArray(value)) {
                return value;
            }
            return undefined;
        }),
        (0, express_validator_1.body)('currentMacros').custom((value) => {
            if (value && typeof value === 'object') {
                return value;
            }
            return undefined;
        }),
        (0, express_validator_1.query)('*').custom((value, { path }) => {
            if (path && ['password', 'confirmPassword', 'currentPassword', 'newPassword'].includes(path)) {
                return typeof value === 'string' ? value.trim() : value;
            }
            return typeof value === 'string' ? value.trim() : value;
        }),
        (0, express_validator_1.param)('*').custom((value, { path }) => {
            if (path && ['password', 'confirmPassword', 'currentPassword', 'newPassword'].includes(path)) {
                return typeof value === 'string' ? value.trim() : value;
            }
            return typeof value === 'string' ? value.trim() : value;
        }),
        (req, _res, next) => {
            const errors = (0, express_validator_1.validationResult)(req);
            const correlationId = req.headers['x-correlation-id'];
            if (!errors.isEmpty()) {
                logger_1.logger.warn('Input sanitization failed', {
                    correlationId,
                    errors: errors.array(),
                    endpoint: `${req.method} ${req.path}`,
                    ipAddress: req.ip || 'unknown'
                });
            }
            next();
        }
    ];
};
exports.xssSanitizer = xssSanitizer;
const mongoSanitizer = (req, _res, next) => {
    const correlationId = req.headers['x-correlation-id'];
    try {
        if (req.body && typeof req.body === 'object') {
            req.body = (0, mongo_sanitize_1.default)(req.body);
        }
        if (req.query && typeof req.query === 'object') {
            req.query = (0, mongo_sanitize_1.default)(req.query);
        }
        if (req.params && typeof req.params === 'object') {
            req.params = (0, mongo_sanitize_1.default)(req.params);
        }
        logger_1.logger.debug('MongoDB sanitization completed', {
            correlationId,
            endpoint: `${req.method} ${req.path}`
        });
        next();
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger_1.logger.error('MongoDB sanitization failed', err instanceof Error ? err : undefined, {
            correlationId,
            error: errorMessage,
            endpoint: `${req.method} ${req.path}`,
            ipAddress: req.ip || 'unknown'
        });
        next(err);
    }
};
exports.mongoSanitizer = mongoSanitizer;
const inputNormalizer = (req, _res, next) => {
    const correlationId = req.headers['x-correlation-id'];
    try {
        if (req.body && typeof req.body === 'object') {
            req.body = normalizeObject(req.body);
        }
        if (req.query && typeof req.query === 'object') {
            req.query = normalizeObject(req.query);
        }
        logger_1.logger.debug('Input normalization completed', {
            correlationId,
            endpoint: `${req.method} ${req.path}`
        });
        next();
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger_1.logger.error('Input normalization failed', err instanceof Error ? err : undefined, {
            correlationId,
            error: errorMessage,
            endpoint: `${req.method} ${req.path}`,
            ipAddress: req.ip || 'unknown'
        });
        next(err);
    }
};
exports.inputNormalizer = inputNormalizer;
function normalizeObject(obj) {
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
        const normalized = {};
        for (const [key, value] of Object.entries(obj)) {
            normalized[key] = normalizeObject(value);
        }
        return normalized;
    }
    return obj;
}
exports.sanitizationMiddleware = [
    exports.mongoSanitizer,
    exports.inputNormalizer,
    ...(0, exports.xssSanitizer)()
];
exports.authSanitizer = [
    (0, express_validator_1.body)('email').trim().normalizeEmail().escape(),
    (0, express_validator_1.body)('username').trim().escape(),
    (0, express_validator_1.body)('name').trim().escape(),
    (0, express_validator_1.body)('password').trim(),
    (0, express_validator_1.body)('confirmPassword').trim(),
    (0, express_validator_1.body)('currentPassword').trim(),
    (0, express_validator_1.body)('newPassword').trim(),
    exports.mongoSanitizer,
    (req, _res, next) => {
        const errors = (0, express_validator_1.validationResult)(req);
        const correlationId = req.headers['x-correlation-id'];
        if (!errors.isEmpty()) {
            logger_1.logger.warn('Authentication input sanitization warnings', {
                correlationId,
                warnings: errors.array(),
                endpoint: `${req.method} ${req.path}`,
                ipAddress: req.ip || 'unknown'
            });
        }
        next();
    }
];
//# sourceMappingURL=sanitization.middleware.js.map