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
exports.UserActivity = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserActivitySchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    date: {
        type: Date,
        required: [true, 'Date is required'],
        index: true
    },
    workoutActivity: {
        assignedWorkouts: { type: Number, default: 0, min: 0 },
        completedWorkouts: { type: Number, default: 0, min: 0 },
        completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
        workoutHistory: [{
                exerciseId: {
                    type: mongoose_1.Schema.Types.ObjectId,
                    ref: 'Exercise',
                    required: [true, 'Exercise ID is required']
                },
                exerciseName: {
                    type: String,
                    required: [true, 'Exercise name is required'],
                    maxlength: [100, 'Exercise name cannot exceed 100 characters']
                },
                machineId: {
                    type: mongoose_1.Schema.Types.ObjectId,
                    ref: 'Machine'
                },
                completedSets: {
                    type: Number,
                    required: [true, 'Completed sets is required'],
                    min: 0
                },
                completedReps: { type: Number, min: 0 },
                completedSeconds: { type: Number, min: 0 },
                performanceNotes: {
                    type: String,
                    maxlength: [500, 'Performance notes cannot exceed 500 characters']
                },
                completedAt: {
                    type: Date,
                    required: [true, 'Completion time is required']
                }
            }]
    },
    dietActivity: {
        scheduledMeals: { type: Number, default: 0, min: 0 },
        completedMeals: { type: Number, default: 0, min: 0 },
        mealHistory: [{
                mealType: {
                    type: String,
                    required: [true, 'Meal type is required'],
                    enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'],
                    maxlength: [50, 'Meal type cannot exceed 50 characters']
                },
                mealDescription: {
                    type: String,
                    required: [true, 'Meal description is required'],
                    maxlength: [500, 'Meal description cannot exceed 500 characters']
                },
                consumedAt: {
                    type: Date,
                    required: [true, 'Consumption time is required']
                },
                wasOnSchedule: { type: Boolean, default: true },
                notes: {
                    type: String,
                    maxlength: [300, 'Notes cannot exceed 300 characters']
                }
            }],
        uploadedMeals: [{
                imageUrl: {
                    type: String,
                    required: [true, 'Image URL is required'],
                    validate: {
                        validator: function (v) {
                            return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(v);
                        },
                        message: 'Invalid image URL format'
                    }
                },
                calories: {
                    type: Number,
                    required: [true, 'Calories are required'],
                    min: 0
                },
                macros: {
                    carbs: { type: Number, required: true, min: 0 },
                    fat: { type: Number, required: true, min: 0 },
                    protein: { type: Number, required: true, min: 0 },
                    fiber: { type: Number, required: true, min: 0 }
                },
                uploadedAt: {
                    type: Date,
                    required: [true, 'Upload time is required']
                },
                aiVersion: {
                    type: String,
                    required: [true, 'AI version is required'],
                    maxlength: [20, 'AI version cannot exceed 20 characters']
                },
                mealDetected: {
                    type: String,
                    required: [true, 'Detected meal is required'],
                    maxlength: [200, 'Detected meal cannot exceed 200 characters']
                },
                isVerified: { type: Boolean, default: false }
            }]
    },
    pointsEarned: [{
            points: {
                type: Number,
                required: [true, 'Points value is required'],
                min: 0
            },
            reason: {
                type: String,
                required: [true, 'Points reason is required'],
                maxlength: [200, 'Reason cannot exceed 200 characters']
            },
            awardedAt: {
                type: Date,
                required: [true, 'Award time is required']
            }
        }],
    goals: {
        dailyGoals: {
            workouts: { type: Number, min: 0 },
            meals: { type: Number, min: 0 },
            calories: { type: Number, min: 0 },
            steps: { type: Number, min: 0 }
        },
        achievements: [{
                achievementId: {
                    type: String,
                    required: [true, 'Achievement ID is required'],
                    maxlength: [50, 'Achievement ID cannot exceed 50 characters']
                },
                achievementName: {
                    type: String,
                    required: [true, 'Achievement name is required'],
                    maxlength: [100, 'Achievement name cannot exceed 100 characters']
                },
                completedAt: {
                    type: Date,
                    required: [true, 'Completion time is required']
                },
                points: {
                    type: Number,
                    required: [true, 'Points value is required'],
                    min: 0
                }
            }]
    },
    summary: {
        totalWorkouts: { type: Number, default: 0, min: 0 },
        totalMeals: { type: Number, default: 0, min: 0 },
        totalPoints: { type: Number, default: 0, min: 0 },
        caloriesConsumed: { type: Number, default: 0, min: 0 },
        caloriesBurned: { type: Number, default: 0, min: 0 },
        activeMinutes: { type: Number, default: 0, min: 0 }
    }
}, {
    timestamps: true,
    versionKey: false
});
UserActivitySchema.index({ userId: 1, date: -1 }, { unique: true });
UserActivitySchema.index({ userId: 1, 'summary.totalPoints': -1 });
UserActivitySchema.index({ date: -1 });
UserActivitySchema.pre('save', function (next) {
    this['summary'].totalWorkouts = this['workoutActivity'].completedWorkouts;
    this['summary'].totalMeals = this['dietActivity'].completedMeals;
    this['summary'].totalPoints = this['pointsEarned'].reduce((sum, point) => sum + point.points, 0);
    this['summary'].caloriesConsumed = this['dietActivity'].uploadedMeals.reduce((sum, meal) => sum + meal.calories, 0);
    next();
});
exports.UserActivity = mongoose_1.default.model('UserActivity', UserActivitySchema);
//# sourceMappingURL=UserActivity.js.map