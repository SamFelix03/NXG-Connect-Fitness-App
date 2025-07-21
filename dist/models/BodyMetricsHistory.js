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
exports.BodyMetricsHistory = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const BodyMetricsHistorySchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    recordedAt: {
        type: Date,
        required: [true, 'Recording date is required'],
        index: true
    },
    demographics: {
        heightCm: { type: Number, min: 50, max: 300 },
        weightKg: { type: Number, min: 20, max: 500 },
        age: { type: Number, min: 13, max: 120 },
        targetWeightKg: { type: Number, min: 20, max: 500 },
        bmi: { type: Number, min: 10, max: 50 }
    },
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
    timestamps: true,
    versionKey: false
});
BodyMetricsHistorySchema.index({ userId: 1, recordedAt: -1 });
BodyMetricsHistorySchema.index({ userId: 1, 'demographics.weightKg': 1 });
BodyMetricsHistorySchema.index({ userId: 1, 'bodyComposition.bodyFatPercentage': 1 });
BodyMetricsHistorySchema.index({ userId: 1, createdAt: -1 });
exports.BodyMetricsHistory = mongoose_1.default.model('BodyMetricsHistory', BodyMetricsHistorySchema);
//# sourceMappingURL=BodyMetricsHistory.js.map