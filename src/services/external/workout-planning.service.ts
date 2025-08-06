import axios, { AxiosInstance } from 'axios';
import Joi from 'joi';
import { logger } from '../../utils/logger';
import { redis } from '../../utils/redis';
import { 
  workoutPlanningServiceConfig, 
  externalApiCacheConfig, 
  mockApiResponses 
} from '../../config/external-apis.config';

/**
 * External Workout Planning Service
 * 
 * This service integrates with external workout planning APIs to:
 * 1. Create personalized workout plans based on user profiles
 * 2. Fetch exercise libraries and templates
 * 3. Cache responses for performance
 * 4. Implement circuit breaker pattern for resilience
 */

// Input validation schemas
const createWorkoutPlanSchema = Joi.object({
  userId: Joi.string().required(),
  userProfile: Joi.object({
    fitnessLevel: Joi.string().valid('beginner', 'intermediate', 'advanced').required(),
    goal: Joi.string().valid('weight_loss', 'weight_gain', 'muscle_building', 'maintenance').required(),
    age: Joi.number().min(13).max(120).required(),
    heightCm: Joi.number().min(50).max(300).required(),
    weightKg: Joi.number().min(20).max(500).required(),
    activityLevel: Joi.string().required(),
    healthConditions: Joi.array().items(Joi.string()).default([]),
    weeklyWorkoutDays: Joi.number().min(1).max(7).default(3)
  }).required()
});

// Response validation schema
const workoutPlanResponseSchema = Joi.object({
  planId: Joi.string().required(),
  planName: Joi.string().required(),
  weeklySchedule: Joi.number().min(1).max(7).required(),
  difficultyLevel: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
  planDuration: Joi.number().min(1).max(52).optional(),
  workoutDays: Joi.array().items(
    Joi.object({
      dayName: Joi.string().required(),
      muscleGroup: Joi.string().required(),
      estimatedDuration: Joi.number().optional(),
      isRestDay: Joi.boolean().default(false),
      exercises: Joi.array().items(
        Joi.object({
          exerciseId: Joi.string().required(),
          name: Joi.string().required(),
          description: Joi.string().optional(),
          sets: Joi.number().min(1).max(20).required(),
          reps: Joi.string().required(),
          weight: Joi.number().optional(),
          restTime: Joi.number().min(15).max(600).default(60),
          notes: Joi.string().optional(),
          muscleGroup: Joi.string().required(),
          equipment: Joi.string().optional(),
          difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
          videoUrl: Joi.string().uri().optional(),
          imageUrl: Joi.string().uri().optional()
        })
      ).required()
    })
  ).min(1).required()
});

