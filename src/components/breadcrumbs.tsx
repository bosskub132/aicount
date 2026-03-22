import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />}
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? "text-[var(--foreground)] font-medium" : "text-[var(--muted-foreground)]"}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
