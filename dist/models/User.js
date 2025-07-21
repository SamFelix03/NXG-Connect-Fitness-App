"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserSchema = new mongoose_1.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters long'],
        maxlength: [30, 'Username cannot exceed 30 characters'],
        match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
    },
    passwordHash: {
        type: String,
        required: [true, 'Password hash is required'],
        minlength: [60, 'Invalid password hash format']
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date
    },
    demographics: {
        age: { type: Number, min: 13, max: 120 },
        heightCm: { type: Number, min: 50, max: 300 },
        weightKg: { type: Number, min: 20, max: 500 },
        gender: { type: String, enum: ['Male', 'Female', 'Other'] },
        targetWeightKg: { type: Number, min: 20, max: 500 },
        bmi: { type: Number, min: 10, max: 50 },
        allergies: [{ type: String }],
        activityLevel: { type: String }
    },
    fitnessProfile: {
        level: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
        restDay: { type: String },
        goal: { type: String, enum: ['weight_loss', 'weight_gain', 'muscle_building', 'maintenance'] },
        goalWeightDiff: { type: Number },
        healthConditions: [{ type: String }]
    },
    dietPreferences: {
        cuisinePreferences: { type: mongoose_1.Schema.Types.Mixed }
    },
    bodyComposition: {
        bodyAge: { type: Number },
        fatMassKg: { type: Number },
        skeletalMuscleMassKg: { type: Number },
        rohrerIndex: { type: Number },
        bodyFatPercentage: { type: Number },
        waistToHipRatio: { type: Number },
        visceralFatAreaCm2: { type: Number },
        visceralFatLevel: { type: Number },
        subcutaneousFatMassKg: { type: Number },
        extracellularWaterL: { type: Number },
        bodyCellMassKg: { type: Number },
        bcmToEcwRatio: { type: Number },
        ecwToTbwRatio: { type: Number },
        tbwToFfmRatio: { type: Number },
        basalMetabolicRateKcal: { type: Number },
        proteinGrams: { type: Number },
        mineralsMg: { type: Number }
    },
    activePlans: {
        workoutPlanId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'WorkoutPlan' },
        dietPlanId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'DietPlan' }
    },
    branches: [{
            branchId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Branch', required: true },
            branchName: { type: String, required: true },
            joinedAt: { type: Date, default: Date.now }
        }],
    currentMacros: {
        calories: { type: String },
        carbs: { type: String },
        protein: { type: String },
        fat: { type: String },
        fiber: { type: String },
        validTill: { type: Date }
    },
    totalPoints: {
        type: Number,
        default: 0,
        min: 0
    },
    privacySettings: {
        shareBasicMetrics: { type: Boolean, default: true },
        shareBodyComposition: { type: Boolean, default: false },
        shareHealthConditions: { type: Boolean, default: false },
        shareProgressPhotos: { type: Boolean, default: false },
        shareWorkoutData: { type: Boolean, default: true },
        shareNutritionData: { type: Boolean, default: false },
        profileVisibility: {
            type: String,
            enum: ['public', 'friends', 'private'],
            default: 'friends'
        },
        allowHealthDataExport: { type: Boolean, default: true }
    },
    preferences: {
        notifications: {
            workoutReminders: { type: Boolean, default: true },
            mealReminders: { type: Boolean, default: true },
            achievementAlerts: { type: Boolean, default: true },
            socialUpdates: { type: Boolean, default: false },
            weeklyReports: { type: Boolean, default: true },
            pushNotifications: { type: Boolean, default: true },
            emailNotifications: { type: Boolean, default: true },
            smsNotifications: { type: Boolean, default: false }
        },
        appConfiguration: {
            theme: {
                type: String,
                enum: ['light', 'dark', 'auto'],
                default: 'auto'
            },
            language: { type: String, default: 'en' },
            timezone: { type: String, default: 'UTC' },
            units: {
                type: String,
                enum: ['metric', 'imperial'],
                default: 'metric'
            },
            startOfWeek: {
                type: String,
                enum: ['monday', 'sunday'],
                default: 'monday'
            },
            autoSync: { type: Boolean, default: true }
        },
        workout: {
            restTimerSound: { type: Boolean, default: true },
            formTips: { type: Boolean, default: true },
            autoProgressPhotos: { type: Boolean, default: false },
            defaultRestTime: { type: Number, default: 60, min: 30, max: 300 }
        },
        diet: {
            calorieGoalReminders: { type: Boolean, default: true },
            mealPlanNotifications: { type: Boolean, default: true },
            nutritionInsights: { type: Boolean, default: true },
            waterReminders: { type: Boolean, default: true }
        }
    },
    deviceTokens: [{
            token: {
                type: String,
                required: [true, 'Device token is required'],
                maxlength: [500, 'Device token cannot exceed 500 characters']
            },
            platform: {
                type: String,
                enum: ['ios', 'android', 'web'],
                required: [true, 'Platform is required']
            },
            deviceId: {
                type: String,
                required: [true, 'Device ID is required'],
                maxlength: [100, 'Device ID cannot exceed 100 characters']
            },
            isActive: { type: Boolean, default: true },
            registeredAt: { type: Date, default: Date.now },
            lastUsed: { type: Date }
        }]
}, {
    timestamps: true,
    versionKey: false
});
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ isActive: 1 });
UserSchema.index({ 'branches.branchId': 1 });
exports.User = mongoose_1.default.model('User', UserSchema);
//# sourceMappingURL=User.js.map