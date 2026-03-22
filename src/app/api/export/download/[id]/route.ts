import { promises as fs } from "fs";
import path from "path";
import { getRequestContext, unauthorized } from "@/lib/api/request-context";

function bad() {
  return new Response("Not found", { status: 404 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const { id } = await context.params;

  // Path traversal protection: only allow safe characters
  const safeId = id.replace(/[^a-zA-Z0-9\-_]/g, "");
  if (safeId !== id) {
    return bad();
  }

  const baseDir = path.join(process.cwd(), "public", "generated", "exports");
  const fileName = `express-export-${id}.xlsx`;
  const filePath = path.join(baseDir, fileName);

  try {
    const content = await fs.readFile(filePath);
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch {
    return bad();
  }
}
