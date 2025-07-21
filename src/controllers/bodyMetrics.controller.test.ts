import { Request, Response } from 'express';
import { 
  getBodyMetrics, 
  updateBodyMetrics, 
  getBodyMetricsHistory,
  getPrivacySettings,
  updatePrivacySettings,
  exportHealthData
} from './users.controller';
import { User } from '../models/User';
import { BodyMetricsHistory } from '../models/BodyMetricsHistory';
import { validateRequest } from '../utils/validation';
import { calculateBMI, calculateBMR, validateBodyMetrics, getBMICategory, calculateProgress } from '../utils/bodyMetrics';

// Mock all dependencies
jest.mock('../models/User');
jest.mock('../models/BodyMetricsHistory');
jest.mock('../utils/validation');
jest.mock('../utils/bodyMetrics');

const mockUser = User as jest.Mocked<typeof User>;
const mockBodyMetricsHistory = BodyMetricsHistory as jest.Mocked<typeof BodyMetricsHistory>;
const mockValidateRequest = validateRequest as jest.MockedFunction<typeof validateRequest>;
const mockCalculateBMI = calculateBMI as jest.MockedFunction<typeof calculateBMI>;
const mockCalculateBMR = calculateBMR as jest.MockedFunction<typeof calculateBMR>;
const mockGetBMICategory = getBMICategory as jest.MockedFunction<typeof getBMICategory>;
const mockCalculateProgress = calculateProgress as jest.MockedFunction<typeof calculateProgress>;
const mockValidateBodyMetrics = validateBodyMetrics as jest.MockedFunction<typeof validateBodyMetrics>;

