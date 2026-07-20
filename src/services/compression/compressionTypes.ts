import { Readable } from "stream";

// ─── Configuration ───────────────────────────────────────────────────────────

export interface CompressionConfig {
  /** Master switch to enable/disable compression */
  enabled: boolean;

  /** Zstd compression level (1-22, default: 3) */
  level: number;

  /** Skip compression for files smaller than this (bytes) */
  minFileSize: number;

  /** Skip compression for files larger than this (bytes) */
  maxFileSize: number;

  /**
   * Minimum compression gain to keep the compressed output.
   * e.g. 0.05 = 5% — if compression saves less than 5%, store uncompressed.
   */
  compressionThreshold: number;

  /** File extensions to skip (already compressed formats) */
  skipExtensions: Set<string>;

  /** MIME types to skip (already compressed formats) */
  skipMimeTypes: Set<string>;

  /** File extensions known to be highly compressible */
  compressibleExtensions: Set<string>;

  /** MIME type prefixes known to be compressible */
  compressibleMimeTypes: Set<string>;

  /** Bytes to sample for entropy estimation (0 = disabled) */
  sampleSize: number;

  /** Shannon entropy threshold above which compression is skipped (max 8.0) */
  entropyThreshold: number;
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export interface CompressionMetadata {
  /** Size of the original file in bytes */
  originalSize: number;

  /** Size after compression in bytes (equals originalSize if not compressed) */
  compressedSize: number;

  /**
   * Ratio of compressed to original size.
   * e.g. 0.35 means the file was compressed to 35% of its original size.
   */
  compressionRatio: number;

  /** Algorithm used ('zstd' or 'none') */
  algorithm: string;

  /** Compression level used */
  level: number;

  /** Whether compression was actually applied */
  wasCompressed: boolean;

  /** Original MIME type of the file */
  mimeType: string;

  /** Time taken to compress in milliseconds */
  compressionTimeMs: number;
}

// ─── Service Results ─────────────────────────────────────────────────────────

export interface CompressionResult {
  /** The (possibly compressed) output buffer */
  data: Buffer;

  /** Metadata about the compression operation */
  metadata: CompressionMetadata;
}

export interface CompressibilityAnalysis {
  /** Whether the file should be compressed */
  shouldCompress: boolean;

  /** Human-readable reason for the decision */
  reason: string;

  /** Estimated compression ratio (if entropy sampling was done) */
  estimatedRatio?: number;
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export interface CompressionMetricsSnapshot {
  /** Total number of files that were compressed */
  totalCompressed: number;

  /** Total number of files where compression was skipped */
  totalSkipped: number;

  /** Total number of compression failures */
  totalFailures: number;

  /** Total bytes received (before compression) */
  totalBytesIn: number;

  /** Total bytes after compression */
  totalBytesOut: number;

  /** Average compression ratio across all compressed files */
  averageRatio: number;

  /** Average compression time in milliseconds */
  averageCompressionTimeMs: number;

  /** Total bytes saved by compression */
  totalBytesSaved: number;
}
