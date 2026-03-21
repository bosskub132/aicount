import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { ensureRole, getRequestContext, unauthorized } from "@/lib/api/request-context";

export async function GET(request: Request) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const unreadOnly = new URL(request.url).searchParams.get("unreadOnly") === "true";
  const rows = unreadOnly
    ? await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, ctx.userId), eq(notifications.isRead, false)))
        .orderBy(desc(notifications.createdAt))
    : await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, ctx.userId))
        .orderBy(desc(notifications.createdAt));

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(request: Request) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    if (!ensureRole(ctx.role, ["admin", "checker"])) {
      return NextResponse.json({ success: false, error: "Only checker/admin can create notifications" }, { status: 403 });
    }

    const body = (await request.json()) as {
      userId: string;
      title: string;
      body?: string;
      link?: string;
    };

    const [created] = await db
      .insert(notifications)
      .values({
        userId: body.userId,
        title: body.title,
        body: body.body || null,
        link: body.link || null,
      })
      .returning();

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Create notification failed" },
      { status: 500 }
    );
  }
}

