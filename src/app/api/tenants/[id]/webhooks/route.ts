import { NextResponse } from "next/server";
import crypto from "crypto";
import { ensureRole, ensureTenantScope, forbidden, getRequestContext, unauthorized } from "@/lib/api/request-context";

type RegisteredWebhook = {
  id: string;
  event: string;
  targetUrl: string;
  secret: string;
  createdAt: string;
};

const memoryWebhooks = new Map<string, RegisteredWebhook[]>();

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");
  return NextResponse.json({ success: true, data: memoryWebhooks.get(id) || [] });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");
  if (!ensureRole(ctx.role, ["admin", "checker"])) return forbidden("Only checker/admin can register webhooks");

  const body = (await request.json()) as { event: string; targetUrl: string };
  if (!body.event || !body.targetUrl) {
    return NextResponse.json({ success: false, error: "event and targetUrl are required" }, { status: 400 });
  }

  const webhook: RegisteredWebhook = {
    id: crypto.randomUUID(),
    event: body.event,
    targetUrl: body.targetUrl,
    secret: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const list = memoryWebhooks.get(id) || [];
  list.push(webhook);
  memoryWebhooks.set(id, list);

  return NextResponse.json({ success: true, data: webhook }, { status: 201 });
}

