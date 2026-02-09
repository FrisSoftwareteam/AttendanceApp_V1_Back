import cors from "cors";
import express from "express";
import dotenv from "dotenv";
import { connectToDatabase } from "./config/db";
import { configureCloudinary } from "./config/cloudinary";
import authRoutes from "./routes/auth";
import attendanceRoutes from "./routes/attendance";
import adminRoutes from "./routes/admin";
import locationRoutes from "./routes/location";
import uploadsRoutes from "./routes/uploads";

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/uploads", uploadsRoutes);

start();

async function start() {
  try {
    await connectToDatabase();
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  }

  configureCloudinary();

  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}
