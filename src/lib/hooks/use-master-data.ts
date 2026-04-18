import { useQuery } from "@tanstack/react-query";
import { getWorkspaceTenantId } from "@/components/workspace-selector";

export interface MasterDataListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface MasterDataListResponse<T> {
  success: boolean;
  data?: T[];
  meta?: { total: number; page: number; limit: number; totalPages: number };
  error?: string;
}

export const coaKeys = {
  list: (tenantId: string, params: MasterDataListParams) =>
    ["coa", tenantId, params] as const,
};
export const vendorsKeys = {
  list: (tenantId: string, params: MasterDataListParams) =>
    ["vendors", tenantId, params] as const,
};
export const customersKeys = {
  list: (tenantId: string, params: MasterDataListParams) =>
    ["customers", tenantId, params] as const,
};
export const departmentsKeys = {
  list: (tenantId: string, params: MasterDataListParams) =>
    ["departments", tenantId, params] as const,
};
export const productsKeys = {
  list: (tenantId: string, params: MasterDataListParams) =>
    ["products", tenantId, params] as const,
};

function buildSearchParams(params: MasterDataListParams) {
  const sp = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 50),
  });
  if (params.search) sp.set("search", params.search);
  return sp.toString();
}

function createMasterDataHook<T>(
  endpoint: string,
  keys: { list: (tenantId: string, params: MasterDataListParams) => readonly unknown[] }
) {
  return function useMasterDataList(params: MasterDataListParams = {}) {
    const tenantId = getWorkspaceTenantId();
    return useQuery({
      queryKey: keys.list(tenantId, params),
      queryFn: async (): Promise<MasterDataListResponse<T>> => {
        const query = buildSearchParams(params);
        const res = await fetch(`/api/tenants/${tenantId}/${endpoint}?${query}`);
        const json = (await res.json()) as MasterDataListResponse<T>;
        if (!json.success) throw new Error(json.error || `Failed to fetch ${endpoint}`);
        return json;
      },
      enabled: !!tenantId,
      staleTime: 60_000,
    });
  };
}

export const useCoaList = createMasterDataHook("coa", coaKeys);
export const useVendorsList = createMasterDataHook("vendors", vendorsKeys);
export const useCustomersList = createMasterDataHook("customers", customersKeys);
export const useDepartmentsList = createMasterDataHook("departments", departmentsKeys);
export const useProductsList = createMasterDataHook("products", productsKeys);
