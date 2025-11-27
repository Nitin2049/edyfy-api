import { z } from "zod";
const yearPattern = /^\d{4}-\d{2}$/; // e.g., 2024-25
export const academicSessionUpdateSchema = z
    .object({
    year: z
        .string()
        .trim()
        .regex(yearPattern, "year must be in YYYY-YY format (e.g., 2024-25)")
        .refine((val) => {
        // trailing YY equals (YYYY+1)%100
        const yyyy = parseInt(val.slice(0, 4), 10);
        const yy = parseInt(val.slice(5), 10);
        if (Number.isNaN(yyyy) || Number.isNaN(yy))
            return false;
        return yy === ((yyyy + 1) % 100);
    }, { message: "year should represent a contiguous academic year (e.g., 2024-25)" })
        .optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    // isActive is managed by a separate endpoint; accept but ignore if provided
    isActive: z.boolean().optional(),
})
    .refine((v) => {
    if (v.startDate && v.endDate)
        return v.endDate > v.startDate;
    return true;
}, {
    message: "endDate must be after startDate",
    path: ["endDate"],
})
    .strict();
