import mongoose, { Document, Schema } from 'mongoose';

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

const AnalyticsEventSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  sessionId: {
    type: Schema.Types.ObjectId,
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
    metadata: { type: Schema.Types.Mixed }
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
      validator: function(v: string) {
        if (!v) return true; // Optional field
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(v) || ipv6Regex.test(v);
      },
      message: 'Invalid IP address format'
    }
  }
}, {
  timestamps: false, // Using custom timestamp field
  versionKey: false
});

// Compound indexes for analytics queries
AnalyticsEventSchema.index({ userId: 1, timestamp: -1 });
AnalyticsEventSchema.index({ userId: 1, eventType: 1, timestamp: -1 });
AnalyticsEventSchema.index({ eventType: 1, 'eventData.feature': 1, timestamp: -1 });
AnalyticsEventSchema.index({ timestamp: -1 }); // For cleanup and general queries

// TTL index to automatically delete old analytics data (90 days)
AnalyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AnalyticsEvent = mongoose.model<IAnalyticsEvent>('AnalyticsEvent', AnalyticsEventSchema);

// Aggregated analytics data interface
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

const AggregatedAnalyticsSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
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
    featureUsage: { type: Schema.Types.Mixed, default: {} },
    apiCalls: { type: Number, default: 0, min: 0 },
    errors: { type: Number, default: 0, min: 0 },
    uniqueScreens: { type: Number, default: 0, min: 0 },
    engagementScore: { type: Number, default: 0, min: 0, max: 100 }
  }
}, {
  timestamps: true,
  versionKey: false
});

// Compound indexes for aggregated data
AggregatedAnalyticsSchema.index({ userId: 1, period: 1, date: -1 });
AggregatedAnalyticsSchema.index({ period: 1, date: -1 });

export const AggregatedAnalytics = mongoose.model<IAggregatedAnalytics>('AggregatedAnalytics', AggregatedAnalyticsSchema);