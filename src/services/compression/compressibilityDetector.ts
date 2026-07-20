import { CompressionConfig, CompressibilityAnalysis } from "./compressionTypes";
import logger from "../../config/logger";

/**
 * Stateless heuristic engine that determines whether a file should be compressed.
 * Uses multiple signals in priority order: extension → MIME type → size → entropy.
 *
 * Designed to be injected with configuration so it remains testable and configurable.
 */
export class CompressibilityDetector {
  constructor(private readonly config: CompressionConfig) {}

  /**
   * Analyze a file's compressibility using multiple heuristics.
   *
   * @param fileName  - Original file name (used for extension extraction)
   * @param mimeType  - MIME type of the file
   * @param fileSize  - Size in bytes
   * @param sampleBuffer - Optional first N bytes for entropy estimation
   */
  analyze(
    fileName: string,
    mimeType: string,
    fileSize: number,
    sampleBuffer?: Buffer,
  ): CompressibilityAnalysis {
    // ── 0. Master switch ──────────────────────────────────────────────────
    if (!this.config.enabled) {
      return { shouldCompress: false, reason: "Compression is disabled" };
    }

    // ── 1. File size bounds ───────────────────────────────────────────────
    if (fileSize < this.config.minFileSize) {
      return {
        shouldCompress: false,
        reason: `File too small (${fileSize} bytes < ${this.config.minFileSize} bytes minimum)`,
      };
    }

    if (fileSize > this.config.maxFileSize) {
      return {
        shouldCompress: false,
        reason: `File too large (${fileSize} bytes > ${this.config.maxFileSize} bytes maximum)`,
      };
    }

    // ── 2. Extension check ────────────────────────────────────────────────
    const extension = this.extractExtension(fileName);

    if (extension && this.config.skipExtensions.has(extension)) {
      return {
        shouldCompress: false,
        reason: `Extension '.${extension}' is in the skip list (already compressed format)`,
      };
    }

    // ── 3. MIME type check ────────────────────────────────────────────────
    const normalizedMime = mimeType.toLowerCase();

    if (this.config.skipMimeTypes.has(normalizedMime)) {
      return {
        shouldCompress: false,
        reason: `MIME type '${normalizedMime}' is in the skip list`,
      };
    }

    // Skip broad categories (any video/*, audio/*, image/* not already in compressible list)
    const mimeCategory = normalizedMime.split("/")[0];
    if (
      ["video", "audio"].includes(mimeCategory) &&
      !this.config.compressibleMimeTypes.has(normalizedMime)
    ) {
      return {
        shouldCompress: false,
        reason: `MIME category '${mimeCategory}/*' is generally incompressible`,
      };
    }

    // ── 4. Positive match — known compressible extension ──────────────────
    if (extension && this.config.compressibleExtensions.has(extension)) {
      return {
        shouldCompress: true,
        reason: `Extension '.${extension}' is known to be highly compressible`,
      };
    }

    // ── 5. Positive match — known compressible MIME type ──────────────────
    if (this.config.compressibleMimeTypes.has(normalizedMime)) {
      return {
        shouldCompress: true,
        reason: `MIME type '${normalizedMime}' is known to be compressible`,
      };
    }

    // ── 6. Entropy estimation (optional) ──────────────────────────────────
    if (sampleBuffer && sampleBuffer.length > 0 && this.config.sampleSize > 0) {
      const entropy = this.calculateShannonEntropy(sampleBuffer);

      if (entropy > this.config.entropyThreshold) {
        return {
          shouldCompress: false,
          reason: `High entropy detected (${entropy.toFixed(2)} > ${this.config.entropyThreshold}), likely already compressed`,
          estimatedRatio: undefined,
        };
      }

      // Low entropy → good candidate for compression
      return {
        shouldCompress: true,
        reason: `Moderate entropy (${entropy.toFixed(2)} ≤ ${this.config.entropyThreshold}), likely compressible`,
        estimatedRatio: entropy / 8.0, // rough estimate
      };
    }

    // ── 7. Default — unknown format, attempt compression ──────────────────
    // For unknown formats, we try to compress and check the threshold after.
    return {
      shouldCompress: true,
      reason: "Unknown format — will attempt compression and check threshold",
    };
  }

  /**
   * Extract the file extension (lowercase, without dot).
   * Handles compound extensions like `.tar.gz` as just `gz`.
   */
  private extractExtension(fileName: string): string | null {
    const parts = fileName.split(".");
    if (parts.length < 2) return null;
    return parts[parts.length - 1].toLowerCase();
  }

  /**
   * Calculate Shannon entropy of a byte buffer.
   * Returns a value between 0.0 (perfectly uniform) and 8.0 (maximum entropy).
   *
   * High entropy (>7.5) typically means the data is already compressed or encrypted.
   */
  private calculateShannonEntropy(buffer: Buffer): number {
    const len = buffer.length;
    if (len === 0) return 0;

    // Count byte frequency
    const frequency = new Uint32Array(256);
    for (let i = 0; i < len; i++) {
      frequency[buffer[i]]++;
    }

    // Calculate entropy
    let entropy = 0;
    for (let i = 0; i < 256; i++) {
      if (frequency[i] === 0) continue;
      const p = frequency[i] / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }
}
