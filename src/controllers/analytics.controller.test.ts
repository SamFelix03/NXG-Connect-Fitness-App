import { Request, Response } from 'express';
import {
  getDailyWorkoutAnalytics,
  getWeeklyWorkoutProgress,
  getWorkoutHistoryAnalytics,
  getWorkoutGoalTracking,
  getPerformanceComparison,
  getAutoProgressionSuggestions,
  getExerciseSpecificAnalytics
} from './analytics.controller';
import { AnalyticsService } from '../services/analytics.service';
import { validateRequest } from '../utils/validation';
import logger from '../utils/logger';

// Mock dependencies
jest.mock('../services/analytics.service');
jest.mock('../utils/validation');
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

describe('Analytics Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockAnalyticsService: jest.Mocked<AnalyticsService>;

  beforeEach(() => {
    mockRequest = {
      user: { id: 'user123' },
      query: {},
      params: {}
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Create a mock instance
    mockAnalyticsService = new AnalyticsService() as jest.Mocked<AnalyticsService>;
    
    // Mock the constructor to return our mock instance
    (AnalyticsService as jest.Mock).mockImplementation(() => mockAnalyticsService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getDailyWorkoutAnalytics', () => {
    const mockDailyAnalytics = {
      date: new Date('2025-01-15'),
      completionPercentage: 80,
      consistencyScore: 75,
      performanceMetrics: {
        totalWorkouts: 1,
        totalExercises: 5,
        totalSets: 15,
        averageWorkoutDuration: 60,
        caloriesBurned: 400,
        strengthGains: {}
      }
    };

    it('should return daily analytics successfully', async () => {
      (validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        value: { date: '2025-01-15' }
      });

      mockAnalyticsService.getDailyWorkoutAnalytics.mockResolvedValue(mockDailyAnalytics);

      await getDailyWorkoutAnalytics(mockRequest as Request, mockResponse as Response);

      expect(validateRequest).toHaveBeenCalledWith(mockRequest.query, expect.any(Object));
      expect(mockAnalyticsService.getDailyWorkoutAnalytics).toHaveBeenCalledWith('user123', new Date('2025-01-15'));
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Daily workout analytics retrieved successfully',
        data: mockDailyAnalytics
      });
      expect(logger.info).toHaveBeenCalledWith('Daily workout analytics retrieved', {
        userId: 'user123',
        date: new Date('2025-01-15')
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await getDailyWorkoutAnalytics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    });

    it('should return 400 for validation errors', async () => {
      (validateRequest as jest.Mock).mockReturnValue({
        isValid: false,
        errors: { date: 'Invalid date format' }
      });

      await getDailyWorkoutAnalytics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: { date: 'Invalid date format' }
      });
    });

    it('should handle service errors gracefully', async () => {
      (validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        value: {}
      });

      mockAnalyticsService.getDailyWorkoutAnalytics.mockRejectedValue(new Error('Service error'));

      await getDailyWorkoutAnalytics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      });
      expect(logger.error).toHaveBeenCalledWith(
        'Error retrieving daily workout analytics',
        expect.any(Error),
        { userId: 'user123' }
      );
    });
  });

  describe('getWeeklyWorkoutProgress', () => {
    const mockWeeklyProgress = {
      weeks: 4,
      strengthGains: {},
      enduranceImprovements: {},
      workoutStreaks: [],
      weeklyStats: []
    };

    it('should return weekly progress successfully', async () => {
      (validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        value: { weeks: 4 }
      });

      mockAnalyticsService.getWeeklyWorkoutProgress.mockResolvedValue(mockWeeklyProgress);

      await getWeeklyWorkoutProgress(mockRequest as Request, mockResponse as Response);

      expect(mockAnalyticsService.getWeeklyWorkoutProgress).toHaveBeenCalledWith('user123', undefined, undefined, 4);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Weekly workout progress retrieved successfully',
        data: mockWeeklyProgress
      });
    });

    it('should handle date range parameters', async () => {
      (validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        value: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          weeks: 4
        }
      });

      mockAnalyticsService.getWeeklyWorkoutProgress.mockResolvedValue(mockWeeklyProgress);

      await getWeeklyWorkoutProgress(mockRequest as Request, mockResponse as Response);

      expect(mockAnalyticsService.getWeeklyWorkoutProgress).toHaveBeenCalledWith(
        'user123',
        new Date('2025-01-01'),
        new Date('2025-01-31'),
        4
      );
    });
  });

  describe('getWorkoutHistoryAnalytics', () => {
    const mockHistoryAnalytics = {
      exercises: [
        {
          sessionId: 'session123',
          exerciseName: 'Bench Press',
          date: new Date('2025-01-15'),
          sets: 4,
          reps: 8,
          weight: 80,
          muscleGroup: 'Chest',
          performance: 2560
        }
      ],
      trends: {
        volumeProgression: [],
        strengthProgression: [],
        consistencyTrend: []
      },
      pagination: {
        limit: 50,
        offset: 0,
        total: 100,
        hasNext: true
      }
    };

    it('should return workout history successfully with filters', async () => {
      (validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        value: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          exerciseId: 'exercise123',
          muscleGroup: 'Chest',
          limit: 50,
          offset: 0
        }
      });

      mockAnalyticsService.getWorkoutHistoryAnalytics.mockResolvedValue(mockHistoryAnalytics);

      await getWorkoutHistoryAnalytics(mockRequest as Request, mockResponse as Response);

      expect(mockAnalyticsService.getWorkoutHistoryAnalytics).toHaveBeenCalledWith('user123', {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        exerciseId: 'exercise123',
        muscleGroup: 'Chest',
        limit: 50,
        offset: 0
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Workout history analytics retrieved successfully',
        data: mockHistoryAnalytics
      });
    });
  });

  describe('getWorkoutGoalTracking', () => {
    const mockGoalTracking = {
      goalType: 'strength',
      period: 'monthly',
      targets: {},
      progress: {},
      achievements: []
    };

    it('should return goal tracking successfully', async () => {
      (validateRequest as jest.Mock).mockReturnValue({
        isValid: true,
        value: { goalType: 'strength', period: 'monthly' }
      });

      mockAnalyticsService.getWorkoutGoalTracking.mockResolvedValue(mockGoalTracking);

      await getWorkoutGoalTracking(mockRequest as Request, mockResponse as Response);

      expect(mockAnalyticsService.getWorkoutGoalTracking).toHaveBeenCalledWith('user123', 'strength', 'monthly');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Workout goal tracking retrieved successfully',
        data: mockGoalTracking
      });
    });
  });

  describe('getPerformanceComparison', () => {
    const mockComparison = {
      userRank: 75,
      benchmarks: {
        avgWorkoutsPerWeek: 4,
        avgWorkoutDuration: 60,
        avgWeightLifted: 0,
        avgCaloriesBurned: 400
      },
      percentile: 75,
      similarUserStats: {
        sampleSize: 50,
        avgAge: 26,
        fitnessLevel: 'intermediate'
      }
    };

    it('should return performance comparison successfully', async () => {
      mockAnalyticsService.getPerformanceComparison.mockResolvedValue(mockComparison);

      await getPerformanceComparison(mockRequest as Request, mockResponse as Response);

      expect(mockAnalyticsService.getPerformanceComparison).toHaveBeenCalledWith('user123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Performance comparison retrieved successfully',
        data: mockComparison
      });
      expect(logger.info).toHaveBeenCalledWith('Performance comparison retrieved', { userId: 'user123' });
    });
  });

  describe('getAutoProgressionSuggestions', () => {
    const mockSuggestions = {
      exerciseId: 'exercise123',
      currentStats: {
        weight: 80,
        sets: 4,
        reps: 8,
        volume: 2560
      },
      suggestions: [
        {
          type: 'weight_increase',
          message: 'Consider increasing weight by 2.5-5kg next session',
          rationale: 'Consistent strength gains detected'
        }
      ],
      progressionPlan: {
        nextSession: {
          recommendedWeight: 82.5,
          recommendedReps: 8,
          confidence: 75
        }
      }
    };

    it('should return progression suggestions for specific exercise', async () => {
      mockRequest.query = { exerciseId: 'exercise123' };
      mockAnalyticsService.getAutoProgressionSuggestions.mockResolvedValue(mockSuggestions);

      await getAutoProgressionSuggestions(mockRequest as Request, mockResponse as Response);

      expect(mockAnalyticsService.getAutoProgressionSuggestions).toHaveBeenCalledWith('user123', 'exercise123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Auto-progression suggestions retrieved successfully',
        data: mockSuggestions
      });
    });

    it('should return suggestions for all exercises when no exerciseId provided', async () => {
      const allSuggestions = [mockSuggestions, { ...mockSuggestions, exerciseId: 'exercise456' }];
      mockAnalyticsService.getAutoProgressionSuggestions.mockResolvedValue(allSuggestions);

      await getAutoProgressionSuggestions(mockRequest as Request, mockResponse as Response);

      expect(mockAnalyticsService.getAutoProgressionSuggestions).toHaveBeenCalledWith('user123', undefined);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Auto-progression suggestions retrieved successfully',
        data: allSuggestions
      });
    });
  });

  describe('getExerciseSpecificAnalytics', () => {
    const exerciseId = 'exercise123';
    const mockExerciseAnalytics = {
      exerciseId,
      personalRecords: {
        maxWeight: 100,
        maxVolume: 3200,
        maxReps: 12,
        totalSessions: 25,
        firstSession: new Date('2024-12-01'),
        lastSession: new Date('2025-01-15')
      },
      volumeProgression: [
        {
          date: new Date('2025-01-15'),
          volume: 2560,
          weight: 80,
          sets: 4,
          reps: 8
        }
      ],
      techniqueScores: [
        {
          date: new Date('2025-01-15'),
          score: 85,
          notes: 'Good form'
        }
      ],
      milestones: [
        {
          type: 'weight',
          value: 100,
          achievedDate: new Date('2025-01-10'),
          description: 'Lifted 100kg for the first time'
        }
      ]
    };

    it('should return exercise-specific analytics successfully', async () => {
      mockRequest.params = { exerciseId };
      mockAnalyticsService.getExerciseSpecificAnalytics.mockResolvedValue(mockExerciseAnalytics);

      await getExerciseSpecificAnalytics(mockRequest as Request, mockResponse as Response);

      expect(mockAnalyticsService.getExerciseSpecificAnalytics).toHaveBeenCalledWith('user123', exerciseId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Exercise-specific analytics retrieved successfully',
        data: mockExerciseAnalytics
      });
      expect(logger.info).toHaveBeenCalledWith('Exercise-specific analytics retrieved', {
        userId: 'user123',
        exerciseId
      });
    });

    it('should return 400 when exerciseId is missing', async () => {
      mockRequest.params = {};

      await getExerciseSpecificAnalytics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Exercise ID is required',
        code: 'VALIDATION_ERROR'
      });
    });

    it('should handle service errors and log with exerciseId context', async () => {
      mockRequest.params = { exerciseId };
      mockAnalyticsService.getExerciseSpecificAnalytics.mockRejectedValue(new Error('Service error'));

      await getExerciseSpecificAnalytics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      });
      expect(logger.error).toHaveBeenCalledWith(
        'Error retrieving exercise-specific analytics',
        expect.any(Error),
        { userId: 'user123', exerciseId }
      );
    });
  });

  describe('Error handling across all endpoints', () => {
    it('should handle missing user context consistently', async () => {
      const endpoints = [
        getDailyWorkoutAnalytics,
        getWeeklyWorkoutProgress,
        getWorkoutHistoryAnalytics,
        getWorkoutGoalTracking,
        getPerformanceComparison,
        getAutoProgressionSuggestions
      ];

      for (const endpoint of endpoints) {
        mockRequest.user = undefined;
        jest.clearAllMocks();

        await endpoint(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Authentication required',
          code: 'UNAUTHORIZED'
        });
      }
    });

    it('should handle validation errors consistently', async () => {
      const endpointsWithValidation = [
        getDailyWorkoutAnalytics,
        getWeeklyWorkoutProgress,
        getWorkoutHistoryAnalytics,
        getWorkoutGoalTracking
      ];

      (validateRequest as jest.Mock).mockReturnValue({
        isValid: false,
        errors: { field: 'Invalid value' }
      });

      for (const endpoint of endpointsWithValidation) {
        mockRequest.user = { id: 'user123' };
        jest.clearAllMocks();

        await endpoint(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors: { field: 'Invalid value' }
        });
      }
    });
  });
});