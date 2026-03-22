import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { getRequestContext, unauthorized } from "@/lib/api/request-context";
import { validateCsrf } from "@/lib/api/csrf";

export async function GET(request: Request) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const [profile] = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      name: profiles.name,
      role: profiles.role,
      isOnboardingComplete: profiles.isOnboardingComplete,
      onboardingStep: profiles.onboardingStep,
      isActive: profiles.isActive,
    })
    .from(profiles)
    .where(eq(profiles.id, ctx.userId))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: profile });
}

export async function PATCH(request: Request) {
  try {
    if (!validateCsrf(request)) {
      return NextResponse.json({ success: false, error: "CSRF validation failed" }, { status: 403 });
    }
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();

    const body = (await request.json()) as {
      name?: string;
      isOnboardingComplete?: boolean;
      onboardingStep?: number;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined && typeof body.name === "string") {
      updates.name = body.name.slice(0, 200);
    }
    if (body.isOnboardingComplete !== undefined && typeof body.isOnboardingComplete === "boolean") {
      updates.isOnboardingComplete = body.isOnboardingComplete;
    }
    if (body.onboardingStep !== undefined && typeof body.onboardingStep === "number") {
      const step = Math.floor(body.onboardingStep);
      if (step >= 0 && step <= 6) updates.onboardingStep = step;
    }

    const [updated] = await db
      .update(profiles)
      .set(updates)
      .where(eq(profiles.id, ctx.userId))
      .returning({
        id: profiles.id,
        email: profiles.email,
        name: profiles.name,
        isOnboardingComplete: profiles.isOnboardingComplete,
        onboardingStep: profiles.onboardingStep,
      });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
