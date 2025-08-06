import mongoose from 'mongoose';
import { AnalyticsService } from './analytics.service';
import { redisClient } from '../utils/redis';
import logger from '../utils/logger';

// Mock dependencies
jest.mock('../utils/redis', () => ({
  redisClient: {
    get: jest.fn(),
    setex: jest.fn()
  }
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

jest.mock('mongoose', () => ({
  connection: {
    db: {
      collection: jest.fn()
    }
  },
  Types: {
    ObjectId: jest.fn()
  }
}));

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockCollection: any;

  beforeEach(() => {
    analyticsService = new AnalyticsService();
    mockCollection = {
      aggregate: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      countDocuments: jest.fn()
    };
    (mongoose.connection.db.collection as jest.Mock).mockReturnValue(mockCollection);
    (mongoose.Types.ObjectId as any).mockImplementation((id: string) => ({ 
      toString: () => id,
      _id: id 
    }));
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getDailyWorkoutAnalytics', () => {
    const userId = 'user123';
    const testDate = new Date('2025-01-15');

    it('should return cached daily analytics when available', async () => {
      const cachedData = {
        date: testDate,
        completionPercentage: 80,
        consistencyScore: 75,
        performanceMetrics: {
          totalWorkouts: 1,
          totalExercises: 5,
          totalSets: 15,
          averageWorkoutDuration: 60,
          caloriesBurned: 400,
          strengthGains: { 'Bench Press': 80 }
        }
      };

      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));

      const result = await analyticsService.getDailyWorkoutAnalytics(userId, testDate);

      expect(result).toEqual(cachedData);
      expect(redisClient.get).toHaveBeenCalledWith(`analytics:workout:daily:${userId}:2025-01-15`);
      expect(logger.info).toHaveBeenCalledWith('Returning cached daily analytics', { userId, date: testDate });
    });

    it('should calculate daily analytics when no cache is available', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      
      // Mock gym sessions aggregation
      mockCollection.aggregate.mockReturnValueOnce({
        toArray: jest.fn().mockResolvedValue([{
          totalWorkouts: 1,
          totalExercises: 5,
          totalSets: 15,
          totalDuration: 60,
          totalCalories: 400,
          exerciseData: [[{ exerciseName: 'Bench Press', weightUsed: 80 }]]
        }])
      });

      // Mock user activity
      mockCollection.findOne.mockResolvedValue({
        workoutActivity: { completionPercentage: 80 }
      });

      // Mock consistency score calculation (countDocuments)
      mockCollection.countDocuments.mockResolvedValue(5);

      const result = await analyticsService.getDailyWorkoutAnalytics(userId, testDate);

      expect(result.date).toEqual(testDate);
      expect(result.completionPercentage).toBe(80);
      expect(result.performanceMetrics.totalWorkouts).toBe(1);
      expect(result.performanceMetrics.totalExercises).toBe(5);
      expect(result.performanceMetrics.caloriesBurned).toBe(400);
      expect(redisClient.setex).toHaveBeenCalledWith(
        `analytics:workout:daily:${userId}:2025-01-15`,
        3600,
        JSON.stringify(result)
      );
    });

    it('should handle errors and throw appropriate exception', async () => {
      (redisClient.get as jest.Mock).mockRejectedValue(new Error('Redis error'));

      await expect(analyticsService.getDailyWorkoutAnalytics(userId, testDate))
        .rejects.toThrow('Failed to calculate daily workout analytics');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Error calculating daily workout analytics',
        expect.any(Error),
        { userId, date: testDate }
      );
    });
  });

  describe('getWeeklyWorkoutProgress', () => {
    const userId = 'user123';
    const weeks = 4;

    it('should return cached weekly progress when available', async () => {
      const cachedData = {
        weeks: 4,
        strengthGains: {},
        enduranceImprovements: {},
        workoutStreaks: [],
        weeklyStats: []
      };

      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));

      const result = await analyticsService.getWeeklyWorkoutProgress(userId, undefined, undefined, weeks);

      expect(result).toEqual(cachedData);
      expect(redisClient.get).toHaveBeenCalledWith(`analytics:workout:weekly:${userId}:${weeks}`);
    });

    it('should calculate weekly progress when no cache is available', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      
      // Mock weekly aggregation
      mockCollection.aggregate.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([{
          _id: new Date('2025-01-13'), // Week start
          totalWorkouts: 3,
          completedExercises: [[]],
          avgHeartRate: 145,
          totalCalories: 1200
        }])
      });

      const result = await analyticsService.getWeeklyWorkoutProgress(userId, undefined, undefined, weeks);

      expect(result.weeks).toBe(weeks);
      expect(result.weeklyStats).toHaveLength(1);
      expect(result.weeklyStats[0].totalWorkouts).toBe(3);
      expect(redisClient.setex).toHaveBeenCalledWith(
        `analytics:workout:weekly:${userId}:${weeks}`,
        86400,
        JSON.stringify(result)
      );
    });
  });

  describe('getWorkoutHistoryAnalytics', () => {
    const userId = 'user123';
    const filters = {
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-31'),
      exerciseId: 'exercise123',
      muscleGroup: 'Chest',
      limit: 20,
      offset: 0
    };

    it('should return workout history with proper filtering and pagination', async () => {
      // Mock count aggregation
      mockCollection.aggregate.mockReturnValueOnce({
        toArray: jest.fn().mockResolvedValue([{ total: 50 }])
      });

      // Mock main aggregation
      mockCollection.aggregate.mockReturnValueOnce({
        toArray: jest.fn().mockResolvedValue([
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
        ])
      });

      const result = await analyticsService.getWorkoutHistoryAnalytics(userId, filters);

      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].exerciseName).toBe('Bench Press');
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.hasNext).toBe(true);
    });

    it('should handle empty results gracefully', async () => {
      // Mock empty count
      mockCollection.aggregate.mockReturnValueOnce({
        toArray: jest.fn().mockResolvedValue([])
      });

      // Mock empty results
      mockCollection.aggregate.mockReturnValueOnce({
        toArray: jest.fn().mockResolvedValue([])
      });

      const result = await analyticsService.getWorkoutHistoryAnalytics(userId, filters);

      expect(result.exercises).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.hasNext).toBe(false);
    });
  });

  describe('getPerformanceComparison', () => {
    const userId = 'user123';

    it('should return cached performance comparison when available', async () => {
      const cachedData = {
        userRank: 75,
        benchmarks: { avgWorkoutsPerWeek: 4 },
        percentile: 75,
        similarUserStats: { sampleSize: 50 }
      };

      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));

      const result = await analyticsService.getPerformanceComparison(userId);

      expect(result).toEqual(cachedData);
      expect(redisClient.get).toHaveBeenCalledWith(`analytics:workout:comparison:${userId}`);
    });

    it('should calculate performance comparison when no cache is available', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      // Mock user profile
      mockCollection.findOne.mockResolvedValue({
        demographics: { age: 25, gender: 'Male' },
        fitnessProfile: { level: 'intermediate' }
      });

      // Mock similar users aggregation
      mockCollection.aggregate
        .mockReturnValueOnce({
          toArray: jest.fn().mockResolvedValue([
            { _id: 'user456', demographics: { age: 26 } },
            { _id: 'user789', demographics: { age: 24 } }
          ])
        })
        // Mock user stats aggregation
        .mockReturnValueOnce({
          toArray: jest.fn().mockResolvedValue([{
            totalWorkouts: 20,
            avgDuration: 60,
            avgCalories: 400
          }])
        })
        // Mock benchmarks aggregation
        .mockReturnValueOnce({
          toArray: jest.fn().mockResolvedValue([{
            avgWorkoutsPerWeek: 3,
            avgWorkoutDuration: 50,
            avgCaloriesBurned: 350
          }])
        });

      const result = await analyticsService.getPerformanceComparison(userId);

      expect(result.similarUserStats.sampleSize).toBe(2);
      expect(result.benchmarks.avgWorkoutsPerWeek).toBe(3);
      expect(result.percentile).toBeGreaterThan(0);
      expect(redisClient.setex).toHaveBeenCalledWith(
        `analytics:workout:comparison:${userId}`,
        86400,
        JSON.stringify(result)
      );
    });

    it('should throw error when user is not found', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      mockCollection.findOne.mockResolvedValue(null);

      await expect(analyticsService.getPerformanceComparison(userId))
        .rejects.toThrow('User not found');
    });
  });

  describe('getExerciseSpecificAnalytics', () => {
    const userId = 'user123';
    const exerciseId = 'exercise123';

    it('should return cached exercise analytics when available', async () => {
      const cachedData = {
        exerciseId,
        personalRecords: { maxWeight: 100 },
        volumeProgression: [],
        techniqueScores: [],
        milestones: []
      };

      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));

      const result = await analyticsService.getExerciseSpecificAnalytics(userId, exerciseId);

      expect(result).toEqual(cachedData);
      expect(redisClient.get).toHaveBeenCalledWith(`analytics:workout:exercise:${userId}:${exerciseId}`);
    });

    it('should calculate exercise analytics when no cache is available', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      // Mock exercise data aggregation
      mockCollection.aggregate.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            date: new Date('2025-01-15'),
            exercise: {
              exerciseName: 'Bench Press',
              weightUsed: 80,
              sets: 4,
              reps: 8,
              notes: 'Good form'
            },
            volume: 2560
          },
          {
            date: new Date('2025-01-20'),
            exercise: {
              exerciseName: 'Bench Press',
              weightUsed: 85,
              sets: 4,
              reps: 8,
              notes: 'Felt strong'
            },
            volume: 2720
          }
        ])
      });

      const result = await analyticsService.getExerciseSpecificAnalytics(userId, exerciseId);

      expect(result.exerciseId).toBe(exerciseId);
      expect(result.personalRecords.maxWeight).toBe(85);
      expect(result.personalRecords.maxVolume).toBe(2720);
      expect(result.personalRecords.totalSessions).toBe(2);
      expect(result.volumeProgression).toHaveLength(2);
      expect(result.techniqueScores).toHaveLength(2);
      expect(redisClient.setex).toHaveBeenCalledWith(
        `analytics:workout:exercise:${userId}:${exerciseId}`,
        3600,
        JSON.stringify(result)
      );
    });

    it('should handle no exercise data gracefully', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      mockCollection.aggregate.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      });

      const result = await analyticsService.getExerciseSpecificAnalytics(userId, exerciseId);

      expect(result.exerciseId).toBe(exerciseId);
      expect(result.personalRecords).toEqual({});
      expect(result.volumeProgression).toHaveLength(0);
      expect(result.techniqueScores).toHaveLength(0);
      expect(result.milestones).toHaveLength(0);
    });
  });

  describe('getAutoProgressionSuggestions', () => {
    const userId = 'user123';
    const exerciseId = 'exercise123';

    it('should generate progression suggestions based on performance data', async () => {
      mockCollection.aggregate.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            _id: exerciseId,
            exerciseName: 'Bench Press',
            performances: [
              {
                date: new Date('2025-01-20'),
                weight: 85,
                sets: 4,
                reps: 8,
                volume: 2720
              },
              {
                date: new Date('2025-01-18'),
                weight: 82.5,
                sets: 4,
                reps: 8,
                volume: 2640
              },
              {
                date: new Date('2025-01-15'),
                weight: 80,
                sets: 4,
                reps: 8,
                volume: 2560
              }
            ]
          }
        ])
      });

      const result = await analyticsService.getAutoProgressionSuggestions(userId, exerciseId);

      expect(result.exerciseName).toBe('Bench Press');
      expect(result.currentStats.weight).toBe(85);
      expect(result.progressionPlan.nextSession.recommendedWeight).toBeGreaterThanOrEqual(85);
      expect(result.suggestions).toBeDefined();
    });

    it('should return null when no data is available for specific exercise', async () => {
      mockCollection.aggregate.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      });

      const result = await analyticsService.getAutoProgressionSuggestions(userId, exerciseId);

      expect(result).toBeNull();
    });

    it('should return suggestions for all exercises when no exerciseId is provided', async () => {
      mockCollection.aggregate.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            _id: 'exercise1',
            exerciseName: 'Bench Press',
            performances: [{ date: new Date(), weight: 80, sets: 4, reps: 8, volume: 2560 }]
          },
          {
            _id: 'exercise2',
            exerciseName: 'Squat',
            performances: [{ date: new Date(), weight: 100, sets: 4, reps: 8, volume: 3200 }]
          }
        ])
      });

      const result = await analyticsService.getAutoProgressionSuggestions(userId);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].exerciseName).toBe('Bench Press');
      expect(result[1].exerciseName).toBe('Squat');
    });
  });
});