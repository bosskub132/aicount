export function getWhtFormType(vendor: {
  vendorType: "individual" | "company";
  isNonResident: boolean;
}): "pnd3" | "pnd53" | "pp36" {
  if (vendor.isNonResident) return "pp36";
  if (vendor.vendorType === "individual") return "pnd3";
  return "pnd53";
}

// WHT income type codes — Revenue Department classification
// PND3 uses Income Tax Act Section 40 paragraphs
export const WHT_INCOME_TYPES_PND3: Record<string, { section: string; rate: number | null }> = {
  "เงินเดือน/ค่าจ้าง": { section: "40(1)", rate: null },
  "ค่านายหน้า": { section: "40(2)", rate: 0.03 },
  "ค่าลิขสิทธิ์": { section: "40(3)", rate: 0.03 },
  "ดอกเบี้ย": { section: "40(4)(a)", rate: 0.01 },
  "เงินปันผล": { section: "40(4)(b)", rate: 0.10 },
  "ค่าเช่าทรัพย์สิน": { section: "40(5)", rate: 0.05 },
  "วิชาชีพอิสระ": { section: "40(6)", rate: 0.03 },
  "ค่าจ้างทำของ": { section: "40(7)", rate: 0.03 },
  "ค่าจ้างรับเหมา": { section: "40(7)", rate: 0.03 },
  "รางวัล/ชิงโชค": { section: "40(8)", rate: 0.05 },
};

// PND53 uses corporate income type classification
export const WHT_INCOME_TYPES_PND53: Record<string, { type: string; rate: number }> = {
  "ค่าเช่า": { type: "1", rate: 0.05 },
  "ค่าบริการ/จ้างทำของ": { type: "2", rate: 0.03 },
  "ค่าขนส่ง": { type: "3", rate: 0.01 },
  "ค่าโฆษณา": { type: "4", rate: 0.02 },
  "ดอกเบี้ย": { type: "5", rate: 0.01 },
  "เงินปันผล": { type: "6", rate: 0.10 },
  "ค่าที่ปรึกษา": { type: "7", rate: 0.03 },
  "ค่านายหน้า": { type: "8", rate: 0.03 },
};
