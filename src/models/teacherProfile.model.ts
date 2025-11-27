import { Schema, Types, model, Document } from "mongoose";
import {Class} from "./class.model.js";

export interface ITeacherProfile extends Document {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  address?: string;
  qualification?: string;
  classId?: Types.ObjectId; // Class where this teacher is assigned as class teacher
  joinDate?: Date;
  exitDate?: Date;
  status: "active" | "resigned";
  deletedAt: Date | null;
  isClassTeacher?(classId: Types.ObjectId): Promise<boolean>;
}

const teacherProfileSchema = new Schema<ITeacherProfile>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    qualification: { type: String },
    classId: { type: Schema.Types.ObjectId, ref: "Class" },
    joinDate: { type: Date, default: Date.now },
    exitDate: { type: Date },
    status: {
      type: String,
      enum: ["active", "resigned"],
      default: "active",
    },

    deletedAt: { type: Date, default: null },
  },

  { timestamps: true, id: false }
);

teacherProfileSchema.methods.isClassTeacher = async function (
  classId: Types.ObjectId
): Promise<boolean> {
  // Fast path: compare stored classId
  if (this.classId && this.classId.equals(classId)) return true;
  // Fallback to class lookup for safety
  const classDoc = await Class.findOne({
    _id: classId,
    classTeacherId: this._id,
    schoolId: this.schoolId,
  }).select('_id');
  return !!classDoc;
};
//USAGE EXAMPLE:
// const teacher = await TeacherProfile.findById(teacherId);
// const isClassTeacher = await teacher.isClassTeacher(classId);

teacherProfileSchema.index({ schoolId: 1, userId: 1 });
// Allow quick reverse lookup of assigned class teacher
teacherProfileSchema.index({ schoolId: 1, classId: 1 }, { partialFilterExpression: { deletedAt: null } });
teacherProfileSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

export const TeacherProfile = model<ITeacherProfile>(
  "TeacherProfile",
  teacherProfileSchema
);
