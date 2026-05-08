import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import fileRoutes from "./routes/fileRoutes";
import { errorHandler } from "./middleware/errorHandler";
import logger from "./config/logger";
import fileService from "./services/fileService";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
// app.use(compression());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// Routes
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "RapidShare API is running",
    version: "1.0.0",
  });
});

app.use("/api/files", fileRoutes);

// Error handler
app.use(errorHandler);

// Cleanup expired files every hour
setInterval(() => {
  fileService.cleanupExpiredFiles();
}, 60 * 60 * 1000);

//Cleanup temporary files every 30 minutes
setInterval(() => {
  fileService.cleanupTempFiles();
}, 30 * 60 * 1000);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

export default app;
