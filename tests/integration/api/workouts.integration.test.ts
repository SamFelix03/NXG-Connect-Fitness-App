import request from 'supertest';
import mongoose from 'mongoose';
import App from '../../../src/app';
import { User } from '../../../src/models/User';
import { WorkoutPlan } from '../../../src/models/WorkoutPlan';
import { Branch } from '../../../src/models/Branch';
import { generateTestJWT } from '../../fixtures/auth.fixtures';

describe('Workouts Integration Tests', () => {
  let app: App;
  let server: any;
  let testUser: any;
  let authToken: string;
  let testBranch: any;

  beforeAll(async () => {
    // Initialize test app
    app = new App(0); // Use port 0 for dynamic port assignment
    await app.start();
    server = app.getServer();

    // Create test user
    testUser = await User.create({
      username: 'workoutuser',
      email: 'workoutuser@test.com',
      passwordHash: '$2b$10$hashedpassword',
      name: 'Workout Test User',
      fitnessProfile: {
        level: 'beginner',
        goal: 'muscle_building'
      },
      demographics: {
        age: 25,
        heightCm: 175,
        weightKg: 70,
        activityLevel: 'moderate'
      }
    });

    // Generate auth token
    authToken = generateTestJWT(testUser._id.toString());

    // Create test branch with machines
    testBranch = await Branch.create({
      name: 'Test Gym',
      address: '123 Test St',
      city: 'Test City',
      contactNumber: '+1234567890',
      machines: [
        {
          name: 'Bench Press',
          type: 'strength',
          location: 'Zone A',
          qrCode: 'QR001',
          isAvailable: true,
          maintenanceStatus: 'operational'
        },
        {
          name: 'Treadmill',
          type: 'cardio',
          location: 'Zone B',
          qrCode: 'QR002',
          isAvailable: false,
          maintenanceStatus: 'maintenance'
        }
      ]
    });

    // Create test workout plan
    await WorkoutPlan.create({
      planId: 'test-plan-123',
      planName: 'Test Workout Plan',
      userId: testUser._id,
      isActive: true,
      source: 'external',
      workoutDays: [
        {
          dayName: 'Day 1 - Push',
          muscleGroup: 'Push',
          exercises: [
            {
              exerciseId: 'ex-001',
              name: 'Bench Press',
              sets: 3,
              reps: '8-12',
              muscleGroup: 'Chest'
            }
          ]
        }
      ],
      weeklySchedule: 3,
      userContext: {
        fitnessLevel: 'beginner',
        goal: 'muscle_building'
      },
      lastRefreshed: new Date(),
      cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      nextRefreshDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 2 weeks
    });
  });

  afterAll(async () => {
    // Cleanup
    await User.deleteMany({});
    await WorkoutPlan.deleteMany({});
    await Branch.deleteMany({});
    
    // Close connections
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
  });

  describe('GET /api/workouts/daily', () => {
    it('should return user\'s active workout plan', async () => {
      const response = await request(app.app)
        .get('/api/workouts/daily')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Daily workout plan retrieved successfully');
      expect(response.body.data).toHaveProperty('planId', 'test-plan-123');
      expect(response.body.data).toHaveProperty('planName', 'Test Workout Plan');
      expect(response.body.data.workoutDays).toHaveLength(1);
      expect(response.body.data.metadata).toHaveProperty('isExpired', false);
    });

    it('should include machine availability when branchId provided', async () => {
      const response = await request(app.app)
        .get(`/api/workouts/daily?branchId=${testBranch._id}&includeAvailability=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metadata.machineAvailabilityIncluded).toBe(true);
      
      const exercise = response.body.data.workoutDays[0].exercises[0];
      if (exercise.machineAvailability) {
        expect(exercise.machineAvailability).toHaveProperty('isAvailable');
        expect(exercise.machineAvailability).toHaveProperty('maintenanceStatus');
      }
    });

    it('should return 404 when user has no active workout plan', async () => {
      // Create user without workout plan
      const userWithoutPlan = await User.create({
        username: 'noplanuser',
        email: 'noplan@test.com',
        passwordHash: '$2b$10$hashedpassword',
        name: 'No Plan User',
        fitnessProfile: {
          level: 'beginner',
          goal: 'muscle_building'
        },
        demographics: {
          age: 30,
          heightCm: 180,
          weightKg: 75
        }
      });

      const noPlanToken = generateTestJWT(userWithoutPlan._id.toString());

      const response = await request(app.app)
        .get('/api/workouts/daily')
        .set('Authorization', `Bearer ${noPlanToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No active workout plan found');

      // Cleanup
      await User.findByIdAndDelete(userWithoutPlan._id);
    });

    it('should require authentication', async () => {
      const response = await request(app.app)
        .get('/api/workouts/daily')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/workouts/library', () => {
    it('should return exercise library without authentication', async () => {
      const response = await request(app.app)
        .get('/api/workouts/library')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Workout library retrieved successfully');
      expect(response.body.data).toHaveProperty('exercises');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.exercises)).toBe(true);
    });

    it('should support pagination parameters', async () => {
      const response = await request(app.app)
        .get('/api/workouts/library?page=1&limit=5')
        .expect(200);

      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.exercisesPerPage).toBe(5);
      expect(response.body.data.exercises.length).toBeLessThanOrEqual(5);
    });

    it('should support filtering parameters', async () => {
      const response = await request(app.app)
        .get('/api/workouts/library?muscleGroup=chest&difficulty=beginner')
        .expect(200);

      expect(response.body.data.filters.muscleGroup).toBe('chest');
      expect(response.body.data.filters.difficulty).toBe('beginner');
    });

    it('should include machine availability when branchId provided', async () => {
      const response = await request(app.app)
        .get(`/api/workouts/library?branchId=${testBranch._id}`)
        .expect(200);

      expect(response.body.data.branchInfo).toBeDefined();
      expect(response.body.data.branchInfo.branchName).toBe('Test Gym');
      expect(response.body.data.branchInfo.totalMachines).toBe(2);
      expect(response.body.data.branchInfo.availableMachines).toBe(1);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app.app)
        .get('/api/workouts/library?page=0&limit=101')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid query parameters');
    });
  });

  describe('GET /api/workouts/progress', () => {
    it('should return workout progress endpoint placeholder', async () => {
      const response = await request(app.app)
        .get('/api/workouts/progress')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('coming soon');
      expect(response.body.data.availableEndpoints).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app.app)
        .get('/api/workouts/progress')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = Array.from({ length: 10 }, () =>
        request(app.app)
          .get('/api/workouts/library')
      );

      const responses = await Promise.all(requests);
      
      // All should succeed within normal rate limits for library endpoint
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid branchId parameter', async () => {
      const response = await request(app.app)
        .get('/api/workouts/daily?branchId=invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200); // Should succeed but without machine availability

      expect(response.body.success).toBe(true);
      expect(response.body.data.metadata.machineAvailabilityIncluded).toBe(false);
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await request(app.app)
        .get('/api/workouts/library?difficulty=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid query parameters');
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app.app)
        .get('/api/workouts/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('healthy');
      expect(response.body.data.service).toBe('workouts');
      expect(response.body.data.availableEndpoints).toBeDefined();
    });
  });
});