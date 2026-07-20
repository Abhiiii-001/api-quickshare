import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../server";
import { prisma } from "../lib/prisma";
import cloudinaryService from "../services/cloudinaryService";
import { compressionService } from "../services/compression";

// Mock external dependencies
vi.mock("../lib/prisma", () => ({
  prisma: {
    file: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("../services/cloudinaryService", () => ({
  default: {
    uploadStream: vi.fn(),
    fetchFile: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

describe("Intelligent Compression Pipeline Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    compressionService.resetMetrics();
  });

  it("should compress highly compressible files (e.g. .txt)", async () => {
    // 1. Setup mocks
    const mockFileRecord = {
      id: "uuid-123",
      code: "ABCDEF",
      originalName: "test.txt",
      mimetype: "text/plain",
      size: 1024,
      expiresAt: new Date(Date.now() + 86400000),
      isCompressed: true, // we expect this to be true for .txt
      downloadCount: 0,
      maxDownloads: 10,
    };

    // Prisma: mock finding no existing code, then creating the file
    vi.mocked(prisma.file.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.file.create).mockResolvedValueOnce(mockFileRecord as any);

    // Cloudinary: mock successful stream upload
    vi.mocked(cloudinaryService.uploadStream).mockResolvedValueOnce({
      cloudinaryId: "rapidshare/ABCDEF_test.txt",
      cloudinaryUrl: "https://res.cloudinary.com/demo/raw/upload/v1234/rapidshare/ABCDEF_test.txt",
    });

    // 2. Perform upload
    // Generate a long repeating string to ensure it's highly compressible
    const dummyTextContent = "A".repeat(5000); 
    const buffer = Buffer.from(dummyTextContent, "utf-8");

    const uploadResponse = await request(app)
      .post("/api/files/upload-direct")
      .field("expiry", "1")
      .field("downloads", "10")
      .field("usePassword", "false")
      .attach("file", buffer, { filename: "test.txt", contentType: "text/plain" });

    // 3. Verify upload response
    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.success).toBe(true);
    expect(uploadResponse.body.data.code).toBeDefined();

    // 4. Verify Cloudinary upload stream was called with resourceType: "raw"
    expect(cloudinaryService.uploadStream).toHaveBeenCalled();
    const cloudinaryArgs = vi.mocked(cloudinaryService.uploadStream).mock.calls[0];
    expect(cloudinaryArgs[2]).toBe("raw"); // resource type must be 'raw' for compressed binary data

    // 5. Verify compression metrics
    const metrics = compressionService.getMetrics();
    expect(metrics.totalCompressed).toBe(1);
    expect(metrics.averageRatio).toBeLessThan(1.0); // Ratio should be < 1.0 meaning it shrank

    // --- Part 2: Test Download Flow ---
    
    // Setup mocks for download
    vi.mocked(prisma.file.findUnique).mockResolvedValueOnce(mockFileRecord as any);
    vi.mocked(prisma.file.update).mockResolvedValueOnce({} as any);

    // Cloudinary fetchFile must return the COMPRESSED buffer that was sent to it
    const compressedBuffer = cloudinaryArgs[0]; 
    vi.mocked(cloudinaryService.fetchFile).mockResolvedValueOnce(compressedBuffer as Buffer);

    // Perform download
    const downloadResponse = await request(app)
      .post("/api/files/download")
      .send({ code: "ABCDEF" });

    // Verify download response
    expect(downloadResponse.status).toBe(200);
    // The decompressed output should match our original input exactly
    // supertest places text/plain responses into the .text property
    expect(downloadResponse.text).toBe(dummyTextContent);
  });

  it("should NOT compress files on the skip list (e.g. .mp4)", async () => {
    const mockFileRecord = {
      id: "uuid-456",
      code: "VID123",
      originalName: "video.mp4",
      mimetype: "video/mp4",
      size: 5000,
      expiresAt: new Date(Date.now() + 86400000),
      isCompressed: false, // Should be false
      downloadCount: 0,
      maxDownloads: 10,
    };

    vi.mocked(prisma.file.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.file.create).mockResolvedValueOnce(mockFileRecord as any);

    vi.mocked(cloudinaryService.uploadStream).mockResolvedValueOnce({
      cloudinaryId: "rapidshare/VID123_video",
      cloudinaryUrl: "https://res.cloudinary.com/demo/video/upload/v1234/rapidshare/VID123_video.mp4",
    });

    const dummyVideoContent = Buffer.alloc(5000, 1);

    const uploadResponse = await request(app)
      .post("/api/files/upload-direct")
      .field("expiry", "1")
      .field("downloads", "10")
      .field("usePassword", "false")
      .attach("file", dummyVideoContent, { filename: "video.mp4", contentType: "video/mp4" });

    expect(uploadResponse.status).toBe(201);
    
    // Verify it was NOT compressed
    expect(cloudinaryService.uploadStream).toHaveBeenCalled();
    const cloudinaryArgs = vi.mocked(cloudinaryService.uploadStream).mock.calls[0];
    expect(cloudinaryArgs[2]).toBe("auto"); // Because it wasn't compressed, use "auto"

    const metrics = compressionService.getMetrics();
    expect(metrics.totalSkipped).toBe(1);
    expect(metrics.totalCompressed).toBe(0);

    // Ensure database save reflects isCompressed: false
    const prismaCreateArgs = vi.mocked(prisma.file.create).mock.calls[0][0];
    expect(prismaCreateArgs.data.isCompressed).toBe(false);
  });
});
