import mongoose from "mongoose";

export const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI;
  try {
    if (!MONGO_URI) {
      console.error("MONGO_URI is not defined");
      return;
    }

    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
};
