import { NextResponse } from "next/server";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
  ensureRole,
} from "@/lib/api/request-context";
import {
  getReportHistory,
  lockReport,
  unlockReport,
  softDeleteReport,
  restoreReport,
} from "@/lib/db/queries/report-history";

type RouteContext = { params: Promise<{ id: string; reportId: string }> };

const VALID_ACTIONS = ["lock", "unlock", "restore"] as const;
type PatchAction = (typeof VALID_ACTIONS)[number];

export async function GET(request: Request, context: RouteContext) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id, reportId } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id))
    return forbidden("Cross-tenant access denied");

  try {
    const record = await getReportHistory(id, reportId);
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Report not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error("[GET /reports/history/:reportId]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch report" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id, reportId } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id))
    return forbidden("Cross-tenant access denied");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const action = (body as Record<string, unknown>)?.action;
  if (
    typeof action !== "string" ||
    !VALID_ACTIONS.includes(action as PatchAction)
  ) {
    return NextResponse.json(
      { success: false, error: "Invalid action. Must be: lock, unlock, or restore" },
      { status: 400 }
    );
  }

  try {
    return await handlePatchAction(action as PatchAction, ctx, id, reportId);
  } catch (error) {
    console.error("[PATCH /reports/history/:reportId]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update report" },
      { status: 500 }
    );
  }
}

async function handlePatchAction(
  action: PatchAction,
  ctx: { userId: string; role: "admin" | "maker" | "checker" },
  tenantId: string,
  reportId: string
) {
  switch (action) {
    case "lock": {
      if (!ensureRole(ctx.role, ["admin", "checker"])) {
        return forbidden("Only admin and checker can lock reports");
      }
      const locked = await lockReport(tenantId, reportId, ctx.userId);
      if (!locked) {
        return NextResponse.json(
          { success: false, error: "Report not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: locked });
    }
    case "unlock": {
      if (!ensureRole(ctx.role, ["admin", "checker"])) {
        return forbidden("Only admin and checker can unlock reports");
      }
      const unlocked = await unlockReport(tenantId, reportId);
      if (!unlocked) {
        return NextResponse.json(
          { success: false, error: "Report not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: unlocked });
    }
    case "restore": {
      if (!ensureRole(ctx.role, ["admin"])) {
        return forbidden("Only admin can restore reports");
      }
      const restored = await restoreReport(tenantId, reportId);
      if (!restored) {
        return NextResponse.json(
          { success: false, error: "Report not found or not deleted" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: restored });
    }
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id, reportId } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id))
    return forbidden("Cross-tenant access denied");

  if (!ensureRole(ctx.role, ["admin"])) {
    return forbidden("Only admin can delete reports");
  }

  try {
    const deleted = await softDeleteReport(id, reportId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Report not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    console.error("[DELETE /reports/history/:reportId]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete report" },
      { status: 500 }
    );
  }
}
