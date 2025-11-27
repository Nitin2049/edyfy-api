import { AdminProfile } from "../models/adminProfile.model.js";
import { AppError } from "../utils/AppError.js";
import { ResponseHelper } from "../utils/response.helper.js";
import { SUCCESS_CODES } from "../constants/successCodes.js";
import { User } from "../models/user.model.js";
import { School } from "../models/school.model.js";
export const registerAdmin = async (req, res, next) => {
    try {
        const { udisecode, firstName, lastName, gender, dob, profileImage, address, username, email, phone, password, } = req.body;
        // Uniqueness checks
        const userExists = await User.findOne({
            $or: [{ username }],
        }).exec();
        if (userExists)
            return next(new AppError("USER_ALREADY_EXISTS"));
        const school = await School.findOne({ udisecode }).exec();
        if (!school) {
            return next(new AppError("SCHOOL_NOT_FOUND", { reason: "Invalid DICE code" }));
        }
        const schoolId = school._id;
        const user = await User.create({
            schoolId,
            firstName,
            lastName,
            gender,
            dob,
            profileImage,
            address,
            username,
            email,
            phone,
            password,
            role: "admin",
        });
        const adminProfile = await AdminProfile.create({
            schoolId,
            userId: user._id,
            status: "active",
        });
        return ResponseHelper.success(res, {
            admin: user.toJSON(),
        }, SUCCESS_CODES.USER_CREATED);
    }
    catch (err) {
        next(err);
    }
};
