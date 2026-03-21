import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id } = await context.params;

  const [updated] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, ctx.userId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ success: false, error: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: updated });
}

