import { inngest } from "../client";
import { generateCertificate } from "@/lib/services/wht-certificate";

export const whtBatchGenerate = inngest.createFunction(
  { id: "wht-batch-generate", name: "Bulk WHT Certificate Generation" },
  { event: "wht/batch-generate" },
  async ({ event, step }) => {
    const { tenantId, documentIds, userId } = event.data;
    let generated = 0;
    let failed = 0;

    // Generate certificates sequentially (numbering order matters)
    for (const docId of documentIds) {
      await step.run(`generate-${docId}`, async () => {
        try {
          await generateCertificate({
            tenantId,
            documentId: docId,
            issuedBy: userId,
          });
          generated++;
        } catch (err) {
          console.error(
            `[wht-batch-generate] Failed to generate certificate for document ${docId}:`,
            err instanceof Error ? err.message : err
          );
          failed++;
        }
      });
    }

    console.log(
      `[wht-batch-generate] Complete: total=${documentIds.length}, generated=${generated}, failed=${failed}`
    );
    return { total: documentIds.length, generated, failed };
  }
);
