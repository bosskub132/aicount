/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const status = searchParams.get("status");

    if (!tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }

    const rows = status
      ? await db
          .select()
          .from(documents)
          .where(and(eq(documents.tenantId, tenantId), eq(documents.status, status as any)))
          .orderBy(desc(documents.createdAt))
      : await db
          .select()
          .from(documents)
          .where(eq(documents.tenantId, tenantId))
          .orderBy(desc(documents.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "List failed" },
      { status: 500 }
    );
  }
}

