import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ResponseHelper } from "../utils/response.helper.js";
import { SUCCESS_CODES } from "../constants/successCodes.js";
import { School } from "../models/school.model.js";
import { schoolUpdateSchema } from "../validators/schoolUpdate.validator.js";
import { Types } from "mongoose";

const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

// Public: Register a school (no auth)
export const createSchool = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      name,
      slug,
      udisecode,
      address,
      city,
      state,
      country,
      pincode,
      contactEmail,
      contactPhone,
      logoUrl,
      plan,
      subscriptionStatus,
    } = req.body as any;

    // Uniqueness checks
    const udisecodeExists = udisecode
      ? await School.findOne({ udisecode }).select("_id").lean()
      : null;
    if (udisecode && udisecodeExists) {
      throw new AppError("DUPLICATE_ENTRY", {
        reason: "A school with this udisecode already exists",
      });
    }

    // Slug generation with de-dup
    let finalSlug = slug ? slugify(slug) : slugify(name);
    if (!finalSlug) {
      throw new AppError("VALIDATION_ERROR", { reason: "Invalid slug/name" });
    }

    let suffix = 1;
    // Ensure unique slug (since model enforces unique)
    // Try a few suffixes before giving up
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await School.findOne({ slug: finalSlug })
        .select("_id")
        .lean();
      if (!exists) break;
      suffix += 1;
      finalSlug = `${slugify(slug || name)}-${suffix}`;
    }

    const created = await School.create({
      name,
      slug: finalSlug,
      udisecode: udisecode,
      address,
      city,
      state,
      country,
      pincode,
      contactEmail,
      contactPhone,
      logoUrl: logoUrl || undefined,
      plan: plan || undefined,
      subscriptionStatus: subscriptionStatus || undefined,
      subscriptionStart: new Date(),
    });

    const school = await School.findById(created._id)
      .select(
        "name slug udisecode address city state country pincode contactEmail contactPhone logoUrl isActive plan subscriptionStatus subscriptionStart subscriptionEnd isVerified createdAt updatedAt"
      )
      .lean();

    return ResponseHelper.success(
      res,
      { school },
      SUCCESS_CODES.SCHOOL_CREATED
    );
  }
);

// Public: Get a specific school by id
export const getSchool = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || !Types.ObjectId.isValid(id)) {
    throw new AppError("VALIDATION_ERROR", { reason: "Invalid school id" });
  }

  const school = await School.findById(id)
    .select(
      "name slug udisecode address city state country pincode contactEmail contactPhone logoUrl isActive plan subscriptionStatus subscriptionStart subscriptionEnd isVerified createdAt updatedAt"
    )
    .lean();

  if (!school) {
    throw new AppError("RESOURCE_NOT_FOUND", { reason: "School not found" });
  }

  return ResponseHelper.success(res, { school }, SUCCESS_CODES.DATA_FETCHED);
});

// Admin-only: Update a school the admin belongs to
export const updateSchool = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const ctxUser = (req as any).context?.user as { role?: string; schoolId?: string } | undefined;

  if (!id || !Types.ObjectId.isValid(id)) {
    throw new AppError("VALIDATION_ERROR", { reason: "Invalid school id" });
  }
  if (!ctxUser || ctxUser.role !== "admin") {
    throw new AppError("ACCESS_DENIED", { reason: "Admin role required" });
  }
  if (!ctxUser.schoolId || ctxUser.schoolId !== id) {
    throw new AppError("ACCESS_DENIED", { reason: "You can only update your own school" });
  }

  const existing = await School.findById(id).lean();
  if (!existing) {
    throw new AppError("RESOURCE_NOT_FOUND", { reason: "School not found" });
  }

  // Validate body (all fields optional but at least one required)
  const parsed = schoolUpdateSchema.parse(req.body);

  // Uniqueness checks if changing slug or udisecode
  let finalSlug: string | undefined = undefined;
  if (parsed.slug || parsed.name) {
    const base = parsed.slug ? slugify(parsed.slug) : (parsed.name ? slugify(parsed.name) : existing.slug);
    if (!base) {
      throw new AppError("VALIDATION_ERROR", { reason: "Invalid slug" });
    }
    finalSlug = base;
    let suffix = 1;
    while (true) {
      const clash = await School.findOne({ slug: finalSlug, _id: { $ne: id } }).select("_id").lean();
      if (!clash) break;
      suffix += 1;
      finalSlug = `${base}-${suffix}`;
    }
  }

  if (parsed.udisecode && parsed.udisecode !== existing.udisecode) {
    const udiClash = await School.findOne({ udisecode: parsed.udisecode, _id: { $ne: id } }).select("_id").lean();
    if (udiClash) {
      throw new AppError("DUPLICATE_ENTRY", { reason: "A school with this udisecode already exists" });
    }
  }

  const update: any = {};
  ["name","address","city","state","country","pincode","contactEmail","contactPhone","logoUrl","plan","subscriptionStatus","udisecode"].forEach(f => {
    if ((parsed as any)[f] !== undefined) update[f] = (parsed as any)[f];
  });
  if (finalSlug) update.slug = finalSlug;

  // If subscriptionStatus moves to active and subscriptionStart not set, set start
  if (update.subscriptionStatus && update.subscriptionStatus === "active" && !existing.subscriptionStart) {
    update.subscriptionStart = new Date();
  }

  await School.updateOne({ _id: id }, { $set: update });
  const school = await School.findById(id)
    .select(
      "name slug udisecode address city state country pincode contactEmail contactPhone logoUrl isActive plan subscriptionStatus subscriptionStart subscriptionEnd isVerified createdAt updatedAt"
    )
    .lean();

  return ResponseHelper.success(res, { school }, SUCCESS_CODES.SCHOOL_UPDATED);
});
