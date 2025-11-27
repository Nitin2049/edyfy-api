import { z } from "zod";
const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = (label) => z.string().trim().min(1, `${label} is required`).regex(objectIdRegex, `${label} must be a valid ObjectId`);
export const classCreateSchema = z
    .object({
    name: z.enum([
        "Nursery",
        "LKG",
        "UKG",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "11",
        "12",
    ]),
    section: z.enum(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]),
    classTeacherId: objectId("classTeacherId").optional(),
})
    .strict();
