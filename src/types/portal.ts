export interface CreatePortalRequest {
  language: string;
  isEditable: boolean;
  password?: string;
  expiresInHours: number;
}

export interface VerifyPortalRequest {
  code: string;
  password?: string;
}

export interface PortalData {
  id: string;
  code: string;
  language: string;
  content: string;
  isEditable: boolean;
  activeUsers: number;
  expiresAt: Date;
  hasPassword?: boolean;
}
