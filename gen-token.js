// // scripts/dev/gen-token.js
// import jwt from "jsonwebtoken";

// // Replace these with real user info from your DB if possible
// const payload = {
//   sub: "64f1a0c2c9b1d9f21a123456", // userId
//   role: "teacher",                // or "admin"
//   schoolId: "64f1a0c2c9b1d9f21a654321"
// };

// const secret = process.env.JWT_SECRET || "your-long-random-secret";
// const token = jwt.sign(payload, secret, {
//   algorithm: "HS256",
//   expiresIn: "1h"
// });

// console.log("Your JWT token:\n");
// console.log(token);