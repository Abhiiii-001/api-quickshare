export interface UploadFileRequest {
  expiry: "1" | "2" | "3";
  downloads: number;
  password?: string;
  usePassword: boolean;
  resourceType: string;
  tempPublicId?: string;
}

export interface DirectUploadFileRequest {
  expiry: "1" | "2" | "3";
  downloads: number;
  password?: string;
  usePassword: boolean;
}

export interface DownloadFileRequest {
  code: string;
  password?: string;
}

export interface FileData {
  id: string;
  code: string;
  originalName: string;
  size: number;
  expiresAt: Date;
  maxDownloads: number;
  downloadCount: number;
  isCompressed: boolean;
  compressedSize: number | null;
  compressionRatio: number | null;
}
