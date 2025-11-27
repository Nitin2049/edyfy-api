import morgan from "morgan";
import { logger } from "../utils/logger.js";
// 🔥 Custom Morgan token for context
morgan.token("userId", (req) => req.context?.userId || "guest");
morgan.token("schoolId", (req) => req.context?.schoolId || "none");
morgan.token("ip", (req) => req.context?.ip || req.ip);
// 🔁 Stream logs to winston
const stream = {
    write: (message) => logger.info(message.trim()),
};
// 🧠 Advanced log format with context
export const httpLogger = morgan(":method :url :status :res[content-length] - :response-time ms | userId=:userId | schoolId=:schoolId | ip=:ip", { stream });
