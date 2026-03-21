/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import {
  computeTemplateMatchStrength,
  TEMPLATES,
  type TemplateShape,
} from "@/lib/services/match-strength";

function normalizeTemplate(template: TemplateShape) {
  return {
    ...template,
    name: template.id
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") || "";
    const templateId = url.searchParams.get("templateId") || "";
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }

    const approvedDocs = await db
      .select({
        id: documents.id,
        documentNumber: documents.documentNumber,
        documentDate: documents.documentDate,
        issuerName: documents.issuerName,
        grandTotal: documents.grandTotal,
        journalType: documents.journalType,
        direction: documents.direction,
        ocrRaw: documents.ocrRaw,
      })
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.status, "APPROVED")));

    if (!templateId) {
      const cards = TEMPLATES.map((template) => {
        let strong = 0;
        let suitable = 0;
        for (const doc of approvedDocs) {
          const strength = computeTemplateMatchStrength(
            {
              journalType: doc.journalType,
              direction: doc.direction as any,
              ocrRaw: doc.ocrRaw as Record<string, any>,
              issuerName: doc.issuerName,
            },
            template
          );
          if (strength === "strong") strong += 1;
          else if (strength === "suitable") suitable += 1;
        }
        return {
          ...normalizeTemplate(template),
          strong,
          suitable,
          approvedCandidates: approvedDocs.length,
        };
      });
      return NextResponse.json({ success: true, data: cards });
    }

    const selected = TEMPLATES.find((t) => t.id === templateId);
    if (!selected) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    const groups = {
      strong: [] as any[],
      suitable: [] as any[],
      manual: [] as any[],
    };
    for (const doc of approvedDocs) {
      const strength = computeTemplateMatchStrength(
        {
          journalType: doc.journalType,
          direction: doc.direction as any,
          ocrRaw: doc.ocrRaw as Record<string, any>,
          issuerName: doc.issuerName,
        },
        selected
      );
      groups[strength].push(doc);
    }

    return NextResponse.json({
      success: true,
      data: {
        template: normalizeTemplate(selected),
        groups,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Load export templates failed" },
      { status: 500 }
    );
  }
}

