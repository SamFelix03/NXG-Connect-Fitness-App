export declare const calculateBMI: (weightKg: number, heightCm: number) => number;
export declare const getBMICategory: (bmi: number) => string;
export declare const calculateBMR: (weightKg: number, heightCm: number, age: number, gender: string) => number;
export declare const calculateProgress: (current: any, previous: any) => {
    weightChange: number;
    weightChangePercent: number;
    bodyFatChange: number;
    bodyFatChangePercent: number;
    muscleMassChange: number;
    muscleMassChangePercent: number;
    bmiChange: number;
};
export declare const validateBodyMetrics: (metrics: any) => {
    isValid: boolean;
    warnings: string[];
};
//# sourceMappingURL=bodyMetrics.d.ts.map