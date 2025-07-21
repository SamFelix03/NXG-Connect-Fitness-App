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
export interface IAnalyticsEvent extends Document {
    userId: mongoose.Types.ObjectId;
    sessionId?: mongoose.Types.ObjectId;
    eventType: 'app_interaction' | 'api_call' | 'feature_usage' | 'performance' | 'error';
    eventName: string;
    eventData: {
        feature?: string;
        action?: string;
        screen?: string;
        duration?: number;
        success?: boolean;
        errorCode?: string;
        metadata?: Record<string, any>;
    };
    deviceInfo?: {
        deviceType: string;
        os: string;
        appVersion: string;
    };
    timestamp: Date;
    ipAddress?: string;
}
export declare const AnalyticsEvent: mongoose.Model<IAnalyticsEvent, {}, {}, {}, mongoose.Document<unknown, {}, IAnalyticsEvent> & IAnalyticsEvent & {
    _id: mongoose.Types.ObjectId;
}, any>;
export interface IAggregatedAnalytics extends Document {
    userId: mongoose.Types.ObjectId;
    date: Date;
    period: 'daily' | 'weekly' | 'monthly';
    metrics: {
        sessionCount: number;
        totalDuration: number;
        featureUsage: Record<string, number>;
        apiCalls: number;
        errors: number;
        uniqueScreens: number;
        engagementScore: number;
    };
    createdAt: Date;
    updatedAt: Date;
}
export declare const AggregatedAnalytics: mongoose.Model<IAggregatedAnalytics, {}, {}, {}, mongoose.Document<unknown, {}, IAggregatedAnalytics> & IAggregatedAnalytics & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=Analytics.d.ts.map