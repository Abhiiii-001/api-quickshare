/**
 * Compression module barrel export.
 *
 * Usage:
 *   import { compressionService } from "../services/compression";
 *   const result = await compressionService.compress(buffer, fileName, mimeType);
 */

export { CompressionService } from "./compressionService";
export { CompressibilityDetector } from "./compressibilityDetector";
export { CompressionMetrics } from "./compressionMetrics";
export { loadCompressionConfig } from "./compressionConfig";

export type {
  CompressionConfig,
  CompressionMetadata,
  CompressionResult,
  CompressibilityAnalysis,
  CompressionMetricsSnapshot,
} from "./compressionTypes";

// ─── Singleton Instance ──────────────────────────────────────────────────────
// Create a single shared instance for the application.
// The config is loaded once at import time from environment variables.

import { loadCompressionConfig } from "./compressionConfig";
import { CompressionService } from "./compressionService";

const config = loadCompressionConfig();
export const compressionService = new CompressionService(config);
