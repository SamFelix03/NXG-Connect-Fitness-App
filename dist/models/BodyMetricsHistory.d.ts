/// <reference types="mongoose/types/aggregate" />
/// <reference types="mongoose/types/callback" />
/// <reference types="mongoose/types/collection" />
/// <reference types="mongoose/types/connection" />
/// <reference types="mongoose/types/cursor" />
/// <reference types="mongoose/types/document" />
/// <reference types="mongoose/types/error" />
/// <reference types="mongoose/types/expressions" />
/// <reference types="mongoose/types/helpers" />
/// <reference types="mongoose/types/middlewares" />
/// <reference types="mongoose/types/indexes" />
/// <reference types="mongoose/types/models" />
/// <reference types="mongoose/types/mongooseoptions" />
/// <reference types="mongoose/types/pipelinestage" />
/// <reference types="mongoose/types/populate" />
/// <reference types="mongoose/types/query" />
/// <reference types="mongoose/types/schemaoptions" />
/// <reference types="mongoose/types/schematypes" />
/// <reference types="mongoose/types/session" />
/// <reference types="mongoose/types/types" />
/// <reference types="mongoose/types/utility" />
/// <reference types="mongoose/types/validation" />
/// <reference types="mongoose/types/virtuals" />
/// <reference types="mongoose/types/inferschematype" />
import mongoose, { Document } from 'mongoose';
export interface IBodyMetricsHistory extends Document {
    userId: mongoose.Types.ObjectId;
    recordedAt: Date;
    demographics?: {
        heightCm?: number;
        weightKg?: number;
        age?: number;
        targetWeightKg?: number;
        bmi?: number;
    };
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
    source: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const BodyMetricsHistory: mongoose.Model<IBodyMetricsHistory, {}, {}, {}, mongoose.Document<unknown, {}, IBodyMetricsHistory> & IBodyMetricsHistory & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=BodyMetricsHistory.d.ts.map