describe('Body Metrics Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = {
      params: { userId: 'user123' },
      body: {}
    } as any;
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('getBodyMetrics', () => {
    test('should retrieve body metrics successfully', async () => {
      const mockUserData = {
        demographics: { heightCm: 180, weightKg: 75, age: 30, gender: 'Male' },
        bodyComposition: { bodyFatPercentage: 15 },
        currentMacros: { calories: '2000', protein: '150g' }
      };

      // Mock findById to return lean data
      const mockLean = jest.fn().mockResolvedValue(mockUserData);
      const mockSelect = jest.fn().mockReturnValue({ lean: mockLean });
      mockUser.findById.mockReturnValue({ select: mockSelect } as any);

      // Mock calculations
      mockCalculateBMI.mockReturnValue(23.15);
      mockGetBMICategory.mockReturnValue('Normal weight');
      mockCalculateBMR.mockReturnValue(1800);

      await getBodyMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Body metrics retrieved successfully',
        data: {
          demographics: mockUserData.demographics,
          bodyComposition: mockUserData.bodyComposition,
          currentMacros: mockUserData.currentMacros,
          calculated: {
            bmi: 23.15,
            bmiCategory: 'Normal weight',
            bmr: 1800
          }
        }
      });
    });

    test('should return 404 when user not found', async () => {
      const mockLean = jest.fn().mockResolvedValue(null);
      const mockSelect = jest.fn().mockReturnValue({ lean: mockLean });
      mockUser.findById.mockReturnValue({ select: mockSelect } as any);

      await getBodyMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    });

    test('should return 400 when userId is missing', async () => {
      mockRequest.params = {};

      await getBodyMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
    });
  });

  describe('updateBodyMetrics', () => {
    test('should update body metrics successfully', async () => {
      const updateData = {
        demographics: { weightKg: 76, heightCm: 180 },
        bodyComposition: { bodyFatPercentage: 14 }
      };

      mockRequest.body = updateData;

      // Mock validation
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: updateData
      });

      // Mock existing user
      const mockCurrentUser = {
        _id: 'user123',
        demographics: { weightKg: 75, heightCm: 180, age: 30, gender: 'Male' },
        bodyComposition: { bodyFatPercentage: 15 }
      };
      mockUser.findById.mockResolvedValue(mockCurrentUser as any);

      // Mock calculations
      mockCalculateBMI.mockReturnValue(23.46);
      mockGetBMICategory.mockReturnValue('Normal weight');
      mockCalculateBMR.mockReturnValue(1820);
      mockValidateBodyMetrics.mockReturnValue({
        isValid: true,
        warnings: []
      });

      // Mock update
      const mockUpdatedUser = {
        _id: 'user123',
        demographics: { weightKg: 76, heightCm: 180, bmi: 23.46, age: 30, gender: 'Male' },
        bodyComposition: { bodyFatPercentage: 14, basalMetabolicRateKcal: 1820 }
      };
      const mockSelect = jest.fn().mockResolvedValue(mockUpdatedUser);
      mockUser.findByIdAndUpdate.mockReturnValue({ select: mockSelect } as any);

      // Mock history creation
      mockBodyMetricsHistory.create.mockResolvedValue({} as any);

      await updateBodyMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Body metrics updated successfully',
        data: {
          demographics: mockUpdatedUser.demographics,
          bodyComposition: mockUpdatedUser.bodyComposition,
          calculated: {
            bmi: 23.46,
            bmiCategory: 'Normal weight',
            bmr: 1820
          },
          validation: {
            isValid: true,
            warnings: []
          }
        }
      });
    });

    test('should return validation errors', async () => {
      mockValidateRequest.mockReturnValue({
        isValid: false,
        errors: { 'demographics.weightKg': 'Weight must be a positive number' },
        value: null
      });

      await updateBodyMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: { 'demographics.weightKg': 'Weight must be a positive number' }
      });
    });
  });

  describe('getBodyMetricsHistory', () => {
    test('should retrieve body metrics history successfully', async () => {
      mockRequest.query = {
        page: '1',
        limit: '10',
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      };

      // Mock validation
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: {
          page: 1,
          limit: 10,
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        }
      });

      const mockHistory = [
        {
          _id: 'history1',
          userId: 'user123',
          recordedAt: new Date('2025-01-15'),
          demographics: { weightKg: 76 },
          bodyComposition: { bodyFatPercentage: 14 }
        },
        {
          _id: 'history2',
          userId: 'user123',
          recordedAt: new Date('2025-01-08'),
          demographics: { weightKg: 77 },
          bodyComposition: { bodyFatPercentage: 15 }
        }
      ];

      // Mock history query
      const mockLean = jest.fn().mockResolvedValue(mockHistory);
      const mockLimit = jest.fn().mockReturnValue({ lean: mockLean });
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      mockBodyMetricsHistory.find.mockReturnValue({ sort: mockSort } as any);

      // Mock count
      mockBodyMetricsHistory.countDocuments.mockResolvedValue(2);

      // Mock progress calculation
      mockCalculateProgress.mockReturnValue({
        weightChange: -1,
        weightChangePercent: -1.3,
        bodyFatChange: -1,
        bodyFatChangePercent: -6.67,
        muscleMassChange: 0,
        muscleMassChangePercent: 0,
        bmiChange: -0.1
      });

      await getBodyMetricsHistory(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Body metrics history retrieved successfully',
        data: {
          history: mockHistory,
          progress: expect.any(Object),
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 2,
            hasNext: false,
            hasPrev: false
          }
        }
      });
    });
  });

  describe('getPrivacySettings', () => {
    test('should retrieve privacy settings successfully', async () => {
      const mockPrivacySettings = {
        shareBasicMetrics: true,
        shareBodyComposition: false,
        profileVisibility: 'friends',
        allowHealthDataExport: true
      };

      const mockUserData = {
        privacySettings: mockPrivacySettings
      };

      const mockLean = jest.fn().mockResolvedValue(mockUserData);
      const mockSelect = jest.fn().mockReturnValue({ lean: mockLean });
      mockUser.findById.mockReturnValue({ select: mockSelect } as any);

      await getPrivacySettings(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Privacy settings retrieved successfully',
        data: {
          privacySettings: mockPrivacySettings
        }
      });
    });

    test('should return default privacy settings when none exist', async () => {
      const mockUserData = { privacySettings: null };

      const mockLean = jest.fn().mockResolvedValue(mockUserData);
      const mockSelect = jest.fn().mockReturnValue({ lean: mockLean });
      mockUser.findById.mockReturnValue({ select: mockSelect } as any);

      await getPrivacySettings(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Privacy settings retrieved successfully',
        data: {
          privacySettings: {
            shareBasicMetrics: true,
            shareBodyComposition: false,
            shareHealthConditions: false,
            shareProgressPhotos: false,
            shareWorkoutData: true,
            shareNutritionData: false,
            profileVisibility: 'friends',
            allowHealthDataExport: true
          }
        }
      });
    });
  });

  describe('updatePrivacySettings', () => {
    test('should update privacy settings successfully', async () => {
      const updateData = {
        shareBasicMetrics: false,
        profileVisibility: 'private'
      };

      mockRequest.body = updateData;

      // Mock validation
      mockValidateRequest.mockReturnValue({
        isValid: true,
        errors: null,
        value: updateData
      });

      // Mock current user
      const mockCurrentUser = {
        _id: 'user123',
        privacySettings: {
          shareBasicMetrics: true,
          shareBodyComposition: false,
          profileVisibility: 'friends'
        }
      };
      mockUser.findById.mockResolvedValue(mockCurrentUser as any);

      // Mock update
      const mockUpdatedUser = {
        privacySettings: {
          shareBasicMetrics: false,
          shareBodyComposition: false,
          profileVisibility: 'private'
        }
      };
      const mockSelect = jest.fn().mockResolvedValue(mockUpdatedUser);
      mockUser.findByIdAndUpdate.mockReturnValue({ select: mockSelect } as any);

      await updatePrivacySettings(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Privacy settings updated successfully',
        data: {
          privacySettings: mockUpdatedUser.privacySettings
        }
      });
    });
  });

  describe('exportHealthData', () => {
    test('should export health data successfully', async () => {
      const mockUserData = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date('2025-01-01'),
        demographics: { weightKg: 75, heightCm: 180 },
        bodyComposition: { bodyFatPercentage: 15 },
        privacySettings: { allowHealthDataExport: true }
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUserData as any);

      const mockHistory = [
        {
          _id: 'history1',
          userId: 'user123',
          recordedAt: new Date('2025-01-15'),
          demographics: { weightKg: 76 }
        }
      ];

      const mockLean = jest.fn().mockResolvedValue(mockHistory);
      const mockSort = jest.fn().mockReturnValue({ lean: mockLean });
      mockBodyMetricsHistory.find.mockReturnValue({ sort: mockSort } as any);

      await exportHealthData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Health data exported successfully',
        data: expect.objectContaining({
          exportedAt: expect.any(String),
          userId: 'user123',
          userInfo: expect.objectContaining({
            username: 'testuser',
            email: 'test@example.com'
          }),
          bodyMetricsHistory: mockHistory,
          exportMetadata: expect.objectContaining({
            totalHistoryRecords: 1
          })
        })
      });
    });

    test('should return 403 when export not allowed', async () => {
      const mockUserData = {
        _id: 'user123',
        privacySettings: { allowHealthDataExport: false }
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUserData as any);

      await exportHealthData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Health data export is not allowed by user privacy settings',
        code: 'EXPORT_NOT_ALLOWED'
      });
    });
  });
});