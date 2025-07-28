import mongoose, { Document, Schema } from 'mongoose';

// Exercise interface for individual exercises
export interface IExercise {
  exerciseId: string;
  name: string;
  description?: string;
  sets: number;
  reps: string; // Can be "8-12" for ranges
  weight?: number;
  restTime?: number; // in seconds
  notes?: string;
  muscleGroup: string;
  equipment?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  videoUrl?: string;
  imageUrl?: string;
}

// Workout day interface
export interface IWorkoutDay {
  dayName: string; // e.g., "Monday", "Day 1", etc.
  muscleGroup: string; // e.g., "Push", "Pull", "Legs"
  estimatedDuration?: number; // in minutes
  exercises: IExercise[];
  isRestDay?: boolean;
  notes?: string;
}

// WorkoutPlan interface extending Document for TypeScript support
export interface IWorkoutPlan extends Document {
  // Plan Identification
  planId: string; // External service plan ID
  planName: string;
  userId: mongoose.Types.ObjectId;
  
  // Plan Status
  isActive: boolean;
  
  // Caching and Refresh Metadata
  source: 'external' | 'local';
  cacheExpiry: Date;
  lastRefreshed: Date;
  nextRefreshDate: Date;
  
  // Plan Structure
  workoutDays: IWorkoutDay[];
  
  // Plan Configuration
  weeklySchedule: number; // Number of workout days per week
  planDuration?: number; // Total plan duration in weeks
  difficultyLevel?: 'beginner' | 'intermediate' | 'advanced';
  
  // User Context Data (stored for refresh purposes)
  userContext?: {
    fitnessLevel?: string;
    goal?: string;
    age?: number;
    heightCm?: number;
    weightKg?: number;
    activityLevel?: string;
    healthConditions?: string[];
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Exercise sub-schema
const ExerciseSchema = new Schema({
  exerciseId: {
    type: String,
    required: [true, 'Exercise ID is required']
  },
  name: {
    type: String,
    required: [true, 'Exercise name is required'],
    trim: true,
    maxlength: [100, 'Exercise name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Exercise description cannot exceed 500 characters']
  },
  sets: {
    type: Number,
    required: [true, 'Number of sets is required'],
    min: [1, 'Sets must be at least 1'],
    max: [20, 'Sets cannot exceed 20']
  },
  reps: {
    type: String,
    required: [true, 'Reps specification is required'],
    trim: true
  },
  weight: {
    type: Number,
    min: [0, 'Weight cannot be negative']
  },
  restTime: {
    type: Number,
    default: 60,
    min: [15, 'Rest time must be at least 15 seconds'],
    max: [600, 'Rest time cannot exceed 10 minutes']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [200, 'Exercise notes cannot exceed 200 characters']
  },
  muscleGroup: {
    type: String,
    required: [true, 'Muscle group is required'],
    trim: true
  },
  equipment: {
    type: String,
    trim: true
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced']
  },
  videoUrl: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String,
    trim: true
  }
}, { _id: false });

// Workout day sub-schema
const WorkoutDaySchema = new Schema({
  dayName: {
    type: String,
    required: [true, 'Day name is required'],
    trim: true
  },
  muscleGroup: {
    type: String,
    required: [true, 'Muscle group is required'],
    trim: true
  },
  estimatedDuration: {
    type: Number,
    min: [15, 'Duration must be at least 15 minutes'],
    max: [300, 'Duration cannot exceed 5 hours']
  },
  exercises: [ExerciseSchema],
  isRestDay: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Day notes cannot exceed 500 characters']
  }
}, { _id: false });

// WorkoutPlan schema definition
const WorkoutPlanSchema: Schema = new Schema({
  // Plan Identification
  planId: {
    type: String,
    required: [true, 'Plan ID is required'],
    trim: true
  },
  planName: {
    type: String,
    required: [true, 'Plan name is required'],
    trim: true,
    maxlength: [100, 'Plan name cannot exceed 100 characters']
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  
  // Plan Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Caching and Refresh Metadata
  source: {
    type: String,
    enum: ['external', 'local'],
    default: 'external',
    required: [true, 'Source is required']
  },
  cacheExpiry: {
    type: Date,
    required: [true, 'Cache expiry is required'],
    index: true
  },
  lastRefreshed: {
    type: Date,
    default: Date.now,
    required: [true, 'Last refreshed date is required']
  },
  nextRefreshDate: {
    type: Date,
    required: [true, 'Next refresh date is required'],
    index: true
  },
  
  // Plan Structure
  workoutDays: {
    type: [WorkoutDaySchema],
    required: [true, 'Workout days are required'],
    validate: {
      validator: function(days: IWorkoutDay[]) {
        return days.length > 0;
      },
      message: 'At least one workout day is required'
    }
  },
  
  // Plan Configuration
  weeklySchedule: {
    type: Number,
    required: [true, 'Weekly schedule is required'],
    min: [1, 'Weekly schedule must be at least 1 day'],
    max: [7, 'Weekly schedule cannot exceed 7 days']
  },
  planDuration: {
    type: Number,
    min: [1, 'Plan duration must be at least 1 week'],
    max: [52, 'Plan duration cannot exceed 52 weeks']
  },
  difficultyLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced']
  },
  
  // User Context Data (for refresh purposes)
  userContext: {
    fitnessLevel: { type: String },
    goal: { type: String },
    age: { type: Number },
    heightCm: { type: Number },
    weightKg: { type: Number },
    activityLevel: { type: String },
    healthConditions: [{ type: String }]
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  versionKey: false
});

// Indexes for performance
WorkoutPlanSchema.index({ userId: 1, isActive: 1 }); // Find active plan for user
WorkoutPlanSchema.index({ planId: 1 }, { unique: true }); // Unique plan ID
WorkoutPlanSchema.index({ nextRefreshDate: 1 }); // For background refresh job
WorkoutPlanSchema.index({ cacheExpiry: 1 }); // For cache cleanup
WorkoutPlanSchema.index({ source: 1 });

// Pre-save middleware to calculate nextRefreshDate
WorkoutPlanSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('lastRefreshed')) {
    // Set next refresh to 2 weeks from last refresh
    const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;
    this['nextRefreshDate'] = new Date(this['lastRefreshed'].getTime() + twoWeeksInMs);
    
    // Set cache expiry to 30 days from now (longer than refresh for fallback)
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    this['cacheExpiry'] = new Date(Date.now() + thirtyDaysInMs);
  }
  next();
});

// Static method to find active plan for user
WorkoutPlanSchema.statics['findActiveForUser'] = function(userId: mongoose.Types.ObjectId) {
  return this.findOne({ userId, isActive: true });
};

// Static method to deactivate all plans for user
WorkoutPlanSchema.statics['deactivateAllForUser'] = function(userId: mongoose.Types.ObjectId) {
  return this.updateMany({ userId }, { isActive: false });
};

// Export the model
export const WorkoutPlan = mongoose.model<IWorkoutPlan>('WorkoutPlan', WorkoutPlanSchema);