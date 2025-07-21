import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { User } from '../../../src/models/User';
import { BodyMetricsHistory } from '../../../src/models/BodyMetricsHistory';
import jwt from 'jsonwebtoken';

// Create a minimal Express app for testing
import express from 'express';
import cors from 'cors';
import userRoutes from '../../../src/routes/users.routes';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/users', userRoutes);

describe('Body Metrics Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let adminToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test admin user and generate token
    const adminUser = new User({
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: 'hashedpassword',
      name: 'Admin User',
      isActive: true,
      emailVerified: true,
      totalPoints: 0
    });
    await adminUser.save();

    // Generate JWT token (mock admin authentication)
    adminToken = jwt.sign(
      { 
        id: adminUser._id, 
        email: adminUser.email, 
        role: 'admin' 
      },
      process.env['JWT_SECRET'] || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test user
    const testUser = new User({
      username: 'testuser',
      email: 'test@test.com',
      passwordHash: 'hashedpassword',
      name: 'Test User',
      isActive: true,
      emailVerified: true,
      totalPoints: 0,
      demographics: {
        heightCm: 180,
        weightKg: 75,
        age: 30,
        gender: 'Male'
      }
    });
    await testUser.save();
    testUserId = testUser._id.toString();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    // Clean up body metrics history after each test
    await BodyMetricsHistory.deleteMany({});
  });

  describe('GET /api/users/:userId/body-metrics', () => {
    test('should retrieve user body metrics successfully', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}/body-metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Body metrics retrieved successfully',
        data: {
          demographics: expect.objectContaining({
            heightCm: 180,
            weightKg: 75,
            age: 30,
            gender: 'Male'
          }),
          calculated: expect.objectContaining({
            bmi: expect.any(Number),
            bmiCategory: expect.any(String),
            bmr: expect.any(Number)
          })
        }
      });
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .get(`/api/users/${testUserId}/body-metrics`)
        .expect(401);
    });
  });

  describe('PUT /api/users/:userId/body-metrics', () => {
    test('should update user body metrics successfully', async () => {
      const updateData = {
        demographics: {
          weightKg: 77
        },
        bodyComposition: {
          bodyFatPercentage: 15
        }
      };

      const response = await request(app)
        .put(`/api/users/${testUserId}/body-metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Body metrics updated successfully',
        data: {
          demographics: expect.objectContaining({
            weightKg: 77
          }),
          bodyComposition: expect.objectContaining({
            bodyFatPercentage: 15
          }),
          calculated: expect.objectContaining({
            bmi: expect.any(Number)
          })
        }
      });

      // Verify history record was created
      const historyRecords = await BodyMetricsHistory.find({ userId: testUserId });
      expect(historyRecords).toHaveLength(1);
      expect(historyRecords[0].demographics?.weightKg).toBe(77);
    });

    test('should return validation error for invalid data', async () => {
      const invalidData = {
        demographics: {
          weightKg: -10 // Invalid negative weight
        }
      };

      await request(app)
        .put(`/api/users/${testUserId}/body-metrics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /api/users/:userId/body-metrics/history', () => {
    test('should retrieve body metrics history', async () => {
      // Create some history records
      await BodyMetricsHistory.create([
        {
          userId: testUserId,
          recordedAt: new Date('2025-01-15'),
          demographics: { weightKg: 76, heightCm: 180 },
          source: 'manual'
        },
        {
          userId: testUserId,
          recordedAt: new Date('2025-01-10'),
          demographics: { weightKg: 78, heightCm: 180 },
          source: 'manual'
        }
      ]);

      const response = await request(app)
        .get(`/api/users/${testUserId}/body-metrics/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Body metrics history retrieved successfully',
        data: {
          history: expect.arrayContaining([
            expect.objectContaining({
              userId: testUserId,
              demographics: expect.objectContaining({
                weightKg: expect.any(Number)
              })
            })
          ]),
          pagination: expect.objectContaining({
            currentPage: 1,
            totalCount: 2
          })
        }
      });
    });
  });

  describe('GET /api/users/:userId/privacy', () => {
    test('should retrieve privacy settings', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}/privacy`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Privacy settings retrieved successfully',
        data: {
          privacySettings: expect.objectContaining({
            shareBasicMetrics: expect.any(Boolean),
            profileVisibility: expect.any(String)
          })
        }
      });
    });
  });

  describe('PUT /api/users/:userId/privacy', () => {
    test('should update privacy settings', async () => {
      const privacyUpdate = {
        shareBasicMetrics: false,
        profileVisibility: 'private'
      };

      const response = await request(app)
        .put(`/api/users/${testUserId}/privacy`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(privacyUpdate)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Privacy settings updated successfully',
        data: {
          privacySettings: expect.objectContaining({
            shareBasicMetrics: false,
            profileVisibility: 'private'
          })
        }
      });
    });
  });

  describe('GET /api/users/:userId/health-data/export', () => {
    test('should export health data when allowed', async () => {
      // Update user to allow health data export
      await User.findByIdAndUpdate(testUserId, {
        'privacySettings.allowHealthDataExport': true
      });

      const response = await request(app)
        .get(`/api/users/${testUserId}/health-data/export`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Health data exported successfully',
        data: expect.objectContaining({
          exportedAt: expect.any(String),
          userId: testUserId,
          userInfo: expect.objectContaining({
            username: 'testuser',
            email: 'test@test.com'
          }),
          currentData: expect.any(Object),
          exportMetadata: expect.any(Object)
        })
      });
    });

    test('should deny export when not allowed', async () => {
      // Update user to deny health data export
      await User.findByIdAndUpdate(testUserId, {
        'privacySettings.allowHealthDataExport': false
      });

      await request(app)
        .get(`/api/users/${testUserId}/health-data/export`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });
});