import { Schema, model, Types, Document } from "mongoose";

export interface IAcademicReport extends Document {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  academicSessionId: Types.ObjectId; // Reference to AcademicSession
  examName: string; // e.g., "Quarterly Exam", "Half Yearly Exam"
  subjects: [
    {
      name: string;
      maxMarks: number;
      marksObtained: number;
      grade: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "D" | "E1" | "E2";
    }
  ];
  coScholastic?: {
    name: string;
    grade: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "D" | "E1" | "E2";
  }[];
  remarks?: string;
  markedBy: Types.ObjectId; // Reference to TeacherProfile,
  deletedAt?: Date;
}

const academicReportSchema = new Schema<IAcademicReport>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "StudentProfile",
      required: true,
    },
    academicSessionId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    examName: { type: String, required: true },
    subjects: [
      {
        name: { type: String, required: true },
        maxMarks: { type: Number, required: true },
        marksObtained: { type: Number, required: true },
        grade: {
          type: String,
          required: true,
          enum: ["A1", "A2", "B1", "B2", "C1", "C2", "D", "E1", "E2"],
        },
      },
    ],
    coScholastic: [
      {
        name: { type: String, required: true },
        grade: {
          type: String,
          required: true,
          enum: ["A1", "A2", "B1", "B2", "C1", "C2", "D", "E1", "E2"],
        },
      },
    ],
    remarks: { type: String, maxLength: 200 },
    markedBy: { type: Schema.Types.ObjectId, ref: "TeacherProfile" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

academicReportSchema.index(
  { schoolId: 1, studentId: 1, academicSessionId: 1, examName: 1 },
  { unique: true }
);

export const AcademicReport = model<IAcademicReport>(
  "AcademicReport",
  academicReportSchema
);
