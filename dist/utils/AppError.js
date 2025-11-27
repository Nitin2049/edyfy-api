import { ERROR_CODES } from "../constants/errorCodes.js";
export class AppError extends Error {
    constructor(code, details) {
        const errorObj = ERROR_CODES[code];
        super(errorObj.message);
        this.name = "AppError";
        this.http = errorObj.http;
        this.code = errorObj.code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
