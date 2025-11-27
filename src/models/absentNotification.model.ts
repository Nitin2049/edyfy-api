import { Schema, model, Types, Document } from "mongoose";

//USAGE:
//  When a student is marked absent, create a new SMSNotification with status "pending".
//  After sending the SMS, update status to "sent" and set "sentAt".
//  If sending fails, set status to "failed" and insert the error field in DB.

export interface ISMSNotification extends Document {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  guardianPhone: string;
  date: Date;            // UTC midnight Date for sorting/comparison
  dateLocal: string;     // YYYY-MM-DD exact local day (source of truth like attendance)
  message: string;
  status: "pending" | "sent" | "failed";
  error?: string;
  sentAt?: Date;
}

const smsNotificationSchema = new Schema<ISMSNotification>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "StudentProfile",
      required: true,
    },
    guardianPhone: {
      type: String,
      required: true,
      trim: true,
      lowercase: false,
      match: [/^(?:\+91|0)?[6-9]\d{9}$/, "Invalid Indian phone number"],
    },
    // Local day string for uniqueness & querying (mirrors attendance.dateLocal)
    dateLocal: { type: String, required: true }, // "2025-11-24"
    // UTC midnight Date for sorting / legacy compatibility
    date: { type: Date, required: true },
    message: { type: String, required: true, maxlength: 250 },
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    error: { type: String },
    sentAt: { type: Date },
  },
  { timestamps: true }
);

// Uniqueness per (school, student, local day)
smsNotificationSchema.index({ schoolId: 1, studentId: 1, dateLocal: 1 }, { unique: true });

export const SMSNotification = model<ISMSNotification>(
  "SMSNotification",
  smsNotificationSchema
);
