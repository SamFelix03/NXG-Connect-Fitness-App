import request from 'supertest';
import mongoose from 'mongoose';
import App from '../../../src/app';
import { User } from '../../../src/models/User';
import { WorkoutPlan } from '../../../src/models/WorkoutPlan';
import { generateTestJWT } from '../../fixtures/auth.fixtures';

describe('Integrations Integration Tests', () => {
  let app: App;
  let server: any;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Initialize test app
    app = new App(0); // Use port 0 for dynamic port assignment
    await app.start();
    server = app.getServer();

    // Create test user with complete profile
    testUser = await User.create({
      username: 'integrationuser',
      email: 'integrationuser@test.com',
      passwordHash: '$2b$10$hashedpassword',
      name: 'Integration Test User',
      fitnessProfile: {
        level: 'beginner',
        goal: 'muscle_building',
        healthConditions: []
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
  });

  afterAll(async () => {
    // Cleanup
    await User.deleteMany({});
    await WorkoutPlan.deleteMany({});
    
    // Close connections
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up workout plans before each test
    await WorkoutPlan.deleteMany({ userId: testUser._id });
    // Reset user's activePlans
    await User.findByIdAndUpdate(testUser._id, {
      $unset: { 'activePlans.workoutPlanId': '' }
    });
  });

  describe('POST /api/integrations/workout-plans', () => {
    it('should create a new workout plan successfully', async () => {
      const response = await request(app.app)
        .post('/api/integrations/workout-plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          weeklyWorkoutDays: 3
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('created successfully');
      expect(response.body.data.workoutPlan).toHaveProperty('planId');
      expect(response.body.data.workoutPlan).toHaveProperty('planName');
      expect(response.body.data.isNewPlan).toBe(true);
      expect(response.body.data.nextRefreshDate).toBeDefined();

      // Verify plan was saved to database
      const savedPlan = await WorkoutPlan.findOne({ userId: testUser._id });
      expect(savedPlan).toBeTruthy();
      expect(savedPlan?.isActive).toBe(true);

      // Verify user's activePlans was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser?.activePlans?.workoutPlanId).toEqual(savedPlan?._id);
    });

    it('should return existing plan when not forcing refresh', async () => {
      // Create existing workout plan
      await WorkoutPlan.create({
        planId: 'existing-plan-123',
        planName: 'Existing Plan',
        userId: testUser._id,
        isActive: true,
        source: 'external',
        workoutDays: [
          {
            dayName: 'Day 1',
            muscleGroup: 'Push',
            exercises: [
              {
                exerciseId: 'ex-001',
                name: 'Push-ups',
                sets: 3,
                reps: '10-15',
                muscleGroup: 'Chest'
              }
            ]
          }
        ],
        weeklySchedule: 3,
        lastRefreshed: new Date(),
        cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        nextRefreshDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 2 weeks
      });

      const response = await request(app.app)
        .post('/api/integrations/workout-plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('already exists');
      expect(response.body.data.workoutPlan.planId).toBe('existing-plan-123');
      expect(response.body.data.isNewPlan).toBe(false);
    });

    it('should force refresh when requested', async () => {
      // Create existing workout plan
      await WorkoutPlan.create({
        planId: 'old-plan-123',
        planName: 'Old Plan',
        userId: testUser._id,
        isActive: true,
        source: 'external',
        workoutDays: [
          {
            dayName: 'Day 1',
            muscleGroup: 'Push',
            exercises: [
              {
                exerciseId: 'ex-001',
                name: 'Push-ups',
                sets: 3,
                reps: '10-15',
                muscleGroup: 'Chest'
              }
            ]
          }
        ],
        weeklySchedule: 3,
        lastRefreshed: new Date(),
        cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        nextRefreshDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 2 weeks
      });

      const response = await request(app.app)
        .post('/api/integrations/workout-plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          forceRefresh: true,
          weeklyWorkoutDays: 4
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('refreshed successfully');
      expect(response.body.data.isNewPlan).toBe(true);

      // Verify old plan was deactivated
      const oldPlan = await WorkoutPlan.findOne({ planId: 'old-plan-123' });
      expect(oldPlan?.isActive).toBe(false);

      // Verify new plan exists and is active
      const activePlans = await WorkoutPlan.find({ userId: testUser._id, isActive: true });
      expect(activePlans).toHaveLength(1);
      expect(activePlans[0]?.planId).not.toBe('old-plan-123');
    });

    it('should reject incomplete user profiles', async () => {
      // Create user with incomplete profile
      const incompleteUser = await User.create({
        username: 'incompleteuser',
        email: 'incomplete@test.com',
        passwordHash: '$2b$10$hashedpassword',
        name: 'Incomplete User',
        fitnessProfile: {
          level: 'beginner'
          // Missing goal
        },
        demographics: {
          age: 25
          // Missing height and weight
        }
      });

      const incompleteToken = generateTestJWT(incompleteUser._id.toString());

      const response = await request(app.app)
        .post('/api/integrations/workout-plans')
        .set('Authorization', `Bearer ${incompleteToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Incomplete user profile');

      // Cleanup
      await User.findByIdAndDelete(incompleteUser._id);
    });

    it('should require authentication', async () => {
      const response = await request(app.app)
        .post('/api/integrations/workout-plans')
        .send({})
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate request body', async () => {
      const response = await request(app.app)
        .post('/api/integrations/workout-plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          weeklyWorkoutDays: 10, // Invalid - max is 7
          forceRefresh: 'not-boolean' // Invalid type
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid request data');
    });
  });

  describe('GET /api/integrations/workout-plans/status', () => {
    it('should return status for user with active plan', async () => {
      // Create active workout plan
      const activePlan = await WorkoutPlan.create({
        planId: 'status-test-plan',
        planName: 'Status Test Plan',
        userId: testUser._id,
        isActive: true,
        source: 'external',
        workoutDays: [
          {
            dayName: 'Day 1',
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
        lastRefreshed: new Date(),
        cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        nextRefreshDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 2 weeks
      });

      // Update user's activePlans
      await User.findByIdAndUpdate(testUser._id, {
        'activePlans.workoutPlanId': activePlan._id
      });

      const response = await request(app.app)
        .get('/api/integrations/workout-plans/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.planStatus).toBe('active');
      expect(response.body.data.hasActivePlan).toBe(true);
      expect(response.body.data.profileComplete).toBe(true);
      expect(response.body.data.needsRefresh).toBe(false);
      expect(response.body.data.isExpired).toBe(false);
      expect(response.body.data.currentPlan).toHaveProperty('planId', 'status-test-plan');
      expect(response.body.data.statistics.totalPlansCount).toBe(1);
      expect(response.body.data.recommendations.shouldCreatePlan).toBe(false);
    });

    it('should return status for user without active plan', async () => {
      const response = await request(app.app)
        .get('/api/integrations/workout-plans/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.planStatus).toBe('none');
      expect(response.body.data.hasActivePlan).toBe(false);
      expect(response.body.data.profileComplete).toBe(true);
      expect(response.body.data.currentPlan).toBeNull();
      expect(response.body.data.statistics.totalPlansCount).toBe(0);
      expect(response.body.data.recommendations.shouldCreatePlan).toBe(true);
    });

    it('should detect expired plans', async () => {
      // Create expired workout plan
      await WorkoutPlan.create({
        planId: 'expired-plan',
        planName: 'Expired Plan',
        userId: testUser._id,
        isActive: true,
        source: 'external',
        workoutDays: [
          {
            dayName: 'Day 1',
            muscleGroup: 'Push',
            exercises: [
              {
                exerciseId: 'ex-001',
                name: 'Push-ups',
                sets: 3,
                reps: '10-15',
                muscleGroup: 'Chest'
              }
            ]
          }
        ],
        weeklySchedule: 3,
        lastRefreshed: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        cacheExpiry: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Expired 5 days ago
        nextRefreshDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // Should have refreshed 3 days ago
      });

      const response = await request(app.app)
        .get('/api/integrations/workout-plans/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.planStatus).toBe('expired');
      expect(response.body.data.hasActivePlan).toBe(true);
      expect(response.body.data.needsRefresh).toBe(true);
      expect(response.body.data.isExpired).toBe(true);
      expect(response.body.data.recommendations.shouldUpdateExpiredPlan).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app.app)
        .get('/api/integrations/workout-plans/status')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/integrations/workout-plans/:planId', () => {
    it('should deactivate workout plan successfully', async () => {
      // Create active workout plan
      const activePlan = await WorkoutPlan.create({
        planId: 'delete-test-plan',
        planName: 'Delete Test Plan',
        userId: testUser._id,
        isActive: true,
        source: 'external',
        workoutDays: [
          {
            dayName: 'Day 1',
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
        lastRefreshed: new Date(),
        cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        nextRefreshDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      });

      // Update user's activePlans
      await User.findByIdAndUpdate(testUser._id, {
        'activePlans.workoutPlanId': activePlan._id
      });

      const response = await request(app.app)
        .delete('/api/integrations/workout-plans/delete-test-plan')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deactivated successfully');
      expect(response.body.data.deactivatedPlan.planId).toBe('delete-test-plan');

      // Verify plan was deactivated
      const deactivatedPlan = await WorkoutPlan.findById(activePlan._id);
      expect(deactivatedPlan?.isActive).toBe(false);

      // Verify user's activePlans reference was removed
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser?.activePlans?.workoutPlanId).toBeUndefined();
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app.app)
        .delete('/api/integrations/workout-plans/non-existent-plan')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should not allow deactivating other users\' plans', async () => {
      // Create another user and their workout plan
      const otherUser = await User.create({
        username: 'otheruser',
        email: 'other@test.com',
        passwordHash: '$2b$10$hashedpassword',
        name: 'Other User',
        fitnessProfile: { level: 'beginner', goal: 'weight_loss' },
        demographics: { age: 30, heightCm: 170, weightKg: 65 }
      });

      const otherUserPlan = await WorkoutPlan.create({
        planId: 'other-user-plan',
        planName: 'Other User Plan',
        userId: otherUser._id,
        isActive: true,
        source: 'external',
        workoutDays: [
          {
            dayName: 'Day 1',
            muscleGroup: 'Push',
            exercises: [
              {
                exerciseId: 'ex-001',
                name: 'Push-ups',
                sets: 3,
                reps: '10-15',
                muscleGroup: 'Chest'
              }
            ]
          }
        ],
        weeklySchedule: 3,
        lastRefreshed: new Date(),
        cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        nextRefreshDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      });

      const response = await request(app.app)
        .delete('/api/integrations/workout-plans/other-user-plan')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);

      // Verify other user's plan is still active
      const stillActivePlan = await WorkoutPlan.findById(otherUserPlan._id);
      expect(stillActivePlan?.isActive).toBe(true);

      // Cleanup
      await User.findByIdAndDelete(otherUser._id);
      await WorkoutPlan.findByIdAndDelete(otherUserPlan._id);
    });

    it('should require authentication', async () => {
      const response = await request(app.app)
        .delete('/api/integrations/workout-plans/any-plan')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/integrations/health', () => {
    it('should return health status', async () => {
      const response = await request(app.app)
        .get('/api/integrations/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('healthy');
      expect(response.body.data.service).toBe('integrations');
      expect(response.body.data.status).toBe('operational');
      expect(response.body.data.availableEndpoints).toContain('POST /api/integrations/workout-plans');
      expect(response.body.data.externalServices).toHaveProperty('workoutPlanningService');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply strict rate limiting to workout plan creation', async () => {
      // Make multiple rapid requests to test strict rate limiting
      const requests = Array.from({ length: 15 }, () =>
        request(app.app)
          .post('/api/integrations/workout-plans')
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
      );

      const responses = await Promise.allSettled(requests);
      
      // Some requests should be rate limited (429) due to strict limits
      const statusCodes = responses.map(r => 
        r.status === 'fulfilled' ? r.value.status : 500
      );

      expect(statusCodes).toContain(429);
    }, 30000);
  });

  describe('Transaction Integrity', () => {
    it('should maintain data consistency during plan creation', async () => {
      const response = await request(app.app)
        .post('/api/integrations/workout-plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(201);

      const planId = response.body.data.workoutPlan.id;

      // Verify database consistency
      const workoutPlan = await WorkoutPlan.findById(planId);
      const user = await User.findById(testUser._id);

      expect(workoutPlan).toBeTruthy();
      expect(workoutPlan?.isActive).toBe(true);
      expect(user?.activePlans?.workoutPlanId).toEqual(workoutPlan?._id);
    });

    it('should handle concurrent plan creation attempts', async () => {
      // Simulate concurrent requests
      const concurrentRequests = Array.from({ length: 3 }, () =>
        request(app.app)
          .post('/api/integrations/workout-plans')
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
      );

      const responses = await Promise.all(concurrentRequests);

      // Should have at most 1 successful creation and 2 existing plan responses
      const successfulCreations = responses.filter(r => r.status === 201);
      const existingPlanResponses = responses.filter(r => r.status === 200);

      expect(successfulCreations.length).toBeLessThanOrEqual(1);
      expect(successfulCreations.length + existingPlanResponses.length).toBe(3);

      // Verify only one active plan exists
      const activePlans = await WorkoutPlan.find({ userId: testUser._id, isActive: true });
      expect(activePlans).toHaveLength(1);
    }, 30000);
  });
});