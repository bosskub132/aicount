export function requireTestDbUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Point it at a dedicated staging schema. Refusing to run DB tests against production."
    );
  }
  return url;
}
