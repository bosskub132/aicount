import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import { recordPayment } from "@/lib/db/queries/payments";

const paymentBodySchema = z.object({
  documentId: z.string().uuid(),
  amount: z.number().positive(),
  whtAmount: z.number().min(0).optional(),
  paymentDate: z.string(),
  paymentMethod: z.enum([
    "bank_transfer",
    "cheque",
    "cash",
    "promptpay",
  ]),
  referenceNo: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();
  const { id: tenantId } = await context.params;
  if (!ensureTenantScope(ctx.tenantId, tenantId))
    return forbidden("Cross-tenant access denied");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = paymentBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payment data" },
      { status: 400 },
    );
  }

  try {
    const result = await recordPayment(db, tenantId, {
      ...parsed.data,
      createdBy: ctx.userId,
    });

    return NextResponse.json(
      { success: true, payment: result.payment, journalEntry: result.journalEntry },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/tenants/[id]/payments failed:", error);

    // Known validation errors from recordPayment (period locked, amount exceeds remaining)
    const message = error instanceof Error ? error.message : "";
    const isValidationError =
      message.includes("locked") ||
      message.includes("exceeds") ||
      message.includes("not found") ||
      message.includes("must be greater than zero") ||
      message.includes("cannot exceed");

    if (isValidationError) {
      return NextResponse.json(
        { success: false, error: "Payment validation failed" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to record payment" },
      { status: 500 },
    );
  }
}
