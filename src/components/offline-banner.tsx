"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (online) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[var(--z-toast)] flex items-center gap-2 border-t border-amber-200 bg-[var(--warning-light)] px-4 py-2 text-sm text-amber-800">
      <WifiOff className="h-4 w-4" />
      You are offline. Changes may fail to sync; reconnect and retry.
    </div>
  );
}
