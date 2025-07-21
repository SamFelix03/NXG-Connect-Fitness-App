import mongoose, { Document, Schema } from 'mongoose';

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
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  versionKey: false
});

// Indexes for performance
BranchSchema.index({ name: 1 });
BranchSchema.index({ city: 1 });
BranchSchema.index({ isActive: 1 });

// Export the model
export const Branch = mongoose.model<IBranch>('Branch', BranchSchema); 