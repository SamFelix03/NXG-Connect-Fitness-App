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
export interface IUserActivity extends Document {
    userId: mongoose.Types.ObjectId;
    date: Date;
    workoutActivity: {
        assignedWorkouts: number;
        completedWorkouts: number;
        completionPercentage: number;
        workoutHistory: Array<{
            exerciseId: mongoose.Types.ObjectId;
            exerciseName: string;
            machineId?: mongoose.Types.ObjectId;
            completedSets: number;
            completedReps?: number;
            completedSeconds?: number;
            performanceNotes?: string;
            completedAt: Date;
        }>;
    };
    dietActivity: {
        scheduledMeals: number;
        completedMeals: number;
        mealHistory: Array<{
            mealType: string;
            mealDescription: string;
            consumedAt: Date;
            wasOnSchedule: boolean;
            notes?: string;
        }>;
        uploadedMeals: Array<{
            imageUrl: string;
            calories: number;
            macros: {
                carbs: number;
                fat: number;
                protein: number;
                fiber: number;
            };
            uploadedAt: Date;
            aiVersion: string;
            mealDetected: string;
            isVerified: boolean;
        }>;
    };
    pointsEarned: Array<{
        points: number;
        reason: string;
        awardedAt: Date;
    }>;
    goals: {
        dailyGoals?: {
            workouts?: number;
            meals?: number;
            calories?: number;
            steps?: number;
        };
        achievements?: Array<{
            achievementId: string;
            achievementName: string;
            completedAt: Date;
            points: number;
        }>;
    };
    summary: {
        totalWorkouts: number;
        totalMeals: number;
        totalPoints: number;
        caloriesConsumed: number;
        caloriesBurned: number;
        activeMinutes: number;
    };
    createdAt: Date;
    updatedAt: Date;
}
export declare const UserActivity: mongoose.Model<IUserActivity, {}, {}, {}, mongoose.Document<unknown, {}, IUserActivity> & IUserActivity & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=UserActivity.d.ts.map