import { Request, Response } from 'express';
import { 
  createUser, 
  getProfile, 
  updateProfile,
  deleteAccount,
  joinBranch,
  searchUsers
} from './users.controller';
import { User } from '../models/User';
import { Branch } from '../models/Branch';
import bcrypt from 'bcrypt';

// Mock dependencies at module level
jest.mock('../models/User');
jest.mock('../models/Branch');
jest.mock('bcrypt');
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock validation module completely to avoid Joi loading issues
jest.mock('../utils/validation', () => ({
  validateRequest: jest.fn(),
  createUserSchema: {},
  updateProfileSchema: {}
}));

const MockedUser = User as jest.Mocked<typeof User>;
const MockedBranch = Branch as jest.Mocked<typeof Branch>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Import validation after mocking
const { validateRequest } = require('../utils/validation');
const mockedValidateRequest = validateRequest as jest.MockedFunction<any>;

describe('Users Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    req = {
      body: {},
      params: { userId: 'user123' },
      query: {},
      user: { id: 'admin123', _id: 'admin123' } as any
    };
    
    res = {
      status: mockStatus,
      json: mockJson
    };

    jest.clearAllMocks();
  });

  describe('createUser (Admin only)', () => {
    const validUserCreationData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Test123!@#',
      name: 'Test User',
      demographics: {
        age: 25,
        gender: 'Male'
      },
      fitnessProfile: {
        level: 'beginner',
        goal: 'weight_loss'
      }
    };

    it('should create a new user successfully', async () => {
      // Arrange
      mockedValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: validUserCreationData
      });

      MockedUser.findOne = jest.fn().mockResolvedValue(null);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');
      
      const mockUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        emailVerified: true,
        totalPoints: 0,
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(true)
      };
      
      (MockedUser as any).mockImplementation(() => mockUser);

      req.body = validUserCreationData;

      // Act
      await createUser(req as Request, res as Response);

      // Assert
      expect(MockedUser.findOne).toHaveBeenCalledWith({
        $or: [
          { email: 'test@example.com' },
          { username: 'testuser' }
        ]
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('Test123!@#', 12);
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('created successfully')
        })
      );
    });

    it('should return 409 if email already exists', async () => {
      // Arrange
      mockedValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: validUserCreationData
      });

      MockedUser.findOne = jest.fn().mockResolvedValue({
        email: 'test@example.com'
      });

      req.body = validUserCreationData;

      // Act
      await createUser(req as Request, res as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'EMAIL_EXISTS'
        })
      );
    });

    it('should return 400 for validation errors', async () => {
      // Arrange
      mockedValidateRequest.mockReturnValue({
        isValid: false,
        errors: { email: 'Invalid email format' },
        value: null
      });

      req.body = { ...validUserCreationData, email: 'invalid-email' };

      // Act
      await createUser(req as Request, res as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'VALIDATION_ERROR'
        })
      );
    });
  });

  describe('getProfile (Admin only)', () => {
    it('should return user profile by ID successfully', async () => {
      // Arrange
      const mockUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        demographics: {},
        fitnessProfile: {},
        isActive: true,
        emailVerified: true
      };

      MockedUser.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      // Act
      await getProfile(req as Request, res as Response);

      // Assert
      expect(MockedUser.findById).toHaveBeenCalledWith('user123');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Profile retrieved successfully',
          data: { 
            user: expect.objectContaining({
              id: 'user123',
              username: 'testuser',
              email: 'test@example.com',
              name: 'Test User',
              demographics: {},
              fitnessProfile: {},
              isActive: true,
              emailVerified: true
            })
          }
        })
      );
    });

    it('should return 400 if userId parameter is missing', async () => {
      // Arrange
      req.params = {};

      // Act
      await getProfile(req as Request, res as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'VALIDATION_ERROR'
        })
      );
    });

    it('should return 404 if user not found', async () => {
      // Arrange
      MockedUser.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      // Act
      await getProfile(req as Request, res as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'USER_NOT_FOUND'
        })
      );
    });
  });

  describe('updateProfile (Admin only)', () => {
    it('should update user profile successfully', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Name',
        demographics: {
          age: 30
        }
      };

      mockedValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: updateData
      });

      const mockUpdatedUser = {
        _id: 'user123',
        name: 'Updated Name',
        demographics: { age: 30 }
      };

      MockedUser.findByIdAndUpdate = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUpdatedUser)
      });

      req.body = updateData;

      // Act
      await updateProfile(req as Request, res as Response);

      // Assert
      expect(MockedUser.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { $set: expect.objectContaining(updateData) },
        { new: true, runValidators: true }
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Profile updated successfully'
        })
      );
    });
  });

  describe('joinBranch (Admin only)', () => {
    it('should add user to branch successfully', async () => {
      // Arrange
      const mockBranch = {
        _id: 'branch123',
        name: 'Downtown Gym',
        address: '123 Main St',
        city: 'City',
        isActive: true
      };

      const mockUser = {
        _id: 'user123',
        branches: []
      };

      MockedBranch.findById = jest.fn().mockResolvedValue(mockBranch);
      MockedUser.findById = jest.fn().mockResolvedValue(mockUser);
      MockedUser.findByIdAndUpdate = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ ...mockUser, branches: [{ branchId: 'branch123' }] })
      });

      req.body = { branchId: 'branch123' };

      // Act
      await joinBranch(req as Request, res as Response);

      // Assert
      expect(MockedBranch.findById).toHaveBeenCalledWith('branch123');
      expect(MockedUser.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { $push: { branches: expect.objectContaining({ branchId: 'branch123' }) } },
        { new: true, runValidators: true }
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('added to branch')
        })
      );
    });

    it('should return 409 if already a member', async () => {
      // Arrange
      const mockBranch = {
        _id: 'branch123',
        isActive: true
      };

      const mockUser = {
        _id: 'user123',
        branches: [{ branchId: { toString: () => 'branch123' } }]
      };

      MockedBranch.findById = jest.fn().mockResolvedValue(mockBranch);
      MockedUser.findById = jest.fn().mockResolvedValue(mockUser);

      req.body = { branchId: 'branch123' };

      // Act
      await joinBranch(req as Request, res as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'ALREADY_MEMBER'
        })
      );
    });
  });

  describe('searchUsers (Admin only)', () => {
    it('should search users with filters successfully', async () => {
      // Arrange
      const mockUsers = [
        { _id: 'user1', name: 'John Doe', email: 'john@example.com' },
        { _id: 'user2', name: 'Jane Smith', email: 'jane@example.com' }
      ];

      MockedUser.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockUsers)
              })
            })
          })
        })
      });

      MockedUser.countDocuments = jest.fn().mockResolvedValue(2);

      req.query = {
        query: 'john',
        page: '1',
        limit: '10'
      };

      // Act
      await searchUsers(req as Request, res as Response);

      // Assert
      expect(MockedUser.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { name: { $regex: 'john', $options: 'i' } },
            { username: { $regex: 'john', $options: 'i' } },
            { email: { $regex: 'john', $options: 'i' } }
          ])
        })
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: {
            users: mockUsers,
            pagination: expect.objectContaining({
              currentPage: 1,
              totalCount: 2
            })
          }
        })
      );
    });
  });

  describe('deleteAccount (Admin only)', () => {
    it('should delete account successfully', async () => {
      // Arrange
      const mockSession = {
        withTransaction: jest.fn().mockImplementation(async (callback) => {
          await callback();
        }),
        endSession: jest.fn()
      };

      MockedUser.startSession = jest.fn().mockResolvedValue(mockSession);
      MockedUser.findByIdAndDelete = jest.fn().mockResolvedValue({
        _id: 'user123',
        email: 'test@example.com'
      });

      // Act
      await deleteAccount(req as Request, res as Response);

      // Assert
      expect(MockedUser.startSession).toHaveBeenCalled();
      expect(mockSession.withTransaction).toHaveBeenCalled();
      expect(MockedUser.findByIdAndDelete).toHaveBeenCalledWith('user123', { session: mockSession });
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          code: 'ACCOUNT_DELETED'
        })
      );
    });
  });
}); 