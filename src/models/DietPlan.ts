import mongoose, { Document, Schema } from 'mongoose';

// Instance methods interface
interface IDietPlanMethods {
  isExpired(): boolean;
  needsRefresh(): boolean;
  getDayMeals(dayNumber: number): any[];
}

// Diet Plan interface extending Document for TypeScript support
export interface IDietPlan extends Document, IDietPlanMethods {
  // User Association
  userId: mongoose.Types.ObjectId;
  
  // Plan Metadata
  planName: string;
  targetWeightKg: number;
  source: 'external' | 'manual';
  isActive: boolean;
  
  // Cache Management Fields
  cacheExpiry?: Date;
  lastRefreshed?: Date;
  nextRefreshDate?: Date;
  
  // Total Macros
  totalMacros: {
    calories: string;
    carbs: string;
    protein: string;
    fat: string;
    fiber: string;
  };
  
  // Weekly Meal Plan (7 days)
  mealPlan: Array<{
    day: number;
    dayName: string;
    meals: Array<{
      mealType: string; // 'Breakfast', 'Snack 1', 'Lunch', 'Snack 2', 'Dinner'
      mealDescription: string;
      shortName: string;
      calories: number;
      mealOrder: number;
    }>;
  }>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Diet Plan Schema
const dietPlanSchema = new Schema<IDietPlan>({
  // User Association
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Plan Metadata
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
  
  // Cache Management Fields
  cacheExpiry: {
    type: Date,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
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
  
  // Total Macros
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
  
  // Weekly Meal Plan
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

// Compound Indexes for Performance
dietPlanSchema.index({ userId: 1, isActive: 1 }); // For finding user's active plan
dietPlanSchema.index({ nextRefreshDate: 1, isActive: 1 }); // For background refresh jobs
dietPlanSchema.index({ cacheExpiry: 1 }); // For cache cleanup
dietPlanSchema.index({ createdAt: -1 }); // For recent plans query

// Pre-save middleware to set next refresh date
dietPlanSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('lastRefreshed')) {
    // Set next refresh to 2 weeks from now
    const nextRefresh = new Date();
    nextRefresh.setDate(nextRefresh.getDate() + 14);
    this.nextRefreshDate = nextRefresh;
    
    // Set cache expiry to 24 hours from now
    const cacheExpiry = new Date();
    cacheExpiry.setHours(cacheExpiry.getHours() + 24);
    this.cacheExpiry = cacheExpiry;
  }
  next();
});

// Instance Methods
dietPlanSchema.methods['isExpired'] = function(): boolean {
  return !!(this['cacheExpiry'] && this['cacheExpiry'] < new Date());
};

dietPlanSchema.methods['needsRefresh'] = function(): boolean {
  return !!(this['nextRefreshDate'] && this['nextRefreshDate'] <= new Date());
};

dietPlanSchema.methods['getDayMeals'] = function(dayNumber: number) {
  const dayPlan = this['mealPlan'].find((day: any) => day.day === dayNumber);
  return dayPlan ? dayPlan.meals.sort((a: any, b: any) => a.mealOrder - b.mealOrder) : [];
};

// Export the model
export const DietPlan = mongoose.model<IDietPlan>('DietPlan', dietPlanSchema);
export default DietPlan;