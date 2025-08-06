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

// Diet Planning Service Configuration
export const dietPlanningServiceConfig = {
  // Base URL for the external diet planning service
  baseUrl: getEnvVar('DIET_PLANNING_SERVICE_URL', 'https://productionmealplanner-330329704801.us-central1.run.app'),
  
  // API Authentication - HMAC signature required
  apiKey: getEnvVar('DIET_PLANNING_SERVICE_API_KEY', 'mock-diet-api-key-12345'),
  hmacSecret: getEnvVar('DIET_PLANNING_SERVICE_HMAC_SECRET', 'mock-hmac-secret'),
  
  // Request Timeout Configuration
  timeout: parseInt(getEnvVar('DIET_PLANNING_SERVICE_TIMEOUT', '30000'), 10), // 30 seconds
  
  // Rate Limiting Configuration (2000 requests per day per API key)
  rateLimit: {
    requestsPerDay: parseInt(getEnvVar('DIET_PLANNING_RATE_LIMIT_RPD', '2000'), 10),
    requestsPerHour: parseInt(getEnvVar('DIET_PLANNING_RATE_LIMIT_RPH', '84'), 10), // ~2000/24
    requestsPerMinute: parseInt(getEnvVar('DIET_PLANNING_RATE_LIMIT_RPM', '2'), 10), // Conservative
  },
  
  // Retry Configuration
  retry: {
    attempts: parseInt(getEnvVar('DIET_PLANNING_SERVICE_RETRY_ATTEMPTS', '3'), 10),
    delay: parseInt(getEnvVar('DIET_PLANNING_SERVICE_RETRY_DELAY', '1000'), 10), // 1 second
    factor: parseFloat(getEnvVar('DIET_PLANNING_SERVICE_RETRY_FACTOR', '2')), // exponential backoff
  },
  
  // Circuit Breaker Configuration
  circuitBreaker: {
    failureThreshold: parseInt(getEnvVar('DIET_PLANNING_CIRCUIT_BREAKER_THRESHOLD', '5'), 10),
    timeout: parseInt(getEnvVar('DIET_PLANNING_CIRCUIT_BREAKER_TIMEOUT', '60000'), 10), // 1 minute
    resetTimeout: parseInt(getEnvVar('DIET_PLANNING_CIRCUIT_BREAKER_RESET', '120000'), 10), // 2 minutes
  },
  
  // API Endpoints
  endpoints: {
    createDietPlan: '/mealplan',
  },
  
  // Request Headers
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'NXG-Connect-Fitness/1.0.0',
  },
  
  // Feature Flags
  features: {
    enableCaching: getEnvVar('DIET_PLANNING_ENABLE_CACHE', 'true') === 'true',
    enableCircuitBreaker: getEnvVar('DIET_PLANNING_ENABLE_CIRCUIT_BREAKER', 'true') === 'true',
    enableRetries: getEnvVar('DIET_PLANNING_ENABLE_RETRIES', 'true') === 'true',
    mockMode: getEnvVar('DIET_PLANNING_MOCK_MODE', 'false') === 'true', // Use real service by default
  }
};

