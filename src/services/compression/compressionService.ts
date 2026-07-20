import {
  CompressionConfig,
  CompressionMetadata,
  CompressionResult,
  CompressibilityAnalysis,
  CompressionMetricsSnapshot,
} from "./compressionTypes";
import { CompressibilityDetector } from "./compressibilityDetector";
import { CompressionMetrics } from "./compressionMetrics";
import logger from "../../config/logger";

/**
 * Main compression orchestrator.
 *
 * Responsibilities:
 * - Detect compressibility (delegates to CompressibilityDetector)
 * - Compress / decompress buffers using Zstandard
 * - Generate compression metadata
 * - Track metrics
 * - Handle failures gracefully (fallback to uncompressed)
 *
 * This service is stateless except for in-memory metrics.
 * Safe for concurrent use behind load balancers.
 */
export class CompressionService {
  private readonly detector: CompressibilityDetector;
  private readonly metrics: CompressionMetrics;
  private zstdModule: typeof import("zstd-napi") | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly config: CompressionConfig) {
    this.detector = new CompressibilityDetector(config);
    this.metrics = new CompressionMetrics();
  }

  /**
   * Lazy-load the zstd-napi module.
   * This avoids import-time errors if the native module isn't built yet.
   */
  private async ensureZstd(): Promise<typeof import("zstd-napi")> {
    if (this.zstdModule) return this.zstdModule;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          this.zstdModule = await import("zstd-napi");
          logger.info("Zstd native module loaded successfully");
        } catch (error) {
          logger.error("Failed to load zstd-napi module:", error);
          throw new Error(
            "Zstd native module not available. Ensure zstd-napi is installed correctly.",
          );
        }
      })();
    }

    await this.initPromise;
    return this.zstdModule!;
  }

  /**
   * Analyze whether a file should be compressed.
   */
  analyze(
    fileName: string,
    mimeType: string,
    fileSize: number,
    sampleBuffer?: Buffer,
  ): CompressibilityAnalysis {
    return this.detector.analyze(fileName, mimeType, fileSize, sampleBuffer);
  }

  /**
   * Compress a file buffer using Zstandard.
   *
   * If compression is not beneficial (below threshold) or fails,
   * returns the original buffer with appropriate metadata.
   *
   * @param input     - The file buffer to compress
   * @param fileName  - Original file name
   * @param mimeType  - Original MIME type
   * @returns CompressionResult with (possibly compressed) data and metadata
   */
  async compress(
    input: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<CompressionResult> {
    const originalSize = input.length;

    // ── Check compressibility first ──────────────────────────────────────
    const sampleBuffer = this.config.sampleSize > 0
      ? input.subarray(0, Math.min(this.config.sampleSize, input.length))
      : undefined;

    const analysis = this.analyze(fileName, mimeType, originalSize, sampleBuffer);

    if (!analysis.shouldCompress) {
      const metadata = this.buildSkippedMetadata(originalSize, mimeType, analysis.reason);
      this.metrics.record(metadata);
      logger.debug(`Compression skipped for '${fileName}': ${analysis.reason}`);
      return { data: input, metadata };
    }

    // ── Attempt compression ──────────────────────────────────────────────
    try {
      const zstd = await this.ensureZstd();

      const startTime = performance.now();
      const compressed = await zstd.compress(input);
      const compressionTimeMs = Math.round(performance.now() - startTime);

      const compressedSize = compressed.length;
      const compressionRatio = compressedSize / originalSize;
      const savingsPercent = 1 - compressionRatio;

      // ── Check threshold — was compression actually worth it? ──────────
      if (savingsPercent < this.config.compressionThreshold) {
        logger.debug(
          `Compression gain too low for '${fileName}': ` +
          `${(savingsPercent * 100).toFixed(1)}% < ${(this.config.compressionThreshold * 100).toFixed(1)}% threshold`,
        );
        const metadata = this.buildSkippedMetadata(
          originalSize,
          mimeType,
          `Compression gain (${(savingsPercent * 100).toFixed(1)}%) below threshold`,
        );
        this.metrics.record(metadata);
        return { data: input, metadata };
      }

      // ── Compression successful and worthwhile ─────────────────────────
      const metadata: CompressionMetadata = {
        originalSize,
        compressedSize,
        compressionRatio,
        algorithm: "zstd",
        level: this.config.level,
        wasCompressed: true,
        mimeType,
        compressionTimeMs,
      };

      this.metrics.record(metadata);

      logger.info(
        `Compressed '${fileName}': ${this.formatBytes(originalSize)} → ` +
        `${this.formatBytes(compressedSize)} (${(savingsPercent * 100).toFixed(1)}% saved, ${compressionTimeMs}ms)`,
      );

      return { data: compressed, metadata };
    } catch (error) {
      // ── Compression failed — fallback to original ─────────────────────
      logger.error(`Compression failed for '${fileName}', using original:`, error);
      this.metrics.recordFailure();

      const metadata = this.buildSkippedMetadata(
        originalSize,
        mimeType,
        "Compression failed — using original file",
      );
      return { data: input, metadata };
    }
  }

  /**
   * Decompress a Zstandard-compressed buffer.
   *
   * @param input - The compressed buffer
   * @returns The decompressed buffer
   * @throws Error if decompression fails (no fallback for downloads)
   */
  async decompress(input: Buffer): Promise<Buffer> {
    try {
      const zstd = await this.ensureZstd();
      const decompressed = await zstd.decompress(input);
      return Buffer.from(decompressed);
    } catch (error) {
      logger.error("Decompression failed:", error);
      throw new Error("Failed to decompress file. The file may be corrupted.");
    }
  }

  /**
   * Get a snapshot of compression metrics.
   */
  getMetrics(): CompressionMetricsSnapshot {
    return this.metrics.getSnapshot();
  }

  /**
   * Reset metrics (for testing).
   */
  resetMetrics(): void {
    this.metrics.reset();
  }

  /**
   * Build metadata for a skipped/failed compression.
   */
  private buildSkippedMetadata(
    originalSize: number,
    mimeType: string,
    _reason: string,
  ): CompressionMetadata {
    return {
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1.0,
      algorithm: "none",
      level: 0,
      wasCompressed: false,
      mimeType,
      compressionTimeMs: 0,
    };
  }

  /**
   * Format bytes for human-readable logging.
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}
