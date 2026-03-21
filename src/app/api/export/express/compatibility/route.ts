import { NextResponse } from "next/server";

const matrix = [
  { version: "Express v1.5", status: "supported", notes: "Default template format" },
  { version: "Express v1.6", status: "supported", notes: "Header + detail text format verified" },
  { version: "Express v1.7+", status: "partial", notes: "Field subset supported, custom mapping recommended" },
];

export async function GET() {
  return NextResponse.json({ success: true, data: matrix });
}

