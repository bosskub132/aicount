# Extraction Detail - Full Edit Support

## What was done
The extraction detail page (`src/app/(app)/extractions/page.tsx`) was updated to allow users to edit ALL extraction fields, not just a subset.

## Previously editable (8 fields)
- issuerName, issuerTaxId, documentNumber, documentDate
- subtotal, vatAmount, grandTotal, currency

## Newly editable fields

### Customer Information
- Address (ocrRaw: issuer.address)
- Postal Code (ocrRaw: issuer.postal_code)
- Branch ID (ocrRaw: issuer.branch_id)

### Transaction Details
- Credit Days (ocrRaw: document.credit_days)
- Due Date (ocrRaw: document.due_date)

### Line Items & Pricing
- VAT Mode — dropdown: NORMAL_VAT, VAT_EXEMPT, ZERO_RATED (ocrRaw: accounting.vat_mode)
- Document Type — dropdown: RECEIPT, INVOICE, PO, CREDIT_NOTE, DEBIT_NOTE, OTHER (DB column + ocrRaw)
- Expense Category (ocrRaw: accounting.expense_type)

### Additional Information
- Direction — dropdown: REVENUE, EXPENSE (DB column)
- Journal Type — dropdown: RV, SV, PV, PurV, JV (DB column)

### Amount Breakdown
- WHT Amount — added as editable (was display-only); grid changed from 3-col to 4-col
- Grand Total split into its own card in the grid

## Key implementation details
- `FieldRow` component gained an `options` prop for rendering `<select>` dropdowns for enum fields
- `saveChanges()` now builds an updated `ocrRaw` object merging edited OCR-level fields before sending to API
- API route (`src/app/api/documents/[id]/route.ts`) updated: added `whtAmount` to PatchBody type and DB update query
- OCR Processing Tier and Requires Manual Review remain read-only (system/processing fields)
