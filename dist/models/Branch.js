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
exports.Branch = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const BranchSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, 'Branch name is required'],
        trim: true,
        maxlength: [100, 'Branch name cannot exceed 100 characters']
    },
    address: {
        type: String,
        required: [true, 'Branch address is required'],
        trim: true,
        maxlength: [200, 'Address cannot exceed 200 characters']
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
        maxlength: [50, 'City name cannot exceed 50 characters']
    },
    contactNumber: {
        type: String,
        required: [true, 'Contact number is required'],
        trim: true,
        match: [/^\+?[\d\s\-\(\)]+$/, 'Please provide a valid contact number']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    capacity: {
        type: Number,
        default: 500,
        min: [1, 'Capacity must be at least 1'],
        max: [10000, 'Capacity cannot exceed 10000']
    },
    machines: [{
            name: {
                type: String,
                required: [true, 'Machine name is required'],
                trim: true,
                maxlength: [100, 'Machine name cannot exceed 100 characters']
            },
            type: {
                type: String,
                required: [true, 'Machine type is required'],
                trim: true,
                enum: ['cardio', 'strength', 'functional', 'stretching', 'other']
            },
            location: {
                type: String,
                required: [true, 'Machine location is required'],
                trim: true,
                maxlength: [50, 'Location cannot exceed 50 characters']
            },
            qrCode: {
                type: String,
                required: [true, 'QR code is required'],
                trim: true,
                unique: true
            },
            isAvailable: {
                type: Boolean,
                default: true,
                index: true
            },
            maintenanceStatus: {
                type: String,
                enum: ['operational', 'maintenance', 'out_of_order'],
                default: 'operational'
            },
            lastMaintenanceDate: {
                type: Date
            },
            installationDate: {
                type: Date,
                default: Date.now
            },
            specifications: {
                maxWeight: {
                    type: Number,
                    min: [0, 'Max weight cannot be negative']
                },
                brand: {
                    type: String,
                    trim: true
                },
                model: {
                    type: String,
                    trim: true
                }
            }
        }]
}, {
    timestamps: true,
    versionKey: false
});
BranchSchema.index({ name: 1 });
BranchSchema.index({ city: 1 });
BranchSchema.index({ isActive: 1 });
BranchSchema.index({ 'machines.qrCode': 1 });
BranchSchema.index({ 'machines.isAvailable': 1 });
BranchSchema.index({ 'machines.type': 1 });
exports.Branch = mongoose_1.default.model('Branch', BranchSchema);
//# sourceMappingURL=Branch.js.map