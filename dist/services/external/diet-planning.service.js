"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dietPlanningService = exports.DietPlanningService = void 0;
const axios_1 = __importDefault(require("axios"));
const joi_1 = __importDefault(require("joi"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const external_apis_config_1 = require("../../config/external-apis.config");
const createDietPlanSchema = joi_1.default.object({
    userId: joi_1.default.string().required(),
    userProfile: joi_1.default.object({
        goal: joi_1.default.string().valid('weight_loss', 'weight_gain', 'muscle_building', 'maintenance').required(),
        age: joi_1.default.number().min(13).max(120).required(),
        heightCm: joi_1.default.number().min(50).max(300).required(),
        weightKg: joi_1.default.number().min(20).max(500).required(),
        targetWeightKg: joi_1.default.number().min(20).max(500).optional(),
        gender: joi_1.default.string().valid('Male', 'Female', 'Other').required(),
        activityLevel: joi_1.default.string().required(),
        allergies: joi_1.default.array().items(joi_1.default.string()).default([]),
        healthConditions: joi_1.default.array().items(joi_1.default.string()).default([])
    }).required(),
    dietPreferences: joi_1.default.object({
        cuisinePreferences: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.array().items(joi_1.default.string())).optional()
    }).optional()
});
const dietPlanResponseSchema = joi_1.default.object({
    target_weight: joi_1.default.string().required(),
    macros: joi_1.default.object({
        'Total Calories': joi_1.default.string().required(),
        'Total Carbs': joi_1.default.string().required(),
        'Total Protein': joi_1.default.string().required(),
        'Total Fat': joi_1.default.string().required(),
        'Total Fiber': joi_1.default.string().required()
    }).required(),
    meal_plan: joi_1.default.array().items(joi_1.default.object({
        day: joi_1.default.number().min(1).max(7).required(),
        meals: joi_1.default.object().pattern(joi_1.default.string().valid('Breakfast', 'Snack 1', 'Lunch', 'Snack 2', 'Dinner'), joi_1.default.string().required()).required(),
        calories: joi_1.default.object().pattern(joi_1.default.string().valid('Breakfast', 'Snack 1', 'Lunch', 'Snack 2', 'Dinner'), joi_1.default.number().min(0).max(2000).required()).required(),
        short_names: joi_1.default.object().pattern(joi_1.default.string().valid('Breakfast', 'Snack 1', 'Lunch', 'Snack 2', 'Dinner'), joi_1.default.string().required()).required()
    })).min(1).max(7).required()
});
class DietPlanningService {
    httpClient;
    circuitBreakerState;
    constructor() {
        this.httpClient = axios_1.default.create({
            baseURL: external_apis_config_1.dietPlanningServiceConfig.baseUrl,
            timeout: external_apis_config_1.dietPlanningServiceConfig.timeout,
            headers: {
                ...external_apis_config_1.dietPlanningServiceConfig.defaultHeaders
            }
        });
        this.circuitBreakerState = {
            state: 'CLOSED',
            failureCount: 0,
            lastFailureTime: 0,
            nextAttemptTime: 0
        };
        this.httpClient.interceptors.request.use((config) => {
            logger_1.logger.info('External API request initiated', {
                service: 'diet-planning-service',
                method: config.method?.toUpperCase() || 'UNKNOWN',
                url: config.url || 'UNKNOWN',
                baseURL: config.baseURL || 'UNKNOWN',
                timeout: config.timeout || 0,
                event: 'api-request-start'
            });
            return config;
        }, (error) => {
            logger_1.logger.error('External API request error', error, {
                service: 'diet-planning-service',
                event: 'api-request-error'
            });
            return Promise.reject(error);
        });
        this.httpClient.interceptors.response.use((response) => {
            logger_1.logger.info('External API request successful', {
                service: 'diet-planning-service',
                method: response.config.method?.toUpperCase() || 'UNKNOWN',
                url: response.config.url || 'UNKNOWN',
                status: response.status,
                event: 'api-request-success'
            });
            this.recordSuccess();
            return response;
        }, (error) => {
            logger_1.logger.error('External API request failed', error, {
                service: 'diet-planning-service',
                method: error.config?.method?.toUpperCase(),
                url: error.config?.url,
                status: error.response?.status,
                message: error.message,
                event: 'api-request-failure'
            });
            this.recordFailure();
            return Promise.reject(error);
        });
    }
    async createDietPlan(input) {
        try {
            const { error, value } = createDietPlanSchema.validate(input);
            if (error) {
                throw new Error(`Input validation failed: ${error.details[0]?.message || 'Validation failed'}`);
            }
            logger_1.logger.info('Creating diet plan for user', {
                service: 'diet-planning-service',
                userId: value.userId,
                goal: value.userProfile.goal,
                gender: value.userProfile.gender,
                event: 'create-diet-plan-start'
            });
            if (!this.canMakeRequest()) {
                logger_1.logger.warn('Circuit breaker is open, using fallback', {
                    service: 'diet-planning-service',
                    userId: value.userId,
                    circuitState: this.circuitBreakerState.state,
                    event: 'circuit-breaker-open'
                });
                return this.getFallbackDietPlan(value.userProfile);
            }
            const cacheKey = this.generateCacheKey('diet-plan', value.userId, JSON.stringify(value.userProfile));
            if (external_apis_config_1.dietPlanningServiceConfig.features.enableCaching) {
                const cachedPlan = await this.getCachedResponse(cacheKey);
                if (cachedPlan) {
                    logger_1.logger.info('Returning cached diet plan', {
                        service: 'diet-planning-service',
                        userId: value.userId,
                        cacheKey,
                        event: 'cache-hit'
                    });
                    return cachedPlan;
                }
            }
            let response;
            if (external_apis_config_1.dietPlanningServiceConfig.features.mockMode) {
                response = { data: this.getMockDietPlan(value.userProfile) };
                logger_1.logger.info('Using mock diet plan response', {
                    service: 'diet-planning-service',
                    userId: value.userId,
                    event: 'mock-response-used'
                });
            }
            else {
                const inputText = this.formatInputText(value.userProfile, value.dietPreferences);
                const requestBody = { input_text: inputText };
                const signature = this.generateHMACSignature(JSON.stringify(requestBody));
                response = await this.httpClient.post(external_apis_config_1.dietPlanningServiceConfig.endpoints.createDietPlan, requestBody, {
                    headers: {
                        'X-API-Key': external_apis_config_1.dietPlanningServiceConfig.apiKey,
                        'X-Signature': signature
                    }
                });
            }
            const { error: validationError, value: validatedResponse } = dietPlanResponseSchema.validate(response.data || response);
            if (validationError) {
                throw new Error(`Response validation failed: ${validationError.details[0]?.message || 'Validation failed'}`);
            }
            if (external_apis_config_1.dietPlanningServiceConfig.features.enableCaching) {
                await this.cacheResponse(cacheKey, validatedResponse, external_apis_config_1.externalApiCacheConfig.ttl.dietPlans);
            }
            logger_1.logger.info('Diet plan created successfully', {
                service: 'diet-planning-service',
                userId: value.userId,
                targetWeight: validatedResponse.target_weight,
                totalCalories: validatedResponse.macros['Total Calories'],
                mealPlanDays: validatedResponse.meal_plan.length,
                event: 'create-diet-plan-success'
            });
            return validatedResponse;
        }
        catch (error) {
            logger_1.logger.error('Failed to create diet plan', error, {
                service: 'diet-planning-service',
                userId: input.userId,
                event: 'create-diet-plan-error'
            });
            if (external_apis_config_1.dietPlanningServiceConfig.features.enableCircuitBreaker) {
                logger_1.logger.info('Returning fallback diet plan due to error', {
                    service: 'diet-planning-service',
                    userId: input.userId,
                    event: 'fallback-used'
                });
                return this.getFallbackDietPlan(input.userProfile);
            }
            throw error;
        }
    }
    canMakeRequest() {
        const now = Date.now();
        switch (this.circuitBreakerState.state) {
            case 'CLOSED':
                return true;
            case 'OPEN':
                if (now >= this.circuitBreakerState.nextAttemptTime) {
                    this.circuitBreakerState.state = 'HALF_OPEN';
                    logger_1.logger.info('Circuit breaker transitioning to HALF_OPEN', {
                        service: 'diet-planning-service',
                        event: 'circuit-breaker-half-open'
                    });
                    return true;
                }
                return false;
            case 'HALF_OPEN':
                return true;
            default:
                return false;
        }
    }
    recordSuccess() {
        if (this.circuitBreakerState.state === 'HALF_OPEN') {
            this.circuitBreakerState.state = 'CLOSED';
            this.circuitBreakerState.failureCount = 0;
            logger_1.logger.info('Circuit breaker reset to CLOSED', {
                service: 'diet-planning-service',
                event: 'circuit-breaker-closed'
            });
        }
    }
    recordFailure() {
        this.circuitBreakerState.failureCount++;
        this.circuitBreakerState.lastFailureTime = Date.now();
        if (this.circuitBreakerState.failureCount >= external_apis_config_1.dietPlanningServiceConfig.circuitBreaker.failureThreshold) {
            this.circuitBreakerState.state = 'OPEN';
            this.circuitBreakerState.nextAttemptTime =
                Date.now() + external_apis_config_1.dietPlanningServiceConfig.circuitBreaker.resetTimeout;
            logger_1.logger.warn('Circuit breaker opened due to failures', {
                service: 'diet-planning-service',
                failureCount: this.circuitBreakerState.failureCount,
                nextAttemptTime: this.circuitBreakerState.nextAttemptTime,
                event: 'circuit-breaker-open'
            });
        }
    }
    generateCacheKey(type, ...parts) {
        const prefix = external_apis_config_1.externalApiCacheConfig.keyPrefixes.dietPlans;
        const key = [type, ...parts].join(':');
        return `${prefix}${key}`;
    }
    async getCachedResponse(key) {
        try {
            const client = redis_1.redis.getClient();
            const cached = await client.get(key);
            return cached ? JSON.parse(cached) : null;
        }
        catch (error) {
            logger_1.logger.error('Cache retrieval error', error, {
                service: 'diet-planning-service',
                cacheKey: key,
                event: 'cache-error'
            });
            return null;
        }
    }
    async cacheResponse(key, data, ttlSeconds) {
        try {
            const client = redis_1.redis.getClient();
            await client.setEx(key, ttlSeconds, JSON.stringify(data));
            logger_1.logger.debug('Response cached successfully', {
                service: 'diet-planning-service',
                cacheKey: key,
                ttl: ttlSeconds,
                event: 'cache-set'
            });
        }
        catch (error) {
            logger_1.logger.error('Cache storage error', error, {
                service: 'diet-planning-service',
                cacheKey: key,
                event: 'cache-error'
            });
        }
    }
    generateHMACSignature(data) {
        const hmac = crypto_1.default.createHmac('sha256', external_apis_config_1.dietPlanningServiceConfig.hmacSecret);
        hmac.update(data);
        return hmac.digest('hex');
    }
    formatInputText(userProfile, dietPreferences) {
        const { goal, age, weightKg: currentWeight, targetWeightKg, heightCm, gender, activityLevel, allergies = [], healthConditions = [] } = userProfile;
        const heightM = heightCm / 100;
        const bmi = (currentWeight / (heightM * heightM)).toFixed(2);
        const activityDescription = this.formatActivityLevel(activityLevel);
        let cuisineText = '';
        if (dietPreferences?.cuisinePreferences) {
            const cuisines = Object.entries(dietPreferences.cuisinePreferences)
                .map(([cuisine, types]) => `${cuisine}: [${types.join(', ')}]`)
                .join(', ');
            cuisineText = `cuisine: {${cuisines}}`;
        }
        const allergiesText = allergies.length > 0 ? allergies.join(', ') : 'None';
        const healthConditionsText = healthConditions.length > 0 ? healthConditions.join(', ') : 'None';
        return `fitness goal: ${goal.replace('_', ' ')}, age: ${age}, current weight: ${currentWeight}kg, target weight: ${targetWeightKg || currentWeight}kg, BMI: ${bmi}, allergies: ${allergiesText}, health conditions: ${healthConditionsText}, gender: ${gender}, ${cuisineText}, activity level: ${activityDescription}`;
    }
    formatActivityLevel(activityLevel) {
        const activityLevels = {
            'sedentary': '0 - 2 hours a day',
            'lightly_active': '2 - 4 hours a day',
            'moderately_active': '4 - 6 hours a day',
            'very_active': '6 - 8 hours a day',
            'extremely_active': '8+ hours a day'
        };
        return activityLevels[activityLevel] || '0 - 2 hours a day';
    }
    getMockDietPlan(userProfile) {
        const mockPlan = { ...external_apis_config_1.mockApiResponses.dietPlan };
        if (userProfile.targetWeightKg) {
            mockPlan.target_weight = userProfile.targetWeightKg.toString();
        }
        let calorieAdjustment = 1;
        if (userProfile.goal === 'weight_loss') {
            calorieAdjustment = 0.8;
        }
        else if (userProfile.goal === 'weight_gain') {
            calorieAdjustment = 1.2;
        }
        if (userProfile.gender === 'Female') {
            calorieAdjustment *= 0.9;
        }
        const adjustedCalories = Math.round(parseInt(mockPlan.macros['Total Calories']) * calorieAdjustment);
        mockPlan.macros['Total Calories'] = adjustedCalories.toString();
        return mockPlan;
    }
    getFallbackDietPlan(userProfile) {
        logger_1.logger.info('Using fallback diet plan', {
            service: 'diet-planning-service',
            userProfile: {
                goal: userProfile.goal,
                gender: userProfile.gender
            },
            event: 'fallback-plan-used'
        });
        return this.getMockDietPlan(userProfile);
    }
}
exports.DietPlanningService = DietPlanningService;
exports.dietPlanningService = process.env['NODE_ENV'] === 'test'
    ? {}
    : new DietPlanningService();
//# sourceMappingURL=diet-planning.service.js.map