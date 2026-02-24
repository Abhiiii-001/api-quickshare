import { Request, Response, NextFunction } from "express";
import fileService from "../services/fileService";
import { DownloadFileRequest } from "../types";

export const getUploadUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { fileName, fileType, fileSize } = req.body;

    // Validate file size
    const maxSize = Number(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024;
    if (fileSize > maxSize) {
      return res.status(400).json({
        success: false,
        message: `File size exceeds maximum allowed size of ${
          maxSize / (1024 * 1024)
        }MB`,
      });
    }

    const result = await fileService.generateUploadUrl(fileName, fileType);

    res.status(200).json({
      success: true,
      message: "Upload URL generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadFile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { cloudinaryUrl, originalName, mimetype, size, ...options } =
      req.body;

    const result = await fileService.uploadFile(cloudinaryUrl, {
      ...options,
      originalName,
      mimetype,
      size,
    });

    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const downloadFile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const request: DownloadFileRequest = req.body;
    const fileUrl = await fileService.downloadFile(request);

    res.status(200).json({
      success: true,
      message: "File ready for download",
      data: { url: fileUrl },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getFileInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code } = req.params;
    const file = await fileService.getFileByCode(code);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found or expired",
      });
    }

    res.status(200).json({
      success: true,
      data: file,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteFile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    await fileService.deleteFile(id);

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
