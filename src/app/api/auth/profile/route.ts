import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { getRequestContext, unauthorized } from "@/lib/api/request-context";
import { validateCsrf } from "@/lib/api/csrf";

const PatchProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isOnboardingComplete: z.boolean().optional(),
  onboardingStep: z.number().int().min(0).max(6).optional(),
});

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

    const parsed = PatchProfileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    }
    const body = parsed.data;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) {
      updates.name = body.name;
    }
    if (body.isOnboardingComplete !== undefined) {
      updates.isOnboardingComplete = body.isOnboardingComplete;
    }
    if (body.onboardingStep !== undefined) {
      updates.onboardingStep = body.onboardingStep;
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