// Meal Detection Service Configuration
export const mealDetectionServiceConfig = {
  // Base URL for the external meal detection service
  baseUrl: getEnvVar('MEAL_DETECTION_SERVICE_URL', 'https://productionbreakdown-330329704801.us-central1.run.app'),
  
  // API Authentication - Bearer token required
  apiToken: getEnvVar('MEAL_DETECTION_SERVICE_API_TOKEN', 'mock-meal-detection-token'),
  
  // Request Timeout Configuration
  timeout: parseInt(getEnvVar('MEAL_DETECTION_SERVICE_TIMEOUT', '30000'), 10), // 30 seconds
  
  // Rate Limiting Configuration (AI processing is expensive)
  rateLimit: {
    requestsPerHour: parseInt(getEnvVar('MEAL_DETECTION_RATE_LIMIT_RPH', '100'), 10),
    requestsPerMinute: parseInt(getEnvVar('MEAL_DETECTION_RATE_LIMIT_RPM', '10'), 10),
    requestsPerDay: parseInt(getEnvVar('MEAL_DETECTION_RATE_LIMIT_RPD', '500'), 10),
  },
  
  // Retry Configuration
  retry: {
    attempts: parseInt(getEnvVar('MEAL_DETECTION_SERVICE_RETRY_ATTEMPTS', '3'), 10),
    delay: parseInt(getEnvVar('MEAL_DETECTION_SERVICE_RETRY_DELAY', '2000'), 10), // 2 seconds
    factor: parseFloat(getEnvVar('MEAL_DETECTION_SERVICE_RETRY_FACTOR', '2')), // exponential backoff
  },
  
  // Circuit Breaker Configuration
  circuitBreaker: {
    failureThreshold: parseInt(getEnvVar('MEAL_DETECTION_CIRCUIT_BREAKER_THRESHOLD', '5'), 10),
    timeout: parseInt(getEnvVar('MEAL_DETECTION_CIRCUIT_BREAKER_TIMEOUT', '60000'), 10), // 1 minute
    resetTimeout: parseInt(getEnvVar('MEAL_DETECTION_CIRCUIT_BREAKER_RESET', '300000'), 10), // 5 minutes
  },
  
  // Image Processing Configuration
  imageProcessing: {
    maxSizeKB: parseInt(getEnvVar('MEAL_DETECTION_MAX_IMAGE_SIZE_KB', '1024'), 10), // 1MB
    maxWidth: parseInt(getEnvVar('MEAL_DETECTION_MAX_IMAGE_WIDTH', '1024'), 10),
    maxHeight: parseInt(getEnvVar('MEAL_DETECTION_MAX_IMAGE_HEIGHT', '1024'), 10),
    quality: parseInt(getEnvVar('MEAL_DETECTION_IMAGE_QUALITY', '85'), 10),
    allowedFormats: (getEnvVar('MEAL_DETECTION_ALLOWED_FORMATS', 'jpeg,jpg,png,webp')).split(','),
  },
  
  // API Endpoints
  endpoints: {
    identifyMeal: '/identify/',
    correctMeal: '/edit/',
  },
  
  // Request Headers
  defaultHeaders: {
    'Accept': 'application/json',
    'User-Agent': 'NXG-Connect-Fitness/1.0.0',
  },
  
  // Feature Flags
  features: {
    enableCaching: getEnvVar('MEAL_DETECTION_ENABLE_CACHE', 'true') === 'true',
    enableCircuitBreaker: getEnvVar('MEAL_DETECTION_ENABLE_CIRCUIT_BREAKER', 'true') === 'true',
    enableRetries: getEnvVar('MEAL_DETECTION_ENABLE_RETRIES', 'true') === 'true',
    enableImageOptimization: getEnvVar('MEAL_DETECTION_ENABLE_IMAGE_OPTIMIZATION', 'true') === 'true',
    mockMode: getEnvVar('MEAL_DETECTION_MOCK_MODE', 'false') === 'true', // Use real service by default
  }
};

