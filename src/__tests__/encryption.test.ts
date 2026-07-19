import { describe, it, expect, beforeEach } from "vitest";
import { EnvKeyProvider } from "../services/encryption/keyProvider";
import { EncryptionService } from "../services/encryption/encryptionService";
import { EncryptionConfig } from "../services/encryption/encryptionTypes";
import crypto from "crypto";

describe("Encryption Pipeline", () => {
  let config: EncryptionConfig;
  let keyProvider: EnvKeyProvider;
  let encryptionService: EncryptionService;

  beforeEach(() => {
    // Generate a new random master key for each test run to ensure isolation
    const masterKey = crypto.randomBytes(32).toString("hex");
    process.env.ENCRYPTION_MASTER_KEY = masterKey;

    config = {
      enabled: true,
      algorithm: "aes-256-gcm",
      keySize: 32,
      ivSize: 12,
      authTagSize: 16,
      version: 1,
    };

    keyProvider = new EnvKeyProvider(config);
    encryptionService = new EncryptionService(config, keyProvider);
  });

  it("should successfully encrypt and decrypt a buffer (roundtrip)", async () => {
    const originalText = "Hello, this is a secret file that needs encryption!";
    const originalBuffer = Buffer.from(originalText, "utf-8");

    // 1. Encrypt
    const result = await encryptionService.encrypt(originalBuffer);

    // Verify it's actually encrypted (not matching original)
    expect(result.data.toString("utf-8")).not.toContain(originalText);
    expect(result.metadata.wasEncrypted).toBe(true);

    // 2. Decrypt
    const decryptedBuffer = await encryptionService.decrypt(result.data, result.metadata);

    // Verify roundtrip
    expect(decryptedBuffer.toString("utf-8")).toBe(originalText);
  });

  it("should generate unique DEK and IV for each encryption", async () => {
    const buffer = Buffer.from("Same content", "utf-8");

    const result1 = await encryptionService.encrypt(buffer);
    const result2 = await encryptionService.encrypt(buffer);

    // Even with the same input, ciphertext should be completely different
    expect(result1.data).not.toEqual(result2.data);
    
    // IVs must be unique
    expect(result1.metadata.iv).not.toBe(result2.metadata.iv);
    
    // Wrapped DEKs must be unique (meaning the underlying DEKs were unique)
    expect(result1.metadata.wrappedKey).not.toBe(result2.metadata.wrappedKey);
  });

  it("should fail decryption if ciphertext is tampered with (Authentication check)", async () => {
    const buffer = Buffer.from("Important financial data", "utf-8");
    const result = await encryptionService.encrypt(buffer);

    // Tamper with the ciphertext (flip a bit)
    const tamperedData = Buffer.from(result.data);
    tamperedData[0] = tamperedData[0] ^ 1;

    // Decryption should throw an error because the auth tag verification will fail
    await expect(
      encryptionService.decrypt(tamperedData, result.metadata)
    ).rejects.toThrow(/Failed to decrypt/);
  });

  it("should fail decryption if auth tag is tampered with", async () => {
    const buffer = Buffer.from("Secret recipe", "utf-8");
    const result = await encryptionService.encrypt(buffer);

    // Tamper with the auth tag
    const metadata = { ...result.metadata };
    const authTagBuffer = Buffer.from(metadata.authTag, "base64");
    authTagBuffer[0] = authTagBuffer[0] ^ 1;
    metadata.authTag = authTagBuffer.toString("base64");

    await expect(
      encryptionService.decrypt(result.data, metadata)
    ).rejects.toThrow(/Failed to decrypt/);
  });

  it("should bypass encryption when config is disabled", async () => {
    const disabledConfig = { ...config, enabled: false };
    const disabledService = new EncryptionService(disabledConfig, keyProvider);

    const originalText = "This shouldn't be encrypted";
    const buffer = Buffer.from(originalText, "utf-8");

    const result = await disabledService.encrypt(buffer);

    // Should return original data
    expect(result.data.toString("utf-8")).toBe(originalText);
    expect(result.metadata.wasEncrypted).toBe(false);
    expect(result.metadata.algorithm).toBe("none");

    // Decrypt should just pass it through
    const decrypted = await disabledService.decrypt(result.data, result.metadata);
    expect(decrypted.toString("utf-8")).toBe(originalText);
  });

  it("should fail to unwrap DEK if wrapped key is tampered with", async () => {
    const plaintextDek = crypto.randomBytes(32);
    const { wrappedKey, wrapIv, wrapAuthTag } = await keyProvider.wrapKey(plaintextDek);

    // Tamper with the wrapped DEK
    const tamperedWrappedKey = Buffer.from(wrappedKey);
    tamperedWrappedKey[5] = tamperedWrappedKey[5] ^ 1;

    await expect(
      keyProvider.unwrapKey(tamperedWrappedKey, wrapIv, wrapAuthTag)
    ).rejects.toThrow(/Failed to unwrap key/);
  });
});
