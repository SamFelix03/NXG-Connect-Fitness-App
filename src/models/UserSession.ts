import mongoose, { Document, Schema } from 'mongoose';

export interface IUserSession extends Document {
  userId: mongoose.Types.ObjectId;
  sessionToken: string;
  deviceInfo: {
    deviceType: string;
    os: string;
    appVersion: string;
    userAgent: string;
  };
  networkInfo: {
    ipAddress: string;
    location?: {
      city?: string;
      country?: string;
    };
  };
  expiresAt: Date;
  createdAt: Date;
  lastAccessed: Date;
  isActive: boolean;
}

const UserSessionSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  sessionToken: {
    type: String,
    required: [true, 'Session token is required'],
    unique: true,
    index: true
  },
  deviceInfo: {
    deviceType: {
      type: String,
      required: [true, 'Device type is required'],
      maxlength: [100, 'Device type cannot exceed 100 characters']
    },
    os: {
      type: String,
      required: [true, 'Operating system is required'],
      maxlength: [50, 'OS cannot exceed 50 characters']
    },
    appVersion: {
      type: String,
      required: [true, 'App version is required'],
      maxlength: [20, 'App version cannot exceed 20 characters']
    },
    userAgent: {
      type: String,
      required: [true, 'User agent is required'],
      maxlength: [500, 'User agent cannot exceed 500 characters']
    }
  },
  networkInfo: {
    ipAddress: {
      type: String,
      required: [true, 'IP address is required'],
      validate: {
        validator: function(v: string) {
          // Basic IP validation regex for IPv4 and IPv6
          const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
          return ipv4Regex.test(v) || ipv6Regex.test(v);
        },
        message: 'Invalid IP address format'
      }
    },
    location: {
      city: { type: String, maxlength: [100, 'City cannot exceed 100 characters'] },
      country: { type: String, maxlength: [100, 'Country cannot exceed 100 characters'] }
    }
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiration date is required'],
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  },
  lastAccessed: {
    type: Date,
    default: Date.now,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Compound indexes for performance
UserSessionSchema.index({ userId: 1, isActive: 1 });
UserSessionSchema.index({ userId: 1, createdAt: -1 });
UserSessionSchema.index({ expiresAt: 1 });

// Pre-save middleware to update lastAccessed
UserSessionSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this['lastAccessed'] = new Date();
  }
  next();
});

export const UserSession = mongoose.model<IUserSession>('UserSession', UserSessionSchema);