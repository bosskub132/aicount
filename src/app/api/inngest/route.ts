import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { processDocument } from "@/lib/inngest/functions/process-document";
import {
  notifyDocumentPendingApproval,
  notifyDocumentRejected,
  sendWeeklyDigest,
} from "@/lib/inngest/functions/send-notifications";
import { applyDataRetention } from "@/lib/inngest/functions/data-retention";
import { autoExpirePendingApprovals } from "@/lib/inngest/functions/workflow-maintenance";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processDocument,
    sendWeeklyDigest,
    notifyDocumentRejected,
    notifyDocumentPendingApproval,
    applyDataRetention,
    autoExpirePendingApprovals,
  ],
});
