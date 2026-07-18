import express from "express";
import { compressionService } from "../services/compression";

const router = express.Router();

// GET /api/metrics/compression - Get compression metrics
router.get("/compression", (req, res) => {
  const metrics = compressionService.getMetrics();
  res.status(200).json({
    success: true,
    data: metrics,
  });
});

export default router;
