import { DietPlanningService } from './diet-planning.service';
import { redis } from '../../utils/redis';
import { dietPlanningServiceConfig } from '../../config/external-apis.config';
import axios from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('../../utils/redis');
jest.mock('../../utils/logger');
jest.mock('../../config/external-apis.config');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedRedis = {
  getClient: jest.fn().mockReturnValue({
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn()
  })
};

(redis as jest.Mocked<typeof redis>) = mockedRedis as any;

describe('DietPlanningService', () => {
  let dietPlanningService: DietPlanningService;
  let mockAxiosInstance: any;

  const mockUserProfile = {
    goal: 'weight_loss',
    age: 25,
    heightCm: 175,
    weightKg: 75,
    targetWeightKg: 70,
    gender: 'Male',
    activityLevel: 'moderately_active',
    allergies: [],
    healthConditions: []
  };

  const mockDietPreferences = {
    cuisinePreferences: {
      Indian: ['Non-Veg', 'Veg'],
      RegionAndState: ['South Indian', 'Kerala']
    }
  };

  const mockExternalResponse = {
    target_weight: "70.0",
    macros: {
      "Total Calories": "1800",
      "Total Carbs": "200g",
      "Total Protein": "120g",
      "Total Fat": "60g",
      "Total Fiber": "25g"
    },
    meal_plan: [
      {
        day: 1,
        meals: {
          "Breakfast": "150g Rava Dosa with 100ml Tomato Chutney",
          "Snack 1": "100g Mixed berries",
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
        }
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios.create
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    // Mock config
    (dietPlanningServiceConfig as any) = {
      baseUrl: 'https://test-diet-service.com',
      timeout: 30000,
      apiKey: 'test-api-key',
      hmacSecret: 'test-hmac-secret',
      defaultHeaders: { 'Content-Type': 'application/json' },
      endpoints: { createDietPlan: '/mealplan' },
      features: {
        enableCaching: true,
        enableCircuitBreaker: true,
        enableRetries: true,
        mockMode: false
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 120000
      }
    };

    dietPlanningService = new DietPlanningService();
  });

  describe('createDietPlan', () => {
    it('should create a diet plan successfully with valid input', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserProfile,
        dietPreferences: mockDietPreferences
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: mockExternalResponse
      });

      const mockRedisClient = mockedRedis.getClient();
      mockRedisClient.get.mockResolvedValue(null); // No cache hit

      // Act
      const result = await dietPlanningService.createDietPlan(input);

      // Assert
      expect(result).toEqual(mockExternalResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/mealplan',
        expect.objectContaining({
          input_text: expect.stringContaining('fitness goal: weight loss')
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key',
            'X-Signature': expect.any(String)
          })
        })
      );
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    it('should return cached result when available', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserProfile,
        dietPreferences: mockDietPreferences
      };

      const mockRedisClient = mockedRedis.getClient();
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockExternalResponse));

      // Act
      const result = await dietPlanningService.createDietPlan(input);

      // Assert
      expect(result).toEqual(mockExternalResponse);
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
      expect(mockRedisClient.get).toHaveBeenCalled();
    });

    it('should use mock response when in mock mode', async () => {
      // Arrange
      (dietPlanningServiceConfig as any).features.mockMode = true;
      dietPlanningService = new DietPlanningService();
      
      const input = {
        userId: 'user123',
        userProfile: mockUserProfile,
        dietPreferences: mockDietPreferences
      };

      const mockRedisClient = mockedRedis.getClient();
      mockRedisClient.get.mockResolvedValue(null);

      // Act
      const result = await dietPlanningService.createDietPlan(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.target_weight).toBeDefined();
      expect(result.macros).toBeDefined();
      expect(result.meal_plan).toBeDefined();
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('should validate input parameters', async () => {
      // Arrange
      const invalidInput = {
        userId: 'user123',
        userProfile: {
          ...mockUserProfile,
          age: 200 // Invalid age
        }
      };

      // Act & Assert
      await expect(dietPlanningService.createDietPlan(invalidInput))
        .rejects.toThrow('Input validation failed');
    });

    it('should validate external service response', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserProfile,
        dietPreferences: mockDietPreferences
      };

      const invalidResponse = {
        // Missing required fields
        target_weight: "70.0"
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: invalidResponse
      });

      const mockRedisClient = mockedRedis.getClient();
      mockRedisClient.get.mockResolvedValue(null);

      // Act & Assert
      await expect(dietPlanningService.createDietPlan(input))
        .rejects.toThrow('Response validation failed');
    });

    it('should handle external service failures with circuit breaker', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserProfile,
        dietPreferences: mockDietPreferences
      };

      mockAxiosInstance.post.mockRejectedValue(new Error('Service unavailable'));

      const mockRedisClient = mockedRedis.getClient();
      mockRedisClient.get.mockResolvedValue(null);

      // Act & Assert
      await expect(dietPlanningService.createDietPlan(input))
        .rejects.toThrow('Service unavailable');
    });

    it('should handle cache errors gracefully', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserProfile,
        dietPreferences: mockDietPreferences
      };

      const mockRedisClient = mockedRedis.getClient();
      mockRedisClient.get.mockRejectedValue(new Error('Cache error'));
      mockAxiosInstance.post.mockResolvedValue({
        data: mockExternalResponse
      });

      // Act
      const result = await dietPlanningService.createDietPlan(input);

      // Assert
      expect(result).toEqual(mockExternalResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalled();
    });

    it('should format input text correctly for external API', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: {
          ...mockUserProfile,
          goal: 'muscle_building',
          allergies: ['peanuts'],
          healthConditions: ['diabetes']
        },
        dietPreferences: mockDietPreferences
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: mockExternalResponse
      });

      const mockRedisClient = mockedRedis.getClient();
      mockRedisClient.get.mockResolvedValue(null);

      // Act
      await dietPlanningService.createDietPlan(input);

      // Assert
      const postCall = mockAxiosInstance.post.mock.calls[0];
      const requestBody = postCall[1];
      
      expect(requestBody.input_text).toContain('fitness goal: muscle building');
      expect(requestBody.input_text).toContain('age: 25');
      expect(requestBody.input_text).toContain('current weight: 75kg');
      expect(requestBody.input_text).toContain('target weight: 70kg');
      expect(requestBody.input_text).toContain('gender: Male');
      expect(requestBody.input_text).toContain('allergies: peanuts');
      expect(requestBody.input_text).toContain('health conditions: diabetes');
      expect(requestBody.input_text).toContain('Indian: [Non-Veg, Veg]');
    });

    it('should generate HMAC signature for authentication', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserProfile,
        dietPreferences: mockDietPreferences
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: mockExternalResponse
      });

      const mockRedisClient = mockedRedis.getClient();
      mockRedisClient.get.mockResolvedValue(null);

      // Act
      await dietPlanningService.createDietPlan(input);

      // Assert
      const postCall = mockAxiosInstance.post.mock.calls[0];
      const headers = postCall[2].headers;
      
      expect(headers['X-API-Key']).toBe('test-api-key');
      expect(headers['X-Signature']).toBeDefined();
      expect(typeof headers['X-Signature']).toBe('string');
    });

    it('should customize mock plan based on user profile', async () => {
      // Arrange
      (dietPlanningServiceConfig as any).features.mockMode = true;
      dietPlanningService = new DietPlanningService();
      
      const femaleInput = {
        userId: 'user123',
        userProfile: {
          ...mockUserProfile,
          gender: 'Female',
          goal: 'weight_gain'
        }
      };

      const mockRedisClient = mockedRedis.getClient();
      mockRedisClient.get.mockResolvedValue(null);

      // Act
      const result = await dietPlanningService.createDietPlan(femaleInput);

      // Assert
      expect(result).toBeDefined();
      expect(result.macros['Total Calories']).toBeDefined();
      // Should adjust calories based on gender and goal
      const calories = parseInt(result.macros['Total Calories']);
      expect(calories).toBeGreaterThan(0);
    });
  });

  describe('Circuit Breaker', () => {
    it('should track failures and open circuit breaker', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserProfile
      };

      const mockRedisClient = mockedRedis.getClient();
      mockRedisClient.get.mockResolvedValue(null);
      mockAxiosInstance.post.mockRejectedValue(new Error('Service error'));

      // Act - Trigger multiple failures to open circuit breaker
      for (let i = 0; i < 6; i++) {
        try {
          await dietPlanningService.createDietPlan(input);
        } catch (error) {
          // Expected to fail
        }
      }

      // Assert - Next call should use fallback
      const result = await dietPlanningService.createDietPlan(input);
      expect(result).toBeDefined();
      expect(result.macros).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required fields gracefully', async () => {
      // Arrange
      const incompleteInput = {
        userId: 'user123',
        userProfile: {
          goal: 'weight_loss'
          // Missing required fields
        }
      } as any; // Use any to bypass TypeScript checking for testing validation

      // Act & Assert
      await expect(dietPlanningService.createDietPlan(incompleteInput))
        .rejects.toThrow('Input validation failed');
    });

    it('should handle network timeouts', async () => {
      // Arrange
      const input = {
        userId: 'user123',
        userProfile: mockUserProfile
      };

      const mockRedisClient = mockedRedis.getClient();
      mockRedisClient.get.mockResolvedValue(null);
      mockAxiosInstance.post.mockRejectedValue(new Error('ETIMEDOUT'));

      // Act & Assert
      await expect(dietPlanningService.createDietPlan(input))
        .rejects.toThrow('ETIMEDOUT');
    });
  });
});

describe('DietPlanningService Integration', () => {
  // Integration tests would go here
  // These would test with actual Redis and potentially real external service in test environment
  
  it.skip('should integrate with Redis for caching', async () => {
    // This would be an actual integration test
  });

  it.skip('should handle rate limiting from external service', async () => {
    // This would test actual rate limiting behavior
  });
});