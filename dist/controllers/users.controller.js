"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeDeviceToken = exports.registerDeviceToken = exports.updateUserPreferences = exports.getUserPreferences = exports.exportHealthData = exports.updatePrivacySettings = exports.getPrivacySettings = exports.getBodyMetricsHistory = exports.updateBodyMetrics = exports.getBodyMetrics = exports.getUserById = exports.updateUserStatus = exports.searchUsers = exports.getUserBranches = exports.leaveBranch = exports.joinBranch = exports.deleteAccount = exports.updateProfile = exports.getProfile = exports.createUser = void 0;
const User_1 = require("../models/User");
const Branch_1 = require("../models/Branch");
const BodyMetricsHistory_1 = require("../models/BodyMetricsHistory");
const bcrypt_1 = __importDefault(require("bcrypt"));
const validation_1 = require("../utils/validation");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const bodyMetrics_1 = require("../utils/bodyMetrics");
const createUser = async (req, res) => {
    try {
        const validation = (0, validation_1.validateRequest)(validation_1.createUserSchema, req.body);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const existingUser = await User_1.User.findOne({
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
        const passwordHash = await bcrypt_1.default.hash(validation.value.password, 12);
        const userData = {
            username: validation.value.username,
            email: validation.value.email.toLowerCase(),
            passwordHash,
            name: validation.value.name,
            isActive: true,
            emailVerified: true,
            totalPoints: 0
        };
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
        const user = new User_1.User(userData);
        await user.save();
        logger_1.logger.info('User profile created by admin', {
            userId: user._id,
            email: user.email,
            createdBy: req.user?.id
        });
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
                    totalPoints: user.totalPoints,
                    createdAt: user.createdAt
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error during user creation',
            code: 'USER_CREATION_ERROR'
        });
    }
};
exports.createUser = createUser;
const getProfile = async (req, res) => {
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
        const user = await User_1.User.findById(userId).select('-passwordHash');
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res) => {
    try {
        const validation = (0, validation_1.validateRequest)(validation_1.updateProfileSchema, req.body);
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
        const updateData = { ...validation.value, updatedAt: new Date() };
        const updatedUser = await User_1.User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true }).select('-passwordHash');
        if (!updatedUser) {
            res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        logger_1.logger.info('User profile updated by admin', {
            userId,
            updatedFields: Object.keys(updateData),
            updatedBy: req.user?.id
        });
        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: updatedUser
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};
exports.updateProfile = updateProfile;
const deleteAccount = async (req, res) => {
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
        const session = await User_1.User.startSession();
        try {
            await session.withTransaction(async () => {
                const deletedUser = await User_1.User.findByIdAndDelete(userId, { session });
                if (!deletedUser) {
                    throw new errors_1.NotFoundError('User not found');
                }
                logger_1.logger.info('User account deleted by admin', {
                    userId,
                    email: deletedUser.email,
                    deletedAt: new Date(),
                    deletedBy: req.user?.id
                });
            });
            await session.endSession();
            res.status(200).json({
                success: true,
                message: 'Account deleted successfully',
                code: 'ACCOUNT_DELETED'
            });
        }
        catch (error) {
            await session.endSession();
            throw error;
        }
    }
    catch (error) {
        if (error instanceof errors_1.NotFoundError) {
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
exports.deleteAccount = deleteAccount;
const joinBranch = async (req, res) => {
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
        const branch = await Branch_1.Branch.findById(branchId);
        if (!branch || !branch.isActive) {
            res.status(404).json({
                success: false,
                message: 'Branch not found or inactive',
                code: 'BRANCH_NOT_FOUND'
            });
            return;
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        const existingMembership = user.branches?.find(b => b.branchId.toString() === branchId);
        if (existingMembership) {
            res.status(409).json({
                success: false,
                message: 'User is already a member of this branch',
                code: 'ALREADY_MEMBER'
            });
            return;
        }
        const branchMembership = {
            branchId: branch._id,
            branchName: branch.name,
            joinedAt: new Date()
        };
        await User_1.User.findByIdAndUpdate(userId, { $push: { branches: branchMembership } }, { new: true, runValidators: true }).select('-passwordHash');
        logger_1.logger.info('User added to branch by admin', {
            userId,
            branchId,
            branchName: branch.name,
            addedBy: req.user?.id
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};
exports.joinBranch = joinBranch;
const leaveBranch = async (req, res) => {
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
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        const membershipIndex = user.branches?.findIndex(b => b.branchId.toString() === branchId);
        if (membershipIndex === undefined || membershipIndex === -1) {
            res.status(404).json({
                success: false,
                message: 'User is not a member of this branch',
                code: 'NOT_MEMBER'
            });
            return;
        }
        await User_1.User.findByIdAndUpdate(userId, { $pull: { branches: { branchId: branchId } } }, { new: true }).select('-passwordHash');
        logger_1.logger.info('User removed from branch by admin', {
            userId,
            branchId,
            removedBy: req.user?.id
        });
        res.status(200).json({
            success: true,
            message: 'User successfully removed from branch',
            data: {
                branchId,
                leftAt: new Date()
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};
exports.leaveBranch = leaveBranch;
const getUserBranches = async (req, res) => {
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
        const user = await User_1.User.findById(userId)
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};
exports.getUserBranches = getUserBranches;
const searchUsers = async (req, res) => {
    try {
        const { query, page = 1, limit = 20, gender, fitnessLevel, city, isActive, emailVerified } = req.query;
        const filter = {};
        if (query) {
            filter.$or = [
                { name: { $regex: query, $options: 'i' } },
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ];
        }
        if (gender) {
            filter['demographics.gender'] = gender;
        }
        if (fitnessLevel) {
            filter['fitnessProfile.level'] = fitnessLevel;
        }
        if (city) {
            filter['branches.branchName'] = { $regex: city, $options: 'i' };
        }
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }
        if (emailVerified !== undefined) {
            filter.emailVerified = emailVerified === 'true';
        }
        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);
        const skip = (pageNumber - 1) * limitNumber;
        const [users, totalCount] = await Promise.all([
            User_1.User.find(filter)
                .select('-passwordHash')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNumber)
                .lean(),
            User_1.User.countDocuments(filter)
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SEARCH_ERROR'
        });
    }
};
exports.searchUsers = searchUsers;
const updateUserStatus = async (req, res) => {
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
        const user = await User_1.User.findByIdAndUpdate(userId, {
            isActive: isActive,
            updatedAt: new Date()
        }, { new: true, runValidators: true }).select('-passwordHash');
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        logger_1.logger.info('User status updated by admin', {
            userId: userId,
            isActive: !!isActive,
            reason: reason || 'No reason provided',
            updatedBy: req.user?.id || 'unknown'
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'STATUS_UPDATE_ERROR'
        });
    }
};
exports.updateUserStatus = updateUserStatus;
const getUserById = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User_1.User.findById(userId)
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};
exports.getUserById = getUserById;
const getBodyMetrics = async (req, res) => {
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
        const user = await User_1.User.findById(userId)
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
        let calculatedBMI = null;
        let bmiCategory = null;
        let calculatedBMR = null;
        if (user.demographics?.heightCm && user.demographics?.weightKg) {
            calculatedBMI = (0, bodyMetrics_1.calculateBMI)(user.demographics.weightKg, user.demographics.heightCm);
            bmiCategory = (0, bodyMetrics_1.getBMICategory)(calculatedBMI);
            if (user.demographics.age && user.demographics.gender) {
                calculatedBMR = (0, bodyMetrics_1.calculateBMR)(user.demographics.weightKg, user.demographics.heightCm, user.demographics.age, user.demographics.gender);
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
    }
    catch (error) {
        logger_1.logger.error('Error retrieving body metrics', error instanceof Error ? error : new Error('Unknown error'), { userId: req.params['userId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'BODY_METRICS_RETRIEVAL_ERROR'
        });
    }
};
exports.getBodyMetrics = getBodyMetrics;
const updateBodyMetrics = async (req, res) => {
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
        const validation = (0, validation_1.validateRequest)(validation_1.bodyMetricsSchema, req.body);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const currentUser = await User_1.User.findById(userId);
        if (!currentUser) {
            res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        const updateData = { updatedAt: new Date() };
        if (validation.value.demographics) {
            updateData.demographics = {
                ...(currentUser.demographics || {}),
                ...validation.value.demographics
            };
            if (updateData.demographics.heightCm && updateData.demographics.weightKg) {
                updateData.demographics.bmi = (0, bodyMetrics_1.calculateBMI)(updateData.demographics.weightKg, updateData.demographics.heightCm);
            }
        }
        if (validation.value.bodyComposition) {
            updateData.bodyComposition = {
                ...(currentUser.bodyComposition || {}),
                ...validation.value.bodyComposition
            };
            if (updateData.demographics?.heightCm &&
                updateData.demographics?.weightKg &&
                updateData.demographics?.age &&
                updateData.demographics?.gender) {
                updateData.bodyComposition.basalMetabolicRateKcal = (0, bodyMetrics_1.calculateBMR)(updateData.demographics.weightKg, updateData.demographics.heightCm, updateData.demographics.age, updateData.demographics.gender);
            }
        }
        const metricsValidation = (0, bodyMetrics_1.validateBodyMetrics)(updateData);
        const updatedUser = await User_1.User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true }).select('-passwordHash');
        if (!updatedUser) {
            res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        const historyData = {
            userId: userId,
            recordedAt: new Date(),
            demographics: updatedUser.demographics,
            bodyComposition: updatedUser.bodyComposition,
            source: 'manual',
            notes: req.body.notes || undefined
        };
        await BodyMetricsHistory_1.BodyMetricsHistory.create(historyData);
        logger_1.logger.info('Body metrics updated', {
            userId,
            updatedFields: Object.keys(validation.value),
            warnings: metricsValidation.warnings,
            updatedBy: req.user?.id
        });
        res.status(200).json({
            success: true,
            message: 'Body metrics updated successfully',
            data: {
                demographics: updatedUser.demographics,
                bodyComposition: updatedUser.bodyComposition,
                calculated: {
                    bmi: updatedUser.demographics?.bmi,
                    bmiCategory: updatedUser.demographics?.bmi ? (0, bodyMetrics_1.getBMICategory)(updatedUser.demographics.bmi) : null,
                    bmr: updatedUser.bodyComposition?.basalMetabolicRateKcal
                },
                validation: {
                    isValid: metricsValidation.isValid,
                    warnings: metricsValidation.warnings
                }
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating body metrics', error instanceof Error ? error : new Error('Unknown error'), { userId: req.params['userId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'BODY_METRICS_UPDATE_ERROR'
        });
    }
};
exports.updateBodyMetrics = updateBodyMetrics;
const getBodyMetricsHistory = async (req, res) => {
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
        const validation = (0, validation_1.validateRequest)(req.query, validation_1.bodyMetricsHistorySchema);
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
        const filter = { userId };
        if (startDate || endDate) {
            filter.recordedAt = {};
            if (startDate)
                filter.recordedAt.$gte = new Date(startDate);
            if (endDate)
                filter.recordedAt.$lte = new Date(endDate);
        }
        const skip = (page - 1) * limit;
        const [history, totalCount] = await Promise.all([
            BodyMetricsHistory_1.BodyMetricsHistory.find(filter)
                .sort({ recordedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            BodyMetricsHistory_1.BodyMetricsHistory.countDocuments(filter)
        ]);
        let progress = null;
        if (history.length >= 2) {
            const latest = history[0];
            const previous = history[1];
            progress = (0, bodyMetrics_1.calculateProgress)(latest, previous);
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
    }
    catch (error) {
        logger_1.logger.error('Error retrieving body metrics history', error instanceof Error ? error : new Error('Unknown error'), { userId: req.params['userId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'BODY_METRICS_HISTORY_ERROR'
        });
    }
};
exports.getBodyMetricsHistory = getBodyMetricsHistory;
const getPrivacySettings = async (req, res) => {
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
        const user = await User_1.User.findById(userId)
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
    }
    catch (error) {
        logger_1.logger.error('Error retrieving privacy settings', error instanceof Error ? error : new Error('Unknown error'), { userId: req.params['userId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'PRIVACY_SETTINGS_RETRIEVAL_ERROR'
        });
    }
};
exports.getPrivacySettings = getPrivacySettings;
const updatePrivacySettings = async (req, res) => {
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
        const validation = (0, validation_1.validateRequest)(validation_1.privacySettingsSchema, req.body);
        if (!validation.isValid) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors
            });
            return;
        }
        const currentUser = await User_1.User.findById(userId);
        if (!currentUser) {
            res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        const updateData = {
            privacySettings: {
                ...(currentUser.privacySettings || {}),
                ...validation.value
            },
            updatedAt: new Date()
        };
        const updatedUser = await User_1.User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true }).select('privacySettings');
        if (!updatedUser) {
            res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        logger_1.logger.info('Privacy settings updated', {
            userId,
            updatedFields: Object.keys(validation.value),
            updatedBy: req.user?.id
        });
        res.status(200).json({
            success: true,
            message: 'Privacy settings updated successfully',
            data: {
                privacySettings: updatedUser.privacySettings
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating privacy settings', error instanceof Error ? error : new Error('Unknown error'), { userId: req.params['userId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'PRIVACY_SETTINGS_UPDATE_ERROR'
        });
    }
};
exports.updatePrivacySettings = updatePrivacySettings;
const exportHealthData = async (req, res) => {
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
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        if (!user.privacySettings?.allowHealthDataExport) {
            res.status(403).json({
                success: false,
                message: 'Health data export is not allowed by user privacy settings',
                code: 'EXPORT_NOT_ALLOWED'
            });
            return;
        }
        const bodyMetricsHistory = await BodyMetricsHistory_1.BodyMetricsHistory.find({ userId })
            .sort({ recordedAt: -1 })
            .lean();
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
        logger_1.logger.info('Health data exported', {
            userId,
            recordCount: bodyMetricsHistory.length,
            exportedBy: req.user?.id
        });
        res.status(200).json({
            success: true,
            message: 'Health data exported successfully',
            data: healthDataExport
        });
    }
    catch (error) {
        logger_1.logger.error('Error exporting health data', error instanceof Error ? error : new Error('Unknown error'), { userId: req.params['userId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'HEALTH_DATA_EXPORT_ERROR'
        });
    }
};
exports.exportHealthData = exportHealthData;
const getUserPreferences = async (req, res) => {
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
        const user = await User_1.User.findById(userId)
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
    }
    catch (error) {
        logger_1.logger.error('Error retrieving user preferences', error instanceof Error ? error : new Error('Unknown error'), { userId: req.params['userId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
};
exports.getUserPreferences = getUserPreferences;
const updateUserPreferences = async (req, res) => {
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
        const validation = (0, validation_1.validateRequest)(req.body, validation_1.userPreferencesSchema);
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
        const user = await User_1.User.findByIdAndUpdate(userId, { $set: { preferences: preferencesUpdate } }, { new: true, runValidators: true }).select('preferences');
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        logger_1.logger.info('User preferences updated successfully', {
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
    }
    catch (error) {
        logger_1.logger.error('Error updating user preferences', error instanceof Error ? error : new Error('Unknown error'), { userId: req.params['userId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
};
exports.updateUserPreferences = updateUserPreferences;
const registerDeviceToken = async (req, res) => {
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
        const validation = (0, validation_1.validateRequest)(req.body, validation_1.deviceTokenSchema);
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
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        user.deviceTokens = user.deviceTokens?.filter(deviceToken => deviceToken.deviceId !== deviceId) || [];
        user.deviceTokens.push({
            token,
            platform,
            deviceId,
            isActive: true,
            registeredAt: new Date()
        });
        await user.save();
        logger_1.logger.info('Device token registered successfully', {
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
    }
    catch (error) {
        logger_1.logger.error('Error registering device token', error instanceof Error ? error : new Error('Unknown error'), { userId: req.params['userId'] || 'unknown' });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
};
exports.registerDeviceToken = registerDeviceToken;
const removeDeviceToken = async (req, res) => {
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
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        const initialTokenCount = user.deviceTokens?.length || 0;
        user.deviceTokens = user.deviceTokens?.filter(deviceToken => deviceToken._id?.toString() !== tokenId) || [];
        if (user.deviceTokens.length === initialTokenCount) {
            res.status(404).json({
                success: false,
                message: 'Device token not found',
                code: 'TOKEN_NOT_FOUND'
            });
            return;
        }
        await user.save();
        logger_1.logger.info('Device token removed successfully', {
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
    }
    catch (error) {
        logger_1.logger.error('Error removing device token', error instanceof Error ? error : new Error('Unknown error'), {
            userId: req.params['userId'] || 'unknown',
            tokenId: req.params['tokenId'] || 'unknown'
        });
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
};
exports.removeDeviceToken = removeDeviceToken;
//# sourceMappingURL=users.controller.js.map