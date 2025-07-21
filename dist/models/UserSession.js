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
exports.UserSession = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserSessionSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
                validator: function (v) {
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
        index: { expireAfterSeconds: 0 }
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
UserSessionSchema.index({ userId: 1, isActive: 1 });
UserSessionSchema.index({ userId: 1, createdAt: -1 });
UserSessionSchema.index({ expiresAt: 1 });
UserSessionSchema.pre('save', function (next) {
    if (this.isModified() && !this.isNew) {
        this['lastAccessed'] = new Date();
    }
    next();
});
exports.UserSession = mongoose_1.default.model('UserSession', UserSessionSchema);
//# sourceMappingURL=UserSession.js.map