import { prisma } from "../lib/prisma";
import cloudinaryService from "./cloudinaryService";
import {
  generateCode,
  hashPassword,
  comparePassword,
  calculateExpiryDate,
  sanitizeFileName,
} from "../utils/helper";
import { UploadFileRequest, DirectUploadFileRequest, DownloadFileRequest, FileData } from "../types";
import { compressionService } from "./compression";
import { encryptionService } from "./encryption";
import logger from "../config/logger";

class FileService {
  async generateUploadUrl(
    fileName: string,
    fileType: string,
  ): Promise<{
    uploadUrl: string;
    uploadPreset: string;
    publicId: string;
    folder: string;
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    resource_type: string;
  }> {
    try {
      const timestamp = Date.now();
      const formattedFileName = sanitizeFileName(fileName);
      const publicId = `${timestamp}_${formattedFileName}`;

      // Generate upload signature
      const uploadData = await cloudinaryService.generateUploadSignature(
        publicId,
        "temp",
      );

      logger.info(`Upload URL generated for: ${fileName}`);

      return {
        uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
        uploadPreset: uploadData.uploadPreset || "",
        publicId: uploadData.publicId,
        folder: "temp",
        signature: uploadData.signature,
        timestamp: uploadData.timestamp,
        apiKey: uploadData.apiKey,
        cloudName: uploadData.cloudName,
        resource_type: "auto",
      };
    } catch (error) {
      logger.error("Generate upload URL error:", error);
      throw new Error("Failed to generate upload URL");
    }
  }

  /**
   * Confirm upload and move file from temp to permanent storage
   */
  async uploadFile(
    cloudinaryUrl: string,
    options: UploadFileRequest & {
      originalName: string;
      mimetype: string;
      size: number;
    },
  ): Promise<{ code: string; expiresAt: Date }> {
    try {
      // Extract public_id from cloudinary URL or use provided tempPublicId
      const tempPublicId = options.tempPublicId || this.extractPublicIdFromUrl(cloudinaryUrl);
      
      if (!tempPublicId) {
        throw new Error("Invalid temporary file ID or URL");
      }

      // Generate unique code
      let code = generateCode();
      let existingFile = await prisma.file.findUnique({ where: { code } });

      while (existingFile) {
        code = generateCode();
        existingFile = await prisma.file.findUnique({ where: { code } });
      }

      // Move file from temp to permanent folder
      const isRaw = options.resourceType === "raw";
      const fileName = sanitizeFileName(options.originalName, isRaw);
      const permanentPublicId = `rapidshare/${code}_${fileName}`;
      
      const { cloudinaryId, cloudinaryUrl: permanentUrl } =
        await cloudinaryService.moveFile(
          tempPublicId,
          permanentPublicId,
          options.resourceType,
        );

      // Hash password if provided
      const hashedPassword = options.password
        ? await hashPassword(options.password)
        : undefined;

      // Calculate expiry date
      const expiresAt = calculateExpiryDate(options.expiry);

      // Save to database
      const newFile = await prisma.file.create({
        data: {
          code,
          originalName: options.originalName,
          fileName: options.originalName,
          mimetype: options.mimetype,
          size: options.size,
          cloudinaryId,
          cloudinaryUrl: permanentUrl,
          password: hashedPassword,
          expiresAt,
          maxDownloads: options.downloads,
        },
      });

      logger.info(`File confirmed and moved to permanent storage: ${code}`);

      return {
        code: newFile.code,
        expiresAt: newFile.expiresAt,
      };
    } catch (error) {
      logger.error("Confirm upload error:", error);
      throw new Error("Failed to confirm file upload");
    }
  }

  /**
   * Extract public_id from Cloudinary URL
   */
  private extractPublicIdFromUrl(url: string): string {
    try {
      const urlParts = url.split("/upload/");
      if (urlParts.length < 2) return "";

      const pathParts = urlParts[1].split("/");
      // Remove version (v1234567890) and get the rest
      const publicIdParts = pathParts.slice(1);
      const publicIdWithExt = publicIdParts.join("/");

      // Remove file extension
      let publicId = publicIdWithExt.substring(
        0,
        publicIdWithExt.lastIndexOf("."),
      );

      // Decode URL-encoded characters (e.g., %28 → (, %29 → ))
      // Cloudinary URLs encode special chars but the actual public_id uses raw chars
      publicId = decodeURIComponent(publicId);

      return publicId;
    } catch (error) {
      logger.error("Extract public ID error:", error);
      return "";
    }
  }

