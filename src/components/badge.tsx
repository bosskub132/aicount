type BadgeVariant =
  | "default"
  | "draft"
  | "processing"
  | "query"
  | "action_required"
  | "pending"
  | "rejected"
  | "approved"
  | "exported"
  | "void";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  draft: "bg-[var(--status-draft-bg)] text-[var(--status-draft-text)]",
  processing: "bg-[var(--status-processing-bg)] text-[var(--status-processing-text)]",
  query: "bg-[var(--status-query-bg)] text-[var(--status-query-text)]",
  action_required: "bg-[var(--status-action-bg)] text-[var(--status-action-text)]",
  pending: "bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]",
  rejected: "bg-[var(--status-rejected-bg)] text-[var(--status-rejected-text)]",
  approved: "bg-[var(--status-approved-bg)] text-[var(--status-approved-text)]",
  exported: "bg-[var(--status-exported-bg)] text-[var(--status-exported-text)]",
  void: "bg-[var(--status-void-bg)] text-[var(--status-void-text)]",
};

const statusToVariant: Record<string, BadgeVariant> = {
  DRAFT: "draft",
  OCR_PROCESSING: "processing",
  QUERY: "query",
  ACTION_REQUIRED: "action_required",
  PENDING_APPROVAL: "pending",
  REJECTED: "rejected",
  APPROVED: "approved",
  EXPORTED: "exported",
  VOID: "void",
};

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-button)] px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const variant = statusToVariant[status] || "default";
  const label = status.replace(/_/g, " ");
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
