import request from 'supertest';
import App from '../../../src/app';
import { User } from '../../../src/models/User';
import { Branch } from '../../../src/models/Branch';
import database from '../../../src/utils/database';
import { redis } from '../../../src/utils/redis';

describe('Users API Integration Tests', () => {
  let testApp: any;
  let authToken: string;
  let userId: string;
  let branchId: string;

  beforeAll(async () => {
    // Initialize test database connection
    await database.connect();
    await redis.connect();
    
    // Create test app instance
    const appInstance = new App(3001);
    testApp = appInstance.app;

    // Create a test branch
    const testBranch = new Branch({
      name: 'Test Gym',
      address: '123 Test St',
      city: 'Test City',
      contactNumber: '+1234567890',
      isActive: true,
      capacity: 100
    });
    const savedBranch = await testBranch.save();
    branchId = savedBranch._id.toString();
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Branch.deleteMany({});
    await database.disconnect();
    await redis.disconnect();
  });

  beforeEach(async () => {
    // Clean up users before each test
    await User.deleteMany({});
  });

  describe('POST /api/users/register', () => {
    const validUserData = {
      username: 'testuser123',
      email: 'test@example.com',
      password: 'Test123!@#',
      confirmPassword: 'Test123!@#',
      name: 'Test User',
      demographics: {
        age: 25,
        gender: 'Male',
        heightCm: 175,
        weightKg: 70
      },
      fitnessProfile: {
        level: 'beginner',
        goal: 'weight_loss'
      }
    };

    it('should register a new user successfully', async () => {
      const response = await request(testApp)
        .post('/api/users/register')
        .send(validUserData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('registered successfully'),
        data: {
          user: {
            username: 'testuser123',
            email: 'test@example.com',
            name: 'Test User',
            isActive: true,
            emailVerified: false,
            totalPoints: 0
          }
        }
      });

      // Verify user was created in database
      const user = await User.findOne({ email: 'test@example.com' });
      expect(user).toBeTruthy();
      expect(user?.emailVerified).toBe(false);
      userId = user?._id.toString() || '';
    });

    it('should return 409 for duplicate email', async () => {
      // Create user first
      await request(testApp)
        .post('/api/users/register')
        .send(validUserData)
        .expect(201);

      // Try to register with same email
      const response = await request(testApp)
        .post('/api/users/register')
        .send({ ...validUserData, username: 'differentuser' })
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        code: 'EMAIL_EXISTS'
      });
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = {
        ...validUserData,
        email: 'invalid-email',
        password: '123' // too short
      };

      const response = await request(testApp)
        .post('/api/users/register')
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'VALIDATION_ERROR'
      });
    });
  });

  describe('Authentication Required Endpoints', () => {
    beforeEach(async () => {
      // Register and login to get auth token
      const registerResponse = await request(testApp)
        .post('/api/users/register')
        .send({
          username: 'authuser',
          email: 'auth@example.com',
          password: 'Test123!@#',
          confirmPassword: 'Test123!@#',
          name: 'Auth User'
        });

      userId = registerResponse.body.data.user.id;

      // Login to get token (assuming login endpoint exists in auth routes)
      const loginResponse = await request(testApp)
        .post('/api/auth/login')
        .send({
          email: 'auth@example.com',
          password: 'Test123!@#'
        });

      authToken = loginResponse.body.data.tokens.accessToken;
    });

    describe('GET /api/users/profile', () => {
      it('should return user profile successfully', async () => {
        const response = await request(testApp)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            user: {
              id: userId,
              username: 'authuser',
              email: 'auth@example.com',
              name: 'Auth User'
            }
          }
        });
      });

      it('should return 401 without token', async () => {
        await request(testApp)
          .get('/api/users/profile')
          .expect(401);
      });
    });

    describe('PUT /api/users/profile', () => {
      it('should update profile successfully', async () => {
        const updateData = {
          name: 'Updated Name',
          demographics: {
            age: 30,
            heightCm: 180
          }
        };

        const response = await request(testApp)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Profile updated successfully'
        });

        // Verify update in database
        const user = await User.findById(userId);
        expect(user?.name).toBe('Updated Name');
        expect(user?.demographics?.age).toBe(30);
      });
    });

    describe('Branch Management', () => {
      describe('POST /api/users/branches/join', () => {
        it('should join branch successfully', async () => {
          const response = await request(testApp)
            .post('/api/users/branches/join')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ branchId })
            .expect(200);

          expect(response.body).toMatchObject({
            success: true,
            message: 'Successfully joined branch',
            data: {
              branch: {
                id: branchId,
                name: 'Test Gym'
              }
            }
          });

          // Verify in database
          const user = await User.findById(userId);
          expect(user?.branches).toHaveLength(1);
          expect(user?.branches?.[0]?.branchId.toString()).toBe(branchId);
        });

        it('should return 409 if already a member', async () => {
          // Join branch first
          await request(testApp)
            .post('/api/users/branches/join')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ branchId })
            .expect(200);

          // Try to join again
          const response = await request(testApp)
            .post('/api/users/branches/join')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ branchId })
            .expect(409);

          expect(response.body.code).toBe('ALREADY_MEMBER');
        });
      });

      describe('GET /api/users/branches', () => {
        it('should return user branches', async () => {
          // Join a branch first
          await request(testApp)
            .post('/api/users/branches/join')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ branchId });

          const response = await request(testApp)
            .get('/api/users/branches')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          expect(response.body).toMatchObject({
            success: true,
            data: {
              branches: expect.arrayContaining([
                expect.objectContaining({
                  branchId: expect.any(Object),
                  branchName: 'Test Gym'
                })
              ])
            }
          });
        });
      });

      describe('DELETE /api/users/branches/:branchId', () => {
        it('should leave branch successfully', async () => {
          // Join branch first
          await request(testApp)
            .post('/api/users/branches/join')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ branchId });

          const response = await request(testApp)
            .delete(`/api/users/branches/${branchId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          expect(response.body).toMatchObject({
            success: true,
            message: 'Successfully left branch'
          });

          // Verify in database
          const user = await User.findById(userId);
          expect(user?.branches).toHaveLength(0);
        });

        it('should return 404 if not a member', async () => {
          const response = await request(testApp)
            .delete(`/api/users/branches/${branchId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(404);

          expect(response.body.code).toBe('NOT_MEMBER');
        });
      });
    });

    describe('Email Verification', () => {
      describe('POST /api/users/verify-email', () => {
        it('should verify email with valid token', async () => {
          // Store a verification token in Redis
          const client = redis.getClient();
          const email = 'auth@example.com';
          const token = 'test-verification-token';
          await client.setEx(`email_verification:${email}`, 3600, token);

          const response = await request(testApp)
            .post('/api/users/verify-email')
            .send({ email, token })
            .expect(200);

          expect(response.body).toMatchObject({
            success: true,
            message: 'Email verified successfully'
          });

          // Verify in database
          const user = await User.findById(userId);
          expect(user?.emailVerified).toBe(true);
        });

        it('should return 400 for invalid token', async () => {
          const response = await request(testApp)
            .post('/api/users/verify-email')
            .send({ 
              email: 'auth@example.com', 
              token: 'invalid-token' 
            })
            .expect(400);

          expect(response.body.code).toBe('INVALID_TOKEN');
        });
      });

      describe('POST /api/users/resend-verification', () => {
        it('should resend verification email', async () => {
          const response = await request(testApp)
            .post('/api/users/resend-verification')
            .send({ email: 'auth@example.com' })
            .expect(200);

          expect(response.body).toMatchObject({
            success: true,
            message: 'Verification email sent successfully'
          });

          // Verify token was stored in Redis
          const client = redis.getClient();
          const storedToken = await client.get('email_verification:auth@example.com');
          expect(storedToken).toBeTruthy();
        });
      });
    });

    describe('DELETE /api/users/account', () => {
      it('should delete account successfully', async () => {
        const response = await request(testApp)
          .delete('/api/users/account')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          code: 'ACCOUNT_DELETED'
        });

        // Verify user was deleted from database
        const user = await User.findById(userId);
        expect(user).toBeNull();
      });
    });
  });

  describe('Admin Endpoints', () => {
    let adminToken: string;

    beforeEach(async () => {
      // Create admin user (this would need admin role implementation)
      // For now, we'll just use a regular user and mock the role check
      await request(testApp)
        .post('/api/users/register')
        .send({
          username: 'admin',
          email: 'admin@example.com',
          password: 'Admin123!@#',
          confirmPassword: 'Admin123!@#',
          name: 'Admin User'
        });

      const loginResponse = await request(testApp)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'Admin123!@#'
        });

      adminToken = loginResponse.body.data.tokens.accessToken;
    });

    describe('GET /api/users/search', () => {
      it('should search users successfully', async () => {
        // Create some test users
        await User.create([
          {
            username: 'user1',
            email: 'user1@example.com',
            passwordHash: 'hashedpass',
            name: 'John Doe',
            demographics: { gender: 'Male' }
          },
          {
            username: 'user2',
            email: 'user2@example.com',
            passwordHash: 'hashedpass',
            name: 'Jane Smith',
            demographics: { gender: 'Female' }
          }
        ]);

        const response = await request(testApp)
          .get('/api/users/search?query=john&page=1&limit=10')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            users: expect.arrayContaining([
              expect.objectContaining({
                name: 'John Doe'
              })
            ]),
            pagination: expect.objectContaining({
              currentPage: 1,
              totalCount: expect.any(Number)
            })
          }
        });
      });
    });
  });
}); 