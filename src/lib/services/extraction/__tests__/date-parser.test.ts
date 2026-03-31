import { describe, it, expect } from "vitest";
import { parseThaiDate } from "../parsers/date-parser";

describe("parseThaiDate", () => {
  it("converts Buddhist Era full year YYYY-MM-DD: '2567-08-02' → '2024-08-02'", () => {
    expect(parseThaiDate("2567-08-02")).toBe("2024-08-02");
  });

  it("converts short year D/M/YY (BE): '2/8/67' → '2024-08-02'", () => {
    expect(parseThaiDate("2/8/67")).toBe("2024-08-02");
  });

  it("converts short year where YY=24 as BE: '2/8/24' → '2024-08-02'", () => {
    // YY=24 means BE 2524 → CE 1981, but we resolve as 2500+24=2524→1981
    // Wait, spec says "2/8/24" → "2024-08-02" (NOT 1924 — BE 2567)
    // So YY=24 means BE century 2500+24=2524→CE 1981? No, spec says result is 2024-08-02.
    // The spec says: resolveShortYear always treats as BE century (2500 + yy), then convert
    // 2500 + 24 = 2524, 2524 - 543 = 1981. But spec wants 2024-08-02.
    // Re-reading: "Short year where YY=24: '2/8/24' → '2024-08-02' (NOT 1924 — BE 2567)"
    // So 24 maps to BE 2567 → CE 2024. The logic must be: if result < 2000, add 543.
    // Actually it means: short years in Thai docs are BE short years of current century.
    // 67 → 2567 → 2024. 24 → 2524 → 1981 is wrong, so it must be:
    // For short years, try 2500+yy first; if CE < 2000, try (current BE century)+yy
    // Current BE century = 2500, so 2500+24=2524→1981 < 2000, so try 2567's century?
    // Simplest: always resolve as 25xx where xx=yy, giving 2524→1981. Hmm.
    // The spec literally says the output is "2024-08-02" for input "2/8/24".
    // So the logic must be: if 2500+yy → CE < 2000, use current CE century instead.
    // Actually most likely: if yy <= current CE short year (26), treat as CE 20xx.
    // 24 ≤ 26 → CE 2024. 67 > 26 → BE 2567 → CE 2024. That works!
    expect(parseThaiDate("2/8/24")).toBe("2024-08-02");
  });

  it("converts DD/MM/YYYY Buddhist Era: '02/08/2567' → '2024-08-02'", () => {
    expect(parseThaiDate("02/08/2567")).toBe("2024-08-02");
  });

  it("passes through already-CE dates in ISO: '2026-01-06' → '2026-01-06'", () => {
    expect(parseThaiDate("2026-01-06")).toBe("2026-01-06");
  });

  it("converts DD-MM-YYYY with hyphens (BE): '06-01-2569' → '2026-01-06'", () => {
    expect(parseThaiDate("06-01-2569")).toBe("2026-01-06");
  });

  it("converts Thai month names: '6 มกราคม 2569' → '2026-01-06'", () => {
    expect(parseThaiDate("6 มกราคม 2569")).toBe("2026-01-06");
  });

  it("converts abbreviated Thai months: '6 ม.ค. 2569' → '2026-01-06'", () => {
    expect(parseThaiDate("6 ม.ค. 2569")).toBe("2026-01-06");
  });

  it("converts abbreviated Thai months short year: '6 ม.ค. 67' → '2024-01-06'", () => {
    expect(parseThaiDate("6 ม.ค. 67")).toBe("2024-01-06");
  });

  it("returns null for null input", () => {
    expect(parseThaiDate(null as unknown as string)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseThaiDate("")).toBeNull();
  });

  it("returns null for unparseable input", () => {
    expect(parseThaiDate("not a date")).toBeNull();
  });

  it("strips time component: '2026-01-06T10:30:00' → '2026-01-06'", () => {
    expect(parseThaiDate("2026-01-06T10:30:00")).toBe("2026-01-06");
  });

  it("rejects dates before 2000 CE", () => {
    expect(parseThaiDate("1999-12-31")).toBeNull();
  });
});
