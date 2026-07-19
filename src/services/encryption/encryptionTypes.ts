/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    ENCRYPTION TYPE DEFINITIONS                              ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                             ║
 * ║  This file defines the "shapes" (interfaces) for every data structure       ║
 * ║  used by the encryption module. Think of interfaces as blueprints —         ║
 * ║  they describe what fields an object must have, but don't contain           ║
 * ║  any logic.                                                                 ║
 * ║                                                                             ║
 * ║  Why a separate types file?                                                 ║
 * ║  • Prevents circular imports (A imports B which imports A)                  ║
 * ║  • Makes it easy to see all data structures in one place                    ║
 * ║  • Other modules can import just the types without pulling in               ║
 * ║    heavy dependencies like Node's crypto module                             ║
 * ║                                                                             ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ─── Configuration ───────────────────────────────────────────────────────────

/**
 * Configuration for the encryption pipeline.
 *
 * Every value is loaded from environment variables at startup.
 * Nothing is hardcoded in business logic — this allows changing behavior
 * without code changes (just restart with different env vars).
 */
export interface EncryptionConfig {
  /**
   * Master switch to enable/disable encryption.
   *
   * When false, files pass through unencrypted.
   * Useful for local development or debugging.
   */
  enabled: boolean;

  /**
   * The encryption algorithm identifier.
   *
   * We use "aes-256-gcm" — this string is passed directly to
   * Node.js's crypto.createCipheriv() function.
   *
   * Why configurable? If a vulnerability is found in AES-GCM
   * (unlikely but possible), we can switch algorithms without
   * changing code — just update the config and encryption version.
   */
  algorithm: string;

  /**
   * Size of the Data Encryption Key (DEK) in bytes.
   *
   * 32 bytes = 256 bits. This determines the "256" in AES-256.
   * A larger key = more security, but 256 bits is already
   * impossible to brute-force. No need to go higher.
   */
  keySize: number;

  /**
   * Size of the Initialization Vector (IV) in bytes.
   *
   * 12 bytes = 96 bits. This is the REQUIRED size for AES-GCM.
   * Using a different size works but is slower and less standard.
   *
   * The IV ensures that encrypting the same file twice with
   * the same key produces different ciphertext each time.
   */
  ivSize: number;

  /**
   * Size of the authentication tag in bytes.
   *
   * 16 bytes = 128 bits. This is the maximum (and recommended)
   * size for AES-GCM. The auth tag is a "fingerprint" of the
   * encrypted data — it proves the ciphertext hasn't been tampered with.
   *
   * Smaller tags (e.g. 12 bytes) are acceptable but offer less
   * protection against forgery. We use the maximum.
   */
  authTagSize: number;

  /**
   * Version number for the encryption scheme.
   *
   * Why versioning?
   * If we ever change algorithms, key sizes, or how we wrap keys,
   * we need to know which "version" was used to encrypt a file
   * so we can decrypt it correctly.
   *
   * Example: Version 1 = AES-256-GCM + env-based KEK
   *          Version 2 = AES-256-GCM + AWS KMS (future)
   *          Version 3 = ChaCha20-Poly1305 (hypothetical)
   *
   * Old files keep their version; new files get the latest.
   */
  version: number;
}

// ─── Key Provider ────────────────────────────────────────────────────────────

/**
 * The result of wrapping (encrypting) a Data Encryption Key.
 *
 * When we wrap a DEK, we get three pieces:
 * 1. The wrapped (encrypted) key itself
 * 2. The IV used for the wrapping operation
 * 3. The auth tag proving the wrapped key wasn't tampered with
 *
 * All three are needed to unwrap (decrypt) the DEK later.
 *
 * ┌──────────────────────────────────────────────┐
 * │              Key Wrapping                     │
 * │                                               │
 * │  Plaintext DEK ─┐                             │
 * │                  ├─► AES-256-GCM ─► Wrapped   │
 * │  Master KEK ────┘    (wrapping)     DEK       │
 * │                                   + Wrap IV   │
 * │                                   + Wrap Tag  │
 * └──────────────────────────────────────────────┘
 */
export interface WrappedKeyResult {
  /** The DEK encrypted with the master KEK (Buffer) */
  wrappedKey: Buffer;

  /** The IV used specifically for the key-wrapping operation */
  wrapIv: Buffer;

  /** The auth tag from the key-wrapping operation */
  wrapAuthTag: Buffer;
}

/**
 * Interface for Master Key providers.
 *
 * This is the key abstraction that makes our encryption module future-proof.
 *
 * Today: EnvKeyProvider reads the master key from process.env
 * Tomorrow: AwsKmsKeyProvider calls AWS KMS API
 *
 * The EncryptionService doesn't know or care WHERE the master key lives.
 * It just calls wrapKey() and unwrapKey(). This is "dependency injection" —
 * we inject the specific provider at startup, and the service works with
 * any provider that implements this interface.
 *
 * Real-world analogy:
 *   Think of this like a USB port. Your computer doesn't care if you
 *   plug in a mouse, keyboard, or flash drive — it just knows "something
 *   that speaks USB." The KeyProvider is our "USB port" for key management.
 */
