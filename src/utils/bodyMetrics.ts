// Body metrics calculation utilities

/**
 * Calculate BMI (Body Mass Index)
 * @param weightKg Weight in kilograms
 * @param heightCm Height in centimeters
 * @returns BMI value rounded to 2 decimal places
 */
export const calculateBMI = (weightKg: number, heightCm: number): number => {
  if (weightKg <= 0 || heightCm <= 0) {
    throw new Error('Weight and height must be positive values');
  }
  
  const heightM = heightCm / 100; // Convert cm to meters
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate BMI category
 * @param bmi BMI value
 * @returns BMI category string
 */
export const getBMICategory = (bmi: number): string => {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal weight';
  if (bmi < 30) return 'Overweight';
  return 'Obesity';
};

/**
 * Calculate Basal Metabolic Rate (BMR) using Harris-Benedict equation
 * @param weightKg Weight in kilograms
 * @param heightCm Height in centimeters
 * @param age Age in years
 * @param gender Gender ('Male', 'Female', 'Other')
 * @returns BMR in calories per day
 */
export const calculateBMR = (
  weightKg: number, 
  heightCm: number, 
  age: number, 
  gender: string
): number => {
  let bmr: number;
  
  if (gender.toLowerCase() === 'male') {
    // Harris-Benedict equation for men
    bmr = 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age);
  } else if (gender.toLowerCase() === 'female') {
    // Harris-Benedict equation for women
    bmr = 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age);
  } else {
    // Use average for 'Other' gender
    const maleBMR = 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age);
    const femaleBMR = 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age);
    bmr = (maleBMR + femaleBMR) / 2;
  }
  
  return Math.round(bmr);
};

/**
 * Calculate progress between two body metrics readings
 * @param current Current metrics
 * @param previous Previous metrics
 * @returns Progress object with changes and percentages
 */
export const calculateProgress = (
  current: any,
  previous: any
): {
  weightChange: number;
  weightChangePercent: number;
  bodyFatChange: number;
  bodyFatChangePercent: number;
  muscleMassChange: number;
  muscleMassChangePercent: number;
  bmiChange: number;
} => {
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

/**
 * Validate if body metrics data is reasonable
 * @param metrics Body metrics object
 * @returns Validation result with warnings
 */
export const validateBodyMetrics = (metrics: any): {
  isValid: boolean;
  warnings: string[];
} => {
  const warnings: string[] = [];
  
  // Check for unrealistic BMI values
  if (metrics.demographics?.bmi) {
    const bmi = metrics.demographics.bmi;
    if (bmi < 15) warnings.push('BMI is extremely low (below 15)');
    if (bmi > 40) warnings.push('BMI is extremely high (above 40)');
  }
  
  // Check body fat percentage
  if (metrics.bodyComposition?.bodyFatPercentage) {
    const bodyFat = metrics.bodyComposition.bodyFatPercentage;
    if (bodyFat < 5) warnings.push('Body fat percentage is extremely low (below 5%)');
    if (bodyFat > 50) warnings.push('Body fat percentage is extremely high (above 50%)');
  }
  
  // Check muscle mass relative to weight
  if (metrics.demographics?.weightKg && metrics.bodyComposition?.skeletalMuscleMassKg) {
    const muscleMassRatio = metrics.bodyComposition.skeletalMuscleMassKg / metrics.demographics.weightKg;
    if (muscleMassRatio > 0.6) warnings.push('Muscle mass seems unusually high relative to total weight');
    if (muscleMassRatio < 0.2) warnings.push('Muscle mass seems unusually low relative to total weight');
  }
  
  return {
    isValid: warnings.length === 0,
    warnings
  };
};