import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";
import { useToast } from "@/lib/stores/ui-store";

interface GenerateReportPdfInput {
  reportType: string;
  period: string;
  scope: string;
  filters?: Record<string, unknown>;
}

export function useGenerateReportPdf() {
  const tenantId = getWorkspaceTenantId();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: GenerateReportPdfInput) => {
      const res = await fetch(`/api/tenants/${tenantId}/reports/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to generate report PDF");
      return json.data as { reportId: string; pdfUrl: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-history"] });
      toast.success("Report PDF generated successfully");
    },
    onError: () => {
      toast.error("Failed to generate report PDF");
    },
  });
}
