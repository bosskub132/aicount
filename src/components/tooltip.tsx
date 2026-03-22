"use client";

import { useState, useRef } from "react";

interface TooltipProps {
  content: string;
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactNode;
}

const positionStyles = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
};

export function Tooltip({ content, side = "top", children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(true), 200);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`absolute z-50 whitespace-nowrap rounded-[var(--radius-input)] bg-[var(--foreground)] px-2.5 py-1 text-xs text-white shadow-[var(--shadow-md)] pointer-events-none ${positionStyles[side]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
