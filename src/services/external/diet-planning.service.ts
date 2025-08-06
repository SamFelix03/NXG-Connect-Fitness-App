import axios, { AxiosInstance } from 'axios';
import Joi from 'joi';
import crypto from 'crypto';
import { logger } from '../../utils/logger';
import { redis } from '../../utils/redis';
import { 
  dietPlanningServiceConfig, 
  externalApiCacheConfig, 
  mockApiResponses 
} from '../../config/external-apis.config';

/**
 * External Diet Planning Service
 * 
 * This service integrates with external diet planning APIs to:
 * 1. Create personalized diet plans based on user profiles and dietary preferences
 * 2. Implement HMAC authentication for secure API access
 * 3. Cache responses for performance
 * 4. Implement circuit breaker pattern for resilience
 */

// Input validation schemas
const createDietPlanSchema = Joi.object({
  userId: Joi.string().required(),
  userProfile: Joi.object({
    goal: Joi.string().valid('weight_loss', 'weight_gain', 'muscle_building', 'maintenance').required(),
    age: Joi.number().min(13).max(120).required(),
    heightCm: Joi.number().min(50).max(300).required(),
    weightKg: Joi.number().min(20).max(500).required(),
    targetWeightKg: Joi.number().min(20).max(500).optional(),
    gender: Joi.string().valid('Male', 'Female', 'Other').required(),
    activityLevel: Joi.string().required(),
    allergies: Joi.array().items(Joi.string()).default([]),
    healthConditions: Joi.array().items(Joi.string()).default([])
  }).required(),
  dietPreferences: Joi.object({
    cuisinePreferences: Joi.object().pattern(
      Joi.string(), 
      Joi.array().items(Joi.string())
    ).optional()
  }).optional()
});

// Response validation schema
const dietPlanResponseSchema = Joi.object({
  target_weight: Joi.string().required(),
  macros: Joi.object({
    'Total Calories': Joi.string().required(),
    'Total Carbs': Joi.string().required(),
    'Total Protein': Joi.string().required(),
    'Total Fat': Joi.string().required(),
    'Total Fiber': Joi.string().required()
  }).required(),
  meal_plan: Joi.array().items(
    Joi.object({
      day: Joi.number().min(1).max(7).required(),
      meals: Joi.object().pattern(
        Joi.string().valid('Breakfast', 'Snack 1', 'Lunch', 'Snack 2', 'Dinner'),
        Joi.string().required()
      ).required(),
      calories: Joi.object().pattern(
        Joi.string().valid('Breakfast', 'Snack 1', 'Lunch', 'Snack 2', 'Dinner'),
        Joi.number().min(0).max(2000).required()
      ).required(),
      short_names: Joi.object().pattern(
        Joi.string().valid('Breakfast', 'Snack 1', 'Lunch', 'Snack 2', 'Dinner'),
        Joi.string().required()
      ).required()
    })
  ).min(1).max(7).required()
});

