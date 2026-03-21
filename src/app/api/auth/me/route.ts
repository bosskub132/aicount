import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles, tenantAssignments, tenants } from "@/lib/db/schema";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!token) {
      return NextResponse.json({ success: false, error: "Missing bearer token" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
    }

    const userId = data.user.id;
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
    const assignments = await db
      .select({
        assignmentId: tenantAssignments.id,
        tenantId: tenantAssignments.tenantId,
        assignmentRole: tenantAssignments.role,
        tenantName: tenants.name,
      })
      .from(tenantAssignments)
      .innerJoin(tenants, eq(tenantAssignments.tenantId, tenants.id))
      .where(eq(tenantAssignments.userId, userId));

    return NextResponse.json({
      success: true,
      data: {
        user: data.user,
        profile: profile || null,
        assignments,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Profile fetch failed" },
      { status: 500 }
    );
  }
}

