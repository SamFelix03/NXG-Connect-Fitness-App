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
export interface IBranch extends Document {
    name: string;
    address: string;
    city: string;
    contactNumber: string;
    isActive: boolean;
    capacity: number;
    machines: IMachine[];
    createdAt: Date;
    updatedAt: Date;
}
export declare const Branch: mongoose.Model<IBranch, {}, {}, {}, mongoose.Document<unknown, {}, IBranch> & IBranch & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=Branch.d.ts.map