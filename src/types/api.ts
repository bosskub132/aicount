export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UploadDocumentRequest {
  tenantId: string;
  files: File[];
  intakeSource?: "FRONTEND_UPLOAD" | "LINE";
}

export interface ExportExpressRequest {
  tenantId: string;
  templateId: string;
  documentIds: string[];
  periodYearMonth?: string;
  journalType?: string;
}

export interface ApproveRejectRequest {
  comment?: string;
}

export interface BatchApproveRequest {
  documentIds: string[];
}
