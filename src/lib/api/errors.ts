import { NextResponse } from "next/server";

type PgCause = { code?: string; constraint?: string; column?: string };

function getPgCause(error: unknown): PgCause | null {
  const cause = (error as { cause?: unknown })?.cause;
  if (cause && typeof cause === "object") return cause as PgCause;
  return null;
}

export function mapPgError(error: unknown, fallback: string): NextResponse {
  const cause = getPgCause(error);
  if (cause?.code === "23505") {
    return NextResponse.json(
      { success: false, error: "Duplicate entry — a record with these values already exists." },
      { status: 409 }
    );
  }
  if (cause?.code === "23502") {
    const field = cause.column ? ` (${cause.column})` : "";
    return NextResponse.json(
      { success: false, error: `Missing required field${field}.` },
      { status: 400 }
    );
  }
  if (cause?.code === "23503") {
    return NextResponse.json(
      { success: false, error: "Referenced record not found." },
      { status: 400 }
    );
  }
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}
