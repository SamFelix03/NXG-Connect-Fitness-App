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
interface IDietPlanMethods {
    isExpired(): boolean;
    needsRefresh(): boolean;
    getDayMeals(dayNumber: number): any[];
}
export interface IDietPlan extends Document, IDietPlanMethods {
    userId: mongoose.Types.ObjectId;
    planName: string;
    targetWeightKg: number;
    source: 'external' | 'manual';
    isActive: boolean;
    cacheExpiry?: Date;
    lastRefreshed?: Date;
    nextRefreshDate?: Date;
    totalMacros: {
        calories: string;
        carbs: string;
        protein: string;
        fat: string;
        fiber: string;
    };
    mealPlan: Array<{
        day: number;
        dayName: string;
        meals: Array<{
            mealType: string;
            mealDescription: string;
            shortName: string;
            calories: number;
            mealOrder: number;
        }>;
    }>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const DietPlan: mongoose.Model<IDietPlan, {}, {}, {}, mongoose.Document<unknown, {}, IDietPlan> & IDietPlan & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default DietPlan;
//# sourceMappingURL=DietPlan.d.ts.map