// Circuit breaker state
interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export class WorkoutPlanningService {
  private readonly httpClient: AxiosInstance;
  private circuitBreakerState: CircuitBreakerState;

  constructor() {
    // Initialize HTTP client with configuration
    this.httpClient = axios.create({
      baseURL: workoutPlanningServiceConfig.baseUrl,
      timeout: workoutPlanningServiceConfig.timeout,
      headers: {
        ...workoutPlanningServiceConfig.defaultHeaders,
        'Authorization': `Bearer ${workoutPlanningServiceConfig.apiKey}`
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
          service: 'workout-planning-service',
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
          service: 'workout-planning-service',
          event: 'api-request-error'
        });
        return Promise.reject(error);
      }
    );

    // Setup response interceptor for logging and error handling
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.info('External API request successful', {
          service: 'workout-planning-service',
          method: response.config.method?.toUpperCase() || 'UNKNOWN',
          url: response.config.url || 'UNKNOWN',
          status: response.status,
          responseTime: 0, // Remove metadata access that doesn't exist
          event: 'api-request-success'
        });
        this.recordSuccess();
        return response;
      },
      (error) => {
        logger.error('External API request failed', error, {
          service: 'workout-planning-service',
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
   * Create a personalized workout plan for a user
   */
  async createWorkoutPlan(input: {
    userId: string;
    userProfile: {
      fitnessLevel: string;
      goal: string;
      age: number;
      heightCm: number;
      weightKg: number;
      activityLevel: string;
      healthConditions?: string[];
      weeklyWorkoutDays?: number;
    };
  }): Promise<any> {
    try {
      // Validate input
      const { error, value } = createWorkoutPlanSchema.validate(input);
      if (error) {
        throw new Error(`Input validation failed: ${error.details[0]?.message || 'Validation failed'}`);
      }

      logger.info('Creating workout plan for user', {
        service: 'workout-planning-service',
        userId: value.userId,
        fitnessLevel: value.userProfile.fitnessLevel,
        goal: value.userProfile.goal,
        event: 'create-workout-plan-start'
      });

      // Check circuit breaker
      if (!this.canMakeRequest()) {
        logger.warn('Circuit breaker is open, using fallback', {
          service: 'workout-planning-service',
          userId: value.userId,
          circuitState: this.circuitBreakerState.state,
          event: 'circuit-breaker-open'
        });
        return this.getFallbackWorkoutPlan(value.userProfile);
      }

      // Check cache first
      const cacheKey = this.generateCacheKey('workout-plan', value.userId, value.userProfile);
      
      if (workoutPlanningServiceConfig.features.enableCaching) {
        const cachedPlan = await this.getCachedResponse(cacheKey);
        if (cachedPlan) {
          logger.info('Returning cached workout plan', {
            service: 'workout-planning-service',
            userId: value.userId,
            cacheKey,
            event: 'cache-hit'
          });
          return cachedPlan;
        }
      }

      // Make external API call or use mock
      let response: any;
      
      if (workoutPlanningServiceConfig.features.mockMode) {
        response = this.getMockWorkoutPlan(value.userProfile);
        logger.info('Using mock workout plan response', {
          service: 'workout-planning-service',
          userId: value.userId,
          event: 'mock-response-used'
        });
      } else {
        response = await this.httpClient.post(
          workoutPlanningServiceConfig.endpoints.createWorkoutPlan,
          {
            userProfile: value.userProfile,
            preferences: {
              workoutDaysPerWeek: value.userProfile.weeklyWorkoutDays || 3
            }
          }
        );
      }

      // Validate response
      const { error: validationError, value: validatedResponse } = workoutPlanResponseSchema.validate(response.data || response);
      if (validationError) {
        throw new Error(`Response validation failed: ${validationError.details[0]?.message || 'Validation failed'}`);
      }

      // Cache the response
      if (workoutPlanningServiceConfig.features.enableCaching) {
        await this.cacheResponse(cacheKey, validatedResponse, externalApiCacheConfig.ttl.workoutPlans);
      }

      logger.info('Workout plan created successfully', {
        service: 'workout-planning-service',
        userId: value.userId,
        planId: validatedResponse.planId,
        planName: validatedResponse.planName,
        workoutDays: validatedResponse.workoutDays.length,
        event: 'create-workout-plan-success'
      });

      return validatedResponse;

    } catch (error) {
      logger.error('Failed to create workout plan', error as Error, {
        service: 'workout-planning-service',
        userId: input.userId,
        event: 'create-workout-plan-error'
      });

      // Return fallback if available
      if (workoutPlanningServiceConfig.features.enableCircuitBreaker) {
        logger.info('Returning fallback workout plan due to error', {
          service: 'workout-planning-service',
          userId: input.userId,
          event: 'fallback-used'
        });
        return this.getFallbackWorkoutPlan(input.userProfile);
      }

      throw error;
    }
  }

  /**
   * Fetch exercise library from external service
   */
  async getExerciseLibrary(filters?: {
    muscleGroup?: string;
    equipment?: string;
    difficulty?: string;
  }): Promise<any[]> {
    try {
      logger.info('Fetching exercise library', {
        service: 'workout-planning-service',
        filters,
        event: 'get-exercise-library-start'
      });

      // Check circuit breaker
      if (!this.canMakeRequest()) {
        logger.warn('Circuit breaker is open, using mock exercise library', {
          service: 'workout-planning-service',
          event: 'circuit-breaker-open'
        });
        return mockApiResponses.exerciseLibrary;
      }

      // Check cache
      const cacheKey = this.generateCacheKey('exercise-library', JSON.stringify(filters || {}));
      
      if (workoutPlanningServiceConfig.features.enableCaching) {
        const cachedLibrary = await this.getCachedResponse(cacheKey);
        if (cachedLibrary) {
          logger.info('Returning cached exercise library', {
            service: 'workout-planning-service',
            cacheKey,
            event: 'cache-hit'
          });
          return cachedLibrary;
        }
      }

      // Return mock data if in mock mode
      if (workoutPlanningServiceConfig.features.mockMode) {
        const mockLibrary = mockApiResponses.exerciseLibrary;
        
        // Cache mock response
        if (workoutPlanningServiceConfig.features.enableCaching) {
          await this.cacheResponse(cacheKey, mockLibrary, externalApiCacheConfig.ttl.exercises);
        }
        
        logger.info('Returning mock exercise library', {
          service: 'workout-planning-service',
          exerciseCount: mockLibrary.length,
          event: 'mock-response-used'
        });
        
        return mockLibrary;
      }

      // Make actual API call (would be implemented with real service)
      const response = await this.httpClient.get(
        workoutPlanningServiceConfig.endpoints.getExerciseLibrary,
        { params: filters }
      );

      // Cache the response
      if (workoutPlanningServiceConfig.features.enableCaching) {
        await this.cacheResponse(cacheKey, response.data, externalApiCacheConfig.ttl.exercises);
      }

      logger.info('Exercise library fetched successfully', {
        service: 'workout-planning-service',
        exerciseCount: response.data?.length || 0,
        event: 'get-exercise-library-success'
      });

      return response.data;

    } catch (error) {
      logger.error('Failed to fetch exercise library', error as Error, {
        service: 'workout-planning-service',
        event: 'get-exercise-library-error'
      });

      // Return mock data as fallback
      return mockApiResponses.exerciseLibrary;
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

  private recordSuccess(): void {
    if (this.circuitBreakerState.state === 'HALF_OPEN') {
      this.circuitBreakerState.state = 'CLOSED';
      this.circuitBreakerState.failureCount = 0;
      logger.info('Circuit breaker reset to CLOSED', {
        service: 'workout-planning-service',
        event: 'circuit-breaker-closed'
      });
    }
  }

  private recordFailure(): void {
    this.circuitBreakerState.failureCount++;
    this.circuitBreakerState.lastFailureTime = Date.now();

    if (this.circuitBreakerState.failureCount >= workoutPlanningServiceConfig.circuitBreaker.failureThreshold) {
      this.circuitBreakerState.state = 'OPEN';
      this.circuitBreakerState.nextAttemptTime = 
        Date.now() + workoutPlanningServiceConfig.circuitBreaker.resetTimeout;
      
      logger.warn('Circuit breaker opened due to failures', {
        service: 'workout-planning-service',
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
    const prefix = externalApiCacheConfig.keyPrefixes.workoutPlans;
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
        service: 'workout-planning-service',
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
        service: 'workout-planning-service',
        cacheKey: key,
        ttl: ttlSeconds,
        event: 'cache-set'
      });
    } catch (error) {
      logger.error('Cache storage error', error as Error, {
        service: 'workout-planning-service',
        cacheKey: key,
        event: 'cache-error'
      });
    }
  }

  /**
   * Fallback and mock methods
   */
  private getMockWorkoutPlan(userProfile: any): any {
    // Customize mock plan based on user profile
    const mockPlan = { ...mockApiResponses.workoutPlan };
    
    // Generate unique plan ID to avoid duplicate key errors
    mockPlan.planId = `mock-plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Adjust difficulty based on fitness level
    mockPlan.difficultyLevel = userProfile.fitnessLevel;
    mockPlan.planName = `${mockPlan.planName} - ${userProfile.fitnessLevel}`;
    
    // Adjust workout days based on goal
    if (userProfile.goal === 'weight_loss') {
      mockPlan.weeklySchedule = Math.max(4, userProfile.weeklyWorkoutDays || 4);
    } else if (userProfile.goal === 'muscle_building') {
      mockPlan.weeklySchedule = Math.max(3, userProfile.weeklyWorkoutDays || 3);
    }

    return mockPlan;
  }

  private getFallbackWorkoutPlan(userProfile: any): any {
    logger.info('Using fallback workout plan', {
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

// Export singleton instance (only if not in test environment)
export const workoutPlanningService = process.env['NODE_ENV'] === 'test' 
  ? {} as WorkoutPlanningService 
  : new WorkoutPlanningService();