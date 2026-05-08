export interface UploadFileRequest {
  expiry: "1" | "2" | "3";
  downloads: number;
  password?: string;
  usePassword: boolean;
  resourceType: string;
  tempPublicId?: string;
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
}
