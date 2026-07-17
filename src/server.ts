import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import fileRoutes from "./routes/fileRoutes";
import portalRoutes from "./routes/portalRoutes";
import { errorHandler } from "./middleware/errorHandler";
import logger from "./config/logger";
import fileService from "./services/fileService";
import portalService from "./services/portalService";
import { createServer } from "http";
import { Server } from "socket.io";
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
// app.use(compression());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
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
app.use("/api/portals", portalRoutes);

// Error handler
app.use(errorHandler);

// Cleanup expired files every hour
setInterval(() => {
  fileService.cleanupExpiredFiles();
}, 60 * 60 * 1000);

// Cleanup temporary files every 30 minutes
setInterval(() => {
  fileService.cleanupTempFiles();
}, 30 * 60 * 1000);

// Cleanup expired portals every hour
setInterval(() => {
  portalService.cleanupExpiredPortals();
}, 60 * 60 * 1000);

// Create HTTP server and Socket.io instance
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Socket.io handlers
io.on("connection", (socket) => {
  logger.info(`User connected to socket: ${socket.id}`);
  let currentRoom = "";

  socket.on("join-portal", async ({ code, creatorToken, password }) => {
    // 1. Verify portal existence and password
    const result = await portalService.verifyPortal(code, password);
    if (!result.success) {
      socket.emit("error", { message: result.message });
      return;
    }

    // 2. Check if user is creator
    const isCreator = await portalService.verifyCreator(code, creatorToken);
    const role = isCreator ? "creator" : "guest";

    // 3. Join Socket room
    currentRoom = code.toUpperCase();
    socket.join(currentRoom);

    // 4. Update memory active users (simplified counting via socket.io room size)
    const activeUsers = io.sockets.adapter.rooms.get(currentRoom)?.size || 1;
    
    // Broadcast user joined to room
    io.to(currentRoom).emit("active-users", activeUsers);

    socket.emit("joined-portal", {
      success: true,
      role,
      data: {
        ...result.data,
        activeUsers,
      },
    });
  });

  socket.on("code-update", async ({ codeContent }) => {
    if (currentRoom) {
      socket.to(currentRoom).emit("code-update", { codeContent });
      // Optionally debounce database save, but we'll save per keystroke (or could be improved later)
      await portalService.updatePortalContent(currentRoom, codeContent);
    }
  });

  socket.on("permission-update", async ({ isEditable, language }) => {
    if (currentRoom) {
      io.to(currentRoom).emit("permission-update", { isEditable, language });
      await portalService.updatePortalSettings(currentRoom, isEditable, language);
    }
  });

  socket.on("disconnect", () => {
    if (currentRoom) {
      const activeUsers = io.sockets.adapter.rooms.get(currentRoom)?.size || 0;
      io.to(currentRoom).emit("active-users", activeUsers);
    }
    logger.info(`User disconnected: ${socket.id}`);
  });
});

// Start server
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

export { app, httpServer };