export interface KeyProvider {
  /**
   * Wrap (encrypt) a plaintext DEK using the master KEK.
   *
   * @param plaintextKey - The raw DEK bytes to protect
   * @returns The wrapped key + metadata needed for unwrapping
   */
  wrapKey(plaintextKey: Buffer): Promise<WrappedKeyResult>;

  /**
   * Unwrap (decrypt) a previously wrapped DEK.
   *
   * @param wrappedKey  - The encrypted DEK bytes
   * @param wrapIv      - The IV used during wrapping
   * @param wrapAuthTag - The auth tag from wrapping
   * @returns The original plaintext DEK bytes
   * @throws Error if the wrapped key is invalid or tampered with
   */
  unwrapKey(
    wrappedKey: Buffer,
    wrapIv: Buffer,
    wrapAuthTag: Buffer,
  ): Promise<Buffer>;
}

// ─── Encryption Metadata ─────────────────────────────────────────────────────

/**
 * Metadata produced by encrypting a file.
 *
 * This is stored in the database alongside the file record.
 * None of these values are secret — they're all either:
 *   - Public parameters (algorithm, version)
 *   - Encrypted values (wrappedKey — useless without the master KEK)
 *   - Random values (IV — not secret, just must be unique)
 *   - Integrity proofs (authTag — public, used for verification)
 *
 * Together with the master KEK, these allow reconstructing the
 * decryption key and decrypting the file.
 *
 * IMPORTANT: The wrappedKey, IV, and authTag are stored as
 * Base64-encoded strings in the database for safe text storage.
 * They are converted to/from Buffers when used in crypto operations.
 */
export interface EncryptionMetadata {
  /** The encryption algorithm used (e.g. "aes-256-gcm") */
  algorithm: string;

  /** Schema version for future algorithm rotation */
  version: number;

  /** Whether the file was actually encrypted */
  wasEncrypted: boolean;

  /**
   * The file's unique DEK, encrypted with the master KEK.
   * Base64-encoded string for database storage.
   *
   * Think of this as: "the locker key, sealed in a tamper-proof
   * envelope that only the vault manager can open"
   */
  wrappedKey: string;

  /**
   * The IV used to encrypt the file data.
   * Base64-encoded string. 12 bytes for AES-GCM.
   *
   * This is NOT secret — it just needs to be unique.
   * It's stored alongside the ciphertext so decryption
   * knows the "starting position" of the cipher.
   */
  iv: string;

  /**
   * The authentication tag from AES-GCM encryption.
   * Base64-encoded string. 16 bytes.
   *
   * This proves the ciphertext hasn't been tampered with.
   * During decryption, the tag is recalculated and compared.
   * If they don't match → the data was modified → decryption fails.
   */
  authTag: string;

  /**
   * The IV used to wrap (encrypt) the DEK.
   * Base64-encoded string. Separate from the file IV.
   *
   * Why a separate IV? Because the wrapping operation is a
   * completely separate encryption — different key (KEK vs DEK),
   * different data (DEK bytes vs file bytes). Each encryption
   * operation MUST have its own unique IV.
   */
  wrapIv: string;

  /**
   * The auth tag from the key-wrapping operation.
   * Base64-encoded string.
   */
  wrapAuthTag: string;

  /** Size of the encrypted output in bytes */
  encryptedSize: number;

  /** Time taken to encrypt in milliseconds */
  encryptionTimeMs: number;
}

// ─── Service Results ─────────────────────────────────────────────────────────

/**
 * The complete result of an encryption operation.
 *
 * Contains both the encrypted data (to upload to Cloudinary)
 * and the metadata (to store in the database).
 */
export interface EncryptionResult {
  /** The encrypted file data (ciphertext) — upload this to Cloudinary */
  data: Buffer;

  /** Metadata about the encryption — store this in the database */
  metadata: EncryptionMetadata;
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

/**
 * A snapshot of encryption performance metrics.
 *
 * Used by the /api/metrics/encryption endpoint for observability.
 * Helps answer questions like:
 * - How many files have been encrypted?
 * - What's the average encryption time?
 * - Are there failures we should investigate?
 */
export interface EncryptionMetricsSnapshot {
  /** Total number of successful encryption operations */
  totalEncrypted: number;

  /** Total number of successful decryption operations */
  totalDecrypted: number;

  /** Total number of files that bypassed encryption (disabled) */
  totalSkipped: number;

  /** Total number of encryption/decryption failures */
  totalFailures: number;

  /** Total bytes processed (before encryption) */
  totalBytesIn: number;

  /** Total bytes produced (after encryption) */
  totalBytesOut: number;

  /** Average encryption time in milliseconds */
  averageEncryptionTimeMs: number;

  /** Average decryption time in milliseconds */
  averageDecryptionTimeMs: number;
}
