/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                      ENCRYPTION METRICS                                      ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                             ║
 * ║  This file handles observability for the encryption pipeline.               ║
 * ║                                                                             ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { EncryptionMetricsSnapshot } from "./encryptionTypes";

export class EncryptionMetrics {
  private totalEncrypted = 0;
  private totalDecrypted = 0;
  private totalSkipped = 0;
  private totalFailures = 0;
  private totalBytesIn = 0;
  private totalBytesOut = 0;
  private totalEncryptionTimeMs = 0;
  private totalDecryptionTimeMs = 0;

  recordEncryption(bytesIn: number, bytesOut: number, timeMs: number): void {
    this.totalEncrypted++;
    this.totalBytesIn += bytesIn;
    this.totalBytesOut += bytesOut;
    this.totalEncryptionTimeMs += timeMs;
  }

  recordDecryption(timeMs: number): void {
    this.totalDecrypted++;
    this.totalDecryptionTimeMs += timeMs;
  }

  recordSkipped(): void {
    this.totalSkipped++;
  }

  recordFailure(): void {
    this.totalFailures++;
  }

  getSnapshot(): EncryptionMetricsSnapshot {
    return {
      totalEncrypted: this.totalEncrypted,
      totalDecrypted: this.totalDecrypted,
      totalSkipped: this.totalSkipped,
      totalFailures: this.totalFailures,
      totalBytesIn: this.totalBytesIn,
      totalBytesOut: this.totalBytesOut,
      averageEncryptionTimeMs:
        this.totalEncrypted > 0 ? this.totalEncryptionTimeMs / this.totalEncrypted : 0,
      averageDecryptionTimeMs:
        this.totalDecrypted > 0 ? this.totalDecryptionTimeMs / this.totalDecrypted : 0,
    };
  }

  reset(): void {
    this.totalEncrypted = 0;
    this.totalDecrypted = 0;
    this.totalSkipped = 0;
    this.totalFailures = 0;
    this.totalBytesIn = 0;
    this.totalBytesOut = 0;
    this.totalEncryptionTimeMs = 0;
    this.totalDecryptionTimeMs = 0;
  }
}
