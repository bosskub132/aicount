// src/components/card.tsx
interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <div className={`rounded-[var(--radius-card)] border border-[var(--border)] bg-white ${className}`}>
      {title && (
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
