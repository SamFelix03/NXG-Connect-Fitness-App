import { Request, Response } from 'express';
import { getWorkoutDay } from './workouts.controller';
import { WorkoutPlan } from '../models/WorkoutPlan';
import { Branch } from '../models/Branch';

// Mock dependencies
jest.mock('../models/WorkoutPlan');
jest.mock('../models/Branch');
jest.mock('../utils/logger');

const mockWorkoutPlan = WorkoutPlan as jest.Mocked<typeof WorkoutPlan>;
const mockBranch = Branch as jest.Mocked<typeof Branch>;

describe('WorkoutController - getWorkoutDay', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockReq = {
      user: { id: 'user123' } as any,
      params: { muscleGroup: 'chest' },
      query: { branchId: 'branch123', includeAvailability: 'true' }
    };
    
    mockRes = {
      status: mockStatus,
      json: mockJson
    };

    jest.clearAllMocks();
  });

  it('should successfully return chest workout day with machine availability', async () => {
    // Mock workout plan data
    const mockWorkoutPlanData = {
      planId: 'plan123',
      planName: 'Advanced Muscle Building',
      cacheExpiry: new Date(Date.now() + 86400000), // Future date
      workoutDays: [
        {
          dayName: 'Day 1 - Chest',
          muscleGroup: 'Chest',
          estimatedDuration: 60,
          exercises: [
            {
              exerciseId: 'ex-001',
              name: 'Bench Press',
              sets: 4,
              reps: '8-12',
              restTime: 90,
              muscleGroup: 'Chest',
              equipment: 'Barbell'
            },
            {
              exerciseId: 'ex-002',
              name: 'Incline Dumbbell Press',
              sets: 3,
              reps: '10-12',
              restTime: 60,
              muscleGroup: 'Chest',
              equipment: 'Dumbbell'
            }
          ],
          isRestDay: false
        }
      ]
    };

    // Mock branch data with machines
    const mockBranchData = {
      machines: [
        {
          name: 'Bench Press',
          isAvailable: true,
          qrCode: 'NXG-BP-001',
          location: 'Free weights area'
        },
        {
          name: 'Incline Dumbbell Press',
          isAvailable: false,
          qrCode: 'NXG-IDP-002',
          location: 'Dumbbell area'
        }
      ]
    };

    // Setup mocks
    mockWorkoutPlan.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockWorkoutPlanData)
    } as any);

    mockBranch.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockBranchData)
      })
    } as any);

    // Execute
    await getWorkoutDay(mockReq as Request, mockRes as Response);

    // Verify
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      success: true,
      message: 'chest workout exercises retrieved successfully',
      data: {
        muscleGroup: 'Chest',
        exercises: [
          {
            exerciseId: 'ex-001',
            name: 'Bench Press',
            sets: 4,
            reps: '8-12',
            restTime: 90,
            muscleGroup: 'Chest',
            equipment: 'Barbell',
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
            sets: 3,
            reps: '10-12',
            restTime: 60,
            muscleGroup: 'Chest',
            equipment: 'Dumbbell',
            machineAvailability: {
              isAvailable: false,
              maintenanceStatus: undefined,
              qrCode: 'NXG-IDP-002',
              location: 'Dumbbell area'
            }
          }
        ],
        metadata: {
          planId: 'plan123',
          planName: 'Advanced Muscle Building',
          totalExercises: 2,
          branchInfo: {
            branchId: 'branch123',
            machineAvailabilityIncluded: true
          }
        }
      }
    });
  });

  it('should return 404 when no active workout plan found', async () => {
    // Mock no workout plan found
    mockWorkoutPlan.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    } as any);

    await getWorkoutDay(mockReq as Request, mockRes as Response);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith({
      success: false,
      message: 'No active workout plan found. Please create a workout plan first.',
      data: null
    });
  });

  it('should return 404 when muscle group not found in plan', async () => {
    const mockWorkoutPlanData = {
      planId: 'plan123',
      planName: 'Advanced Muscle Building',
      cacheExpiry: new Date(Date.now() + 86400000),
      workoutDays: [
        {
          dayName: 'Day 1 - Back',
          muscleGroup: 'Back', // Different muscle group
          exercises: []
        }
      ]
    };

    mockWorkoutPlan.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockWorkoutPlanData)
    } as any);

    await getWorkoutDay(mockReq as Request, mockRes as Response);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith({
      success: false,
      message: "Muscle group 'chest' not found in your active workout plan",
      data: {
        availableMuscleGroups: ['Back']
      }
    });
  });

  it('should work without machine availability when branchId not provided', async () => {
    // Remove branchId from request
    mockReq.query = { includeAvailability: 'true' };

    const mockWorkoutPlanData = {
      planId: 'plan123',
      planName: 'Advanced Muscle Building',
      cacheExpiry: new Date(Date.now() + 86400000),
      workoutDays: [
        {
          dayName: 'Day 1 - Chest',
          muscleGroup: 'Chest',
          estimatedDuration: 45,
          exercises: [
            {
              exerciseId: 'ex-001',
              name: 'Push-ups',
              sets: 3,
              reps: '15-20',
              restTime: 45,
              muscleGroup: 'Chest',
              equipment: 'Bodyweight'
            }
          ],
          isRestDay: false
        }
      ]
    };

    mockWorkoutPlan.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockWorkoutPlanData)
    } as any);

    await getWorkoutDay(mockReq as Request, mockRes as Response);

    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({
      success: true,
      message: 'chest workout exercises retrieved successfully',
      data: {
        muscleGroup: 'Chest',
        exercises: [
          {
            exerciseId: 'ex-001',
            name: 'Push-ups',
            sets: 3,
            reps: '15-20',
            restTime: 45,
            muscleGroup: 'Chest',
            equipment: 'Bodyweight',
            machineAvailability: null
          }
        ],
        metadata: {
          planId: 'plan123',
          planName: 'Advanced Muscle Building',
          totalExercises: 1
        }
      }
    });
  });

  it('should return 401 when user not authenticated', async () => {
    delete mockReq.user;

    await getWorkoutDay(mockReq as Request, mockRes as Response);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({
      success: false,
      message: 'User authentication required',
      data: null
    });
  });

  it('should return 400 when muscle group parameter is missing', async () => {
    mockReq.params = {};

    await getWorkoutDay(mockReq as Request, mockRes as Response);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      success: false,
      message: 'Muscle group parameter is required',
      data: null
    });
  });

  it('should handle case-insensitive muscle group matching', async () => {
    mockReq.params = { muscleGroup: 'CHEST' }; // Uppercase

    const mockWorkoutPlanData = {
      planId: 'plan123',
      planName: 'Advanced Muscle Building',
      cacheExpiry: new Date(Date.now() + 86400000),
      workoutDays: [
        {
          dayName: 'Day 1 - Chest',
          muscleGroup: 'chest', // Lowercase in data
          exercises: [
            {
              exerciseId: 'ex-001',
              name: 'Bench Press',
              sets: 4,
              reps: '8-12'
            }
          ]
        }
      ]
    };

    mockWorkoutPlan.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockWorkoutPlanData)
    } as any);

    await getWorkoutDay(mockReq as Request, mockRes as Response);

    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'CHEST workout exercises retrieved successfully'
      })
    );
  });
});