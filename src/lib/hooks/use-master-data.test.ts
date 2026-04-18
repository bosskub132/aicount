import { describe, it, expect } from "vitest";
import {
  coaKeys,
  vendorsKeys,
  customersKeys,
  departmentsKeys,
  productsKeys,
} from "./use-master-data";

describe("master data keys (contract)", () => {
  const tenantId = "11111111-1111-1111-1111-111111111111";
  const params = { page: 1, limit: 50 };

  it("coaKeys.list", () => {
    expect(coaKeys.list(tenantId, params)).toMatchInlineSnapshot(`
      [
        "coa",
        "11111111-1111-1111-1111-111111111111",
        {
          "limit": 50,
          "page": 1,
        },
      ]
    `);
  });

  it("vendorsKeys.list", () => {
    expect(vendorsKeys.list(tenantId, params)).toMatchInlineSnapshot(`
      [
        "vendors",
        "11111111-1111-1111-1111-111111111111",
        {
          "limit": 50,
          "page": 1,
        },
      ]
    `);
  });

  it("customersKeys.list", () => {
    expect(customersKeys.list(tenantId, params)).toMatchInlineSnapshot(`
      [
        "customers",
        "11111111-1111-1111-1111-111111111111",
        {
          "limit": 50,
          "page": 1,
        },
      ]
    `);
  });

  it("departmentsKeys.list", () => {
    expect(departmentsKeys.list(tenantId, params)).toMatchInlineSnapshot(`
      [
        "departments",
        "11111111-1111-1111-1111-111111111111",
        {
          "limit": 50,
          "page": 1,
        },
      ]
    `);
  });

  it("productsKeys.list", () => {
    expect(productsKeys.list(tenantId, params)).toMatchInlineSnapshot(`
      [
        "products",
        "11111111-1111-1111-1111-111111111111",
        {
          "limit": 50,
          "page": 1,
        },
      ]
    `);
  });
});
