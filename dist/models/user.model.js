import { Schema, model } from "mongoose";
import bcrypt from "bcrypt";
const userSchema = new Schema({
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    //personal details
    firstName: { type: String, required: true },
    lastName: { type: String },
    gender: {
        type: String,
        enum: ["male", "female", "others"],
        required: true,
    },
    dob: { type: Date, required: true },
    role: {
        type: String,
        enum: ["student", "teacher", "admin"],
        default: "student",
        required: true,
    },
    profileImage: { type: String, default: "" },
    address: { type: String, required: true },
    //login details
    username: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true, //should be unique across the system
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        unique: true, //should be unique across the system
        required: true,
        match: /.+\@.+\..+/,
    },
    phone: {
        type: String,
        required: true,
        trim: true,
        lowercase: false,
        match: [/^(?:\+91|0)?[6-9]\d{9}$/, "Invalid Indian phone number"],
    },
    password: { type: String, required: true },
    //automatic fields
    tokenVersion: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    twoFactorAuthSecret: { type: String, default: null },
    resetPasswordToken: { type: String, default: null },
    verified: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
}, { timestamps: true });
userSchema.set("toJSON", {
    virtuals: true,
    transform: (_doc, ret) => {
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.twoFactorAuthSecret;
        return ret;
    },
});
userSchema.set("toObject", {
    virtuals: true,
    transform: (_doc, ret) => {
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.twoFactorAuthSecret;
        return ret;
    },
});
userSchema.virtual("fullName").get(function () {
    return [this.firstName, this.lastName].filter(Boolean).join(" ");
});
//Use when 1 user can have multiple profiles
// userSchema.virtual("adminProfile", {
//   ref: "AdminProfile",
//   localField: "_id",
//   foreignField: "userId",
//   justOne: true,
// });
// userSchema.virtual("teacherProfile", {
//   ref: "TeacherProfile",
//   localField: "_id",
//   foreignField: "userId",
//   justOne: true,
// });
// userSchema.virtual("studentProfile", {
//   ref: "StudentProfile",
//   localField: "_id",
//   foreignField: "userId",
//   justOne: true,
// });
//Use when 1 user has only 1 profile based on role
userSchema.virtual("profile", {
    ref: (doc) => {
        switch (doc.role) {
            case "admin":
                return "AdminProfile";
            case "teacher":
                return "TeacherProfile";
            default:
                return "StudentProfile";
        }
    },
    localField: "_id",
    foreignField: "userId",
    justOne: true,
});
userSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});
// userSchema.index({ schoolId: 1, email: 1 });
export const User = model("User", userSchema);
