/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";

function verifyLineSignature(rawBody: string, signature: string | null) {
  if (!signature || !process.env.LINE_CHANNEL_SECRET) return false;
  const hash = crypto
    .createHmac("sha256", process.env.LINE_CHANNEL_SECRET)
    .update(rawBody)
    .digest("base64");
  return hash === signature;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-line-signature");
    if (!verifyLineSignature(rawBody, signature)) {
      return NextResponse.json({ success: false, error: "Invalid LINE signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as { events?: any[] };
    const events = Array.isArray(payload.events) ? payload.events : [];
    const accepted: string[] = [];
    const replies: Array<{ replyToken: string; text: string }> = [];

    for (const event of events) {
      if (event?.type !== "message" || event?.message?.type !== "image") continue;

      const tenantId = process.env.LINE_DEFAULT_TENANT_ID || "";
      const uploadedBy = process.env.LINE_DEFAULT_UPLOADED_BY || "";
      if (!isUuid(tenantId) || !isUuid(uploadedBy)) continue;

      const [created] = await db
        .insert(documents)
        .values({
          tenantId,
          uploadedBy,
          intakeSource: "LINE",
          status: "OCR_PROCESSING",
          ocrRaw: {
            source: "LINE",
            lineMessageId: event.message.id,
            sourceUserId: event?.source?.userId || null,
            sourceGroupId: event?.source?.groupId || null,
            sourceRoomId: event?.source?.roomId || null,
            sourceType: event?.source?.type || null,
            imageCompression: event?.message?.contentProvider?.type === "line" ? "LINE_COMPRESSED" : "EXTERNAL_ORIGINAL",
            imageSetId: event?.message?.imageSet?.id || null,
            imageSetIndex: event?.message?.imageSet?.index || null,
          },
        })
        .returning({ id: documents.id });

      accepted.push(created.id);
      if (event.replyToken) {
        replies.push({
          replyToken: event.replyToken,
          text: `Received image. Document queued as ${created.id.slice(0, 8)}...`,
        });
      }
      await inngest.send({
        name: "document/uploaded",
        data: { documentId: created.id, tenantId },
      });
    }

    if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      for (const reply of replies) {
        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            replyToken: reply.replyToken,
            messages: [{ type: "text", text: reply.text }],
          }),
        }).catch(() => null);
      }
    }

    return NextResponse.json({ success: true, data: { acceptedCount: accepted.length, accepted } });
  } catch (error) {
    console.error("[webhooks/line POST]", error);
    return NextResponse.json(
      { success: false, error: "LINE webhook failed" },
      { status: 500 }
    );
  }
}

