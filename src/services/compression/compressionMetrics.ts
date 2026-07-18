import { CompressionMetadata, CompressionMetricsSnapshot } from "./compressionTypes";

/**
 * In-memory metrics accumulator for compression operations.
 *
 * Stateless across restarts — designed to be scraped by external monitoring
 * systems (Prometheus, Datadog, etc.) or exposed via an API endpoint.
 *
 * Thread-safe in Node.js single-threaded environment.
 */
export class CompressionMetrics {
  private compressed = 0;
  private skipped = 0;
  private failures = 0;
  private bytesIn = 0;
  private bytesOut = 0;
  private totalRatio = 0;
  private totalTimeMs = 0;

  /**
   * Record a successful compression or skip event.
   */
  record(metadata: CompressionMetadata): void {
    if (metadata.wasCompressed) {
      this.compressed++;
      this.bytesIn += metadata.originalSize;
      this.bytesOut += metadata.compressedSize;
      this.totalRatio += metadata.compressionRatio;
      this.totalTimeMs += metadata.compressionTimeMs;
    } else {
      this.skipped++;
      this.bytesIn += metadata.originalSize;
      this.bytesOut += metadata.originalSize;
    }
  }

  /**
   * Record a compression failure.
   */
  recordFailure(): void {
    this.failures++;
  }

  /**
   * Get a snapshot of current metrics.
   */
  getSnapshot(): CompressionMetricsSnapshot {
    return {
      totalCompressed: this.compressed,
      totalSkipped: this.skipped,
      totalFailures: this.failures,
      totalBytesIn: this.bytesIn,
      totalBytesOut: this.bytesOut,
      averageRatio: this.compressed > 0
        ? this.totalRatio / this.compressed
        : 0,
      averageCompressionTimeMs: this.compressed > 0
        ? this.totalTimeMs / this.compressed
        : 0,
      totalBytesSaved: this.bytesIn - this.bytesOut,
    };
  }

  /**
   * Reset all metrics (useful for testing or periodic resets).
   */
  reset(): void {
    this.compressed = 0;
    this.skipped = 0;
    this.failures = 0;
    this.bytesIn = 0;
    this.bytesOut = 0;
    this.totalRatio = 0;
    this.totalTimeMs = 0;
  }
}
