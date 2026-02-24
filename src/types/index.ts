export interface UploadFileRequest {
  expiry: "1hour" | "24hours" | "7days";
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
}
