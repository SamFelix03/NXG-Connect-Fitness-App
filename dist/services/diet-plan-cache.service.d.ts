import { IDietPlan } from '../models/DietPlan';
export interface CreateDietPlanInput {
    userId: string;
    userProfile: {
        goal: string;
        age: number;
        heightCm: number;
        weightKg: number;
        targetWeightKg?: number;
        gender: string;
        activityLevel: string;
        allergies?: string[];
        healthConditions?: string[];
    };
    dietPreferences?: {
        cuisinePreferences?: Record<string, string[]>;
    };
    forceRefresh?: boolean;
}
export interface ProcessedDietPlan {
    planId: string;
    planName: string;
    targetWeightKg: number;
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
    source: 'external';
    cacheExpiry: Date;
    lastRefreshed: Date;
    nextRefreshDate: Date;
}
export declare class DietPlanCacheService {
    createOrRefreshDietPlan(input: CreateDietPlanInput): Promise<ProcessedDietPlan>;
    getUserActiveDietPlan(userId: string): Promise<ProcessedDietPlan | null>;
    getDayMeals(userId: string, dayNumber: number): Promise<any>;
    findPlansNeedingRefresh(): Promise<IDietPlan[]>;
    private processExternalResponse;
    private formatDietPlanResponse;
    private cacheInRedis;
    private getFromRedisCache;
}
export declare const dietPlanCacheService: DietPlanCacheService;
//# sourceMappingURL=diet-plan-cache.service.d.ts.map