import { Schema, Types, model, Document } from "mongoose";
import {School} from "./school.model.js";

export interface IAdminProfile extends Document {
  schoolId: Types.ObjectId; // Reference to School
  userId: Types.ObjectId; // Reference to User
  status: "active" | "inactive";
  deletedAt?: Date;
}

const adminProfileSchema = new Schema<IAdminProfile>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, id: false }
);

adminProfileSchema.index({ schoolId: 1, email: 1 });
adminProfileSchema.index(
  { schoolId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

export const AdminProfile = model<IAdminProfile>("AdminProfile", adminProfileSchema);
