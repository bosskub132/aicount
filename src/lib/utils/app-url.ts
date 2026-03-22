export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://aicount-mocha.vercel.app";
}
