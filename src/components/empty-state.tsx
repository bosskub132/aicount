// src/components/empty-state.tsx
import { Button } from "@/components/button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="mb-4 text-[var(--muted-foreground)]">{icon}</div>}
      <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          <Button onClick={action.onClick}>{action.label}</Button>
        </div>
      )}
    </div>
  );
}
