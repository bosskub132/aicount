"use client";

import { Menu, Search, LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore, useToast } from "@/lib/stores/ui-store";
import { Avatar } from "@/components/avatar";
import { DropdownMenu } from "@/components/dropdown-menu";

interface HeaderProps {
  title: string;
  userName?: string;
}

export function Header({ title, userName = "User" }: HeaderProps) {
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  async function handleSignOut() {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Logout failed");
      queryClient.clear();
      router.replace("/login");
    } catch {
      toast.error("Failed to sign out. Please try again.");
    }
  }

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] flex h-14 items-center justify-between border-b border-[var(--border)] bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] md:hidden cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-[var(--foreground)]">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {/* Search trigger */}
        <button
          className="flex items-center gap-2 rounded-[var(--radius-input)] bg-[var(--muted)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--border)] transition-colors cursor-pointer min-w-[200px]"
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
          }}
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden sm:inline-flex text-[11px] text-[var(--muted-foreground)] bg-white rounded px-1 py-0.5 border border-[var(--border)]">
            ⌘K
          </kbd>
        </button>
        {/* User avatar with menu */}
        <DropdownMenu
          trigger={<Avatar name={userName} size="md" />}
          align="right"
          items={[
            {
              label: "Settings",
              icon: <Settings className="h-4 w-4" />,
              onClick: () => router.push("/settings"),
            },
            { label: "", onClick: () => {}, divider: true },
            {
              label: "Sign out",
              icon: <LogOut className="h-4 w-4" />,
              destructive: true,
              onClick: handleSignOut,
            },
          ]}
        />
      </div>
    </header>
  );
}
