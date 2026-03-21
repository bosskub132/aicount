"use client";

import { useEffect, useState } from "react";

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
    <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900">
      You are offline. Changes may fail to sync; reconnect and retry.
    </div>
  );
}

