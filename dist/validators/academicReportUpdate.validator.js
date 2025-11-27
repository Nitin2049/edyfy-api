import { z } from "zod";
const gradeEnum = z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "D", "E1", "E2"]);
export const academicReportUpdateSchema = z
    .object({
    examName: z.string().trim().min(1).max(100).optional(),
    subjects: z
        .array(z.object({
        name: z.string().trim().min(1).max(60),
        maxMarks: z.number().min(1).max(1000),
        marksObtained: z.number().min(0),
        grade: gradeEnum,
    }))
        .optional(),
    coScholastic: z
        .array(z.object({
        name: z.string().trim().min(1).max(60),
        grade: gradeEnum,
    }))
        .optional(),
    remarks: z.string().max(200).optional(),
})
    .refine((v) => {
    if (!v.subjects)
        return true;
    return v.subjects.every((s) => s.marksObtained <= s.maxMarks);
}, { message: "marksObtained cannot exceed maxMarks", path: ["subjects"] })
    .refine((v) => {
    if (!v.subjects)
        return true;
    const names = v.subjects.map((s) => s.name.toLowerCase());
    return new Set(names).size === names.length;
}, { message: "subjects contain duplicate names", path: ["subjects"] })
    .strict();
