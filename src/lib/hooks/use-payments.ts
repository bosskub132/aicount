import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/lib/stores/ui-store";

interface RecordPaymentInput {
  type: "receivable" | "payable";
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  whtAmount?: number;
}

export function useRecordPayment(tenantId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: RecordPaymentInput) => {
      const res = await fetch(`/api/tenants/${tenantId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to record payment");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receivables", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["payables", tenantId] });
      toast.success("Payment recorded successfully");
    },
    onError: () => {
      toast.error("Failed to record payment");
    },
  });
}
