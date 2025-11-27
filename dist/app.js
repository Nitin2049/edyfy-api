import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middlewares/error.middleware.js";
import { contextMiddleware } from "./middlewares/context.middleware.js";
import { httpLogger } from "./middlewares/logger.middleware.js";
import { deepSanitize } from "./utils/sanitize.helper.js";
import cookieParser from "cookie-parser";
const app = express();
// Trust proxy - required for secure cookies behind Render's proxy
app.set("trust proxy", 1);
app.use(cookieParser());
// CORS configuration
// CLIENT_URL may be a single origin or comma-separated list
const allowedOriginsRaw = process.env.CLIENT_URL || "";
const allowedOrigins = allowedOriginsRaw
    .split(",")
    .map(o => o.trim())
    .filter(Boolean);
app.use(cors({
    origin: (origin, cb) => {
        // Allow non-browser requests (no origin header) and if no whitelist provided
        if (!origin || allowedOrigins.length === 0)
            return cb(null, true);
        if (allowedOrigins.includes(origin))
            return cb(null, true);
        console.warn("CORS Rejected Origin:", origin);
        return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));
// Add context first
app.use(contextMiddleware);
// Add HTTP logger next
app.use(httpLogger);
app.use(helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
    },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 🔒 Global XSS sanitization middleware
app.use((req, res, next) => {
    if (req.body) {
        req.body = deepSanitize(req.body);
    }
    next();
});
// routes import
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import teacherRoutes from "./routes/teacher.routes.js";
import studentRoutes from "./routes/student.routes.js";
import meRoutes from "./routes/me.routes.js";
import classRoutes from "./routes/class.routes.js";
import academicSessionRoutes from "./routes/academicSession.routes.js";
import enrollmentRoutes from "./routes/enrollments.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import academicReportRoutes from "./routes/academicReport.routes.js";
import absentNotificationRoutes from "./routes/absentNotification.routes.js";
import schoolRoutes from "./routes/school.routes.js";
// routes declaration
app.use("/api/v1/auth", authRoutes); //teacher and student authentication routes (login, logout)
app.use("/api/v1/me", meRoutes); //get logged in user details
app.use("/api/v1/admin", adminRoutes); //admin registration + actions
app.use("/api/v1/students", studentRoutes); //student registration + actions
app.use("/api/v1/teachers", teacherRoutes); //teacher registration + actions
app.use("/api/v1/classes", classRoutes); //class management routes
app.use("/api/v1/sessions", academicSessionRoutes); //academic session management routes
app.use("/api/v1/enrollments", enrollmentRoutes); //enrollment management routes
app.use("/api/v1/attendance", attendanceRoutes); //attendance management routes
app.use("/api/v1/reports", academicReportRoutes); //academic report management routes
app.use("/api/v1/notifications/absent", absentNotificationRoutes); //absent notifications management routes
app.use("/api/v1/schools", schoolRoutes); //public school registration
// Global error handler
app.use(errorHandler);
export default app;
// Log with context
//   logger.info("🎓 New student created", {
//     userId:"unknown",
//     studentId: "newUserId",
//     name: "anonymous",
//     ip: "1.1.1.1",
//     role: "student"
//   });
// NORMALIZE PHONE EXAMPLE
// function normalizePhone(phone: string): string {
//   // remove spaces, dashes, etc.
//   phone = phone.replace(/\D/g, "");
//   // if it starts with '0', remove it
//   if (phone.startsWith("0")) phone = phone.slice(1);
//   // if it doesn't start with country code, add +91
//   if (!phone.startsWith("91")) phone = "91" + phone;
//   return "+" + phone;
// }
