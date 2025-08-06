export declare class DietPlanningService {
    private readonly httpClient;
    private circuitBreakerState;
    constructor();
    createDietPlan(input: {
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
    }): Promise<any>;
    private canMakeRequest;
    private recordSuccess;
    private recordFailure;
    private generateCacheKey;
    private getCachedResponse;
    private cacheResponse;
    private generateHMACSignature;
    private formatInputText;
    private formatActivityLevel;
    private getMockDietPlan;
    private getFallbackDietPlan;
}
export declare const dietPlanningService: DietPlanningService;
//# sourceMappingURL=diet-planning.service.d.ts.map