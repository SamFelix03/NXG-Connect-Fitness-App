import mongoose, { Document, Schema } from 'mongoose';

// User interface extending Document for TypeScript support
export interface IUser extends Document {
  // Authentication & Identity
  username: string;
  email: string;
  passwordHash: string;
  name: string;
  
  // Account Status
  isActive: boolean;
  emailVerified: boolean;
  lastLogin?: Date;
  
  // Basic Demographics
  demographics: {
    age?: number;
    heightCm?: number;
    weightKg?: number;
    gender?: string;
    targetWeightKg?: number;
    bmi?: number;
    allergies?: string[];
    activityLevel?: string;
  };
  
  // Fitness Profile
  fitnessProfile: {
    level?: string;
    restDay?: string;
    goal?: string;
    goalWeightDiff?: number;
    healthConditions?: string[];
  };
  
  // Diet Preferences
  dietPreferences: {
    cuisinePreferences?: Record<string, string[]>;
  };
  
  // Body Composition Metrics
  bodyComposition?: {
    bodyAge?: number;
    fatMassKg?: number;
    skeletalMuscleMassKg?: number;
    rohrerIndex?: number;
    bodyFatPercentage?: number;
    waistToHipRatio?: number;
    visceralFatAreaCm2?: number;
    visceralFatLevel?: number;
    subcutaneousFatMassKg?: number;
    extracellularWaterL?: number;
    bodyCellMassKg?: number;
    bcmToEcwRatio?: number;
    ecwToTbwRatio?: number;
    tbwToFfmRatio?: number;
    basalMetabolicRateKcal?: number;
    proteinGrams?: number;
    mineralsMg?: number;
  };
  
  // Current Active Plans
  activePlans?: {
    workoutPlanId?: mongoose.Types.ObjectId;
    dietPlanId?: mongoose.Types.ObjectId;
  };
  
  // Branch Associations
  branches?: Array<{
    branchId: mongoose.Types.ObjectId;
    branchName: string;
    joinedAt: Date;
  }>;
  
  // Current Macros
  currentMacros?: {
    calories?: string;
    carbs?: string;
    protein?: string;
    fat?: string;
    fiber?: string;
    validTill?: Date;
  };
  
  // NXG Points
  totalPoints: number;
  
  // Privacy Settings
  privacySettings?: {
    shareBasicMetrics: boolean;        // Share height, weight, BMI
    shareBodyComposition: boolean;     // Share detailed body composition
    shareHealthConditions: boolean;    // Share health conditions
    shareProgressPhotos: boolean;      // Share progress photos
    shareWorkoutData: boolean;         // Share workout performance
    shareNutritionData: boolean;       // Share nutrition tracking
    profileVisibility: 'public' | 'friends' | 'private';
    allowHealthDataExport: boolean;    // Allow GDPR data export
  };

  // User Preferences
  preferences?: {
    notifications: {
      workoutReminders: boolean;
      mealReminders: boolean;
      achievementAlerts: boolean;
      socialUpdates: boolean;
      weeklyReports: boolean;
      pushNotifications: boolean;
      emailNotifications: boolean;
      smsNotifications: boolean;
    };
    appConfiguration: {
      theme: 'light' | 'dark' | 'auto';
      language: string;
      timezone: string;
      units: 'metric' | 'imperial';
      startOfWeek: 'monday' | 'sunday';
      autoSync: boolean;
    };
    workout: {
      restTimerSound: boolean;
      formTips: boolean;
      autoProgressPhotos: boolean;
      defaultRestTime: number;
    };
    diet: {
      calorieGoalReminders: boolean;
      mealPlanNotifications: boolean;
      nutritionInsights: boolean;
      waterReminders: boolean;
    };
  };

