import { NextResponse } from "next/server";
import {
  ensureTenantScope,
  forbidden,
  getRequestContext,
  unauthorized,
} from "@/lib/api/request-context";
import {
  getRetentionPolicy,
  upsertRetentionPolicy,
} from "@/lib/db/queries/report-retention";
import { validateRetentionPolicy } from "@/lib/services/report-retention";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id))
    return forbidden("Cross-tenant access denied");

  try {
    const policy = await getRetentionPolicy(id);
    return NextResponse.json({ success: true, data: policy });
  } catch (err) {
    console.error("Failed to fetch retention policy:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch retention policy" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id))
    return forbidden("Cross-tenant access denied");

  if (ctx.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Only admins can update retention policy" },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const errors = validateRetentionPolicy(body);
  if (errors.length > 0) {
    return NextResponse.json(
      { success: false, errors },
      { status: 400 }
    );
  }

  try {
    const policy = await upsertRetentionPolicy(id, body, ctx.userId);
    return NextResponse.json({ success: true, data: policy });
  } catch (err) {
    console.error("Failed to update retention policy:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update retention policy" },
      { status: 500 }
    );
  }
}
