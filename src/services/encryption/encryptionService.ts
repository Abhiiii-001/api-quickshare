/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                      ENCRYPTION SERVICE                                      ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                             ║
 * ║  This is the core orchestrator for the encryption pipeline.                 ║
 * ║                                                                             ║
 * ║  It manages the lifecycle of generating unique keys (DEK), encrypting      ║
 * ║  data, delegating key wrapping to the KeyProvider, and structuring the     ║
 * ║  metadata for database storage.                                             ║
 * ║                                                                             ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import crypto from "crypto";
import {
  EncryptionConfig,
  EncryptionMetadata,
  EncryptionResult,
  KeyProvider,
  EncryptionMetricsSnapshot,
} from "./encryptionTypes";
import { EncryptionMetrics } from "./encryptionMetrics";
import logger from "../../config/logger";

export class EncryptionService {
  private metrics: EncryptionMetrics;

  constructor(
    private config: EncryptionConfig,
    private keyProvider: KeyProvider
  ) {
    this.metrics = new EncryptionMetrics();
  }

  /**
   * Encrypt a file buffer using a unique DEK, then wrap the DEK.
   */
  async encrypt(input: Buffer): Promise<EncryptionResult> {
    if (!this.config.enabled) {
      this.metrics.recordSkipped();
      return this.buildSkippedResult(input);
    }

    try {
      const startTime = performance.now();
      const originalSize = input.length;

      // 1. Generate a unique DEK for this specific file
      const dek = crypto.randomBytes(this.config.keySize);

      // 2. Generate a unique IV for the file encryption
      const iv = crypto.randomBytes(this.config.ivSize);

      // 3. Encrypt the file data with the DEK
      const cipher = crypto.createCipheriv(this.config.algorithm, dek, iv) as crypto.CipherGCM;
      const encryptedData = Buffer.concat([cipher.update(input), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // 4. Wrap the DEK using the KeyProvider (envelope encryption)
      const { wrappedKey, wrapIv, wrapAuthTag } = await this.keyProvider.wrapKey(dek);

      // 5. Zeroize the plaintext DEK from memory (defense-in-depth)
      this.zeroBuffer(dek);

      const encryptionTimeMs = Math.round(performance.now() - startTime);

      // 6. Build the metadata
      const metadata: EncryptionMetadata = {
        algorithm: this.config.algorithm,
        version: this.config.version,
        wasEncrypted: true,
        wrappedKey: wrappedKey.toString("base64"),
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
        wrapIv: wrapIv.toString("base64"),
        wrapAuthTag: wrapAuthTag.toString("base64"),
        encryptedSize: encryptedData.length,
        encryptionTimeMs,
      };

      this.metrics.recordEncryption(originalSize, encryptedData.length, encryptionTimeMs);

      return {
        data: encryptedData,
        metadata,
      };
    } catch (error) {
      this.metrics.recordFailure();
      logger.error("Encryption failed", error);
      throw new Error("Failed to encrypt file data.");
    }
  }

  /**
   * Decrypt a file buffer using the provided metadata to unwrap the DEK.
   */
  async decrypt(ciphertext: Buffer, metadata: EncryptionMetadata): Promise<Buffer> {
    if (!metadata.wasEncrypted) {
      return ciphertext;
    }

    try {
      const startTime = performance.now();

      // 1. Parse the Base64 metadata back into Buffers
      const wrappedKey = Buffer.from(metadata.wrappedKey, "base64");
      const iv = Buffer.from(metadata.iv, "base64");
      const authTag = Buffer.from(metadata.authTag, "base64");
      const wrapIv = Buffer.from(metadata.wrapIv, "base64");
      const wrapAuthTag = Buffer.from(metadata.wrapAuthTag, "base64");

      // 2. Unwrap the DEK using the KeyProvider
      const dek = await this.keyProvider.unwrapKey(wrappedKey, wrapIv, wrapAuthTag);

      // 3. Decrypt the file data with the unwrapped DEK
      const decipher = crypto.createDecipheriv(metadata.algorithm, dek, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      // 4. Zeroize the plaintext DEK from memory
      this.zeroBuffer(dek);

      const decryptionTimeMs = Math.round(performance.now() - startTime);
      this.metrics.recordDecryption(decryptionTimeMs);

      return plaintext;
    } catch (error) {
      this.metrics.recordFailure();
      logger.error("Decryption failed", error);
      throw new Error("Failed to decrypt file data. The file may be corrupted or tampered with.");
    }
  }

  getMetrics(): EncryptionMetricsSnapshot {
    return this.metrics.getSnapshot();
  }

  resetMetrics(): void {
    this.metrics.reset();
  }

  /**
   * Securely clears a buffer from memory.
   * Useful for ensuring cryptographic keys don't linger in RAM
   * longer than necessary, reducing the risk of them being exposed
   * in memory dumps.
   */
  private zeroBuffer(buffer: Buffer): void {
    buffer.fill(0);
  }

  /**
   * Returns a passthrough result when encryption is disabled.
   */
  private buildSkippedResult(input: Buffer): EncryptionResult {
    return {
      data: input,
      metadata: {
        algorithm: "none",
        version: this.config.version,
        wasEncrypted: false,
        wrappedKey: "",
        iv: "",
        authTag: "",
        wrapIv: "",
        wrapAuthTag: "",
        encryptedSize: input.length,
        encryptionTimeMs: 0,
      },
    };
  }
}
