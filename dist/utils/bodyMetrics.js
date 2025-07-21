"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBodyMetrics = exports.calculateProgress = exports.calculateBMR = exports.getBMICategory = exports.calculateBMI = void 0;
const calculateBMI = (weightKg, heightCm) => {
    if (weightKg <= 0 || heightCm <= 0) {
        throw new Error('Weight and height must be positive values');
    }
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    return Math.round(bmi * 100) / 100;
};
exports.calculateBMI = calculateBMI;
const getBMICategory = (bmi) => {
    if (bmi < 18.5)
        return 'Underweight';
    if (bmi < 25)
        return 'Normal weight';
    if (bmi < 30)
        return 'Overweight';
    return 'Obesity';
};
exports.getBMICategory = getBMICategory;
const calculateBMR = (weightKg, heightCm, age, gender) => {
    let bmr;
    if (gender.toLowerCase() === 'male') {
        bmr = 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age);
    }
    else if (gender.toLowerCase() === 'female') {
        bmr = 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age);
    }
    else {
        const maleBMR = 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age);
        const femaleBMR = 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age);
        bmr = (maleBMR + femaleBMR) / 2;
    }
    return Math.round(bmr);
};
exports.calculateBMR = calculateBMR;
const calculateProgress = (current, previous) => {
    const currentWeight = current.demographics?.weightKg || 0;
    const previousWeight = previous.demographics?.weightKg || 0;
    const currentBodyFat = current.bodyComposition?.bodyFatPercentage || 0;
    const previousBodyFat = previous.bodyComposition?.bodyFatPercentage || 0;
    const currentMuscle = current.bodyComposition?.skeletalMuscleMassKg || 0;
    const previousMuscle = previous.bodyComposition?.skeletalMuscleMassKg || 0;
    const currentBMI = current.demographics?.bmi || 0;
    const previousBMI = previous.demographics?.bmi || 0;
    const weightChange = Math.round((currentWeight - previousWeight) * 100) / 100;
    const weightChangePercent = previousWeight > 0
        ? Math.round(((currentWeight - previousWeight) / previousWeight) * 10000) / 100
        : 0;
    const bodyFatChange = Math.round((currentBodyFat - previousBodyFat) * 100) / 100;
    const bodyFatChangePercent = previousBodyFat > 0
        ? Math.round(((currentBodyFat - previousBodyFat) / previousBodyFat) * 10000) / 100
        : 0;
    const muscleMassChange = Math.round((currentMuscle - previousMuscle) * 100) / 100;
    const muscleMassChangePercent = previousMuscle > 0
        ? Math.round(((currentMuscle - previousMuscle) / previousMuscle) * 10000) / 100
        : 0;
    const bmiChange = Math.round((currentBMI - previousBMI) * 100) / 100;
    return {
        weightChange,
        weightChangePercent,
        bodyFatChange,
        bodyFatChangePercent,
        muscleMassChange,
        muscleMassChangePercent,
        bmiChange
    };
};
exports.calculateProgress = calculateProgress;
const validateBodyMetrics = (metrics) => {
    const warnings = [];
    if (metrics.demographics?.bmi) {
        const bmi = metrics.demographics.bmi;
        if (bmi < 15)
            warnings.push('BMI is extremely low (below 15)');
        if (bmi > 40)
            warnings.push('BMI is extremely high (above 40)');
    }
    if (metrics.bodyComposition?.bodyFatPercentage) {
        const bodyFat = metrics.bodyComposition.bodyFatPercentage;
        if (bodyFat < 5)
            warnings.push('Body fat percentage is extremely low (below 5%)');
        if (bodyFat > 50)
            warnings.push('Body fat percentage is extremely high (above 50%)');
    }
    if (metrics.demographics?.weightKg && metrics.bodyComposition?.skeletalMuscleMassKg) {
        const muscleMassRatio = metrics.bodyComposition.skeletalMuscleMassKg / metrics.demographics.weightKg;
        if (muscleMassRatio > 0.6)
            warnings.push('Muscle mass seems unusually high relative to total weight');
        if (muscleMassRatio < 0.2)
            warnings.push('Muscle mass seems unusually low relative to total weight');
    }
    return {
        isValid: warnings.length === 0,
        warnings
    };
};
exports.validateBodyMetrics = validateBodyMetrics;
//# sourceMappingURL=bodyMetrics.js.map