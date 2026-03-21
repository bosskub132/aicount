import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }

    const queue = await db
      .select()
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.status, "PENDING_APPROVAL")))
      .orderBy(desc(documents.updatedAt));

    return NextResponse.json({ success: true, data: queue });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Queue failed" },
      { status: 500 }
    );
  }
}