  // Device Tokens for Push Notifications
  deviceTokens?: Array<{
    _id?: mongoose.Types.ObjectId;
    token: string;
    platform: 'ios' | 'android' | 'web';
    deviceId: string;
    isActive: boolean;
    registeredAt: Date;
    lastUsed?: Date;
  }>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// User schema definition
const UserSchema: Schema = new Schema({
  // Authentication & Identity
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required'],
    minlength: [60, 'Invalid password hash format'] // bcrypt hash length
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  
  // Basic Demographics
  demographics: {
    age: { type: Number, min: 13, max: 120 },
    heightCm: { type: Number, min: 50, max: 300 },
    weightKg: { type: Number, min: 20, max: 500 },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    targetWeightKg: { type: Number, min: 20, max: 500 },
    bmi: { type: Number, min: 10, max: 50 },
    allergies: [{ type: String }],
    activityLevel: { type: String }
  },
  
  // Fitness Profile
  fitnessProfile: {
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    restDay: { type: String },
    goal: { type: String, enum: ['weight_loss', 'weight_gain', 'muscle_building', 'maintenance'] },
    goalWeightDiff: { type: Number },
    healthConditions: [{ type: String }]
  },
  
  // Diet Preferences
  dietPreferences: {
    cuisinePreferences: { type: Schema.Types.Mixed }
  },
  
  // Body Composition Metrics
  bodyComposition: {
    bodyAge: { type: Number },
    fatMassKg: { type: Number },
    skeletalMuscleMassKg: { type: Number },
    rohrerIndex: { type: Number },
    bodyFatPercentage: { type: Number },
    waistToHipRatio: { type: Number },
    visceralFatAreaCm2: { type: Number },
    visceralFatLevel: { type: Number },
    subcutaneousFatMassKg: { type: Number },
    extracellularWaterL: { type: Number },
    bodyCellMassKg: { type: Number },
    bcmToEcwRatio: { type: Number },
    ecwToTbwRatio: { type: Number },
    tbwToFfmRatio: { type: Number },
    basalMetabolicRateKcal: { type: Number },
    proteinGrams: { type: Number },
    mineralsMg: { type: Number }
  },
  
  // Current Active Plans
  activePlans: {
    workoutPlanId: { type: Schema.Types.ObjectId, ref: 'WorkoutPlan' },
    dietPlanId: { type: Schema.Types.ObjectId, ref: 'DietPlan' }
  },
  
  // Branch Associations
  branches: [{
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    branchName: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now }
  }],
  
  // Current Macros
  currentMacros: {
    calories: { type: String },
    carbs: { type: String },
    protein: { type: String },
    fat: { type: String },
    fiber: { type: String },
    validTill: { type: Date }
  },
  
  // NXG Points
  totalPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Privacy Settings
  privacySettings: {
    shareBasicMetrics: { type: Boolean, default: true },
    shareBodyComposition: { type: Boolean, default: false },
    shareHealthConditions: { type: Boolean, default: false },
    shareProgressPhotos: { type: Boolean, default: false },
    shareWorkoutData: { type: Boolean, default: true },
    shareNutritionData: { type: Boolean, default: false },
    profileVisibility: { 
      type: String, 
      enum: ['public', 'friends', 'private'], 
      default: 'friends' 
    },
    allowHealthDataExport: { type: Boolean, default: true }
  },

  // User Preferences
  preferences: {
    notifications: {
      workoutReminders: { type: Boolean, default: true },
      mealReminders: { type: Boolean, default: true },
      achievementAlerts: { type: Boolean, default: true },
      socialUpdates: { type: Boolean, default: false },
      weeklyReports: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: false }
    },
    appConfiguration: {
      theme: { 
        type: String, 
        enum: ['light', 'dark', 'auto'], 
        default: 'auto' 
      },
      language: { type: String, default: 'en' },
      timezone: { type: String, default: 'UTC' },
      units: { 
        type: String, 
        enum: ['metric', 'imperial'], 
        default: 'metric' 
      },
      startOfWeek: { 
        type: String, 
        enum: ['monday', 'sunday'], 
        default: 'monday' 
      },
      autoSync: { type: Boolean, default: true }
    },
    workout: {
      restTimerSound: { type: Boolean, default: true },
      formTips: { type: Boolean, default: true },
      autoProgressPhotos: { type: Boolean, default: false },
      defaultRestTime: { type: Number, default: 60, min: 30, max: 300 }
    },
    diet: {
      calorieGoalReminders: { type: Boolean, default: true },
      mealPlanNotifications: { type: Boolean, default: true },
      nutritionInsights: { type: Boolean, default: true },
      waterReminders: { type: Boolean, default: true }
    }
  },

  // Device Tokens for Push Notifications
  deviceTokens: [{
    token: { 
      type: String, 
      required: [true, 'Device token is required'],
      maxlength: [500, 'Device token cannot exceed 500 characters']
    },
    platform: { 
      type: String, 
      enum: ['ios', 'android', 'web'],
      required: [true, 'Platform is required']
    },
    deviceId: { 
      type: String, 
      required: [true, 'Device ID is required'],
      maxlength: [100, 'Device ID cannot exceed 100 characters']
    },
    isActive: { type: Boolean, default: true },
    registeredAt: { type: Date, default: Date.now },
    lastUsed: { type: Date }
  }]
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  versionKey: false
});

// Indexes for performance
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ isActive: 1 });
UserSchema.index({ 'branches.branchId': 1 });

// Export the model
export const User = mongoose.model<IUser>('User', UserSchema); 