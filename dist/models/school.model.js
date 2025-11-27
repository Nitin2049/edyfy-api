import { Schema, model } from "mongoose";
const schoolSchema = new Schema({
    name: { type: String, required: true, trim: true },
    // tenantId removed
    slug: { type: String, trim: true }, // e.g., "delhi-public-school"
    udisecode: { type: String, trim: true, required: true },
    // admin: { type: Schema.Types.ObjectId, ref: "AdminProfile", required: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    contactEmail: { type: String, lowercase: true, required: true, match: /.+\@.+\..+/ },
    contactPhone: { type: String, required: true, match: /^[0-9+\-\s()]{7,20}$/ },
    logoUrl: { type: String },
    isActive: { type: Boolean, default: true },
    // 💳 Subscription & Plan
    plan: { type: String, enum: ["free", "standard", "pro"], default: "free" },
    subscriptionStatus: {
        type: String,
        enum: ["trial", "active", "expired"],
        default: "trial",
    },
    subscriptionStart: Date,
    subscriptionEnd: Date,
    isVerified: { type: Boolean, default: false },
}, { timestamps: true });
// Middleware for any pre-save logic
schoolSchema.pre("save", function (next) {
    // e.g., auto-generate slug from name if not provided
    if (!this.slug) {
        this.slug = this.name.toLowerCase().replace(/ /g, "-");
    }
    next();
});
// Enable virtuals in JSON & Object outputs
schoolSchema.set("toJSON", { virtuals: true });
schoolSchema.set("toObject", { virtuals: true });
// Define virtuals
schoolSchema.virtual("adminProfile", {
    ref: "AdminProfile",
    localField: "admin",
    foreignField: "_id",
    justOne: true,
});
// Example usage of virtuals
// const school = await School.findById(schoolId).populate('adminProfile');
// console.log(school.adminProfile); // This will be the full AdminProfile document
// Indexes
// tenantId index removed
schoolSchema.index({ udisecode: 1 });
export const School = model("School", schoolSchema);
