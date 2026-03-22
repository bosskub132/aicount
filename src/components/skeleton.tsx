// src/components/skeleton.tsx
type SkeletonVariant = "text" | "circle" | "rect";

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ variant = "text", width, height, className = "" }: SkeletonProps) {
  const base = "animate-pulse bg-[var(--muted)]";

  const variantStyles = {
    text: `${base} h-4 rounded`,
    circle: `${base} rounded-full`,
    rect: `${base} rounded-[var(--radius-card)]`,
  };

  return (
    <div
      className={`${variantStyles[variant]} ${className}`}
      style={{ width: width || "100%", height: height || (variant === "circle" ? width : undefined) }}
    />
  );
}