  /**
   * Clean up abandoned temporary files (older than 1 hour)
   */
  async cleanupTempFiles(): Promise<void> {
    try {
      await cloudinaryService.cleanupTempFolder();
      logger.info("Temporary files cleaned up");
    } catch (error) {
      logger.error("Cleanup temp files error:", error);
    }
  }

  async getFileByCode(code: string): Promise<FileData | null> {
    try {
      const file = await prisma.file.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (!file) {
        return null;
      }

      // Check if file has expired
      if (new Date() > file.expiresAt) {
        await this.deleteFile(file.id);
        return null;
      }

      return {
        id: file.id,
        code: file.code,
        originalName: file.originalName,
        size: file.size,
        expiresAt: file.expiresAt,
        maxDownloads: file.maxDownloads,
        downloadCount: file.downloadCount,
        isCompressed: file.isCompressed,
        compressedSize: file.compressedSize,
        compressionRatio: file.compressionRatio,
        isEncrypted: file.isEncrypted,
        encryptedSize: file.encryptedSize,
      };
    } catch (error) {
      logger.error("Get file error:", error);
      throw new Error("Failed to retrieve file");
    }
  }

  async downloadFile(request: DownloadFileRequest): Promise<string> {
    try {
      const file = await prisma.file.findUnique({
        where: { code: request.code.toUpperCase() },
      });

      if (!file) {
        throw new Error("File not found");
      }

      // Check expiry
      if (new Date() > file.expiresAt) {
        await this.deleteFile(file.id);
        throw new Error("File has expired");
      }

      // Check download limit
      if (file.downloadCount >= file.maxDownloads) {
        throw new Error("Download limit reached");
      }

      // Verify password if required
      if (file.password && request.password) {
        const isPasswordValid = await comparePassword(
          request.password,
          file.password,
        );
        if (!isPasswordValid) {
          throw new Error("Invalid password");
        }
      } else if (file.password && !request.password) {
        throw new Error("Password required");
      }

      // Increment download count
      await prisma.file.update({
        where: { id: file.id },
        data: { downloadCount: file.downloadCount + 1 },
      });

      logger.info(`File downloaded: ${file.code}`);

      return file.cloudinaryUrl;
    } catch (error) {
      logger.error("Download file error:", error);
      throw error;
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      const file = await prisma.file.findUnique({ where: { id: fileId } });

      if (file) {
        await cloudinaryService.deleteFile(file.cloudinaryId, file.resourceType);
        await prisma.file.delete({ where: { id: fileId } });
        logger.info(`File deleted: ${file.code}`);
      }
    } catch (error) {
      logger.error("Delete file error:", error);
      throw new Error("Failed to delete file");
    }
  }

  async cleanupExpiredFiles(): Promise<void> {
    try {
      const expiredFiles = await prisma.file.findMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      for (const file of expiredFiles) {
        await this.deleteFile(file.id);
      }

      logger.info(`Cleaned up ${expiredFiles.length} expired files`);
    } catch (error) {
      logger.error("Cleanup error:", error);
    }
  }

