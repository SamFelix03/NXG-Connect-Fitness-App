import { Request, Response } from 'express';
import { User } from '../models/User';
import { Branch } from '../models/Branch';
import { BodyMetricsHistory } from '../models/BodyMetricsHistory';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { 
  validateRequest, 
  createUserSchema,
  updateProfileSchema,
  bodyMetricsSchema,
  bodyMetricsHistorySchema,
  privacySettingsSchema,
  userPreferencesSchema,
  deviceTokenSchema
} from '../utils/validation';
import { NotFoundError} from '../utils/errors';
import { logger } from '../utils/logger';
import { 
  calculateBMI, 
  getBMICategory, 
  calculateBMR, 
  calculateProgress, 
  validateBodyMetrics 
} from '../utils/bodyMetrics';

/**
 * Create user profile (Admin only)
 * POST /api/users/create
 */
export const createUser = async (req: Request, res: Response): Promise<void> => {
  // Validate request data
  const validation = validateRequest(req.body, createUserSchema);
  
  if (!validation.isValid) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: validation.errors
    });
    return;
  }

  try {

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: validation.value.email.toLowerCase() },
        { username: validation.value.username }
      ]
    });

    if (existingUser) {
      if (existingUser.email === validation.value.email.toLowerCase()) {
        res.status(409).json({
          success: false,
          message: 'Email address is already registered',
          code: 'EMAIL_EXISTS'
        });
        return;
      }
      if (existingUser.username === validation.value.username) {
        res.status(409).json({
          success: false,
          message: 'Username is already taken',
          code: 'USERNAME_EXISTS'
        });
        return;
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validation.value.password, 12);

    // Create new user profile
    const userData: any = {
      username: validation.value.username,
      email: validation.value.email.toLowerCase(),
      passwordHash,
      name: validation.value.name,
      isActive: true,
      emailVerified: true, // Admin created users are pre-verified
      totalPoints: 0
    };

    // Only add nested objects if they have data
    if (validation.value.demographics && Object.keys(validation.value.demographics).length > 0) {
      userData.demographics = validation.value.demographics;
    }
    
    if (validation.value.fitnessProfile && Object.keys(validation.value.fitnessProfile).length > 0) {
      userData.fitnessProfile = validation.value.fitnessProfile;
    }
    
    if (validation.value.dietPreferences && Object.keys(validation.value.dietPreferences).length > 0) {
      userData.dietPreferences = validation.value.dietPreferences;
    }
    
    if (validation.value.bodyComposition && Object.keys(validation.value.bodyComposition).length > 0) {
      userData.bodyComposition = validation.value.bodyComposition;
    }
    
    if (validation.value.activePlans && Object.keys(validation.value.activePlans).length > 0) {
      try {
        userData.activePlans = {
          workoutPlanId: validation.value.activePlans.workoutPlanId ? 
            new mongoose.Types.ObjectId(validation.value.activePlans.workoutPlanId) : undefined,
          dietPlanId: validation.value.activePlans.dietPlanId ? 
            new mongoose.Types.ObjectId(validation.value.activePlans.dietPlanId) : undefined
        };
      } catch (error) {
        res.status(400).json({
          success: false,
          message: 'Invalid ObjectId format in activePlans',
          code: 'INVALID_OBJECTID'
        });
        return;
      }
    }
    
    if (validation.value.branches && Array.isArray(validation.value.branches) && validation.value.branches.length > 0) {
      try {
        userData.branches = validation.value.branches.map((branch: any) => ({
          branchId: new mongoose.Types.ObjectId(branch.branchId),
          branchName: branch.branchName,
          joinedAt: branch.joinedAt ? new Date(branch.joinedAt) : new Date()
        }));
      } catch (error) {
        res.status(400).json({
          success: false,
          message: 'Invalid ObjectId format in branches',
          code: 'INVALID_OBJECTID'
        });
        return;
      }
    }
    
    if (validation.value.currentMacros && Object.keys(validation.value.currentMacros).length > 0) {
      userData.currentMacros = validation.value.currentMacros;
    }
    
    if (validation.value.totalPoints !== undefined) {
      userData.totalPoints = validation.value.totalPoints;
    }

    const user = new User(userData);

    await user.save();

    logger.info('User profile created by admin', { 
      userId: user._id, 
      email: user.email,
      hasActivePlans: !!user.activePlans,
      hasBranches: !!(user.branches && user.branches.length > 0),
      createdBy: (req as any).user?.id 
    });

    // Return user data without sensitive information
    res.status(201).json({
      success: true,
      message: 'User profile created successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          name: user.name,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          demographics: user.demographics,
          fitnessProfile: user.fitnessProfile,
          dietPreferences: user.dietPreferences,
          bodyComposition: user.bodyComposition,
          activePlans: user.activePlans,
          branches: user.branches,
          currentMacros: user.currentMacros,
          totalPoints: user.totalPoints,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    logger.error('Error creating user', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { 
        email: validation.value?.email || 'unknown',
        hasActivePlans: !!(validation.value?.activePlans),
        hasBranches: !!(validation.value?.branches && validation.value.branches.length > 0)
      }
    );
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during user creation',
      code: 'USER_CREATION_ERROR'
    });
  }
};

