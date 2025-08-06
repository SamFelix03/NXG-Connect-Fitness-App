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
exports.DietPlan = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const dietPlanSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    planName: {
        type: String,
        required: true,
        trim: true
    },
    targetWeightKg: {
        type: Number,
        required: true,
        min: 20,
        max: 500
    },
    source: {
        type: String,
        enum: ['external', 'manual'],
        default: 'external',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true,
        required: true,
        index: true
    },
    cacheExpiry: {
        type: Date,
        index: { expireAfterSeconds: 0 }
    },
    lastRefreshed: {
        type: Date,
        default: Date.now
    },
    nextRefreshDate: {
        type: Date,
        required: true,
        index: true
    },
    totalMacros: {
        calories: {
            type: String,
            required: true
        },
        carbs: {
            type: String,
            required: true
        },
        protein: {
            type: String,
            required: true
        },
        fat: {
            type: String,
            required: true
        },
        fiber: {
            type: String,
            required: true
        }
    },
    mealPlan: [{
            day: {
                type: Number,
                required: true,
                min: 1,
                max: 7
            },
            dayName: {
                type: String,
                required: true,
                enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            },
            meals: [{
                    mealType: {
                        type: String,
                        required: true,
                        enum: ['Breakfast', 'Snack 1', 'Lunch', 'Snack 2', 'Dinner']
                    },
                    mealDescription: {
                        type: String,
                        required: true,
                        trim: true
                    },
                    shortName: {
                        type: String,
                        required: true,
                        trim: true
                    },
                    calories: {
                        type: Number,
                        required: true,
                        min: 0,
                        max: 2000
                    },
                    mealOrder: {
                        type: Number,
                        required: true,
                        min: 1,
                        max: 5
                    }
                }]
        }]
}, {
    timestamps: true,
    collection: 'dietPlans'
});
dietPlanSchema.index({ userId: 1, isActive: 1 });
dietPlanSchema.index({ nextRefreshDate: 1, isActive: 1 });
dietPlanSchema.index({ cacheExpiry: 1 });
dietPlanSchema.index({ createdAt: -1 });
dietPlanSchema.pre('save', function (next) {
    if (this.isNew || this.isModified('lastRefreshed')) {
        const nextRefresh = new Date();
        nextRefresh.setDate(nextRefresh.getDate() + 14);
        this.nextRefreshDate = nextRefresh;
        const cacheExpiry = new Date();
        cacheExpiry.setHours(cacheExpiry.getHours() + 24);
        this.cacheExpiry = cacheExpiry;
    }
    next();
});
dietPlanSchema.methods['isExpired'] = function () {
    return !!(this['cacheExpiry'] && this['cacheExpiry'] < new Date());
};
dietPlanSchema.methods['needsRefresh'] = function () {
    return !!(this['nextRefreshDate'] && this['nextRefreshDate'] <= new Date());
};
dietPlanSchema.methods['getDayMeals'] = function (dayNumber) {
    const dayPlan = this['mealPlan'].find((day) => day.day === dayNumber);
    return dayPlan ? dayPlan.meals.sort((a, b) => a.mealOrder - b.mealOrder) : [];
};
exports.DietPlan = mongoose_1.default.model('DietPlan', dietPlanSchema);
exports.default = exports.DietPlan;
//# sourceMappingURL=DietPlan.js.map