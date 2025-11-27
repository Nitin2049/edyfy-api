import { ERROR_CODES } from "../constants/errorCodes.js";

interface ErrorDetails {
  [key: string]: any;
}

export class AppError extends Error {
  public http: number;
  public code: string;
  public details?: ErrorDetails;

  constructor(code: keyof typeof ERROR_CODES, details?: ErrorDetails) {
    const errorObj = ERROR_CODES[code];
    super(errorObj.message);

    this.name = "AppError";
    this.http = errorObj.http;
    this.code = errorObj.code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}
