export declare const workoutPlanningServiceConfig: {
    baseUrl: string;
    apiKey: string;
    timeout: number;
    retry: {
        attempts: number;
        delay: number;
        factor: number;
    };
    circuitBreaker: {
        failureThreshold: number;
        timeout: number;
        resetTimeout: number;
    };
    rateLimit: {
        requestsPerMinute: number;
        requestsPerHour: number;
    };
    endpoints: {
        createWorkoutPlan: string;
        getWorkoutPlan: string;
        updateWorkoutPlan: string;
        getExerciseLibrary: string;
        getWorkoutTemplates: string;
    };
    defaultHeaders: {
        'Content-Type': string;
        Accept: string;
        'User-Agent': string;
    };
    features: {
        enableCaching: boolean;
        enableCircuitBreaker: boolean;
        enableRetries: boolean;
        mockMode: boolean;
    };
};
export declare const dietPlanningServiceConfig: {
    baseUrl: string;
    apiKey: string;
    hmacSecret: string;
    timeout: number;
    rateLimit: {
        requestsPerDay: number;
        requestsPerHour: number;
        requestsPerMinute: number;
    };
    retry: {
        attempts: number;
        delay: number;
        factor: number;
    };
    circuitBreaker: {
        failureThreshold: number;
        timeout: number;
        resetTimeout: number;
    };
    endpoints: {
        createDietPlan: string;
    };
    defaultHeaders: {
        'Content-Type': string;
        Accept: string;
        'User-Agent': string;
    };
    features: {
        enableCaching: boolean;
        enableCircuitBreaker: boolean;
        enableRetries: boolean;
        mockMode: boolean;
    };
};
export declare const externalApisConfig: {
    globalTimeout: number;
    globalRetry: {
        attempts: number;
        delay: number;
    };
    commonHeaders: {
        'User-Agent': string;
        Accept: string;
        'Content-Type': string;
    };
    environment: {
        isDevelopment: boolean;
        isProduction: boolean;
        isTest: boolean;
    };
};
export declare const externalApiCacheConfig: {
    keyPrefixes: {
        workoutPlans: string;
        dietPlans: string;
        exercises: string;
        templates: string;
    };
    ttl: {
        workoutPlans: number;
        dietPlans: number;
        exercises: number;
        templates: number;
        default: number;
    };
    refresh: {
        staleWhileRevalidate: number;
        refreshBuffer: number;
    };
};
export declare const mockApiResponses: {
    workoutPlan: {
        planId: string;
        planName: string;
        weeklySchedule: number;
        difficultyLevel: string;
        planDuration: number;
        workoutDays: {
            dayName: string;
            muscleGroup: string;
            estimatedDuration: number;
            isRestDay: boolean;
            exercises: {
                exerciseId: string;
                name: string;
                description: string;
                sets: number;
                reps: string;
                restTime: number;
                muscleGroup: string;
                equipment: string;
                difficulty: string;
            }[];
        }[];
    };
    dietPlan: {
        target_weight: string;
        macros: {
            "Total Calories": string;
            "Total Carbs": string;
            "Total Protein": string;
            "Total Fat": string;
            "Total Fiber": string;
        };
        meal_plan: {
            meals: {
                Breakfast: string;
                "Snack 1": string;
                Lunch: string;
                "Snack 2": string;
                Dinner: string;
            };
            calories: {
                Breakfast: number;
                "Snack 1": number;
                Lunch: number;
                "Snack 2": number;
                Dinner: number;
            };
            short_names: {
                Breakfast: string;
                "Snack 1": string;
                Lunch: string;
                "Snack 2": string;
                Dinner: string;
            };
            day: number;
        }[];
    };
    exerciseLibrary: {
        exerciseId: string;
        name: string;
        description: string;
        muscleGroup: string;
        equipment: string;
        difficulty: string;
        videoUrl: string;
        imageUrl: string;
    }[];
};
export declare const validateExternalApisConfig: () => {
    isValid: boolean;
    errors: string[];
};
declare const _default: {
    workoutPlanningService: {
        baseUrl: string;
        apiKey: string;
        timeout: number;
        retry: {
            attempts: number;
            delay: number;
            factor: number;
        };
        circuitBreaker: {
            failureThreshold: number;
            timeout: number;
            resetTimeout: number;
        };
        rateLimit: {
            requestsPerMinute: number;
            requestsPerHour: number;
        };
        endpoints: {
            createWorkoutPlan: string;
            getWorkoutPlan: string;
            updateWorkoutPlan: string;
            getExerciseLibrary: string;
            getWorkoutTemplates: string;
        };
        defaultHeaders: {
            'Content-Type': string;
            Accept: string;
            'User-Agent': string;
        };
        features: {
            enableCaching: boolean;
            enableCircuitBreaker: boolean;
            enableRetries: boolean;
            mockMode: boolean;
        };
    };
    dietPlanningService: {
        baseUrl: string;
        apiKey: string;
        hmacSecret: string;
        timeout: number;
        rateLimit: {
            requestsPerDay: number;
            requestsPerHour: number;
            requestsPerMinute: number;
        };
        retry: {
            attempts: number;
            delay: number;
            factor: number;
        };
        circuitBreaker: {
            failureThreshold: number;
            timeout: number;
            resetTimeout: number;
        };
        endpoints: {
            createDietPlan: string;
        };
        defaultHeaders: {
            'Content-Type': string;
            Accept: string;
            'User-Agent': string;
        };
        features: {
            enableCaching: boolean;
            enableCircuitBreaker: boolean;
            enableRetries: boolean;
            mockMode: boolean;
        };
    };
    general: {
        globalTimeout: number;
        globalRetry: {
            attempts: number;
            delay: number;
        };
        commonHeaders: {
            'User-Agent': string;
            Accept: string;
            'Content-Type': string;
        };
        environment: {
            isDevelopment: boolean;
            isProduction: boolean;
            isTest: boolean;
        };
    };
    cache: {
        keyPrefixes: {
            workoutPlans: string;
            dietPlans: string;
            exercises: string;
            templates: string;
        };
        ttl: {
            workoutPlans: number;
            dietPlans: number;
            exercises: number;
            templates: number;
            default: number;
        };
        refresh: {
            staleWhileRevalidate: number;
            refreshBuffer: number;
        };
    };
    mocks: {
        workoutPlan: {
            planId: string;
            planName: string;
            weeklySchedule: number;
            difficultyLevel: string;
            planDuration: number;
            workoutDays: {
                dayName: string;
                muscleGroup: string;
                estimatedDuration: number;
                isRestDay: boolean;
                exercises: {
                    exerciseId: string;
                    name: string;
                    description: string;
                    sets: number;
                    reps: string;
                    restTime: number;
                    muscleGroup: string;
                    equipment: string;
                    difficulty: string;
                }[];
            }[];
        };
        dietPlan: {
            target_weight: string;
            macros: {
                "Total Calories": string;
                "Total Carbs": string;
                "Total Protein": string;
                "Total Fat": string;
                "Total Fiber": string;
            };
            meal_plan: {
                meals: {
                    Breakfast: string;
                    "Snack 1": string;
                    Lunch: string;
                    "Snack 2": string;
                    Dinner: string;
                };
                calories: {
                    Breakfast: number;
                    "Snack 1": number;
                    Lunch: number;
                    "Snack 2": number;
                    Dinner: number;
                };
                short_names: {
                    Breakfast: string;
                    "Snack 1": string;
                    Lunch: string;
                    "Snack 2": string;
                    Dinner: string;
                };
                day: number;
            }[];
        };
        exerciseLibrary: {
            exerciseId: string;
            name: string;
            description: string;
            muscleGroup: string;
            equipment: string;
            difficulty: string;
            videoUrl: string;
            imageUrl: string;
        }[];
    };
    validate: () => {
        isValid: boolean;
        errors: string[];
    };
};
export default _default;
//# sourceMappingURL=external-apis.config.d.ts.map