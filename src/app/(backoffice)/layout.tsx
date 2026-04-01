"use client";

import { BackofficeSidebar } from "@/components/backoffice-sidebar";
import { AppQueryProvider } from "@/lib/providers/query-provider";

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppQueryProvider>
      <div className="flex h-screen bg-[var(--background)]">
        <BackofficeSidebar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </AppQueryProvider>
  );
}
