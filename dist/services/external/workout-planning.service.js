"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workoutPlanningService = exports.WorkoutPlanningService = void 0;
const axios_1 = __importDefault(require("axios"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const external_apis_config_1 = require("../../config/external-apis.config");
const createWorkoutPlanSchema = joi_1.default.object({
    userId: joi_1.default.string().required(),
    userProfile: joi_1.default.object({
        fitnessLevel: joi_1.default.string().valid('beginner', 'intermediate', 'advanced').required(),
        goal: joi_1.default.string().valid('weight_loss', 'weight_gain', 'muscle_building', 'maintenance').required(),
        age: joi_1.default.number().min(13).max(120).required(),
        heightCm: joi_1.default.number().min(50).max(300).required(),
        weightKg: joi_1.default.number().min(20).max(500).required(),
        activityLevel: joi_1.default.string().required(),
        healthConditions: joi_1.default.array().items(joi_1.default.string()).default([]),
        weeklyWorkoutDays: joi_1.default.number().min(1).max(7).default(3)
    }).required()
});
const workoutPlanResponseSchema = joi_1.default.object({
    planId: joi_1.default.string().required(),
    planName: joi_1.default.string().required(),
    weeklySchedule: joi_1.default.number().min(1).max(7).required(),
    difficultyLevel: joi_1.default.string().valid('beginner', 'intermediate', 'advanced').optional(),
    planDuration: joi_1.default.number().min(1).max(52).optional(),
    workoutDays: joi_1.default.array().items(joi_1.default.object({
        dayName: joi_1.default.string().required(),
        muscleGroup: joi_1.default.string().required(),
        estimatedDuration: joi_1.default.number().optional(),
        isRestDay: joi_1.default.boolean().default(false),
        exercises: joi_1.default.array().items(joi_1.default.object({
            exerciseId: joi_1.default.string().required(),
            name: joi_1.default.string().required(),
            description: joi_1.default.string().optional(),
            sets: joi_1.default.number().min(1).max(20).required(),
            reps: joi_1.default.string().required(),
            weight: joi_1.default.number().optional(),
            restTime: joi_1.default.number().min(15).max(600).default(60),
            notes: joi_1.default.string().optional(),
            muscleGroup: joi_1.default.string().required(),
            equipment: joi_1.default.string().optional(),
            difficulty: joi_1.default.string().valid('beginner', 'intermediate', 'advanced').optional(),
            videoUrl: joi_1.default.string().uri().optional(),
            imageUrl: joi_1.default.string().uri().optional()
        })).required()
    })).min(1).required()
});
class WorkoutPlanningService {
    httpClient;
    circuitBreakerState;
    constructor() {
        this.httpClient = axios_1.default.create({
            baseURL: external_apis_config_1.workoutPlanningServiceConfig.baseUrl,
            timeout: external_apis_config_1.workoutPlanningServiceConfig.timeout,
            headers: {
                ...external_apis_config_1.workoutPlanningServiceConfig.defaultHeaders,
                'Authorization': `Bearer ${external_apis_config_1.workoutPlanningServiceConfig.apiKey}`
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
                service: 'workout-planning-service',
                method: config.method?.toUpperCase() || 'UNKNOWN',
                url: config.url || 'UNKNOWN',
                baseURL: config.baseURL || 'UNKNOWN',
                timeout: config.timeout || 0,
                event: 'api-request-start'
            });
            return config;
        }, (error) => {
            logger_1.logger.error('External API request error', error, {
                service: 'workout-planning-service',
                event: 'api-request-error'
            });
            return Promise.reject(error);
        });
        this.httpClient.interceptors.response.use((response) => {
            logger_1.logger.info('External API request successful', {
                service: 'workout-planning-service',
                method: response.config.method?.toUpperCase() || 'UNKNOWN',
                url: response.config.url || 'UNKNOWN',
                status: response.status,
                responseTime: 0,
                event: 'api-request-success'
            });
            this.recordSuccess();
            return response;
        }, (error) => {
            logger_1.logger.error('External API request failed', error, {
                service: 'workout-planning-service',
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
    async createWorkoutPlan(input) {
        try {
            const { error, value } = createWorkoutPlanSchema.validate(input);
            if (error) {
                throw new Error(`Input validation failed: ${error.details[0]?.message || 'Validation failed'}`);
            }
            logger_1.logger.info('Creating workout plan for user', {
                service: 'workout-planning-service',
                userId: value.userId,
                fitnessLevel: value.userProfile.fitnessLevel,
                goal: value.userProfile.goal,
                event: 'create-workout-plan-start'
            });
            if (!this.canMakeRequest()) {
                logger_1.logger.warn('Circuit breaker is open, using fallback', {
                    service: 'workout-planning-service',
                    userId: value.userId,
                    circuitState: this.circuitBreakerState.state,
                    event: 'circuit-breaker-open'
                });
                return this.getFallbackWorkoutPlan(value.userProfile);
            }
            const cacheKey = this.generateCacheKey('workout-plan', value.userId, value.userProfile);
            if (external_apis_config_1.workoutPlanningServiceConfig.features.enableCaching) {
                const cachedPlan = await this.getCachedResponse(cacheKey);
                if (cachedPlan) {
                    logger_1.logger.info('Returning cached workout plan', {
                        service: 'workout-planning-service',
                        userId: value.userId,
                        cacheKey,
                        event: 'cache-hit'
                    });
                    return cachedPlan;
                }
            }
            let response;
            if (external_apis_config_1.workoutPlanningServiceConfig.features.mockMode) {
                response = this.getMockWorkoutPlan(value.userProfile);
                logger_1.logger.info('Using mock workout plan response', {
                    service: 'workout-planning-service',
                    userId: value.userId,
                    event: 'mock-response-used'
                });
            }
            else {
                response = await this.httpClient.post(external_apis_config_1.workoutPlanningServiceConfig.endpoints.createWorkoutPlan, {
                    userProfile: value.userProfile,
                    preferences: {
                        workoutDaysPerWeek: value.userProfile.weeklyWorkoutDays || 3
                    }
                });
            }
            const { error: validationError, value: validatedResponse } = workoutPlanResponseSchema.validate(response.data || response);
            if (validationError) {
                throw new Error(`Response validation failed: ${validationError.details[0]?.message || 'Validation failed'}`);
            }
            if (external_apis_config_1.workoutPlanningServiceConfig.features.enableCaching) {
                await this.cacheResponse(cacheKey, validatedResponse, external_apis_config_1.externalApiCacheConfig.ttl.workoutPlans);
            }
            logger_1.logger.info('Workout plan created successfully', {
                service: 'workout-planning-service',
                userId: value.userId,
                planId: validatedResponse.planId,
                planName: validatedResponse.planName,
                workoutDays: validatedResponse.workoutDays.length,
                event: 'create-workout-plan-success'
            });
            return validatedResponse;
        }
        catch (error) {
            logger_1.logger.error('Failed to create workout plan', error, {
                service: 'workout-planning-service',
                userId: input.userId,
                event: 'create-workout-plan-error'
            });
            if (external_apis_config_1.workoutPlanningServiceConfig.features.enableCircuitBreaker) {
                logger_1.logger.info('Returning fallback workout plan due to error', {
                    service: 'workout-planning-service',
                    userId: input.userId,
                    event: 'fallback-used'
                });
                return this.getFallbackWorkoutPlan(input.userProfile);
            }
            throw error;
        }
    }
    async getExerciseLibrary(filters) {
        try {
            logger_1.logger.info('Fetching exercise library', {
                service: 'workout-planning-service',
                filters,
                event: 'get-exercise-library-start'
            });
            if (!this.canMakeRequest()) {
                logger_1.logger.warn('Circuit breaker is open, using mock exercise library', {
                    service: 'workout-planning-service',
                    event: 'circuit-breaker-open'
                });
                return external_apis_config_1.mockApiResponses.exerciseLibrary;
            }
            const cacheKey = this.generateCacheKey('exercise-library', JSON.stringify(filters || {}));
            if (external_apis_config_1.workoutPlanningServiceConfig.features.enableCaching) {
                const cachedLibrary = await this.getCachedResponse(cacheKey);
                if (cachedLibrary) {
                    logger_1.logger.info('Returning cached exercise library', {
                        service: 'workout-planning-service',
                        cacheKey,
                        event: 'cache-hit'
                    });
                    return cachedLibrary;
                }
            }
            if (external_apis_config_1.workoutPlanningServiceConfig.features.mockMode) {
                const mockLibrary = external_apis_config_1.mockApiResponses.exerciseLibrary;
                if (external_apis_config_1.workoutPlanningServiceConfig.features.enableCaching) {
                    await this.cacheResponse(cacheKey, mockLibrary, external_apis_config_1.externalApiCacheConfig.ttl.exercises);
                }
                logger_1.logger.info('Returning mock exercise library', {
                    service: 'workout-planning-service',
                    exerciseCount: mockLibrary.length,
                    event: 'mock-response-used'
                });
                return mockLibrary;
            }
            const response = await this.httpClient.get(external_apis_config_1.workoutPlanningServiceConfig.endpoints.getExerciseLibrary, { params: filters });
            if (external_apis_config_1.workoutPlanningServiceConfig.features.enableCaching) {
                await this.cacheResponse(cacheKey, response.data, external_apis_config_1.externalApiCacheConfig.ttl.exercises);
            }
            logger_1.logger.info('Exercise library fetched successfully', {
                service: 'workout-planning-service',
                exerciseCount: response.data?.length || 0,
                event: 'get-exercise-library-success'
            });
            return response.data;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch exercise library', error, {
                service: 'workout-planning-service',
                event: 'get-exercise-library-error'
            });
            return external_apis_config_1.mockApiResponses.exerciseLibrary;
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
                        service: 'workout-planning-service',
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
                service: 'workout-planning-service',
                event: 'circuit-breaker-closed'
            });
        }
    }
    recordFailure() {
        this.circuitBreakerState.failureCount++;
        this.circuitBreakerState.lastFailureTime = Date.now();
        if (this.circuitBreakerState.failureCount >= external_apis_config_1.workoutPlanningServiceConfig.circuitBreaker.failureThreshold) {
            this.circuitBreakerState.state = 'OPEN';
            this.circuitBreakerState.nextAttemptTime =
                Date.now() + external_apis_config_1.workoutPlanningServiceConfig.circuitBreaker.resetTimeout;
            logger_1.logger.warn('Circuit breaker opened due to failures', {
                service: 'workout-planning-service',
                failureCount: this.circuitBreakerState.failureCount,
                nextAttemptTime: this.circuitBreakerState.nextAttemptTime,
                event: 'circuit-breaker-open'
            });
        }
    }
    generateCacheKey(type, ...parts) {
        const prefix = external_apis_config_1.externalApiCacheConfig.keyPrefixes.workoutPlans;
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
                service: 'workout-planning-service',
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
                service: 'workout-planning-service',
                cacheKey: key,
                ttl: ttlSeconds,
                event: 'cache-set'
            });
        }
        catch (error) {
            logger_1.logger.error('Cache storage error', error, {
                service: 'workout-planning-service',
                cacheKey: key,
                event: 'cache-error'
            });
        }
    }
    getMockWorkoutPlan(userProfile) {
        const mockPlan = { ...external_apis_config_1.mockApiResponses.workoutPlan };
        mockPlan.difficultyLevel = userProfile.fitnessLevel;
        mockPlan.planName = `${mockPlan.planName} - ${userProfile.fitnessLevel}`;
        if (userProfile.goal === 'weight_loss') {
            mockPlan.weeklySchedule = Math.max(4, userProfile.weeklyWorkoutDays || 4);
        }
        else if (userProfile.goal === 'muscle_building') {
            mockPlan.weeklySchedule = Math.max(3, userProfile.weeklyWorkoutDays || 3);
        }
        return mockPlan;
    }
    getFallbackWorkoutPlan(userProfile) {
        logger_1.logger.info('Using fallback workout plan', {
            service: 'workout-planning-service',
            userProfile: {
                fitnessLevel: userProfile.fitnessLevel,
                goal: userProfile.goal
            },
            event: 'fallback-plan-used'
        });
        return this.getMockWorkoutPlan(userProfile);
    }
}
exports.WorkoutPlanningService = WorkoutPlanningService;
exports.workoutPlanningService = process.env['NODE_ENV'] === 'test'
    ? {}
    : new WorkoutPlanningService();
//# sourceMappingURL=workout-planning.service.js.map