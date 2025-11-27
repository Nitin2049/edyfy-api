import { Schema, model, Types, Document } from "mongoose";

export interface IEnrollment extends Document {
  schoolId: Types.ObjectId;
  studentProfileId: Types.ObjectId;
  classId: Types.ObjectId;
  academicSessionId: Types.ObjectId;
  enrollmentDate: Date;
  status: "active" | "promoted" | "repeater" | "left";
  promotedBy?: Types.ObjectId;
  promotedOn?: Date;
  notes?: string;
  deletedAt?: Date | null;
}

const enrollmentSchema = new Schema<IEnrollment>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    studentProfileId: {
      type: Schema.Types.ObjectId,
      ref: "StudentProfile",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    academicSessionId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    enrollmentDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["active", "promoted", "repeater", "left"],
      default: "active",
    },
    promotedBy: {
      type: Schema.Types.ObjectId,
      ref: "TeacherProfile",
      default: null,
    },
    promotedOn: { type: Date, default: null },
    notes: { type: String, default: "", trim: true, maxlength: 200 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

enrollmentSchema.index(
  { studentProfileId: 1, academicSessionId: 1 },
  { unique: true }
);

export const Enrollment = model<IEnrollment>("Enrollment", enrollmentSchema);
