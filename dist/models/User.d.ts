/// <reference types="mongoose/types/aggregate" />
/// <reference types="mongoose/types/callback" />
/// <reference types="mongoose/types/collection" />
/// <reference types="mongoose/types/connection" />
/// <reference types="mongoose/types/cursor" />
/// <reference types="mongoose/types/document" />
/// <reference types="mongoose/types/error" />
/// <reference types="mongoose/types/expressions" />
/// <reference types="mongoose/types/helpers" />
/// <reference types="mongoose/types/middlewares" />
/// <reference types="mongoose/types/indexes" />
/// <reference types="mongoose/types/models" />
/// <reference types="mongoose/types/mongooseoptions" />
/// <reference types="mongoose/types/pipelinestage" />
/// <reference types="mongoose/types/populate" />
/// <reference types="mongoose/types/query" />
/// <reference types="mongoose/types/schemaoptions" />
/// <reference types="mongoose/types/schematypes" />
/// <reference types="mongoose/types/session" />
/// <reference types="mongoose/types/types" />
/// <reference types="mongoose/types/utility" />
/// <reference types="mongoose/types/validation" />
/// <reference types="mongoose/types/virtuals" />
/// <reference types="mongoose/types/inferschematype" />
import mongoose, { Document } from 'mongoose';
export interface IUser extends Document {
    username: string;
    email: string;
    passwordHash: string;
    name: string;
    isActive: boolean;
    emailVerified: boolean;
    lastLogin?: Date;
    demographics: {
        age?: number;
        heightCm?: number;
        weightKg?: number;
        gender?: string;
        targetWeightKg?: number;
        bmi?: number;
        allergies?: string[];
        activityLevel?: string;
    };
    fitnessProfile: {
        level?: string;
        restDay?: string;
        goal?: string;
        goalWeightDiff?: number;
        healthConditions?: string[];
    };
    dietPreferences: {
        cuisinePreferences?: Record<string, string[]>;
    };
    bodyComposition?: {
        bodyAge?: number;
        fatMassKg?: number;
        skeletalMuscleMassKg?: number;
        rohrerIndex?: number;
        bodyFatPercentage?: number;
        waistToHipRatio?: number;
        visceralFatAreaCm2?: number;
        visceralFatLevel?: number;
        subcutaneousFatMassKg?: number;
        extracellularWaterL?: number;
        bodyCellMassKg?: number;
        bcmToEcwRatio?: number;
        ecwToTbwRatio?: number;
        tbwToFfmRatio?: number;
        basalMetabolicRateKcal?: number;
        proteinGrams?: number;
        mineralsMg?: number;
    };
    activePlans?: {
        workoutPlanId?: mongoose.Types.ObjectId;
        dietPlanId?: mongoose.Types.ObjectId;
    };
    branches?: Array<{
        branchId: mongoose.Types.ObjectId;
        branchName: string;
        joinedAt: Date;
    }>;
    currentMacros?: {
        calories?: string;
        carbs?: string;
        protein?: string;
        fat?: string;
        fiber?: string;
        validTill?: Date;
    };
    totalPoints: number;
    privacySettings?: {
        shareBasicMetrics: boolean;
        shareBodyComposition: boolean;
        shareHealthConditions: boolean;
        shareProgressPhotos: boolean;
        shareWorkoutData: boolean;
        shareNutritionData: boolean;
        profileVisibility: 'public' | 'friends' | 'private';
        allowHealthDataExport: boolean;
    };
    preferences?: {
        notifications: {
            workoutReminders: boolean;
            mealReminders: boolean;
            achievementAlerts: boolean;
            socialUpdates: boolean;
            weeklyReports: boolean;
            pushNotifications: boolean;
            emailNotifications: boolean;
            smsNotifications: boolean;
        };
        appConfiguration: {
            theme: 'light' | 'dark' | 'auto';
            language: string;
            timezone: string;
            units: 'metric' | 'imperial';
            startOfWeek: 'monday' | 'sunday';
            autoSync: boolean;
        };
        workout: {
            restTimerSound: boolean;
            formTips: boolean;
            autoProgressPhotos: boolean;
            defaultRestTime: number;
        };
        diet: {
            calorieGoalReminders: boolean;
            mealPlanNotifications: boolean;
            nutritionInsights: boolean;
            waterReminders: boolean;
        };
    };
    deviceTokens?: Array<{
        _id?: mongoose.Types.ObjectId;
        token: string;
        platform: 'ios' | 'android' | 'web';
        deviceId: string;
        isActive: boolean;
        registeredAt: Date;
        lastUsed?: Date;
    }>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser> & IUser & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=User.d.ts.map