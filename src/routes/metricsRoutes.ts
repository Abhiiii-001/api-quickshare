import express from "express";
import { compressionService } from "../services/compression";
import { encryptionService } from "../services/encryption";

const router = express.Router();

// GET /api/metrics/compression - Get compression metrics
router.get("/compression", (req, res) => {
  const metrics = compressionService.getMetrics();
  res.status(200).json({
    success: true,
    data: metrics,
  });
});

// GET /api/metrics/encryption - Get encryption metrics
router.get("/encryption", (req, res) => {
  const metrics = encryptionService.getMetrics();
  res.status(200).json({
    success: true,
    data: metrics,
  });
});

export default router;