/**
 * Get user profile by ID (Admin only)
 * GET /api/users/:userId/profile
 */
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          name: user.name,
          demographics: user.demographics,
          fitnessProfile: user.fitnessProfile,
          dietPreferences: user.dietPreferences,
          bodyComposition: user.bodyComposition,
          activePlans: user.activePlans,
          branches: user.branches,
          currentMacros: user.currentMacros,
          totalPoints: user.totalPoints,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Update user profile by ID (Admin only)
 * PUT /api/users/:userId/profile
 */
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request data
    const validation = validateRequest(req.body, updateProfileSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Update user profile with selective field updates
    const updateData = { ...validation.value, updatedAt: new Date() };
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    logger.info('User profile updated by admin', { 
      userId, 
      updatedFields: Object.keys(updateData),
      updatedBy: (req as any).user?.id 
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Delete user account by ID with GDPR compliance (Admin only)
 * DELETE /api/users/:userId/account
 */
export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Start MongoDB transaction for data consistency
    const session = await User.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Remove user account
        const deletedUser = await User.findByIdAndDelete(userId, { session });
        
        if (!deletedUser) {
          throw new NotFoundError('User not found');
        }

        // TODO: Cascade cleanup of related data:
        // - Remove from workout plans
        // - Remove from diet plans
        // - Remove workout history
        // - Remove nutrition logs
        // - Remove from branch memberships
        // - Remove device registrations
        // - Remove session tokens

        logger.info('User account deleted by admin', { 
          userId, 
          email: deletedUser.email,
          deletedAt: new Date(),
          deletedBy: (req as any).user?.id
        });
      });

      await session.endSession();

      res.status(200).json({
        success: true,
        message: 'Account deleted successfully',
        code: 'ACCOUNT_DELETED'
      });
    } catch (error) {
      await session.endSession();
      throw error;
    }
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        message: error.message,
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during account deletion',
      code: 'DELETION_ERROR'
    });
  }
};

/**
 * Add user to a branch (Admin only)
 * POST /api/users/:userId/branches/join
 */
