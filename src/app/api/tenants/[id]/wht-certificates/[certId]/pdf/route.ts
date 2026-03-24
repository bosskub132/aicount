import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getRequestContext,
  unauthorized,
  forbidden,
  ensureTenantScope,
} from "@/lib/api/request-context";
import { getCertificate } from "@/lib/db/queries/wht-certificates";

function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase environment variables for storage");
  }
  return createClient(url, serviceKey);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; certId: string }> },
) {
  try {
    const ctx = getRequestContext(request);
    if (!ctx) return unauthorized();
    const { id, certId } = await context.params;
    if (!ensureTenantScope(ctx.tenantId, id)) return forbidden("Cross-tenant access denied");

    const cert = await getCertificate(id, certId);
    if (!cert) {
      return NextResponse.json(
        { success: false, error: "Certificate not found" },
        { status: 404 },
      );
    }

    if (!cert.pdfStoragePath) {
      return NextResponse.json(
        { success: false, error: "PDF not available for this certificate" },
        { status: 404 },
      );
    }

    const supabase = getStorageClient();
    const { data, error } = await supabase.storage
      .from("wht-certificates")
      .createSignedUrl(cert.pdfStoragePath, 3600); // 1 hour

    if (error || !data?.signedUrl) {
      console.error("[WHT PDF] Signed URL error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to generate PDF download URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: { pdfUrl: data.signedUrl } });
  } catch (error) {
    console.error("[WHT PDF GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate PDF URL" },
      { status: 500 },
    );
  }
}
