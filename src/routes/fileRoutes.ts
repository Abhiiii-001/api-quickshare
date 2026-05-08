import express from "express";
import { validate } from "../middleware/validator";
import {
  uploadFileSchema,
  downloadFileSchema,
  getUploadUrlSchema,
  confirmUploadSchema,
} from "../validators/fileValidator";
import * as fileController from "../controllers/fileController";

const router = express.Router();

// API ENDPOINTS:
// POST   /api/files/upload      - Upload file
// POST   /api/files/download    - Download file
// GET    /api/files/file/:code  - Get file info
// DELETE /api/files/file/:id    - Delete file

router.post(
  "/get-upload-url",
  validate(getUploadUrlSchema),
  fileController.getUploadUrl
);

router.post(
  "/upload-file",
  validate(confirmUploadSchema),
  fileController.uploadFile
);

router.post(
  "/download",
  validate(downloadFileSchema),
  fileController.downloadFile
);

router.get("/file/:code", fileController.getFileInfo);

router.delete("/file/:id", fileController.deleteFile);

export default router;
