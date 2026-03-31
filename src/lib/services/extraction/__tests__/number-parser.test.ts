import { describe, it, expect } from "vitest";
import { parseThaiNumber } from "../parsers/number-parser";

describe("parseThaiNumber", () => {
  it("parses standard format: '1,750,000.00' → 1750000", () => {
    expect(parseThaiNumber("1,750,000.00")).toBe(1750000);
  });

  it("parses Thai ambiguous: '1,750,000,00' → 1750000", () => {
    expect(parseThaiNumber("1,750,000,00")).toBe(1750000);
  });

  it("parses no separators: '32808' → 32808", () => {
    expect(parseThaiNumber("32808")).toBe(32808);
  });

  it("parses decimal only: '122500.00' → 122500", () => {
    expect(parseThaiNumber("122500.00")).toBe(122500);
  });

  it("parses small number: '7.00' → 7", () => {
    expect(parseThaiNumber("7.00")).toBe(7);
  });

  it("handles spaces: ' 1,872,500.00 ' → 1872500", () => {
    expect(parseThaiNumber(" 1,872,500.00 ")).toBe(1872500);
  });

  it("strips currency symbol: '฿1,750,000.00' → 1750000", () => {
    expect(parseThaiNumber("฿1,750,000.00")).toBe(1750000);
  });

  it("returns null for non-numeric input", () => {
    expect(parseThaiNumber("abc")).toBeNull();
  });

  it("parses negative: '-1,500.00' → -1500", () => {
    expect(parseThaiNumber("-1,500.00")).toBe(-1500);
  });

  it("parses ambiguous: '5,015.00' → 5015", () => {
    expect(parseThaiNumber("5,015.00")).toBe(5015);
  });

  it("parses European format: '1.750.000,00' → 1750000", () => {
    expect(parseThaiNumber("1.750.000,00")).toBe(1750000);
  });

  it("passes through numeric values: 1750000 → 1750000", () => {
    expect(parseThaiNumber(1750000)).toBe(1750000);
  });

  it("returns null for null input", () => {
    expect(parseThaiNumber(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseThaiNumber(undefined)).toBeNull();
  });
});
