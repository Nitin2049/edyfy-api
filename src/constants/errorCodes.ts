export const ERROR_CODES = {
  VALIDATION_ERROR: {
    http: 400,
    code: "VALIDATION_ERROR",
    message: "Invalid or missing fields"
  },
  INVALID_CREDENTIALS: {
    http: 401,
    code: "INVALID_CREDENTIALS",
    message: "Invalid username or password"
  },
  ACCESS_DENIED: {
    http: 403,
    code: "ACCESS_DENIED",
    message: "You are not authorized to perform this action"
  },
  RESOURCE_NOT_FOUND: {
    http: 404,
    code: "RESOURCE_NOT_FOUND",
    message: "Requested resource not found"
  },
  USER_NOT_FOUND: {
    http: 404,
    code: "USER_NOT_FOUND",
    message: "No user found with this email or username"
  },
  SCHOOL_NOT_FOUND: {
    http: 404,
    code: "SCHOOL_NOT_FOUND",
    message: "School not found"
  },
  STUDENT_NOT_FOUND: {
    http: 404,
    code: "STUDENT_NOT_FOUND",
    message: "Student not found"
  },
  USER_ALREADY_EXISTS: {
    http: 409,
    code: "USER_ALREADY_EXISTS",
    message: "User already exists with this email or phone"
  },
  DUPLICATE_ENTRY: {
    http: 409,
    code: "DUPLICATE_ENTRY",
    message: "Duplicate record exists"
  },
  PROMOTION_FAILED: {
    http: 422,
    code: "PROMOTION_FAILED",
    message: "Student cannot be promoted due to validation error"
  },
  INTERNAL_SERVER_ERROR: {
    http: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong on the server"
  },
};
