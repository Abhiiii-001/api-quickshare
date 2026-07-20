import { CompressionConfig } from "./compressionTypes";

/**
 * Default file extensions to skip (already compressed or incompressible).
 * These formats have internal compression or are binary-packed.
 */
const DEFAULT_SKIP_EXTENSIONS = new Set([
  // Archives
  "zip", "rar", "7z", "gz", "bz2", "xz", "zst", "lz4", "lzma", "tar.gz", "tar.bz2",
  // Images
  "jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif", "ico", "svg",
  // Video
  "mp4", "mkv", "mov", "avi", "wmv", "flv", "webm", "m4v",
  // Audio
  "mp3", "aac", "flac", "ogg", "wma", "m4a", "opus",
  // Documents (internally compressed)
  "pdf", "docx", "xlsx", "pptx", "odt", "ods", "odp",
  // Executables & packages
  "apk", "ipa", "deb", "rpm", "dmg", "iso", "msi", "exe",
  // Other
  "woff", "woff2", "ttf", "otf",
]);

/**
 * Default MIME types to skip.
 */
const DEFAULT_SKIP_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif",
  "image/heic", "image/heif", "image/svg+xml",
  "video/mp4", "video/webm", "video/quicktime", "video/x-matroska",
  "audio/mpeg", "audio/aac", "audio/flac", "audio/ogg", "audio/opus",
  "application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
  "application/gzip", "application/x-bzip2", "application/x-xz",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/pdf",
  "application/vnd.android.package-archive",
  "font/woff", "font/woff2",
]);

/**
 * Default file extensions known to be highly compressible.
 */
const DEFAULT_COMPRESSIBLE_EXTENSIONS = new Set([
  "txt", "csv", "json", "xml", "yaml", "yml", "md", "html", "htm",
  "css", "js", "ts", "jsx", "tsx", "sql", "log", "ini", "cfg",
  "conf", "env", "sh", "bash", "ps1", "bat", "cmd", "py", "rb",
  "java", "c", "cpp", "h", "hpp", "cs", "go", "rs", "php",
  "swift", "kt", "scala", "lua", "r", "m", "pl", "pm",
  "svg", "bmp", "tiff", "tif", "ppm", "pgm", "pbm",
]);

/**
 * Default MIME type prefixes that indicate compressible content.
 */
const DEFAULT_COMPRESSIBLE_MIME_TYPES = new Set([
  "text/plain", "text/csv", "text/html", "text/css", "text/xml",
  "text/javascript", "text/markdown",
  "application/json", "application/xml", "application/javascript",
  "application/x-yaml", "application/sql",
  "application/x-sh", "application/x-shellscript",
  "image/bmp", "image/tiff", "image/x-portable-pixmap",
]);

/**
 * Merge environment-specified extensions with defaults.
 * Env var format: comma-separated, e.g. "zip,rar,7z"
 */
function parseExtensionSet(envVar: string | undefined, defaults: Set<string>): Set<string> {
  if (!envVar) return new Set(defaults);
  const custom = envVar.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return new Set([...defaults, ...custom]);
}

function parseMimeTypeSet(envVar: string | undefined, defaults: Set<string>): Set<string> {
  if (!envVar) return new Set(defaults);
  const custom = envVar.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean);
  return new Set([...defaults, ...custom]);
}

/**
 * Load compression configuration from environment variables.
 * Every value has a sensible default and is never hardcoded in business logic.
 */
export function loadCompressionConfig(): CompressionConfig {
  return Object.freeze({
    enabled: process.env.COMPRESSION_ENABLED !== "false",
    level: Math.min(22, Math.max(1, Number(process.env.COMPRESSION_LEVEL) || 3)),
    minFileSize: Number(process.env.COMPRESSION_MIN_FILE_SIZE) || 1024, // 1 KB
    maxFileSize: Number(process.env.COMPRESSION_MAX_FILE_SIZE) || 500 * 1024 * 1024, // 500 MB
    compressionThreshold: Number(process.env.COMPRESSION_THRESHOLD) || 0.05,
    skipExtensions: parseExtensionSet(
      process.env.COMPRESSION_SKIP_EXTENSIONS,
      DEFAULT_SKIP_EXTENSIONS,
    ),
    skipMimeTypes: parseMimeTypeSet(
      process.env.COMPRESSION_SKIP_MIME_TYPES,
      DEFAULT_SKIP_MIME_TYPES,
    ),
    compressibleExtensions: parseExtensionSet(
      process.env.COMPRESSION_COMPRESSIBLE_EXTENSIONS,
      DEFAULT_COMPRESSIBLE_EXTENSIONS,
    ),
    compressibleMimeTypes: parseMimeTypeSet(
      process.env.COMPRESSION_COMPRESSIBLE_MIME_TYPES,
      DEFAULT_COMPRESSIBLE_MIME_TYPES,
    ),
    sampleSize: Number(process.env.COMPRESSION_SAMPLE_SIZE) || 4096,
    entropyThreshold: Number(process.env.COMPRESSION_ENTROPY_THRESHOLD) || 7.5,
  });
}
