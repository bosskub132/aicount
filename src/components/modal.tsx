"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export function Modal({ open, onClose, title, children, actions, size = "md" }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`${sizeStyles[size]} w-full rounded-[var(--radius-modal)] border-none p-0 shadow-[var(--shadow-lg)] backdrop:bg-black/40 backdrop:backdrop-blur-[1px]`}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-semibold text-[var(--foreground)]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-[var(--radius-button)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="text-sm text-[var(--muted-foreground)] leading-relaxed">{children}</div>
        {actions && (
          <div className="flex justify-end gap-2 mt-6">{actions}</div>
        )}
      </div>
    </dialog>
  );
}
