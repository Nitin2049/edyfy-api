import app from './app.js';
import dotenv from "dotenv";
import { connectDB } from './config/db.js';
import { logger } from './utils/logger.js';

dotenv.config();

const PORT = process.env.PORT || 8000;

connectDB();

app.listen(PORT, () => {
   logger.info(`🚀 Server running on port ${process.env.PORT}`);
});