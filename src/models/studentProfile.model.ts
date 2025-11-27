import { Schema, model, Types, Document } from "mongoose";

export interface IStudentProfile extends Document {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  admissionNo?: string;
  rollNo?: number;
  classId: Types.ObjectId;
  guardianName: string;
  guardianNumber: string;
  dateOfAdmission?: Date;
  dateOfLeaving?: Date;
  academicReports?: Types.ObjectId[];
  status: "active" | "transferred" | "alumni";
  deletedAt?: Date;
}

const studentProfileSchema = new Schema<IStudentProfile>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  admissionNo: { type: String, required: true, trim: true },
  rollNo: { type: Number },
  classId: { type: Schema.Types.ObjectId, ref: "Class" },
  guardianName: { type: String },
  guardianNumber: {
    type: String,
    required: true,
    trim: true,
    lowercase: false,
    match: [/^(?:\+91|0)?[6-9]\d{9}$/, "Invalid Indian phone number"],
  },
  dateOfAdmission: { type: Date },
  dateOfLeaving: { type: Date },
  academicReports: [{ type: Schema.Types.ObjectId, ref: "AcademicReport" }],
  status: {
    type: String,
    enum: ["active", "transferred", "alumni"],
    default: "active",
  },
  deletedAt: { type: Date, default: null },
});

studentProfileSchema.index({ schoolId: 1, admissionNo: 1 });
studentProfileSchema.index({ schoolId: 1, class: 1, rollNo: 1 });
studentProfileSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

export const StudentProfile = model<IStudentProfile>(
  "StudentProfile",
  studentProfileSchema
);
