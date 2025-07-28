export declare class WorkoutPlanningService {
    private readonly httpClient;
    private circuitBreakerState;
    constructor();
    createWorkoutPlan(input: {
        userId: string;
        userProfile: {
            fitnessLevel: string;
            goal: string;
            age: number;
            heightCm: number;
            weightKg: number;
            activityLevel: string;
            healthConditions?: string[];
            weeklyWorkoutDays?: number;
        };
    }): Promise<any>;
    getExerciseLibrary(filters?: {
        muscleGroup?: string;
        equipment?: string;
        difficulty?: string;
    }): Promise<any[]>;
    private canMakeRequest;
    private recordSuccess;
    private recordFailure;
    private generateCacheKey;
    private getCachedResponse;
    private cacheResponse;
    private getMockWorkoutPlan;
    private getFallbackWorkoutPlan;
}
export declare const workoutPlanningService: WorkoutPlanningService;
//# sourceMappingURL=workout-planning.service.d.ts.map