import { NextResponse } from "next/server";
import {
  ensureTenantScope,
  forbidden,
  getRequestContext,
  unauthorized,
} from "@/lib/api/request-context";
import {
  DOCUMENT_STATUSES,
  type DocumentStatus,
  listDocuments,
} from "@/lib/db/queries/documents";

export async function GET(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") ?? ctx.tenantId;

    if (!ensureTenantScope(ctx.tenantId, tenantId)) {
      return forbidden("Cross-tenant access denied");
    }

    const statusParam = searchParams.get("status");
    const statuses: DocumentStatus[] = statusParam
      ? (statusParam
          .split(",")
          .map((s) => s.trim())
          .filter((s): s is DocumentStatus =>
            (DOCUMENT_STATUSES as readonly string[]).includes(s)
          ))
      : [];
    if (statusParam && statuses.length === 0) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const sort = (searchParams.get("sort") || "createdAt") as
      | "createdAt"
      | "issuerName"
      | "grandTotal"
      | "documentDate"
      | "status";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const search = searchParams.get("search") || undefined;

    const result = await listDocuments(tenantId, {
      page,
      limit,
      statuses: statuses.length > 0 ? statuses : undefined,
      search,
      sort,
      order,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[documents GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