export const joinBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId } = req.body;
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    if (!branchId) {
      res.status(400).json({
        success: false,
        message: 'Branch ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Validate branch exists and is active
    const branch = await Branch.findById(branchId);
    if (!branch || !branch.isActive) {
      res.status(404).json({
        success: false,
        message: 'Branch not found or inactive',
        code: 'BRANCH_NOT_FOUND'
      });
      return;
    }

    // Check if user is already a member of this branch
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    const existingMembership = user.branches?.find(
      b => b.branchId.toString() === branchId
    );

    if (existingMembership) {
      res.status(409).json({
        success: false,
        message: 'User is already a member of this branch',
        code: 'ALREADY_MEMBER'
      });
      return;
    }

    // Add branch membership
    const branchMembership = {
      branchId: branch._id,
      branchName: branch.name,
      joinedAt: new Date()
    };

    await User.findByIdAndUpdate(
      userId,
      { $push: { branches: branchMembership } },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    logger.info('User added to branch by admin', { 
      userId, 
      branchId, 
      branchName: branch.name,
      addedBy: (req as any).user?.id 
    });

    res.status(200).json({
      success: true,
      message: 'User successfully added to branch',
      data: {
        branch: {
          id: branch._id,
          name: branch.name,
          address: branch.address,
          city: branch.city
        },
        joinedAt: branchMembership.joinedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Remove user from a branch (Admin only)
 * DELETE /api/users/:userId/branches/:branchId
 */
export const leaveBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branchId, userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    if (!branchId) {
      res.status(400).json({
        success: false,
        message: 'Branch ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Find user and check if they are a member of the branch
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    const membershipIndex = user.branches?.findIndex(
      b => b.branchId.toString() === branchId
    );

    if (membershipIndex === undefined || membershipIndex === -1) {
      res.status(404).json({
        success: false,
        message: 'User is not a member of this branch',
        code: 'NOT_MEMBER'
      });
      return;
    }

    // Remove branch membership
    await User.findByIdAndUpdate(
      userId,
      { $pull: { branches: { branchId: branchId } } },
      { new: true }
    ).select('-passwordHash');

    logger.info('User removed from branch by admin', { 
      userId, 
      branchId,
      removedBy: (req as any).user?.id 
    });

    res.status(200).json({
      success: true,
      message: 'User successfully removed from branch',
      data: {
        branchId,
        leftAt: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Get user's branch memberships by ID (Admin only)
 * GET /api/users/:userId/branches
 */
export const getUserBranches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const user = await User.findById(userId)
      .populate('branches.branchId', 'name address city contactNumber isActive')
      .select('branches');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Branch memberships retrieved successfully',
      data: {
        branches: user.branches || []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Search users with filtering (Admin only)
 * GET /api/users/search
 */
export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      query,
      page = 1,
      limit = 20,
      gender,
      fitnessLevel,
      city,
      isActive,
      emailVerified
    } = req.query;

    // Build search filter
    const filter: any = {};

    // Text search across name, username, email
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ];
    }

    // Demographics filters
    if (gender) {
      filter['demographics.gender'] = gender;
    }

    if (fitnessLevel) {
      filter['fitnessProfile.level'] = fitnessLevel;
    }

    if (city) {
      filter['branches.branchName'] = { $regex: city, $options: 'i' };
    }

    // Account status filters
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (emailVerified !== undefined) {
      filter.emailVerified = emailVerified === 'true';
    }

    // Pagination
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Execute search
    const [users, totalCount] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      User.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / limitNumber);

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalCount,
          hasNext: pageNumber < totalPages,
          hasPrev: pageNumber > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SEARCH_ERROR'
    });
  }
};

/**
 * Update user account status (Admin only)
 * PUT /api/users/:userId/status
 */
export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { isActive, reason } = req.body;

    if (isActive === undefined) {
      res.status(400).json({
        success: false,
        message: 'Account status (isActive) is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        isActive: isActive,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Log status change for audit trail
    logger.info('User status updated by admin', { 
      userId: userId!, 
      isActive: !!isActive, 
      reason: reason || 'No reason provided',
      updatedBy: (req as any).user?.id || 'unknown'
    });

    res.status(200).json({
      success: true,
      message: `User account ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isActive: user.isActive,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'STATUS_UPDATE_ERROR'
    });
  }
};

/**
 * Get user details by ID (Admin only)
 * GET /api/users/:userId
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .populate('branches.branchId', 'name address city contactNumber')
      .select('-passwordHash')
      .lean();

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User details retrieved successfully',
      data: {
        user
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Get user's current body metrics
 * GET /api/users/:userId/body-metrics
 */
export const getBodyMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const user = await User.findById(userId)
      .select('demographics bodyComposition currentMacros')
      .lean();

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Calculate BMI if height and weight are available
    let calculatedBMI = null;
    let bmiCategory = null;
    let calculatedBMR = null;

    if (user.demographics?.heightCm && user.demographics?.weightKg) {
      calculatedBMI = calculateBMI(user.demographics.weightKg, user.demographics.heightCm);
      bmiCategory = getBMICategory(calculatedBMI);

      // Calculate BMR if age and gender are also available
      if (user.demographics.age && user.demographics.gender) {
        calculatedBMR = calculateBMR(
          user.demographics.weightKg,
          user.demographics.heightCm,
          user.demographics.age,
          user.demographics.gender
        );
      }
    }

    res.status(200).json({
      success: true,
      message: 'Body metrics retrieved successfully',
      data: {
        demographics: user.demographics,
        bodyComposition: user.bodyComposition,
        currentMacros: user.currentMacros,
        calculated: {
          bmi: calculatedBMI,
          bmiCategory,
          bmr: calculatedBMR
        }
      }
    });
  } catch (error) {
    logger.error('Error retrieving body metrics', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'BODY_METRICS_RETRIEVAL_ERROR'
    });
  }
};

/**
 * Update user's body metrics
 * PUT /api/users/:userId/body-metrics
 */
export const updateBodyMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Validate request data
    const validation = validateRequest(req.body, bodyMetricsSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    // Get current user data for history storage
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Prepare update data
    const updateData: any = { updatedAt: new Date() };
    
    // Calculate BMI if height and weight are provided
    if (validation.value.demographics) {
      updateData.demographics = { 
        ...(currentUser.demographics || {}), 
        ...validation.value.demographics 
      };
      
      // Recalculate BMI if we have both height and weight
      if (updateData.demographics.heightCm && updateData.demographics.weightKg) {
        updateData.demographics.bmi = calculateBMI(
          updateData.demographics.weightKg, 
          updateData.demographics.heightCm
        );
      }
    }

    if (validation.value.bodyComposition) {
      updateData.bodyComposition = { 
        ...(currentUser.bodyComposition || {}), 
        ...validation.value.bodyComposition 
      };
      
      // Calculate BMR if we have required fields
      if (updateData.demographics?.heightCm && 
          updateData.demographics?.weightKg && 
          updateData.demographics?.age && 
          updateData.demographics?.gender) {
        updateData.bodyComposition.basalMetabolicRateKcal = calculateBMR(
          updateData.demographics.weightKg,
          updateData.demographics.heightCm,
          updateData.demographics.age,
          updateData.demographics.gender
        );
      }
    }

    // Validate the body metrics data
    const metricsValidation = validateBodyMetrics(updateData);
    
    // Update user record
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Store history record
    const historyData = {
      userId: userId,
      recordedAt: new Date(),
      demographics: updatedUser.demographics,
      bodyComposition: updatedUser.bodyComposition,
      source: 'manual',
      notes: req.body.notes || undefined
    };

    await BodyMetricsHistory.create(historyData);

    logger.info('Body metrics updated', { 
      userId, 
      updatedFields: Object.keys(validation.value),
      warnings: metricsValidation.warnings,
      updatedBy: (req as any).user?.id 
    });

    res.status(200).json({
      success: true,
      message: 'Body metrics updated successfully',
      data: {
        demographics: updatedUser.demographics,
        bodyComposition: updatedUser.bodyComposition,
        calculated: {
          bmi: updatedUser.demographics?.bmi,
          bmiCategory: updatedUser.demographics?.bmi ? getBMICategory(updatedUser.demographics.bmi) : null,
          bmr: updatedUser.bodyComposition?.basalMetabolicRateKcal
        },
        validation: {
          isValid: metricsValidation.isValid,
          warnings: metricsValidation.warnings
        }
      }
    });
  } catch (error) {
    logger.error('Error updating body metrics', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'BODY_METRICS_UPDATE_ERROR'
    });
  }
};

/**
 * Get user's body metrics history with filtering
 * GET /api/users/:userId/body-metrics/history
 */
export const getBodyMetricsHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Validate query parameters
    const validation = validateRequest(req.query, bodyMetricsHistorySchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const { startDate, endDate, page, limit } = validation.value;

    // Build filter query
    const filter: any = { userId };
    if (startDate || endDate) {
      filter.recordedAt = {};
      if (startDate) filter.recordedAt.$gte = new Date(startDate);
      if (endDate) filter.recordedAt.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Execute query
    const [history, totalCount] = await Promise.all([
      BodyMetricsHistory.find(filter)
        .sort({ recordedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BodyMetricsHistory.countDocuments(filter)
    ]);

    // Calculate progress if we have multiple records
    let progress = null;
    if (history.length >= 2) {
      const latest = history[0];
      const previous = history[1];
      progress = calculateProgress(latest, previous);
    }

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      message: 'Body metrics history retrieved successfully',
      data: {
        history,
        progress,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    logger.error('Error retrieving body metrics history', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'BODY_METRICS_HISTORY_ERROR'
    });
  }
};

/**
 * Get user's privacy settings
 * GET /api/users/:userId/privacy
 */
export const getPrivacySettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    const user = await User.findById(userId)
      .select('privacySettings')
      .lean();

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Privacy settings retrieved successfully',
      data: {
        privacySettings: user.privacySettings || {
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
  } catch (error) {
    logger.error('Error retrieving privacy settings', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'PRIVACY_SETTINGS_RETRIEVAL_ERROR'
    });
  }
};

/**
 * Update user's privacy settings
 * PUT /api/users/:userId/privacy
 */
export const updatePrivacySettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Validate request data
    const validation = validateRequest(req.body, privacySettingsSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    // Get current user
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Prepare update data - merge with existing privacy settings
    const updateData = {
      privacySettings: {
        ...(currentUser.privacySettings || {}),
        ...validation.value
      },
      updatedAt: new Date()
    };

    // Update user record
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('privacySettings');

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    logger.info('Privacy settings updated', { 
      userId, 
      updatedFields: Object.keys(validation.value),
      updatedBy: (req as any).user?.id 
    });

    res.status(200).json({
      success: true,
      message: 'Privacy settings updated successfully',
      data: {
        privacySettings: updatedUser.privacySettings
      }
    });
  } catch (error) {
    logger.error('Error updating privacy settings', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'PRIVACY_SETTINGS_UPDATE_ERROR'
    });
  }
};

/**
 * Export user's health data (GDPR compliance)
 * GET /api/users/:userId/health-data/export
 */
export const exportHealthData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Get user and check privacy settings
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Check if user allows health data export
    if (!user.privacySettings?.allowHealthDataExport) {
      res.status(403).json({
        success: false,
        message: 'Health data export is not allowed by user privacy settings',
        code: 'EXPORT_NOT_ALLOWED'
      });
      return;
    }

    // Get body metrics history
    const bodyMetricsHistory = await BodyMetricsHistory.find({ userId })
      .sort({ recordedAt: -1 })
      .lean();

    // Prepare comprehensive health data export
    const healthDataExport = {
      exportedAt: new Date().toISOString(),
      userId: user._id,
      userInfo: {
        username: user.username,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      },
      currentData: {
        demographics: user.demographics,
        fitnessProfile: user.fitnessProfile,
        bodyComposition: user.bodyComposition,
        currentMacros: user.currentMacros,
        activePlans: user.activePlans
      },
      privacySettings: user.privacySettings,
      bodyMetricsHistory: bodyMetricsHistory,
      exportMetadata: {
        totalHistoryRecords: bodyMetricsHistory.length,
        dateRange: bodyMetricsHistory.length > 0 ? {
          earliest: bodyMetricsHistory[bodyMetricsHistory.length - 1]?.recordedAt,
          latest: bodyMetricsHistory[0]?.recordedAt
        } : null
      }
    };

    // Log the export for audit purposes
    logger.info('Health data exported', { 
      userId, 
      recordCount: bodyMetricsHistory.length,
      exportedBy: (req as any).user?.id 
    });

    res.status(200).json({
      success: true,
      message: 'Health data exported successfully',
      data: healthDataExport
    });
  } catch (error) {
    logger.error('Error exporting health data', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'HEALTH_DATA_EXPORT_ERROR'
    });
  }
};

export const getUserPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Get user preferences
    const user = await User.findById(userId)
      .select('preferences')
      .lean();
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Return default preferences if none exist
    const defaultPreferences = {
      notifications: {
        workoutReminders: true,
        mealReminders: true,
        achievementAlerts: true,
        socialUpdates: false,
        weeklyReports: true,
        pushNotifications: true,
        emailNotifications: true,
        smsNotifications: false
      },
      appConfiguration: {
        theme: 'auto',
        language: 'en',
        timezone: 'UTC',
        units: 'metric',
        startOfWeek: 'monday',
        autoSync: true
      },
      workout: {
        restTimerSound: true,
        formTips: true,
        autoProgressPhotos: false,
        defaultRestTime: 60
      },
      diet: {
        calorieGoalReminders: true,
        mealPlanNotifications: true,
        nutritionInsights: true,
        waterReminders: true
      }
    };

    res.status(200).json({
      success: true,
      message: 'User preferences retrieved successfully',
      data: {
        preferences: user.preferences || defaultPreferences
      }
    });

  } catch (error) {
    logger.error('Error retrieving user preferences', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

export const updateUserPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Validate request body
    const validation = validateRequest(req.body, userPreferencesSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const preferencesUpdate = validation.value;

    // Update user preferences
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { preferences: preferencesUpdate } },
      { new: true, runValidators: true }
    ).select('preferences');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    logger.info('User preferences updated successfully', { 
      userId,
      updatedFields: Object.keys(preferencesUpdate)
    });

    res.status(200).json({
      success: true,
      message: 'User preferences updated successfully',
      data: {
        preferences: user.preferences
      }
    });

  } catch (error) {
    logger.error('Error updating user preferences', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

export const registerDeviceToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Validate request body
    const validation = validateRequest(req.body, deviceTokenSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const { token, platform, deviceId } = validation.value;

    // Check if token already exists for this user
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Remove any existing tokens for this device
    user.deviceTokens = user.deviceTokens?.filter(
      deviceToken => deviceToken.deviceId !== deviceId
    ) || [];

    // Add new token
    user.deviceTokens.push({
      token,
      platform,
      deviceId,
      isActive: true,
      registeredAt: new Date()
    });

    await user.save();

    logger.info('Device token registered successfully', { 
      userId,
      platform,
      deviceId
    });

    const lastToken = user.deviceTokens?.[user.deviceTokens.length - 1];
    
    res.status(201).json({
      success: true,
      message: 'Device token registered successfully',
      data: {
        tokenId: lastToken?._id?.toString(),
        platform,
        registeredAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error registering device token', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

export const removeDeviceToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, tokenId } = req.params;
    
    if (!userId || !tokenId) {
      res.status(400).json({
        success: false,
        message: 'User ID and Token ID are required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Remove device token
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    const initialTokenCount = user.deviceTokens?.length || 0;
    user.deviceTokens = user.deviceTokens?.filter(
      deviceToken => deviceToken._id?.toString() !== tokenId
    ) || [];

    if (user.deviceTokens.length === initialTokenCount) {
      res.status(404).json({
        success: false,
        message: 'Device token not found',
        code: 'TOKEN_NOT_FOUND'
      });
      return;
    }

    await user.save();

    logger.info('Device token removed successfully', { 
      userId,
      tokenId
    });

    res.status(200).json({
      success: true,
      message: 'Device token removed successfully',
      data: {
        removedTokenId: tokenId,
        remainingTokens: user.deviceTokens.length
      }
    });

  } catch (error) {
    logger.error('Error removing device token', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { 
        userId: req.params['userId'] || 'unknown',
        tokenId: req.params['tokenId'] || 'unknown'
      }
    );
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};