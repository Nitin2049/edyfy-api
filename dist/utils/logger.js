import winston from "winston";
import path from "path";
const { combine, timestamp, printf, colorize, errors, json } = winston.format;
// 🧠 Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta) : "";
    return `${timestamp} | ${level}: ${stack || message} ${metaString}`;
});
// 🪵 Create logger instance
export const logger = winston.createLogger({
    level: "info",
    format: combine(colorize(), timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), errors({ stack: true }), logFormat),
    transports: [
        new winston.transports.Console(), // visible in console
        new winston.transports.File({
            filename: path.join("logs", "error.log"),
            level: "error",
        }),
        new winston.transports.File({
            filename: path.join("logs", "combined.log"),
        }),
    ],
});
// 🧩 Catch unhandled errors too
process.on("unhandledRejection", (err) => {
    logger.error("Unhandled Rejection", { err });
});
process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception", { err });
});
