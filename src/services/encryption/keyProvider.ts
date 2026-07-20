/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                            KEY PROVIDER                                      ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                             ║
 * ║  This file implements the envelope encryption strategy.                     ║
 * ║                                                                             ║
 * ║  Instead of encrypting every file with the same master key (which is        ║
 * ║  dangerous), we generate a unique Data Encryption Key (DEK) for every       ║
 * ║  file. Then, we use the Master Key (KEK) to encrypt (wrap) the DEK.         ║
 * ║                                                                             ║
 * ║  The EnvKeyProvider reads the Master Key from environment variables.        ║
 * ║  In a production environment, you would implement an AwsKmsKeyProvider      ║
 * ║  that talks to a Key Management Service (KMS).                              ║
 * ║                                                                             ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import crypto from "crypto";
import { KeyProvider, WrappedKeyResult, EncryptionConfig } from "./encryptionTypes";

export class EnvKeyProvider implements KeyProvider {
  private masterKey: Buffer;

  constructor(private config: EncryptionConfig) {
    const keyHex = process.env.ENCRYPTION_MASTER_KEY;

    if (!keyHex) {
      throw new Error(
        "ENCRYPTION_MASTER_KEY environment variable is required when encryption is enabled."
      );
    }

    this.masterKey = Buffer.from(keyHex, "hex");

    if (this.masterKey.length !== this.config.keySize) {
      throw new Error(
        `ENCRYPTION_MASTER_KEY must be exactly ${this.config.keySize} bytes (provided: ${this.masterKey.length} bytes).`
      );
    }
  }

  /**
   * Wraps (encrypts) the plaintext DEK using the Master Key.
   * We use AES-256-GCM for this wrapping operation as well.
   */
  async wrapKey(plaintextKey: Buffer): Promise<WrappedKeyResult> {
    // Generate a unique IV just for this wrapping operation
    const wrapIv = crypto.randomBytes(this.config.ivSize);

    // Create the cipher using the Master Key
    const cipher = crypto.createCipheriv(
      this.config.algorithm,
      this.masterKey,
      wrapIv
    ) as crypto.CipherGCM;

    // Encrypt the DEK
    const wrappedKey = Buffer.concat([
      cipher.update(plaintextKey),
      cipher.final(),
    ]);

    // Get the auth tag (proof of integrity)
    const wrapAuthTag = cipher.getAuthTag();

    return {
      wrappedKey,
      wrapIv,
      wrapAuthTag,
    };
  }

  /**
   * Unwraps (decrypts) a previously wrapped DEK using the Master Key.
   */
  async unwrapKey(
    wrappedKey: Buffer,
    wrapIv: Buffer,
    wrapAuthTag: Buffer
  ): Promise<Buffer> {
    // Create the decipher using the Master Key
    const decipher = crypto.createDecipheriv(
      this.config.algorithm,
      this.masterKey,
      wrapIv
    ) as crypto.DecipherGCM;

    // Provide the auth tag so GCM can verify integrity
    decipher.setAuthTag(wrapAuthTag);

    try {
      // Decrypt the DEK
      const plaintextKey = Buffer.concat([
        decipher.update(wrappedKey),
        decipher.final(),
      ]);

      return plaintextKey;
    } catch (error) {
      // If decryption fails (e.g., auth tag mismatch), it means the
      // wrapped key was tampered with or corrupted.
      throw new Error("Failed to unwrap key. The key or auth tag is invalid.");
    }
  }
}
