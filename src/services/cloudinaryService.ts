import cloudinary from "../config/cloudinary";
import streamifier from "streamifier";
import logger from "../config/logger";

class CloudinaryService {
  /**
   * Generate signed upload parameters for direct upload from frontend
   */
  async generateUploadSignature(
    publicId: string,
    folder: string = "temp",
  ): Promise<{
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    publicId: string;
    uploadPreset?: string;
  }> {
    try {
      const timestamp = Math.round(new Date().getTime() / 1000);

      const params = {
        timestamp,
        public_id: publicId,
        folder,
      };

      // Generate signature
      const signature = cloudinary.utils.api_sign_request(
        params,
        process.env.CLOUDINARY_API_SECRET as string,
      );

      return {
        signature,
        timestamp,
        apiKey: process.env.CLOUDINARY_API_KEY as string,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME as string,
        publicId,
      };
    } catch (error) {
      logger.error("Generate upload signature error:", error);
      throw new Error("Failed to generate upload signature");
    }
  }

  /**
   * Move file from temporary folder to permanent folder
   */
  async moveFile(
    sourcePublicId: string,
    targetPublicId: string,
    resourceType: string = "auto",
  ): Promise<{ cloudinaryId: string; cloudinaryUrl: string }> {
    try {
      // Rename/move the file
      console.log("Debug-moveFile", resourceType);
      const result = await cloudinary.uploader.rename(
        sourcePublicId,
        targetPublicId,
        {
          resource_type: resourceType,
          invalidate: true,
        },
      );

      logger.info(`File moved from ${sourcePublicId} to ${targetPublicId}`);

      return {
        cloudinaryId: result.public_id,
        cloudinaryUrl: result.secure_url,
      };
    } catch (error) {
      logger.error("Move file error:", error);
      throw new Error("Failed to move file");
    }
  }

  async deleteFile(cloudinaryId: string, resourceType: string = "image"): Promise<void> {
    try {
      await cloudinary.uploader.destroy(cloudinaryId, { resource_type: resourceType });
      logger.info(`File deleted from Cloudinary: ${cloudinaryId}`);
    } catch (error) {
      logger.error("Cloudinary delete error:", error);
      throw new Error("File deletion failed");
    }
  }

  async getFileUrl(cloudinaryId: string): Promise<string> {
    return cloudinary.url(cloudinaryId, {
      secure: true,
    });
  }

  async cleanupTempFolder(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const timestamp = Math.floor(oneHourAgo.getTime() / 1000);

      // List all resources in temp folder
      const result = await cloudinary.api.resources({
        type: "upload",
        prefix: "temp/",
        max_results: 500,
      });

      const filesToDelete = result.resources.filter((resource: any) => {
        const createdAt = new Date(resource.created_at).getTime() / 1000;
        return createdAt < timestamp;
      });

      // Delete old files
      for (const file of filesToDelete) {
        await this.deleteFile(file.public_id);
      }

      logger.info(`Cleaned up ${filesToDelete.length} temporary files`);
    } catch (error) {
      logger.error("Cleanup temp folder error:", error);
    }
  }
  /**
   * Verify if file exists in Cloudinary
   */
  async verifyFileExists(publicId: string): Promise<boolean> {
    try {
      await cloudinary.api.resource(publicId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Upload a buffer to Cloudinary via stream.
   * Required for server-side compression flow where the file passes through the backend.
   */
  async uploadStream(
    buffer: Buffer,
    publicId: string,
    resourceType: string = "auto",
  ): Promise<{ cloudinaryId: string; cloudinaryUrl: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: resourceType as "auto" | "image" | "raw" | "video",
          folder: "rapidshare",
        },
        (error, result) => {
          if (error) {
            logger.error("Cloudinary stream upload error:", error);
            reject(new Error("Failed to upload file stream to Cloudinary"));
          } else if (result) {
            logger.info(`File stream uploaded successfully: ${result.public_id}`);
            resolve({
              cloudinaryId: result.public_id,
              cloudinaryUrl: result.secure_url,
            });
          }
        },
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  /**
   * Fetch a file from Cloudinary as an array buffer.
   */
  async fetchFile(cloudinaryUrl: string): Promise<Buffer> {
    try {
      const response = await fetch(cloudinaryUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file from Cloudinary: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error("Cloudinary fetch error:", error);
      throw new Error("Failed to fetch file for download");
    }
  }
}

export default new CloudinaryService();
