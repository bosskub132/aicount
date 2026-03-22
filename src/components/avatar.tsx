import Image from "next/image";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  className?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({ src, name, size = "md", className = "" }: AvatarProps) {
  const initials = getInitials(name);

  if (src) {
    const dimension = size === "sm" ? 28 : size === "md" ? 32 : 40;
    return (
      <Image
        src={src}
        alt={name}
        width={dimension}
        height={dimension}
        className={`rounded-full object-cover ${sizeStyles[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-[var(--primary)] text-white font-semibold ${sizeStyles[size]} ${className}`}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
