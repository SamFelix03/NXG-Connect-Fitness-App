import mongoose, { Document, Schema } from 'mongoose';

// Body Metrics History interface extending Document for TypeScript support
export interface IBodyMetricsHistory extends Document {
  userId: mongoose.Types.ObjectId;
  recordedAt: Date;
  
  // Demographics snapshots
  demographics?: {
    heightCm?: number;
    weightKg?: number;
    age?: number;
    targetWeightKg?: number;
    bmi?: number;
  };
  
  // Body Composition snapshots
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
  
  // Source of the measurement (manual, device, scan, etc.)
  source: string;
  
  // Notes or comments
  notes?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Body Metrics History schema definition
const BodyMetricsHistorySchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  recordedAt: {
    type: Date,
    required: [true, 'Recording date is required'],
    index: true
  },
  
  // Demographics snapshots
  demographics: {
    heightCm: { type: Number, min: 50, max: 300 },
    weightKg: { type: Number, min: 20, max: 500 },
    age: { type: Number, min: 13, max: 120 },
    targetWeightKg: { type: Number, min: 20, max: 500 },
    bmi: { type: Number, min: 10, max: 50 }
  },
  
  // Body Composition snapshots
  bodyComposition: {
    bodyAge: { type: Number, min: 10, max: 120 },
    fatMassKg: { type: Number, min: 0, max: 200 },
    skeletalMuscleMassKg: { type: Number, min: 0, max: 100 },
    rohrerIndex: { type: Number, min: 5, max: 30 },
    bodyFatPercentage: { type: Number, min: 0, max: 100 },
    waistToHipRatio: { type: Number, min: 0.5, max: 2.0 },
    visceralFatAreaCm2: { type: Number, min: 0, max: 500 },
    visceralFatLevel: { type: Number, min: 1, max: 30 },
    subcutaneousFatMassKg: { type: Number, min: 0, max: 100 },
    extracellularWaterL: { type: Number, min: 0, max: 50 },
    bodyCellMassKg: { type: Number, min: 0, max: 100 },
    bcmToEcwRatio: { type: Number, min: 0, max: 5 },
    ecwToTbwRatio: { type: Number, min: 0, max: 1 },
    tbwToFfmRatio: { type: Number, min: 0, max: 1 },
    basalMetabolicRateKcal: { type: Number, min: 800, max: 5000 },
    proteinGrams: { type: Number, min: 0, max: 50000 },
    mineralsMg: { type: Number, min: 0, max: 10000 }
  },
  
  source: {
    type: String,
    required: [true, 'Measurement source is required'],
    enum: ['manual', 'body_scan', 'smart_scale', 'fitness_assessment', 'admin_entry'],
    default: 'manual'
  },
  
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  versionKey: false
});

// Indexes for performance
BodyMetricsHistorySchema.index({ userId: 1, recordedAt: -1 });
BodyMetricsHistorySchema.index({ userId: 1, 'demographics.weightKg': 1 });
BodyMetricsHistorySchema.index({ userId: 1, 'bodyComposition.bodyFatPercentage': 1 });
BodyMetricsHistorySchema.index({ userId: 1, createdAt: -1 });

// Export the model
export const BodyMetricsHistory = mongoose.model<IBodyMetricsHistory>('BodyMetricsHistory', BodyMetricsHistorySchema);