const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function validateCsrf(request: Request) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin || !appUrl) return false;

  // Basic same-origin CSRF check for state-changing requests.
  return origin.toLowerCase() === appUrl.toLowerCase();
}

