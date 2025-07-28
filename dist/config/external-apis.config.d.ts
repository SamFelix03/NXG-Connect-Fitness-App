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
        exercises: string;
        templates: string;
    };
    ttl: {
        workoutPlans: number;
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
            exercises: string;
            templates: string;
        };
        ttl: {
            workoutPlans: number;
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