import { ERROR_CODES } from "../constants/errorCodes.js";
import { SUCCESS_CODES } from "../constants/successCodes.js";
import { Response } from "express";

export class ResponseHelper {
  static success(
    res: Response,
    data: any = {},
    codeObj = SUCCESS_CODES.USER_CREATED // default success code object
  ) {
    return res.status(codeObj.http).json({
      success: true,
      code: codeObj.code,
      message: codeObj.message,
      data,
    });
  }

  static error(
    res: Response,
    codeObj = ERROR_CODES.INTERNAL_SERVER_ERROR, // default error code object
    errors: any = null
  ) {
    return res.status(codeObj.http).json({
      success: false,
      code: codeObj.code,
      message: codeObj.message,
      errors,
    });
  }
}
