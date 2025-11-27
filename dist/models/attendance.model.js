import { Schema, model } from "mongoose";
const attendanceSchema = new Schema({
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    academicSessionId: {
        type: Schema.Types.ObjectId,
        ref: "AcademicSession",
        required: true,
    },
    // 👇 NEW — REAL DAY VALUE
    dateLocal: { type: String, required: true }, // "2025-11-22"
    // 👇 optional machine sortable comparable date
    date: { type: Date, required: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class" },
    entries: [
        {
            _id: false,
            studentId: { type: Schema.Types.ObjectId, ref: "StudentProfile" },
            status: { type: String, enum: ["present", "absent"] },
        },
    ],
    notes: { type: String, maxLength: 200 },
    isHoliday: { type: Boolean, default: false },
    markedBy: { type: Schema.Types.ObjectId, ref: "TeacherProfile" },
    deletedAt: { type: Date, default: null },
}, { timestamps: true });
// 👇 change unique index to use dateLocal instead of date
attendanceSchema.index({
    schoolId: 1,
    academicSessionId: 1,
    dateLocal: 1,
    classId: 1,
}, { unique: true, partialFilterExpression: { deletedAt: null } });
export const Attendance = model("Attendance", attendanceSchema);
