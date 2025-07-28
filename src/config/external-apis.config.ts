import { logger } from '../utils/logger';

/**
 * External API Configuration
 * 
 * This file contains configuration for all external service integrations
 * including timeouts, retry logic, circuit breaker settings, and rate limits.
 */

// Environment variables with defaults
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value || defaultValue!;
};

// Workout Planning Service Configuration
export const workoutPlanningServiceConfig = {
  // Base URL for the external workout planning service
  baseUrl: getEnvVar('WORKOUT_PLANNING_SERVICE_URL', 'https://mock-workout-service.herokuapp.com/api/v1'),
  
  // API Authentication
  apiKey: getEnvVar('WORKOUT_PLANNING_SERVICE_API_KEY', 'mock-api-key-12345'),
  
  // Request Timeout Configuration
  timeout: parseInt(getEnvVar('WORKOUT_PLANNING_SERVICE_TIMEOUT', '30000'), 10), // 30 seconds
  
  // Retry Configuration
  retry: {
    attempts: parseInt(getEnvVar('WORKOUT_PLANNING_SERVICE_RETRY_ATTEMPTS', '3'), 10),
    delay: parseInt(getEnvVar('WORKOUT_PLANNING_SERVICE_RETRY_DELAY', '1000'), 10), // 1 second
    factor: parseFloat(getEnvVar('WORKOUT_PLANNING_SERVICE_RETRY_FACTOR', '2')), // exponential backoff
  },
  
  // Circuit Breaker Configuration
  circuitBreaker: {
    failureThreshold: parseInt(getEnvVar('WORKOUT_PLANNING_CIRCUIT_BREAKER_THRESHOLD', '5'), 10),
    timeout: parseInt(getEnvVar('WORKOUT_PLANNING_CIRCUIT_BREAKER_TIMEOUT', '60000'), 10), // 1 minute
    resetTimeout: parseInt(getEnvVar('WORKOUT_PLANNING_CIRCUIT_BREAKER_RESET', '120000'), 10), // 2 minutes
  },
  
  // Rate Limiting Configuration
  rateLimit: {
    requestsPerMinute: parseInt(getEnvVar('WORKOUT_PLANNING_RATE_LIMIT_RPM', '60'), 10),
    requestsPerHour: parseInt(getEnvVar('WORKOUT_PLANNING_RATE_LIMIT_RPH', '1000'), 10),
  },
  
  // API Endpoints
  endpoints: {
    createWorkoutPlan: '/workout-plans',
    getWorkoutPlan: '/workout-plans/:planId',
    updateWorkoutPlan: '/workout-plans/:planId',
    getExerciseLibrary: '/exercises',
    getWorkoutTemplates: '/templates',
  },
  
  // Request Headers
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'NXG-Connect-Fitness/1.0.0',
  },
  
  // Feature Flags
  features: {
    enableCaching: getEnvVar('WORKOUT_PLANNING_ENABLE_CACHE', 'true') === 'true',
    enableCircuitBreaker: getEnvVar('WORKOUT_PLANNING_ENABLE_CIRCUIT_BREAKER', 'true') === 'true',
    enableRetries: getEnvVar('WORKOUT_PLANNING_ENABLE_RETRIES', 'true') === 'true',
    mockMode: getEnvVar('WORKOUT_PLANNING_MOCK_MODE', 'true') === 'true', // Use mock responses for development
  }
};

