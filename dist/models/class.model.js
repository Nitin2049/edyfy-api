import { Schema, model } from "mongoose";
const classSchema = new Schema({
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    name: {
        type: String,
        required: true,
        enum: [
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
        ],
    },
    level: { type: Number }, //e.g. -3,-2,-1,1,2,...12
    section: {
        type: String,
        required: true,
        enum: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
    }, // "A","B",..."J"
    //  fee: { type: Schema.Types.ObjectId, ref: "FeeStructure" },
    classTeacherId: { type: Schema.Types.ObjectId, ref: "TeacherProfile" },
    deletedAt: { type: Date, default: null },
}, { timestamps: true });
const classLevelMap = {
    Nursery: -3,
    LKG: -2,
    UKG: -1,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    "11": 11,
    "12": 12,
};
classSchema.pre("save", function (next) {
    if (this.isModified("name")) {
        this.level = classLevelMap[this.name] ?? this.level;
    }
    next();
});
classSchema.index({ schoolId: 1, academicSessionId: 1, name: 1, section: 1 });
export const Class = model("Class", classSchema);
