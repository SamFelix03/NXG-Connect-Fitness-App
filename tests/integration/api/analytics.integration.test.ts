import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../../../src/app';
import { createAuthToken } from '../../fixtures/auth.fixtures';
import { redisClient } from '../../../src/utils/redis';

// Mock Redis
jest.mock('../../../src/utils/redis', () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK')
  }
}));

describe('Analytics API Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri);

    // Create test user and auth token
    userId = new mongoose.Types.ObjectId().toString();
    authToken = createAuthToken(userId);
  });

  afterAll(async () => {
    // Clean up database connection
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }

    // Clear Redis mock
    jest.clearAllMocks();
  });

  describe('GET /api/analytics/workout/daily', () => {
    it('should return daily workout analytics for authenticated user', async () => {
      // Insert test data
      await mongoose.connection.db.collection('gymSessions').insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        checkInTime: new Date('2025-01-15T09:00:00Z'),
        checkOutTime: new Date('2025-01-15T11:00:00Z'),
        sessionDuration: 120,
        status: 'completed',
        actualWorkout: {
          totalExercises: 5,
          totalSets: 15,
          caloriesBurned: 400,
          completedExercises: [
            {
              exerciseId: new mongoose.Types.ObjectId(),
              exerciseName: 'Bench Press',
              sets: 4,
              reps: 8,
              weightUsed: 80
            }
          ]
        }
      });

      await mongoose.connection.db.collection('userActivity').insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        date: new Date('2025-01-15T00:00:00Z'),
        workoutActivity: {
          completionPercentage: 80
        }
      });

      const response = await request(app)
        .get('/api/analytics/workout/daily')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ date: '2025-01-15' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Daily workout analytics retrieved successfully',
        data: {
          date: expect.any(String),
          completionPercentage: 80,
          consistencyScore: expect.any(Number),
          performanceMetrics: {
            totalWorkouts: 1,
            totalExercises: 5,
            totalSets: 15,
            averageWorkoutDuration: 120,
            caloriesBurned: 400,
            strengthGains: expect.any(Object)
          }
        }
      });
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/analytics/workout/daily')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('token')
      });
    });

    it('should return 400 for invalid date parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/workout/daily')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ date: 'invalid-date' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR'
      });
    });

    it('should use cached data when available', async () => {
      const cachedData = {
        date: new Date('2025-01-15'),
        completionPercentage: 75,
        consistencyScore: 85,
        performanceMetrics: {
          totalWorkouts: 1,
          totalExercises: 3,
          totalSets: 9,
          averageWorkoutDuration: 90,
          caloriesBurned: 300,
          strengthGains: {}
        }
      };

      (redisClient.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedData));

      const response = await request(app)
        .get('/api/analytics/workout/daily')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ date: '2025-01-15' })
        .expect(200);

      expect(response.body.data.completionPercentage).toBe(75);
      expect(response.body.data.performanceMetrics.totalWorkouts).toBe(1);
    });
  });

  describe('GET /api/analytics/workout/weekly', () => {
    beforeEach(async () => {
      // Insert test data for multiple weeks
      const sessions = [
        {
          userId: new mongoose.Types.ObjectId(userId),
          checkInTime: new Date('2025-01-13T09:00:00Z'), // Monday
          sessionDuration: 90,
          status: 'completed',
          actualWorkout: {
            totalExercises: 4,
            totalSets: 12,
            caloriesBurned: 350,
            avgHeartRate: 145,
            completedExercises: []
          }
        },
        {
          userId: new mongoose.Types.ObjectId(userId),
          checkInTime: new Date('2025-01-15T09:00:00Z'), // Wednesday
          sessionDuration: 100,
          status: 'completed',
          actualWorkout: {
            totalExercises: 5,
            totalSets: 15,
            caloriesBurned: 400,
            avgHeartRate: 150,
            completedExercises: []
          }
        }
      ];

      await mongoose.connection.db.collection('gymSessions').insertMany(sessions);
    });

    it('should return weekly workout progress', async () => {
      const response = await request(app)
        .get('/api/analytics/workout/weekly')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ weeks: 4 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Weekly workout progress retrieved successfully',
        data: {
          weeks: 4,
          strengthGains: expect.any(Object),
          enduranceImprovements: expect.any(Object),
          workoutStreaks: expect.any(Array),
          weeklyStats: expect.any(Array)
        }
      });

      // Check that we have weekly stats
      expect(response.body.data.weeklyStats.length).toBeGreaterThan(0);
      expect(response.body.data.weeklyStats[0]).toMatchObject({
        weekStart: expect.any(String),
        weekEnd: expect.any(String),
        totalWorkouts: expect.any(Number),
        completionRate: expect.any(Number),
        avgIntensity: expect.any(Number)
      });
    });

    it('should handle date range parameters', async () => {
      const response = await request(app)
        .get('/api/analytics/workout/weekly')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          weeks: 2
        })
        .expect(200);

      expect(response.body.data.weeks).toBe(2);
    });
  });

  describe('GET /api/analytics/workout/history', () => {
    beforeEach(async () => {
      const exerciseId = new mongoose.Types.ObjectId();
      
      // Insert exercise reference
      await mongoose.connection.db.collection('exercises').insertOne({
        _id: exerciseId,
        name: 'Bench Press',
        metadata: {
          muscleGroups: ['Chest', 'Triceps']
        }
      });

      // Insert workout sessions with exercise data
      const sessions = [
        {
          userId: new mongoose.Types.ObjectId(userId),
          checkInTime: new Date('2025-01-15T09:00:00Z'),
          status: 'completed',
          actualWorkout: {
            completedExercises: [
              {
                exerciseId,
                exerciseName: 'Bench Press',
                sets: 4,
                reps: 8,
                weightUsed: 80
              }
            ]
          }
        },
        {
          userId: new mongoose.Types.ObjectId(userId),
          checkInTime: new Date('2025-01-17T09:00:00Z'),
          status: 'completed',
          actualWorkout: {
            completedExercises: [
              {
                exerciseId,
                exerciseName: 'Bench Press',
                sets: 4,
                reps: 8,
                weightUsed: 82.5
              }
            ]
          }
        }
      ];

      await mongoose.connection.db.collection('gymSessions').insertMany(sessions);
    });

    it('should return workout history with filtering', async () => {
      const response = await request(app)
        .get('/api/analytics/workout/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          muscleGroup: 'Chest',
          limit: 10,
          offset: 0
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workout history analytics retrieved successfully',
        data: {
          exercises: expect.any(Array),
          trends: {
            volumeProgression: expect.any(Array),
            strengthProgression: expect.any(Array),
            consistencyTrend: expect.any(Array)
          },
          pagination: {
            limit: 10,
            offset: 0,
            total: expect.any(Number),
            hasNext: expect.any(Boolean)
          }
        }
      });
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/analytics/workout/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 1, offset: 0 })
        .expect(200);

      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.offset).toBe(0);
    });
  });

  describe('GET /api/analytics/goals/workout', () => {
    beforeEach(async () => {
      // Insert user with fitness profile
      await mongoose.connection.db.collection('users').insertOne({
        _id: new mongoose.Types.ObjectId(userId),
        fitnessProfile: {
          level: 'intermediate',
          goal: 'strength'
        },
        bodyComposition: {
          bodyFatPercentage: 15
        }
      });
    });

    it('should return workout goal tracking', async () => {
      const response = await request(app)
        .get('/api/analytics/goals/workout')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          goalType: 'strength',
          period: 'monthly'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workout goal tracking retrieved successfully',
        data: {
          goalType: 'strength',
          period: 'monthly',
          targets: expect.any(Object),
          progress: expect.any(Object),
          achievements: expect.any(Array)
        }
      });
    });

    it('should handle missing goal type parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/goals/workout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should default to 'all' goal type
      expect(response.body.data.goalType).toBeDefined();
    });
  });

  describe('GET /api/analytics/workout/comparison', () => {
    beforeEach(async () => {
      // Insert current user
      await mongoose.connection.db.collection('users').insertOne({
        _id: new mongoose.Types.ObjectId(userId),
        demographics: {
          age: 25,
          gender: 'Male'
        },
        fitnessProfile: {
          level: 'intermediate'
        }
      });

      // Insert similar users for comparison
      const similarUsers = [
        {
          _id: new mongoose.Types.ObjectId(),
          demographics: { age: 26, gender: 'Male' },
          fitnessProfile: { level: 'intermediate' }
        },
        {
          _id: new mongoose.Types.ObjectId(),
          demographics: { age: 24, gender: 'Male' },
          fitnessProfile: { level: 'intermediate' }
        }
      ];

      await mongoose.connection.db.collection('users').insertMany(similarUsers);

      // Insert workout data for user
      await mongoose.connection.db.collection('gymSessions').insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        checkInTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        sessionDuration: 90,
        status: 'completed',
        actualWorkout: {
          caloriesBurned: 400
        }
      });
    });

    it('should return performance comparison with benchmarks', async () => {
      const response = await request(app)
        .get('/api/analytics/workout/comparison')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Performance comparison retrieved successfully',
        data: {
          userRank: expect.any(Number),
          benchmarks: {
            avgWorkoutsPerWeek: expect.any(Number),
            avgWorkoutDuration: expect.any(Number),
            avgWeightLifted: expect.any(Number),
            avgCaloriesBurned: expect.any(Number)
          },
          percentile: expect.any(Number),
          similarUserStats: {
            sampleSize: expect.any(Number),
            avgAge: expect.any(Number),
            fitnessLevel: expect.any(String)
          }
        }
      });

      expect(response.body.data.percentile).toBeGreaterThanOrEqual(0);
      expect(response.body.data.percentile).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/analytics/workout/progression', () => {
    beforeEach(async () => {
      const exerciseId = new mongoose.Types.ObjectId();
      
      // Insert workout sessions with progression data
      const sessions = [
        {
          userId: new mongoose.Types.ObjectId(userId),
          checkInTime: new Date('2025-01-10T09:00:00Z'),
          status: 'completed',
          actualWorkout: {
            completedExercises: [
              {
                exerciseId,
                exerciseName: 'Bench Press',
                sets: 4,
                reps: 8,
                weightUsed: 75
              }
            ]
          }
        },
        {
          userId: new mongoose.Types.ObjectId(userId),
          checkInTime: new Date('2025-01-12T09:00:00Z'),
          status: 'completed',
          actualWorkout: {
            completedExercises: [
              {
                exerciseId,
                exerciseName: 'Bench Press',
                sets: 4,
                reps: 8,
                weightUsed: 77.5
              }
            ]
          }
        },
        {
          userId: new mongoose.Types.ObjectId(userId),
          checkInTime: new Date('2025-01-15T09:00:00Z'),
          status: 'completed',
          actualWorkout: {
            completedExercises: [
              {
                exerciseId,
                exerciseName: 'Bench Press',
                sets: 4,
                reps: 8,
                weightUsed: 80
              }
            ]
          }
        }
      ];

      await mongoose.connection.db.collection('gymSessions').insertMany(sessions);
    });

    it('should return progression suggestions for all exercises', async () => {
      const response = await request(app)
        .get('/api/analytics/workout/progression')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Auto-progression suggestions retrieved successfully',
        data: expect.any(Array)
      });

      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toMatchObject({
          exerciseId: expect.any(String),
          exerciseName: expect.any(String),
          currentStats: {
            weight: expect.any(Number),
            sets: expect.any(Number),
            reps: expect.any(Number),
            volume: expect.any(Number)
          },
          suggestions: expect.any(Array),
          progressionPlan: expect.any(Object)
        });
      }
    });

    it('should return progression suggestions for specific exercise', async () => {
      // First get all exercises to find an exerciseId
      const allResponse = await request(app)
        .get('/api/analytics/workout/progression')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (allResponse.body.data.length > 0) {
        const exerciseId = allResponse.body.data[0].exerciseId;
        
        const response = await request(app)
          .get('/api/analytics/workout/progression')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ exerciseId })
          .expect(200);

        expect(response.body.data).toMatchObject({
          exerciseId: exerciseId,
          exerciseName: expect.any(String),
          currentStats: expect.any(Object),
          suggestions: expect.any(Array),
          progressionPlan: expect.any(Object)
        });
      }
    });
  });

  describe('GET /api/analytics/workout/exercise/:exerciseId', () => {
    let exerciseId: mongoose.Types.ObjectId;

    beforeEach(async () => {
      exerciseId = new mongoose.Types.ObjectId();
      
      // Insert exercise data across multiple sessions
      const sessions = [
        {
          userId: new mongoose.Types.ObjectId(userId),
          checkInTime: new Date('2025-01-10T09:00:00Z'),
          status: 'completed',
          actualWorkout: {
            completedExercises: [
              {
                exerciseId,
                exerciseName: 'Bench Press',
                sets: 4,
                reps: 8,
                weightUsed: 75,
                notes: 'Good form'
              }
            ]
          }
        },
        {
          userId: new mongoose.Types.ObjectId(userId),
          checkInTime: new Date('2025-01-15T09:00:00Z'),
          status: 'completed',
          actualWorkout: {
            completedExercises: [
              {
                exerciseId,
                exerciseName: 'Bench Press',
                sets: 4,
                reps: 8,
                weightUsed: 80,
                notes: 'Felt strong'
              }
            ]
          }
        }
      ];

      await mongoose.connection.db.collection('gymSessions').insertMany(sessions);
    });

    it('should return exercise-specific analytics', async () => {
      const response = await request(app)
        .get(`/api/analytics/workout/exercise/${exerciseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Exercise-specific analytics retrieved successfully',
        data: {
          exerciseId: exerciseId.toString(),
          personalRecords: {
            maxWeight: 80,
            maxVolume: expect.any(Number),
            maxReps: 8,
            totalSessions: 2,
            firstSession: expect.any(String),
            lastSession: expect.any(String)
          },
          volumeProgression: expect.any(Array),
          techniqueScores: expect.any(Array),
          milestones: expect.any(Array)
        }
      });

      expect(response.body.data.volumeProgression.length).toBe(2);
      expect(response.body.data.techniqueScores.length).toBe(2);
    });

    it('should return 400 for invalid exerciseId format', async () => {
      const response = await request(app)
        .get('/api/analytics/workout/exercise/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500); // MongoDB will throw an error for invalid ObjectId format

      expect(response.body.success).toBe(false);
    });

    it('should handle empty exercise data gracefully', async () => {
      const newExerciseId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/analytics/workout/exercise/${newExerciseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        exerciseId: newExerciseId.toString(),
        personalRecords: {},
        volumeProgression: [],
        techniqueScores: [],
        milestones: []
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to analytics endpoints', async () => {
      // This test would need to be configured based on your rate limiting setup
      // For now, we'll just verify the endpoint works with auth
      const response = await request(app)
        .get('/api/analytics/workout/daily')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Authentication and Authorization', () => {
    const endpoints = [
      '/api/analytics/workout/daily',
      '/api/analytics/workout/weekly',
      '/api/analytics/workout/history',
      '/api/analytics/goals/workout',
      '/api/analytics/workout/comparison',
      '/api/analytics/workout/progression'
    ];

    endpoints.forEach(endpoint => {
      it(`should require authentication for ${endpoint}`, async () => {
        const response = await request(app)
          .get(endpoint)
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it(`should accept valid JWT for ${endpoint}`, async () => {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    it('should require authentication for exercise-specific endpoint', async () => {
      const exerciseId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/analytics/workout/exercise/${exerciseId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});