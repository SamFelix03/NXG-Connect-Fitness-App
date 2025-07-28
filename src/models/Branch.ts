import mongoose, { Document, Schema } from 'mongoose';

// Machine interface for equipment in branch
export interface IMachine {
  _id?: mongoose.Types.ObjectId;
  name: string;
  type: string;
  location: string;
  qrCode: string;
  isAvailable: boolean;
  maintenanceStatus?: 'operational' | 'maintenance' | 'out_of_order';
  lastMaintenanceDate?: Date;
  installationDate?: Date;
  specifications?: {
    maxWeight?: number;
    brand?: string;
    model?: string;
  };
}

// Branch interface extending Document for TypeScript support
export interface IBranch extends Document {
  // Branch Identification
  name: string;
  address: string;
  city: string;
  contactNumber: string;
  
  // Branch Details
  isActive: boolean;
  capacity: number;
  
  // Equipment Management
  machines: IMachine[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Branch schema definition
const BranchSchema: Schema = new Schema({
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
  
  // Equipment Management
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
  timestamps: true, // Automatically adds createdAt and updatedAt
  versionKey: false
});

// Indexes for performance
BranchSchema.index({ name: 1 });
BranchSchema.index({ city: 1 });
BranchSchema.index({ isActive: 1 });
BranchSchema.index({ 'machines.qrCode': 1 });
BranchSchema.index({ 'machines.isAvailable': 1 });
BranchSchema.index({ 'machines.type': 1 });

// Export the model
export const Branch = mongoose.model<IBranch>('Branch', BranchSchema); 