import multer from "multer";

/**
 * Multer middleware for handling multipart/form-data file uploads.
 *
 * Uses memory storage (files stored as Buffer in req.file.buffer).
 * This is appropriate for the 100MB file size limit — for larger limits,
 * switch to disk storage to reduce memory pressure.
 */
const storage = multer.memoryStorage();

const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024; // 100MB default

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Single file upload only
  },
});
