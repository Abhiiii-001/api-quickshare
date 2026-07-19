/**
 * Encryption module barrel export.
 *
 * Usage:
 *   import { encryptionService } from "../services/encryption";
 *   const result = await encryptionService.encrypt(buffer);
 */

export { EncryptionService } from "./encryptionService";
export { EnvKeyProvider } from "./keyProvider";
export { loadEncryptionConfig } from "./encryptionConfig";
export { EncryptionMetrics } from "./encryptionMetrics";

export type {
  EncryptionConfig,
  EncryptionMetadata,
  EncryptionResult,
  KeyProvider,
  WrappedKeyResult,
  EncryptionMetricsSnapshot,
} from "./encryptionTypes";

// ─── Singleton Instance ──────────────────────────────────────────────────────
// Create a single shared instance for the application.
// The config and KeyProvider are loaded once at import time.

import { loadEncryptionConfig } from "./encryptionConfig";
import { EnvKeyProvider } from "./keyProvider";
import { EncryptionService } from "./encryptionService";

const config = loadEncryptionConfig();
const keyProvider = new EnvKeyProvider(config);
export const encryptionService = new EncryptionService(config, keyProvider);