  /**
   * Direct backend upload flow with compression
   */
  async uploadFileDirect(
    fileBuffer: Buffer,
    originalName: string,
    mimetype: string,
    options: DirectUploadFileRequest
  ): Promise<{ code: string; expiresAt: Date }> {
    try {
      // 1. Generate unique code
      let code = generateCode();
      let existingFile = await prisma.file.findUnique({ where: { code } });

      while (existingFile) {
        code = generateCode();
        existingFile = await prisma.file.findUnique({ where: { code } });
      }

      // 2. Compress file if beneficial
      const { data: compressedBuffer, metadata: compressionMetadata } = await compressionService.compress(
        fileBuffer,
        originalName,
        mimetype
      );

      // 3. Encrypt the file (after compression)
      const { data: uploadBuffer, metadata: encryptionMetadata } = await encryptionService.encrypt(
        compressedBuffer
      );

      // 4. Upload to Cloudinary via stream
      // Compressed/encrypted files are raw binary, otherwise use auto
      const resourceType = (compressionMetadata.wasCompressed || encryptionMetadata.wasEncrypted) ? "raw" : "auto";
      const fileName = sanitizeFileName(originalName, resourceType === "raw");
      const publicId = `rapidshare/${code}_${fileName}`;

      const { cloudinaryId, cloudinaryUrl } = await cloudinaryService.uploadStream(
        uploadBuffer,
        publicId,
        resourceType
      );

      // 4. Save to Database
      const hashedPassword = options.password
        ? await hashPassword(options.password)
        : undefined;

      const expiresAt = calculateExpiryDate(options.expiry);

      const newFile = await prisma.file.create({
        data: {
          code,
          originalName,
          fileName,
          mimetype,
          size: compressionMetadata.originalSize,
          cloudinaryId,
          cloudinaryUrl,
          password: hashedPassword,
          expiresAt,
          maxDownloads: options.downloads,
          resourceType,
          isCompressed: compressionMetadata.wasCompressed,
          compressedSize: compressionMetadata.wasCompressed ? compressionMetadata.compressedSize : null,
          compressionAlgo: compressionMetadata.wasCompressed ? compressionMetadata.algorithm : null,
          compressionLevel: compressionMetadata.wasCompressed ? compressionMetadata.level : null,
          compressionRatio: compressionMetadata.wasCompressed ? compressionMetadata.compressionRatio : null,
          compressionTimeMs: compressionMetadata.wasCompressed ? compressionMetadata.compressionTimeMs : null,
          isEncrypted: encryptionMetadata.wasEncrypted,
          encryptionVersion: encryptionMetadata.wasEncrypted ? encryptionMetadata.version : null,
          encryptionAlgo: encryptionMetadata.wasEncrypted ? encryptionMetadata.algorithm : null,
          wrappedKey: encryptionMetadata.wasEncrypted ? encryptionMetadata.wrappedKey : null,
          encryptionIv: encryptionMetadata.wasEncrypted ? encryptionMetadata.iv : null,
          encryptionAuthTag: encryptionMetadata.wasEncrypted ? encryptionMetadata.authTag : null,
          wrapIv: encryptionMetadata.wasEncrypted ? encryptionMetadata.wrapIv : null,
          wrapAuthTag: encryptionMetadata.wasEncrypted ? encryptionMetadata.wrapAuthTag : null,
          encryptedSize: encryptionMetadata.wasEncrypted ? encryptionMetadata.encryptedSize : null,
          encryptionTimeMs: encryptionMetadata.wasEncrypted ? encryptionMetadata.encryptionTimeMs : null,
        },
      });

      logger.info(`File compressed and uploaded: ${code}`);

      return {
        code: newFile.code,
        expiresAt: newFile.expiresAt,
      };
    } catch (error) {
      logger.error("Direct upload error:", error);
      throw new Error("Failed to upload file");
    }
  }

  /**
   * Download a file through backend, decompressing if necessary
   */
  async downloadFileStream(request: DownloadFileRequest): Promise<{ buffer: Buffer; file: any }> {
    try {
      const file = await prisma.file.findUnique({
        where: { code: request.code.toUpperCase() },
      });

      if (!file) throw new Error("File not found");
      if (new Date() > file.expiresAt) {
        await this.deleteFile(file.id);
        throw new Error("File has expired");
      }
      if (file.downloadCount >= file.maxDownloads) {
        throw new Error("Download limit reached");
      }

      if (file.password && request.password) {
        const isPasswordValid = await comparePassword(request.password, file.password);
        if (!isPasswordValid) throw new Error("Invalid password");
      } else if (file.password && !request.password) {
        throw new Error("Password required");
      }

      // Fetch from Cloudinary
      let buffer = await cloudinaryService.fetchFile(file.cloudinaryUrl);

      // Decrypt if it was encrypted
      if (file.isEncrypted) {
        buffer = await encryptionService.decrypt(buffer, {
          algorithm: file.encryptionAlgo!,
          version: file.encryptionVersion!,
          wasEncrypted: file.isEncrypted,
          wrappedKey: file.wrappedKey!,
          iv: file.encryptionIv!,
          authTag: file.encryptionAuthTag!,
          wrapIv: file.wrapIv!,
          wrapAuthTag: file.wrapAuthTag!,
          encryptedSize: file.encryptedSize!,
          encryptionTimeMs: file.encryptionTimeMs!,
        });
      }

      // Decompress if it was compressed
      if (file.isCompressed) {
        buffer = await compressionService.decompress(buffer);
      }

      // Increment download count
      await prisma.file.update({
        where: { id: file.id },
        data: { downloadCount: file.downloadCount + 1 },
      });

      return { buffer, file };
    } catch (error) {
      logger.error("Download stream error:", error);
      throw error;
    }
  }
}

export default new FileService();
