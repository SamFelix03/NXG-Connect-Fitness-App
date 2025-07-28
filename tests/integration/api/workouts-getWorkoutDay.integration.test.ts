import request from 'supertest';
import App from '../../../src/app';
import { User } from '../../../src/models/User';
import { WorkoutPlan } from '../../../src/models/WorkoutPlan';
import { Branch } from '../../../src/models/Branch';
import { generateTestJWT } from '../../fixtures/auth.fixtures';

describe('GET /api/workouts/days/:muscleGroup - Integration Test', () => {
  let app: App;
  let server: any;
  let testUser: any;
  let authToken: string;
  let testBranch: any;

  beforeAll(async () => {
    // Initialize test app
    app = new App(0);
    await app.start();
    server = app.getServer();
  });

  afterAll(async () => {
    // Cleanup will be handled by graceful shutdown
  });

  beforeEach(async () => {
    // Clear all collections
    await User.deleteMany({});
    await WorkoutPlan.deleteMany({});
    await Branch.deleteMany({});

    // Create test user
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: '$2b$10$hashedpassword',
      name: 'Test User',
      isActive: true,
      emailVerified: true,
      fitnessProfile: {
        level: 'intermediate',
        goal: 'muscle_building'
      }
    });

    // Generate auth token
    authToken = generateTestJWT(testUser._id.toString());

    // Create test branch with machines
    testBranch = await Branch.create({
      name: 'Test Gym Downtown',
      address: '123 Test Street',
      city: 'Test City',
      contactNumber: '+1234567890',
      machines: [
        {
          name: 'Bench Press',
          description: 'Olympic bench press station',
          location: 'Free weights area',
          type: 'strength',
          modelNumber: 'BP-2024',
          qrCode: 'NXG-BP-001',
          isAvailable: true,
          lastMaintenance: new Date()
        },
        {
          name: 'Incline Dumbbell Press',
          description: 'Adjustable incline bench',
          location: 'Dumbbell area', 
          type: 'strength',
          modelNumber: 'IDP-2024',
          qrCode: 'NXG-IDP-002',
          isAvailable: false,
          lastMaintenance: new Date()
        },
        {
          name: 'Chest Fly Machine',
          description: 'Cable chest fly',
          location: 'Cable area',
          type: 'strength',
          modelNumber: 'CF-2024',
          qrCode: 'NXG-CF-003',
          isAvailable: true,
          lastMaintenance: new Date()
        }
      ]
    });

    // Create test workout plan with chest exercises
    await WorkoutPlan.create({
      planId: 'test-plan-123',
      planName: 'Test Muscle Building Plan',
      userId: testUser._id,
      isActive: true,
      source: 'external',
      cacheExpiry: new Date(Date.now() + 86400000), // 24 hours from now
      lastRefreshed: new Date(),
      nextRefreshDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
      weeklySchedule: 5,
      planDuration: 12,
      difficultyLevel: 'intermediate',
      workoutDays: [
        {
          dayName: 'Day 1 - Chest',
          muscleGroup: 'Chest',
          estimatedDuration: 75,
          exercises: [
            {
              exerciseId: 'ex-001',
              name: 'Bench Press',
              description: 'Compound chest exercise',
              sets: 4,
              reps: '8-10',
              restTime: 120,
              muscleGroup: 'Chest',
              equipment: 'Barbell',
              difficulty: 'intermediate'
            },
            {
              exerciseId: 'ex-002', 
              name: 'Incline Dumbbell Press',
              description: 'Upper chest focus',
              sets: 3,
              reps: '10-12',
              restTime: 90,
              muscleGroup: 'Chest',
              equipment: 'Dumbbell',
              difficulty: 'intermediate'
            },
            {
              exerciseId: 'ex-003',
              name: 'Chest Fly Machine',
              description: 'Isolation exercise',
              sets: 3,
              reps: '12-15',
              restTime: 60,
              muscleGroup: 'Chest',
              equipment: 'Machine',
              difficulty: 'beginner'
            }
          ],
          isRestDay: false
        },
        {
          dayName: 'Day 2 - Back',
          muscleGroup: 'Back',
          estimatedDuration: 70,
          exercises: [
            {
              exerciseId: 'ex-004',
              name: 'Deadlifts',
              sets: 4,
              reps: '6-8',
              restTime: 180,
              muscleGroup: 'Back',
              equipment: 'Barbell'
            }
          ],
          isRestDay: false
        }
      ]
    });
  });

  describe('GET /api/workouts/days/chest - Without Branch ID', () => {
    it('should return exact structure without machine availability', async () => {
      const response = await request(server)
        .get('/api/workouts/days/chest')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify exact response structure
      expect(response.body).toEqual({
        success: true,
        message: 'chest workout exercises retrieved successfully',
        data: {
          muscleGroup: 'Chest',
          exercises: [
            {
              exerciseId: 'ex-001',
              name: 'Bench Press',
              description: 'Compound chest exercise',
              sets: 4,
              reps: '8-10',
              restTime: 120,
              muscleGroup: 'Chest',
              equipment: 'Barbell',
              difficulty: 'intermediate',
              machineAvailability: null
            },
            {
              exerciseId: 'ex-002',
              name: 'Incline Dumbbell Press', 
              description: 'Upper chest focus',
              sets: 3,
              reps: '10-12',
              restTime: 90,
              muscleGroup: 'Chest',
              equipment: 'Dumbbell',
              difficulty: 'intermediate',
              machineAvailability: null
            },
            {
              exerciseId: 'ex-003',
              name: 'Chest Fly Machine',
              description: 'Isolation exercise',
              sets: 3,
              reps: '12-15',
              restTime: 60,
              muscleGroup: 'Chest',
              equipment: 'Machine',
              difficulty: 'beginner',
              machineAvailability: null
            }
          ],
          metadata: {
            planId: 'test-plan-123',
            planName: 'Test Muscle Building Plan',
            totalExercises: 3
          }
        }
      });
    });
  });

  describe('GET /api/workouts/days/chest?branchId=xyz - With Branch ID', () => {
    it('should return exact structure with machine availability', async () => {
      const response = await request(server)
        .get(`/api/workouts/days/chest?branchId=${testBranch._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify exact response structure with machine availability
      expect(response.body).toEqual({
        success: true,
        message: 'chest workout exercises retrieved successfully',
        data: {
          muscleGroup: 'Chest',
          exercises: [
            {
              exerciseId: 'ex-001',
              name: 'Bench Press',
              description: 'Compound chest exercise',
              sets: 4,
              reps: '8-10',
              restTime: 120,
              muscleGroup: 'Chest',
              equipment: 'Barbell',
              difficulty: 'intermediate',
              machineAvailability: {
                isAvailable: true,
                maintenanceStatus: undefined,
                qrCode: 'NXG-BP-001',
                location: 'Free weights area'
              }
            },
            {
              exerciseId: 'ex-002',
              name: 'Incline Dumbbell Press',
              description: 'Upper chest focus', 
              sets: 3,
              reps: '10-12',
              restTime: 90,
              muscleGroup: 'Chest',
              equipment: 'Dumbbell',
              difficulty: 'intermediate',
              machineAvailability: {
                isAvailable: false,
                maintenanceStatus: undefined,
                qrCode: 'NXG-IDP-002',
                location: 'Dumbbell area'
              }
            },
            {
              exerciseId: 'ex-003',
              name: 'Chest Fly Machine',
              description: 'Isolation exercise',
              sets: 3,
              reps: '12-15',
              restTime: 60,
              muscleGroup: 'Chest',
              equipment: 'Machine',
              difficulty: 'beginner',
              machineAvailability: {
                isAvailable: true,
                maintenanceStatus: undefined,
                qrCode: 'NXG-CF-003',
                location: 'Cable area'
              }
            }
          ],
          metadata: {
            planId: 'test-plan-123',
            planName: 'Test Muscle Building Plan',
            totalExercises: 3,
            branchInfo: {
              branchId: testBranch._id.toString(),
              machineAvailabilityIncluded: true
            }
          }
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should return 404 for non-existent muscle group', async () => {
      const response = await request(server)
        .get('/api/workouts/days/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        message: "Muscle group 'nonexistent' not found in your active workout plan",
        data: {
          availableMuscleGroups: ['Chest', 'Back']
        }
      });
    });

    it('should return 401 without authentication', async () => {
      const response = await request(server)
        .get('/api/workouts/days/chest')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        message: 'User authentication required',
        data: null
      });
    });

    it('should handle case-insensitive muscle group', async () => {
      const response = await request(server)
        .get('/api/workouts/days/CHEST')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.muscleGroup).toBe('Chest');
      expect(response.body.data.exercises).toHaveLength(3);
    });

    it('should work with invalid branchId (no machine availability)', async () => {
      const response = await request(server)
        .get('/api/workouts/days/chest?branchId=invalid-branch-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should still return exercises but without machine availability
      expect(response.body.data.exercises[0].machineAvailability).toBeNull();
      expect(response.body.data.metadata.branchInfo).toBeUndefined();
    });
  });
});