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

// ── Journal Entry API Types ─────────────────────────────────────────────────

export interface CreateJournalEntryRequest {
  tenantId: string;
  date: string;
  type: "RV" | "SV" | "PV" | "PurV" | "JV" | "Manual";
  description?: string;
  sourceDocumentId?: string;
  lines: {
    accountCode: string;
    deptCode?: string;
    debit: string;
    credit: string;
    description?: string;
  }[];
}

export interface JournalEntryResponse {
  id: string;
  jvNumber: string;
  date: string;
  type: string;
  description: string | null;
  status: "draft" | "posted" | "reversed";
  sourceDocumentId: string | null;
  createdBy: string;
  createdAt: string;
  lines: {
    id: string;
    accountCode: string;
    deptCode: string | null;
    debit: string;
    credit: string;
    description: string | null;
  }[];
}

// ── Aging API Types ─────────────────────────────────────────────────────────

export interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  totalAmount: number;
  count: number;
}

export interface AgingReportResponse {
  buckets: AgingBucket[];
  totalOutstanding: number;
  totalCount: number;
}

// ── Payment API Types ───────────────────────────────────────────────────────

export interface CreatePaymentRequest {
  tenantId: string;
  documentId: string;
  amount: string;
  whtAmount?: string;
  netAmount: string;
  paymentDate: string;
  paymentMethod?: string;
  referenceNo?: string;
  notes?: string;
}

export interface PaymentResponse {
  id: string;
  documentId: string;
  journalEntryId: string | null;
  amount: string;
  whtAmount: string;
  netAmount: string;
  paymentDate: string;
  paymentMethod: string | null;
  referenceNo: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}
