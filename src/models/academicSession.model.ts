import { Schema, model, Types, Document } from "mongoose";

export interface IAcademicSession extends Document {
  schoolId: Types.ObjectId;
  year: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  deletedAt?: Date | null;
}

const academicSessionSchema = new Schema<IAcademicSession>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    year: { type: String, required: true }, // "2024-25"
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

academicSessionSchema.index({ schoolId: 1, year: 1 }, { unique: true });
// Ensure only one active session per school (excluding soft-deleted)
academicSessionSchema.index(
  { schoolId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true, deletedAt: null } }
);

export const AcademicSession = model<IAcademicSession>(
  "AcademicSession",
  academicSessionSchema
);