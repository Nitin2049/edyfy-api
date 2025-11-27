import { z } from "zod";
const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = (label) => z.string().trim().min(1, `${label} is required`).regex(objectIdRegex, `${label} must be a valid ObjectId`);
const gradeEnum = z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "D", "E1", "E2"]);
export const academicReportCreateSchema = z
    .object({
    classId: objectId("classId"), // For class-teacher guard
    studentId: objectId("studentId"),
    sessionId: objectId("sessionId"),
    examName: z.string().trim().min(1, "examName is required").max(100),
    subjects: z
        .array(z.object({
        name: z.string().trim().min(1, "subject name is required").max(60),
        maxMarks: z.number().min(1).max(1000),
        marksObtained: z.number().min(0),
        grade: gradeEnum,
    }))
        .min(1, "At least one subject is required"),
    coScholastic: z
        .array(z.object({
        name: z.string().trim().min(1).max(60),
        grade: gradeEnum,
    }))
        .optional(),
    remarks: z.string().max(200).optional(),
})
    .refine((v) => v.subjects.every((s) => s.marksObtained <= s.maxMarks), { message: "marksObtained cannot exceed maxMarks", path: ["subjects"] })
    .refine((v) => {
    const names = v.subjects.map((s) => s.name.toLowerCase());
    return new Set(names).size === names.length;
}, { message: "subjects contain duplicate names", path: ["subjects"] })
    .strict();