// Circuit breaker state
interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export class DietPlanningService {
  private readonly httpClient: AxiosInstance;
  private circuitBreakerState: CircuitBreakerState;

  constructor() {
    // Initialize HTTP client with configuration
    this.httpClient = axios.create({
      baseURL: dietPlanningServiceConfig.baseUrl,
      timeout: dietPlanningServiceConfig.timeout,
      headers: {
        ...dietPlanningServiceConfig.defaultHeaders
      }
    });

    // Initialize circuit breaker
    this.circuitBreakerState = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0
    };

    // Setup request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.info('External API request initiated', {
          service: 'diet-planning-service',
          method: config.method?.toUpperCase() || 'UNKNOWN',
          url: config.url || 'UNKNOWN',
          baseURL: config.baseURL || 'UNKNOWN',
          timeout: config.timeout || 0,
          event: 'api-request-start'
        });
        return config;
      },
      (error) => {
        logger.error('External API request error', error, {
          service: 'diet-planning-service',
          event: 'api-request-error'
        });
        return Promise.reject(error);
      }
    );

    // Setup response interceptor for logging and error handling
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.info('External API request successful', {
          service: 'diet-planning-service',
          method: response.config.method?.toUpperCase() || 'UNKNOWN',
          url: response.config.url || 'UNKNOWN',
          status: response.status,
          event: 'api-request-success'
        });
        this.recordSuccess();
        return response;
      },
      (error) => {
        logger.error('External API request failed', error, {
          service: 'diet-planning-service',
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
          event: 'api-request-failure'
        });
        this.recordFailure();
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a personalized diet plan for a user
   */
  async createDietPlan(input: {
    userId: string;
    userProfile: {
      goal: string;
      age: number;
      heightCm: number;
      weightKg: number;
      targetWeightKg?: number;
      gender: string;
      activityLevel: string;
      allergies?: string[];
      healthConditions?: string[];
    };
    dietPreferences?: {
      cuisinePreferences?: Record<string, string[]>;
    };
  }): Promise<any> {
    try {
      // Validate input
      const { error, value } = createDietPlanSchema.validate(input);
      if (error) {
        throw new Error(`Input validation failed: ${error.details[0]?.message || 'Validation failed'}`);
      }

      logger.info('Creating diet plan for user', {
        service: 'diet-planning-service',
        userId: value.userId,
        goal: value.userProfile.goal,
        gender: value.userProfile.gender,
        event: 'create-diet-plan-start'
      });

      // Check circuit breaker
      if (!this.canMakeRequest()) {
        logger.warn('Circuit breaker is open, using fallback', {
          service: 'diet-planning-service',
          userId: value.userId,
          circuitState: this.circuitBreakerState.state,
          event: 'circuit-breaker-open'
        });
        return this.getFallbackDietPlan(value.userProfile);
      }

      // Check cache first
      const cacheKey = this.generateCacheKey('diet-plan', value.userId, JSON.stringify(value.userProfile));
      
      if (dietPlanningServiceConfig.features.enableCaching) {
        const cachedPlan = await this.getCachedResponse(cacheKey);
        if (cachedPlan) {
          logger.info('Returning cached diet plan', {
            service: 'diet-planning-service',
            userId: value.userId,
            cacheKey,
            event: 'cache-hit'
          });
          return cachedPlan;
        }
      }

      // Make external API call or use mock
      let response: any;
      
      if (dietPlanningServiceConfig.features.mockMode) {
        response = { data: this.getMockDietPlan(value.userProfile) };
        logger.info('Using mock diet plan response', {
          service: 'diet-planning-service',
          userId: value.userId,
          event: 'mock-response-used'
        });
      } else {
        // Prepare input text for external API
        const inputText = this.formatInputText(value.userProfile, value.dietPreferences);
        
        // Create HMAC signature
        const requestBody = { input_text: inputText };
        const signature = this.generateHMACSignature(JSON.stringify(requestBody));
        
        response = await this.httpClient.post(
          dietPlanningServiceConfig.endpoints.createDietPlan,
          requestBody,
          {
            headers: {
              'X-API-Key': dietPlanningServiceConfig.apiKey,
              'X-Signature': signature
            }
          }
        );
      }

      // Validate response
      const { error: validationError, value: validatedResponse } = dietPlanResponseSchema.validate(response.data || response);
      if (validationError) {
        throw new Error(`Response validation failed: ${validationError.details[0]?.message || 'Validation failed'}`);
      }

      // Cache the response
      if (dietPlanningServiceConfig.features.enableCaching) {
        await this.cacheResponse(cacheKey, validatedResponse, externalApiCacheConfig.ttl.dietPlans);
      }

      logger.info('Diet plan created successfully', {
        service: 'diet-planning-service',
        userId: value.userId,
        targetWeight: validatedResponse.target_weight,
        totalCalories: validatedResponse.macros['Total Calories'],
        mealPlanDays: validatedResponse.meal_plan.length,
        event: 'create-diet-plan-success'
      });

      return validatedResponse;

    } catch (error) {
      logger.error('Failed to create diet plan', error as Error, {
        service: 'diet-planning-service',
        userId: input.userId,
        event: 'create-diet-plan-error'
      });

      // Return fallback if available
      if (dietPlanningServiceConfig.features.enableCircuitBreaker) {
        logger.info('Returning fallback diet plan due to error', {
          service: 'diet-planning-service',
          userId: input.userId,
          event: 'fallback-used'
        });
        return this.getFallbackDietPlan(input.userProfile);
      }

      throw error;
    }
  }

  /**
   * Circuit breaker implementation
   */
  private canMakeRequest(): boolean {
    const now = Date.now();

    switch (this.circuitBreakerState.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        if (now >= this.circuitBreakerState.nextAttemptTime) {
          this.circuitBreakerState.state = 'HALF_OPEN';
          logger.info('Circuit breaker transitioning to HALF_OPEN', {
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

  private recordSuccess(): void {
    if (this.circuitBreakerState.state === 'HALF_OPEN') {
      this.circuitBreakerState.state = 'CLOSED';
      this.circuitBreakerState.failureCount = 0;
      logger.info('Circuit breaker reset to CLOSED', {
        service: 'diet-planning-service',
        event: 'circuit-breaker-closed'
      });
    }
  }

  private recordFailure(): void {
    this.circuitBreakerState.failureCount++;
    this.circuitBreakerState.lastFailureTime = Date.now();

    if (this.circuitBreakerState.failureCount >= dietPlanningServiceConfig.circuitBreaker.failureThreshold) {
      this.circuitBreakerState.state = 'OPEN';
      this.circuitBreakerState.nextAttemptTime = 
        Date.now() + dietPlanningServiceConfig.circuitBreaker.resetTimeout;
      
      logger.warn('Circuit breaker opened due to failures', {
        service: 'diet-planning-service',
        failureCount: this.circuitBreakerState.failureCount,
        nextAttemptTime: this.circuitBreakerState.nextAttemptTime,
        event: 'circuit-breaker-open'
      });
    }
  }

  /**
   * Cache management methods
   */
  private generateCacheKey(type: string, ...parts: string[]): string {
    const prefix = externalApiCacheConfig.keyPrefixes.dietPlans;
    const key = [type, ...parts].join(':');
    return `${prefix}${key}`;
  }

  private async getCachedResponse(key: string): Promise<any | null> {
    try {
      const client = redis.getClient();
      const cached = await client.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Cache retrieval error', error as Error, {
        service: 'diet-planning-service',
        cacheKey: key,
        event: 'cache-error'
      });
      return null;
    }
  }

  private async cacheResponse(key: string, data: any, ttlSeconds: number): Promise<void> {
    try {
      const client = redis.getClient();
      await client.setEx(key, ttlSeconds, JSON.stringify(data));
      logger.debug('Response cached successfully', {
        service: 'diet-planning-service',
        cacheKey: key,
        ttl: ttlSeconds,
        event: 'cache-set'
      });
    } catch (error) {
      logger.error('Cache storage error', error as Error, {
        service: 'diet-planning-service',
        cacheKey: key,
        event: 'cache-error'
      });
    }
  }

  /**
   * HMAC signature generation for authentication
   */
  private generateHMACSignature(data: string): string {
    const hmac = crypto.createHmac('sha256', dietPlanningServiceConfig.hmacSecret);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Format input text for external API
   */
  private formatInputText(userProfile: any, dietPreferences?: any): string {
    const {
      goal,
      age,
      weightKg: currentWeight,
      targetWeightKg,
      heightCm,
      gender,
      activityLevel,
      allergies = [],
      healthConditions = []
    } = userProfile;

    // Calculate BMI
    const heightM = heightCm / 100;
    const bmi = (currentWeight / (heightM * heightM)).toFixed(2);

    // Format activity level
    const activityDescription = this.formatActivityLevel(activityLevel);

    // Format cuisine preferences
    let cuisineText = '';
    if (dietPreferences?.cuisinePreferences) {
      const cuisines = Object.entries(dietPreferences.cuisinePreferences)
        .map(([cuisine, types]) => `${cuisine}: [${(types as string[]).join(', ')}]`)
        .join(', ');
      cuisineText = `cuisine: {${cuisines}}`;
    }

    // Format allergies and health conditions
    const allergiesText = allergies.length > 0 ? allergies.join(', ') : 'None';
    const healthConditionsText = healthConditions.length > 0 ? healthConditions.join(', ') : 'None';

    return `fitness goal: ${goal.replace('_', ' ')}, age: ${age}, current weight: ${currentWeight}kg, target weight: ${targetWeightKg || currentWeight}kg, BMI: ${bmi}, allergies: ${allergiesText}, health conditions: ${healthConditionsText}, gender: ${gender}, ${cuisineText}, activity level: ${activityDescription}`;
  }

  private formatActivityLevel(activityLevel: string): string {
    // Convert activity level to descriptive text
    const activityLevels: Record<string, string> = {
      'sedentary': '0 - 2 hours a day',
      'lightly_active': '2 - 4 hours a day',
      'moderately_active': '4 - 6 hours a day',
      'very_active': '6 - 8 hours a day',
      'extremely_active': '8+ hours a day'
    };
    
    return activityLevels[activityLevel] || '0 - 2 hours a day';
  }

  /**
   * Fallback and mock methods
   */
  private getMockDietPlan(userProfile: any): any {
    // Customize mock plan based on user profile
    const mockPlan = { ...mockApiResponses.dietPlan };
    
    // Adjust target weight based on goal
    if (userProfile.targetWeightKg) {
      mockPlan.target_weight = userProfile.targetWeightKg.toString();
    }
    
    // Adjust calories based on goal and gender
    let calorieAdjustment = 1;
    if (userProfile.goal === 'weight_loss') {
      calorieAdjustment = 0.8;
    } else if (userProfile.goal === 'weight_gain') {
      calorieAdjustment = 1.2;
    }
    
    if (userProfile.gender === 'Female') {
      calorieAdjustment *= 0.9;
    }
    
    const adjustedCalories = Math.round(parseInt(mockPlan.macros['Total Calories']) * calorieAdjustment);
    mockPlan.macros['Total Calories'] = adjustedCalories.toString();

    return mockPlan;
  }

  private getFallbackDietPlan(userProfile: any): any {
    logger.info('Using fallback diet plan', {
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

// Export singleton instance (only if not in test environment)
export const dietPlanningService = process.env['NODE_ENV'] === 'test' 
  ? {} as DietPlanningService 
  : new DietPlanningService();