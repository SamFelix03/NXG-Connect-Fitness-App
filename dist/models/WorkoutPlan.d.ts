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
export interface IExercise {
    exerciseId: string;
    name: string;
    description?: string;
    sets: number;
    reps: string;
    weight?: number;
    restTime?: number;
    notes?: string;
    muscleGroup: string;
    equipment?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    videoUrl?: string;
    imageUrl?: string;
}
export interface IWorkoutDay {
    dayName: string;
    muscleGroup: string;
    estimatedDuration?: number;
    exercises: IExercise[];
    isRestDay?: boolean;
    notes?: string;
}
export interface IWorkoutPlan extends Document {
    planId: string;
    planName: string;
    userId: mongoose.Types.ObjectId;
    isActive: boolean;
    source: 'external' | 'local';
    cacheExpiry: Date;
    lastRefreshed: Date;
    nextRefreshDate: Date;
    workoutDays: IWorkoutDay[];
    weeklySchedule: number;
    planDuration?: number;
    difficultyLevel?: 'beginner' | 'intermediate' | 'advanced';
    userContext?: {
        fitnessLevel?: string;
        goal?: string;
        age?: number;
        heightCm?: number;
        weightKg?: number;
        activityLevel?: string;
        healthConditions?: string[];
    };
    createdAt: Date;
    updatedAt: Date;
}
export declare const WorkoutPlan: mongoose.Model<IWorkoutPlan, {}, {}, {}, mongoose.Document<unknown, {}, IWorkoutPlan> & IWorkoutPlan & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=WorkoutPlan.d.ts.map