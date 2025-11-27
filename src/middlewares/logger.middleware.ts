import morgan from "morgan";
import { logger } from "../utils/logger.js";

// 🔥 Custom Morgan token for context
morgan.token("userId", (req: any) => req.context?.userId || "guest");
morgan.token("schoolId", (req: any) => req.context?.schoolId || "none");
morgan.token("ip", (req: any) => req.context?.ip || req.ip);

// 🔁 Stream logs to winston
const stream = {
  write: (message: string) => logger.info(message.trim()),
};

// 🧠 Advanced log format with context
export const httpLogger = morgan(
  ":method :url :status :res[content-length] - :response-time ms | userId=:userId | schoolId=:schoolId | ip=:ip",
  { stream }
);
