import "dotenv/config";

function readArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

async function mustOk(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} failed with status ${response.status}`);
  }
  return response;
}

async function main() {
  const baseUrl = readArg("baseUrl", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const checks = [
    "/api/health",
    "/api/export/express/compatibility",
    "/api/inngest",
  ];

  const results = [];
  for (const path of checks) {
    const url = `${baseUrl}${path}`;
    const response = await mustOk(url);
    results.push({ path, status: response.status });
  }
  console.log(JSON.stringify({ baseUrl, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