// File Storage Configuration (AWS S3 + CloudFront)
export const fileStorageConfig = {
  // AWS S3 Configuration
  s3: {
    bucketName: getEnvVar('S3_BUCKET_NAME', 'nxg-fitness-meals'),
    region: getEnvVar('AWS_REGION', 'us-east-1'),
    accessKeyId: getEnvVar('AWS_ACCESS_KEY_ID'),
    secretAccessKey: getEnvVar('AWS_SECRET_ACCESS_KEY'),
    // S3 Storage Class options
    storageClass: getEnvVar('S3_STORAGE_CLASS', 'STANDARD'), // STANDARD, REDUCED_REDUNDANCY, STANDARD_IA
    serverSideEncryption: getEnvVar('S3_ENCRYPTION', 'AES256'),
  },
  
  // CloudFront CDN Configuration
  cdn: {
    domain: getEnvVar('CLOUDFRONT_DOMAIN', 'cdn.nxg-fitness.com'),
    distributionId: getEnvVar('CLOUDFRONT_DISTRIBUTION_ID'),
    signedUrlExpiry: parseInt(getEnvVar('CLOUDFRONT_SIGNED_URL_EXPIRY', '3600'), 10), // 1 hour
  },
  
  // Image Storage Configuration
  images: {
    folderStructure: getEnvVar('IMAGE_FOLDER_STRUCTURE', 'meals/user{userId}/'),
    filenamePattern: getEnvVar('IMAGE_FILENAME_PATTERN', 'meal{mealId}_{timestamp}'),
    maxFileSize: parseInt(getEnvVar('IMAGE_MAX_FILE_SIZE', '10485760'), 10), // 10MB in bytes
    allowedMimeTypes: (getEnvVar('IMAGE_ALLOWED_MIME_TYPES', 'image/jpeg,image/png,image/webp')).split(','),
  },
  
  // Image Optimization Settings
  optimization: {
    enabled: getEnvVar('IMAGE_OPTIMIZATION_ENABLED', 'true') === 'true',
    quality: parseInt(getEnvVar('IMAGE_OPTIMIZATION_QUALITY', '85'), 10),
    maxWidth: parseInt(getEnvVar('IMAGE_OPTIMIZATION_MAX_WIDTH', '1024'), 10),
    maxHeight: parseInt(getEnvVar('IMAGE_OPTIMIZATION_MAX_HEIGHT', '1024'), 10),
    format: getEnvVar('IMAGE_OPTIMIZATION_FORMAT', 'jpeg'), // jpeg, png, webp
  },
  
  // Cleanup Configuration
  cleanup: {
    enabled: getEnvVar('IMAGE_CLEANUP_ENABLED', 'true') === 'true',
    orphanedImageRetentionDays: parseInt(getEnvVar('ORPHANED_IMAGE_RETENTION_DAYS', '7'), 10),
    cleanupSchedule: getEnvVar('IMAGE_CLEANUP_SCHEDULE', '0 2 * * *'), // Daily at 2 AM
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
    dietPlans: 'cache:diet-plans:',
    exercises: 'cache:exercises:',
    templates: 'cache:templates:',
    meals: 'meal:',
    userMeals: 'user_meals:',
  },
  
  // Cache TTL (Time To Live) settings in seconds
  ttl: {
    workoutPlans: parseInt(getEnvVar('CACHE_TTL_WORKOUT_PLANS', '86400'), 10), // 24 hours
    dietPlans: parseInt(getEnvVar('CACHE_TTL_DIET_PLANS', '86400'), 10), // 24 hours
    exercises: parseInt(getEnvVar('CACHE_TTL_EXERCISES', '604800'), 10), // 7 days
    templates: parseInt(getEnvVar('CACHE_TTL_TEMPLATES', '604800'), 10), // 7 days
    meals: parseInt(getEnvVar('CACHE_TTL_MEALS', '86400'), 10), // 24 hours
    frequentMeals: parseInt(getEnvVar('CACHE_TTL_FREQUENT_MEALS', '604800'), 10), // 7 days
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

  dietPlan: {
    target_weight: "74.27",
    macros: {
      "Total Calories": "1857",
      "Total Carbs": "223g",
      "Total Protein": "119g",
      "Total Fat": "58g",
      "Total Fiber": "26g"
    },
    meal_plan: [
      {
        meals: {
          "Breakfast": "150g Rava Dosa with 100ml Tomato Chutney",
          "Snack 1": "100g Mixed berries (blueberries, strawberries, raspberries)",
          "Lunch": "150g Kaima Rice with 150g Vegetable Curry",
          "Snack 2": "80g Apple slices with 20g Peanut Butter",
          "Dinner": "2 pieces Appam with 150g Egg Roast"
        },
        calories: {
          "Breakfast": 350,
          "Snack 1": 50,
          "Lunch": 550,
          "Snack 2": 250,
          "Dinner": 657
        },
        short_names: {
          "Breakfast": "Rava Dosa, Tomato Chutney",
          "Snack 1": "Mixed berries",
          "Lunch": "Kaima Rice, Vegetable Curry",
          "Snack 2": "Apple slices, Peanut Butter",
          "Dinner": "Appam, Egg Roast"
        },
        day: 1
      },
      {
        meals: {
          "Breakfast": "150g Jackfruit Upma",
          "Snack 1": "100g Watermelon cubes with 20g Feta and 5g Mint",
          "Lunch": "140g Fried Rice with 100g Veg Manchurian",
          "Snack 2": "30g Walnuts with 80g Apple slices",
          "Dinner": "150g Kappa with 100g Chammanthi"
        },
        calories: {
          "Breakfast": 360,
          "Snack 1": 60,
          "Lunch": 560,
          "Snack 2": 260,
          "Dinner": 617
        },
        short_names: {
          "Breakfast": "Jackfruit Upma",
          "Snack 1": "Watermelon cubes, Feta, Mint",
          "Lunch": "Fried Rice, Veg Manchurian",
          "Snack 2": "Walnuts, Apple slices",
          "Dinner": "Kappa, Chammanthi"
        },
        day: 2
      },
      {
        meals: {
          "Breakfast": "150g Vattayappam",
          "Snack 1": "100g Skyr (Icelandic yogurt) with 50g Berries",
          "Lunch": "150g Sardine Curry with 150g Kaima Rice",
          "Snack 2": "2 pieces Rice cakes with 20g Tahini and 10g Honey",
          "Dinner": "150g Puttu with 150g Kadala Curry"
        },
        calories: {
          "Breakfast": 350,
          "Snack 1": 90,
          "Lunch": 560,
          "Snack 2": 250,
          "Dinner": 607
        },
        short_names: {
          "Breakfast": "Vattayappam",
          "Snack 1": "Skyr, Berries",
          "Lunch": "Sardine Curry, Kaima Rice",
          "Snack 2": "Rice cakes, Tahini, Honey",
          "Dinner": "Puttu, Kadala Curry"
        },
        day: 3
      },
      {
        meals: {
          "Breakfast": "150g Thari Kanji (Rava Porridge)",
          "Snack 1": "80g Sliced cucumber with 50g Greek yogurt dip",
          "Lunch": "150g Kozhi Kurumulaku Roast with 140g Kaima Rice",
          "Snack 2": "30g Fruit and nut bars (Larabars)",
          "Dinner": "2 pieces Aripathiri with 150ml Chicken Stew"
        },
        calories: {
          "Breakfast": 340,
          "Snack 1": 60,
          "Lunch": 570,
          "Snack 2": 250,
          "Dinner": 637
        },
        short_names: {
          "Breakfast": "Thari Kanji",
          "Snack 1": "Cucumber, Greek yogurt dip",
          "Lunch": "Kozhi Kurumulaku Roast, Kaima Rice",
          "Snack 2": "Fruit and nut bars",
          "Dinner": "Aripathiri, Chicken Stew"
        },
        day: 4
      },
      {
        meals: {
          "Breakfast": "150g Ragi Puttu",
          "Snack 1": "100g Mini whole-wheat wraps with veggies",
          "Lunch": "150g Thalassery Biryani (Veg)",
          "Snack 2": "30g Cashew butter on 2 pcs Banana slices",
          "Dinner": "150g Chicken Chukka with 140g Jeera Rice"
        },
        calories: {
          "Breakfast": 350,
          "Snack 1": 80,
          "Lunch": 560,
          "Snack 2": 260,
          "Dinner": 607
        },
        short_names: {
          "Breakfast": "Ragi Puttu",
          "Snack 1": "Mini whole-wheat wraps, veggies",
          "Lunch": "Thalassery Biryani",
          "Snack 2": "Cashew butter, Banana slices",
          "Dinner": "Chicken Chukka, Jeera Rice"
        },
        day: 5
      },
      {
        meals: {
          "Breakfast": "3 pieces Dosa with 100ml Tomato Chutney",
          "Snack 1": "100g Steamed edamame with sea salt",
          "Lunch": "150g Rice with 150g Long Beans Thoran",
          "Snack 2": "30g Flaxseed crackers with 50g Hummus",
          "Dinner": "150g Meen Pollichathu with 140g Kaima Rice"
        },
        calories: {
          "Breakfast": 350,
          "Snack 1": 90,
          "Lunch": 560,
          "Snack 2": 250,
          "Dinner": 607
        },
        short_names: {
          "Breakfast": "Dosa, Tomato Chutney",
          "Snack 1": "Steamed edamame",
          "Lunch": "Rice, Long Beans Thoran",
          "Snack 2": "Flaxseed crackers, Hummus",
          "Dinner": "Meen Pollichathu, Kaima Rice"
        },
        day: 6
      },
      {
        meals: {
          "Breakfast": "150g Dosa with 100ml Tomato Chutney",
          "Snack 1": "80g Walnuts with 80g Apple slices",
          "Lunch": "150g Mussel Fry with 140g Kaima Rice",
          "Snack 2": "100g Smoothie bowl with 20g seeds and 50g fruits",
          "Dinner": "2 pieces Appam with 150g Fish Molee"
        },
        calories: {
          "Breakfast": 350,
          "Snack 1": 260,
          "Lunch": 560,
          "Snack 2": 250,
          "Dinner": 637
        },
        short_names: {
          "Breakfast": "Dosa, Tomato Chutney",
          "Snack 1": "Walnuts, Apple slices",
          "Lunch": "Mussel Fry, Kaima Rice",
          "Snack 2": "Smoothie bowl, seeds, fruits",
          "Dinner": "Appam, Fish Molee"
        },
        day: 7
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

  // Validate diet planning service config
  if (!dietPlanningServiceConfig.baseUrl) {
    errors.push('Diet planning service base URL is required');
  }
  
  if (!dietPlanningServiceConfig.apiKey) {
    errors.push('Diet planning service API key is required');
  }
  
  if (dietPlanningServiceConfig.timeout < 1000 || dietPlanningServiceConfig.timeout > 60000) {
    errors.push('Diet planning service timeout must be between 1 and 60 seconds');
  }

  // Validate meal detection service config
  if (!mealDetectionServiceConfig.baseUrl) {
    errors.push('Meal detection service base URL is required');
  }
  
  if (!mealDetectionServiceConfig.apiToken) {
    errors.push('Meal detection service API token is required');
  }
  
  if (mealDetectionServiceConfig.timeout < 1000 || mealDetectionServiceConfig.timeout > 60000) {
    errors.push('Meal detection service timeout must be between 1 and 60 seconds');
  }

  // Validate file storage config
  if (!fileStorageConfig.s3.bucketName) {
    errors.push('S3 bucket name is required for file storage');
  }
  
  if (!fileStorageConfig.s3.accessKeyId) {
    errors.push('AWS access key ID is required for file storage');
  }
  
  if (!fileStorageConfig.s3.secretAccessKey) {
    errors.push('AWS secret access key is required for file storage');
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
    dietPlanningService: {
      baseUrl: dietPlanningServiceConfig.baseUrl,
      timeout: dietPlanningServiceConfig.timeout,
      mockMode: dietPlanningServiceConfig.features.mockMode,
      cacheEnabled: dietPlanningServiceConfig.features.enableCaching,
    },
    mealDetectionService: {
      baseUrl: mealDetectionServiceConfig.baseUrl,
      timeout: mealDetectionServiceConfig.timeout,
      mockMode: mealDetectionServiceConfig.features.mockMode,
      cacheEnabled: mealDetectionServiceConfig.features.enableCaching,
      imageOptimization: mealDetectionServiceConfig.features.enableImageOptimization,
    },
    fileStorage: {
      s3Bucket: fileStorageConfig.s3.bucketName,
      s3Region: fileStorageConfig.s3.region,
      cdnDomain: fileStorageConfig.cdn.domain,
      imageOptimization: fileStorageConfig.optimization.enabled,
      cleanup: fileStorageConfig.cleanup.enabled,
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
  dietPlanningService: dietPlanningServiceConfig,
  mealDetectionService: mealDetectionServiceConfig,
  fileStorage: fileStorageConfig,
  general: externalApisConfig,
  cache: externalApiCacheConfig,
  mocks: mockApiResponses,
  validate: validateExternalApisConfig
};