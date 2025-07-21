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
exports.AggregatedAnalytics = exports.AnalyticsEvent = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AnalyticsEventSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    sessionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'UserSession',
        index: true
    },
    eventType: {
        type: String,
        enum: ['app_interaction', 'api_call', 'feature_usage', 'performance', 'error'],
        required: [true, 'Event type is required'],
        index: true
    },
    eventName: {
        type: String,
        required: [true, 'Event name is required'],
        maxlength: [100, 'Event name cannot exceed 100 characters'],
        index: true
    },
    eventData: {
        feature: {
            type: String,
            maxlength: [50, 'Feature name cannot exceed 50 characters'],
            index: true
        },
        action: {
            type: String,
            maxlength: [50, 'Action cannot exceed 50 characters']
        },
        screen: {
            type: String,
            maxlength: [50, 'Screen name cannot exceed 50 characters']
        },
        duration: {
            type: Number,
            min: [0, 'Duration cannot be negative']
        },
        success: { type: Boolean },
        errorCode: {
            type: String,
            maxlength: [20, 'Error code cannot exceed 20 characters']
        },
        metadata: { type: mongoose_1.Schema.Types.Mixed }
    },
    deviceInfo: {
        deviceType: {
            type: String,
            maxlength: [50, 'Device type cannot exceed 50 characters']
        },
        os: {
            type: String,
            maxlength: [30, 'OS cannot exceed 30 characters']
        },
        appVersion: {
            type: String,
            maxlength: [20, 'App version cannot exceed 20 characters']
        }
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    },
    ipAddress: {
        type: String,
        validate: {
            validator: function (v) {
                if (!v)
                    return true;
                const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
                return ipv4Regex.test(v) || ipv6Regex.test(v);
            },
            message: 'Invalid IP address format'
        }
    }
}, {
    timestamps: false,
    versionKey: false
});
AnalyticsEventSchema.index({ userId: 1, timestamp: -1 });
AnalyticsEventSchema.index({ userId: 1, eventType: 1, timestamp: -1 });
AnalyticsEventSchema.index({ eventType: 1, 'eventData.feature': 1, timestamp: -1 });
AnalyticsEventSchema.index({ timestamp: -1 });
AnalyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
exports.AnalyticsEvent = mongoose_1.default.model('AnalyticsEvent', AnalyticsEventSchema);
const AggregatedAnalyticsSchema = new mongoose_1.Schema({
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
    period: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        required: [true, 'Period is required'],
        index: true
    },
    metrics: {
        sessionCount: { type: Number, default: 0, min: 0 },
        totalDuration: { type: Number, default: 0, min: 0 },
        featureUsage: { type: mongoose_1.Schema.Types.Mixed, default: {} },
        apiCalls: { type: Number, default: 0, min: 0 },
        errors: { type: Number, default: 0, min: 0 },
        uniqueScreens: { type: Number, default: 0, min: 0 },
        engagementScore: { type: Number, default: 0, min: 0, max: 100 }
    }
}, {
    timestamps: true,
    versionKey: false
});
AggregatedAnalyticsSchema.index({ userId: 1, period: 1, date: -1 });
AggregatedAnalyticsSchema.index({ period: 1, date: -1 });
exports.AggregatedAnalytics = mongoose_1.default.model('AggregatedAnalytics', AggregatedAnalyticsSchema);
//# sourceMappingURL=Analytics.js.map