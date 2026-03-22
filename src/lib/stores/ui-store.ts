import { create } from "zustand";

// Toast types
interface Toast {
  id: string;
  variant: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
}

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Mobile menu
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;

  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Sidebar
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // Mobile menu
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

  // Toasts
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: `toast-${Date.now()}-${Math.random().toString(36).slice(2)}` },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

// Convenience hook for toasts
export function useToast() {
  const addToast = useUIStore((s) => s.addToast);
  const removeToast = useUIStore((s) => s.removeToast);

  return {
    success: (message: string) => addToast({ variant: "success", message }),
    error: (message: string) => addToast({ variant: "error", message }),
    warning: (message: string) => addToast({ variant: "warning", message }),
    info: (message: string) => addToast({ variant: "info", message }),
    dismiss: (id: string) => removeToast(id),
  };
}
