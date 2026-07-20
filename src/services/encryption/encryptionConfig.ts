/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                      ENCRYPTION CONFIGURATION                                ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                             ║
 * ║  This file loads all encryption-related settings from environment           ║
 * ║  variables. It provides a central place for configuration so we never       ║
 * ║  have to scatter `process.env.XXX` checks throughout the business logic.    ║
 * ║                                                                             ║
 * ║  Why provide defaults?                                                      ║
 * ║  If an environment variable is missing, we fall back to secure defaults.    ║
 * ║  This prevents the application from crashing on startup or, worse,          ║
 * ║  defaulting to an insecure state.                                           ║
 * ║                                                                             ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { EncryptionConfig } from "./encryptionTypes";

/**
 * Load encryption configuration from environment variables.
 * 
 * We freeze the object using `Object.freeze()` to ensure the
 * configuration cannot be accidentally modified at runtime by
 * other parts of the application.
 */
export function loadEncryptionConfig(): EncryptionConfig {
  return Object.freeze({
    // Master switch. Default to true for security.
    enabled: process.env.ENCRYPTION_ENABLED !== "false",

    // The encryption algorithm. AES-256-GCM is the industry standard
    // for authenticated encryption.
    algorithm: process.env.ENCRYPTION_ALGORITHM || "aes-256-gcm",

    // Key size in bytes. 32 bytes = 256 bits.
    // This MUST match the algorithm (e.g., aes-256 requires 32 bytes).
    keySize: Number(process.env.ENCRYPTION_KEY_SIZE) || 32,

    // IV size in bytes. 12 bytes = 96 bits.
    // 96 bits is the recommended and most efficient IV size for GCM.
    ivSize: Number(process.env.ENCRYPTION_IV_SIZE) || 12,

    // Auth tag size in bytes. 16 bytes = 128 bits.
    // 128 bits provides the maximum forgery protection for GCM.
    authTagSize: Number(process.env.ENCRYPTION_AUTH_TAG_SIZE) || 16,

    // Schema version. Useful if we ever change algorithms or key sizes
    // in the future and need to differentiate old files from new files.
    version: Number(process.env.ENCRYPTION_VERSION) || 1,
  });
}