// General External API Configuration
export const externalApisConfig = {
  // Global timeout for all external API calls
  globalTimeout: parseInt(getEnvVar('EXTERNAL_API_GLOBAL_TIMEOUT', '30000'), 10),
  
  // Global retry settings
  globalRetry: {
    attempts: parseInt(getEnvVar('EXTERNAL_API_GLOBAL_RETRY_ATTEMPTS', '3'), 10),
    delay: parseInt(getEnvVar('EXTERNAL_API_GLOBAL_RETRY_DELAY', '1000'), 10),
  },
  
  // Common headers for all external API requests
  commonHeaders: {
    'User-Agent': 'NXG-Connect-Fitness/1.0.0',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  
  // Environment-specific settings
  environment: {
    isDevelopment: process.env['NODE_ENV'] === 'development',
    isProduction: process.env['NODE_ENV'] === 'production',
    isTest: process.env['NODE_ENV'] === 'test',
  }
};

// Cache Configuration for External API Responses
export const externalApiCacheConfig = {
  // Redis key prefixes for different types of cached data
  keyPrefixes: {
    workoutPlans: 'cache:workout-plans:',
    exercises: 'cache:exercises:',
    templates: 'cache:templates:',
  },
  
  // Cache TTL (Time To Live) settings in seconds
  ttl: {
    workoutPlans: parseInt(getEnvVar('CACHE_TTL_WORKOUT_PLANS', '86400'), 10), // 24 hours
    exercises: parseInt(getEnvVar('CACHE_TTL_EXERCISES', '604800'), 10), // 7 days
    templates: parseInt(getEnvVar('CACHE_TTL_TEMPLATES', '604800'), 10), // 7 days
    default: parseInt(getEnvVar('CACHE_TTL_DEFAULT', '3600'), 10), // 1 hour
  },
  
  // Cache refresh settings
  refresh: {
    staleWhileRevalidate: parseInt(getEnvVar('CACHE_STALE_WHILE_REVALIDATE', '300'), 10), // 5 minutes
    refreshBuffer: parseInt(getEnvVar('CACHE_REFRESH_BUFFER', '3600'), 10), // 1 hour before expiry
  }
};

// Mock API Responses for Development
export const mockApiResponses = {
  workoutPlan: {
    planId: 'mock-plan-12345',
    planName: 'Push Pull Legs - Beginner',
    weeklySchedule: 3,
    difficultyLevel: 'beginner',
    planDuration: 8,
    workoutDays: [
      {
        dayName: 'Day 1 - Push',
        muscleGroup: 'Push',
        estimatedDuration: 60,
        isRestDay: false,
        exercises: [
          {
            exerciseId: 'ex-001',
            name: 'Bench Press',
            description: 'Chest compound movement',
            sets: 3,
            reps: '8-12',
            restTime: 90,
            muscleGroup: 'Chest',
            equipment: 'Barbell',
            difficulty: 'beginner'
          },
          {
            exerciseId: 'ex-002',
            name: 'Overhead Press',
            description: 'Shoulder compound movement',
            sets: 3,
            reps: '8-12',
            restTime: 90,
            muscleGroup: 'Shoulders',
            equipment: 'Barbell',
            difficulty: 'beginner'
          },
          {
            exerciseId: 'ex-003',
            name: 'Tricep Dips',
            description: 'Tricep isolation movement',
            sets: 3,
            reps: '10-15',
            restTime: 60,
            muscleGroup: 'Triceps',
            equipment: 'Bodyweight',
            difficulty: 'beginner'
          }
        ]
      },
      {
        dayName: 'Day 2 - Pull',
        muscleGroup: 'Pull',
        estimatedDuration: 60,
        isRestDay: false,
        exercises: [
          {
            exerciseId: 'ex-004',
            name: 'Pull-ups',
            description: 'Back compound movement',
            sets: 3,
            reps: '5-10',
            restTime: 90,
            muscleGroup: 'Back',
            equipment: 'Bodyweight',
            difficulty: 'beginner'
          },
          {
            exerciseId: 'ex-005',
            name: 'Barbell Rows',
            description: 'Back compound movement',
            sets: 3,
            reps: '8-12',
            restTime: 90,
            muscleGroup: 'Back',
            equipment: 'Barbell',
            difficulty: 'beginner'
          },
          {
            exerciseId: 'ex-006',
            name: 'Bicep Curls',
            description: 'Bicep isolation movement',
            sets: 3,
            reps: '12-15',
            restTime: 60,
            muscleGroup: 'Biceps',
            equipment: 'Dumbbell',
            difficulty: 'beginner'
          }
        ]
      },
      {
        dayName: 'Day 3 - Legs',
        muscleGroup: 'Legs',
        estimatedDuration: 75,
        isRestDay: false,
        exercises: [
          {
            exerciseId: 'ex-007',
            name: 'Squats',
            description: 'Leg compound movement',
            sets: 3,
            reps: '8-12',
            restTime: 120,
            muscleGroup: 'Quadriceps',
            equipment: 'Barbell',
            difficulty: 'beginner'
          },
          {
            exerciseId: 'ex-008',
            name: 'Romanian Deadlifts',
            description: 'Hamstring compound movement',
            sets: 3,
            reps: '8-12',
            restTime: 90,
            muscleGroup: 'Hamstrings',
            equipment: 'Barbell',
            difficulty: 'beginner'
          },
          {
            exerciseId: 'ex-009',
            name: 'Calf Raises',
            description: 'Calf isolation movement',
            sets: 3,
            reps: '15-20',
            restTime: 45,
            muscleGroup: 'Calves',
            equipment: 'Bodyweight',
            difficulty: 'beginner'
          }
        ]
      }
    ]
  },
  
  exerciseLibrary: [
    {
      exerciseId: 'ex-001',
      name: 'Bench Press',
      description: 'Chest compound movement',
      muscleGroup: 'Chest',
      equipment: 'Barbell',
      difficulty: 'beginner',
      videoUrl: 'https://example.com/bench-press-video',
      imageUrl: 'https://example.com/bench-press-image'
    },
    {
      exerciseId: 'ex-002',
      name: 'Squats',
      description: 'Leg compound movement',
      muscleGroup: 'Quadriceps',
      equipment: 'Barbell',
      difficulty: 'beginner',
      videoUrl: 'https://example.com/squats-video',
      imageUrl: 'https://example.com/squats-image'
    }
  ]
};

// Validation function for configuration
export const validateExternalApisConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Validate workout planning service config
  if (!workoutPlanningServiceConfig.baseUrl) {
    errors.push('Workout planning service base URL is required');
  }
  
  if (!workoutPlanningServiceConfig.apiKey) {
    errors.push('Workout planning service API key is required');
  }
  
  if (workoutPlanningServiceConfig.timeout < 1000 || workoutPlanningServiceConfig.timeout > 60000) {
    errors.push('Workout planning service timeout must be between 1 and 60 seconds');
  }
  
  // Log configuration validation
  logger.info('External APIs configuration validated', {
    service: 'external-apis-config',
    workoutPlanningService: {
      baseUrl: workoutPlanningServiceConfig.baseUrl,
      timeout: workoutPlanningServiceConfig.timeout,
      mockMode: workoutPlanningServiceConfig.features.mockMode,
      cacheEnabled: workoutPlanningServiceConfig.features.enableCaching,
    },
    errors: errors.length > 0 ? errors : undefined,
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export default {
  workoutPlanningService: workoutPlanningServiceConfig,
  general: externalApisConfig,
  cache: externalApiCacheConfig,
  mocks: mockApiResponses,
  validate: validateExternalApisConfig
};