import { eq, sql } from "drizzle-orm";
import { inngest } from "../client";
import { db } from "@/lib/db";
import { notificationPreferences, notifications, profiles } from "@/lib/db/schema";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendEmailIfEnabled({
  userId,
  title,
  body,
  preferenceKey,
}: {
  userId: string;
  title: string;
  body: string;
  preferenceKey: "emailOnReject" | "emailOnPending" | "emailWeeklyDigest";
}) {
  if (!resend) return;
  const [user] = await db
    .select({ email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!user?.email) return;
  const [pref] = await db
    .select({
      emailOnReject: notificationPreferences.emailOnReject,
      emailOnPending: notificationPreferences.emailOnPending,
      emailWeeklyDigest: notificationPreferences.emailWeeklyDigest,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  const enabled = pref ? Boolean(pref[preferenceKey]) : true;
  if (!enabled) return;
  await resend.emails.send({
    from: "AiCount <noreply@aicount.app>",
    to: user.email,
    subject: title,
    text: body,
  });
}

export const sendWeeklyDigest = inngest.createFunction(
  { id: "send-weekly-digest", retries: 1 },
  { cron: "TZ=Asia/Bangkok 0 9 * * MON" },
  async ({ step }) => {
    const unreadCounts = await step.run("collect-unread-counts", async () => {
      return db
        .select({
          userId: notifications.userId,
          unread: sql<number>`count(*)`,
        })
        .from(notifications)
        .where(eq(notifications.isRead, false))
        .groupBy(notifications.userId);
    });

    await step.run("queue-digest-notifications", async () => {
      for (const row of unreadCounts) {
        await db.insert(notifications).values({
          userId: row.userId,
          title: "Weekly digest",
          body: `You have ${row.unread} unread notifications this week.`,
          link: "/settings",
          isRead: false,
        });
        await sendEmailIfEnabled({
          userId: row.userId,
          title: "AiCount weekly digest",
          body: `You have ${row.unread} unread notifications this week.`,
          preferenceKey: "emailWeeklyDigest",
        });
      }
    });

    return {
      generatedForUsers: unreadCounts.length,
    };
  }
);

export const notifyDocumentRejected = inngest.createFunction(
  { id: "notify-document-rejected", retries: 2 },
  { event: "document/rejected" },
  async ({ event, step }) => {
    const { userId, documentId, comment } = event.data as {
      userId: string;
      documentId: string;
      comment?: string;
    };

    await step.run("insert-notification", async () => {
      await db.insert(notifications).values({
        userId,
        title: "Document rejected",
        body: comment || "A document was rejected and needs your action.",
        link: `/documents/${documentId}`,
      });
      await sendEmailIfEnabled({
        userId,
        title: "Document rejected",
        body: comment || "A document was rejected and needs your action.",
        preferenceKey: "emailOnReject",
      });
    });

    return { ok: true };
  }
);

export const notifyDocumentPendingApproval = inngest.createFunction(
  { id: "notify-document-pending-approval", retries: 2 },
  { event: "document/pending_approval" },
  async ({ event, step }) => {
    const { makerUserId, documentId } = event.data as {
      makerUserId: string;
      documentId: string;
    };
    await step.run("insert-pending-notification", async () => {
      await db.insert(notifications).values({
        userId: makerUserId,
        title: "Document submitted for approval",
        body: "Your document is now in checker queue.",
        link: `/documents/${documentId}`,
      });
      await sendEmailIfEnabled({
        userId: makerUserId,
        title: "Document submitted for approval",
        body: "Your document is now in checker queue.",
        preferenceKey: "emailOnPending",
      });
    });
    return { ok: true };
  }
);

