import { useState, useEffect } from "react";

/**
 * Returns false on server and during hydration, true after mount.
 * Use to guard React Query's isLoading so server/client first render match.
 *
 * Usage: `const isLoading = !useMounted() || queryLoading;`
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
