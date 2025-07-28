"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkoutPlan = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ExerciseSchema = new mongoose_1.Schema({
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
const WorkoutDaySchema = new mongoose_1.Schema({
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
const WorkoutPlanSchema = new mongoose_1.Schema({
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
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
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
    workoutDays: {
        type: [WorkoutDaySchema],
        required: [true, 'Workout days are required'],
        validate: {
            validator: function (days) {
                return days.length > 0;
            },
            message: 'At least one workout day is required'
        }
    },
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
    timestamps: true,
    versionKey: false
});
WorkoutPlanSchema.index({ userId: 1, isActive: 1 });
WorkoutPlanSchema.index({ planId: 1 }, { unique: true });
WorkoutPlanSchema.index({ nextRefreshDate: 1 });
WorkoutPlanSchema.index({ cacheExpiry: 1 });
WorkoutPlanSchema.index({ source: 1 });
WorkoutPlanSchema.pre('save', function (next) {
    if (this.isNew || this.isModified('lastRefreshed')) {
        const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;
        this['nextRefreshDate'] = new Date(this['lastRefreshed'].getTime() + twoWeeksInMs);
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
        this['cacheExpiry'] = new Date(Date.now() + thirtyDaysInMs);
    }
    next();
});
WorkoutPlanSchema.statics['findActiveForUser'] = function (userId) {
    return this.findOne({ userId, isActive: true });
};
WorkoutPlanSchema.statics['deactivateAllForUser'] = function (userId) {
    return this.updateMany({ userId }, { isActive: false });
};
exports.WorkoutPlan = mongoose_1.default.model('WorkoutPlan', WorkoutPlanSchema);
//# sourceMappingURL=WorkoutPlan.js.map