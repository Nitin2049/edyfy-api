import { Schema, model } from "mongoose";
const academicSessionSchema = new Schema({
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    year: { type: String, required: true }, // "2024-25"
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
}, { timestamps: true });
academicSessionSchema.index({ schoolId: 1, year: 1 }, { unique: true });
// Ensure only one active session per school (excluding soft-deleted)
academicSessionSchema.index({ schoolId: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true, deletedAt: null } });
export const AcademicSession = model("AcademicSession", academicSessionSchema);
