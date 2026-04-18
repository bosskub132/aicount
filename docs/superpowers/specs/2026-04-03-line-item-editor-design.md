# Line Item Editor — Extraction Page

**Date:** 2026-04-03
**Status:** Approved
**Scope:** Add full CRUD for line items on the extraction page edit mode

---

## Overview

The extraction page currently displays OCR-extracted line items as a read-only table. This feature adds the ability to edit, add, and delete line items. Edits are persisted to `ocrRaw.line_items` in the documents JSONB column.

## User Interactions

### 1. Read Mode — Table with Inline Delete

The existing `LineItemsTable` gains:
- A **"Edit All"** button in the section header (only visible when document status is editable)
- A **Trash2 icon** (lucide-react) per row for quick inline deletion
- Inline delete triggers a confirmation, then removes the item from local state and marks `editValues` as dirty

Columns: #, Description, Qty, Unit Price, Discount, Total, Delete (trash icon)

### 2. Edit All Modal

Clicking "Edit All" opens an **xl-sized Modal** containing all line items as editable cards.

**Modal layout:**
- Header: "Edit Line Items" + item count
- Body: scrollable list of item cards
- Each card shows: Description (full width), then a 4-column grid of Qty, Unit Price, Discount, Total
- Each card has a "Remove" button in the top-right corner
- "+ Add Line Item" dashed button at the bottom appends a blank card
- Footer: subtotal display + Cancel / Save All buttons

**Fields per line item:**
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| description | text | "" | Full width input |
| quantity | number | 1 | Right-aligned |
| unit_price | number | 0 | Right-aligned |
| discount | number | 0 | Right-aligned |
| total | number | auto | Auto-calculated, manually overridable |

### 3. Auto-Calculate with Manual Override

- **Default:** `total = quantity × unit_price - discount` — recalculates on any change to qty, price, or discount
- **Manual override:** If the user edits the total field directly, auto-calc stops for that item. The total field shows a blue "(auto)" label when auto-calculating, which disappears when manually overridden
- **Reset to auto:** If the user clears the total field, auto-calc resumes

Implementation: Each item in local state has an `isManualTotal: boolean` flag. Set to `true` when the user directly edits the total input. Set to `false` when total is cleared.

## Data Flow

### State Management

Line items are managed in local component state within the extraction page:

```typescript
const [editingLineItems, setEditingLineItems] = useState<LineItemEdit[]>([]);
const [lineItemModalOpen, setLineItemModalOpen] = useState(false);

interface LineItemEdit {
  id: string;           // temporary client-side ID for React keys
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  isManualTotal: boolean;
}
```

### Opening the Modal

When "Edit All" is clicked:
1. Copy `ocr.line_items` (from current document data) into `editingLineItems` state
2. Normalize each item to the `LineItemEdit` shape (OCR data may have varying field names)
3. Set `lineItemModalOpen = true`

### Saving

"Save All" in the modal:
1. Convert `editingLineItems` back to the `ocrRaw.line_items` format
2. Store in a dedicated `editedLineItems` state variable (separate from `editValues` which handles header fields)
3. Line items are included in the `saveDraft()` PATCH call's `ocrRaw` update
4. Close the modal

### Inline Delete

Clicking the trash icon on the read-only table:
1. Remove the item from the local line items state
2. Mark the document as having unsaved changes (same as other field edits)
3. The deletion is persisted when the user clicks "Save" on the extraction page

### Persistence

Line items are stored in `ocrRaw.line_items` (JSONB). The existing `saveDraft()` function already sends `ocrRaw` in the PATCH body. The line items edit integrates into this existing flow — no new API endpoints needed.

The `saveDraft()` function will be extended to include line item changes:
```typescript
if (lineItemsEdited) {
  updatedOcrRaw.line_items = editedLineItems.map(item => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount: item.discount,
    total: item.total,
  }));
}
```

## Component Architecture

### New Components

**`LineItemEditorModal`** — `src/components/line-item-editor-modal.tsx`
- Props: `open`, `items: LineItemEdit[]`, `onSave: (items: LineItemEdit[]) => void`, `onClose: () => void`, `currency: string`
- Uses the existing `Modal` component (xl size)
- Internal state for the working copy of items
- Auto-calculate logic per item
- Add/remove item handlers

### Modified Components

**`LineItemsTable`** in `extractions/page.tsx`
- Add `onDelete?: (index: number) => void` prop
- Add `onEditAll?: () => void` prop
- Add `editable?: boolean` prop (controls visibility of edit/delete buttons)
- Render Trash2 icon per row when `editable` and `onDelete` are provided
- Render "Edit All" button in header when `editable` and `onEditAll` are provided

## Editable Status Guard

Line item editing is only available when `EDITABLE_STATUSES.includes(doc.status)`:
- ACTION_REQUIRED
- DRAFT
- QUERY
- REJECTED

The "Edit All" button and trash icons are hidden for non-editable statuses (PENDING_APPROVAL, APPROVED, EXPORTED, VOID).

## Edge Cases

- **Empty line items:** Modal shows only the "+ Add Line Item" button. Table shows "No line items extracted" with no delete icons.
- **OCR field name normalization:** Items from OCR may use `name` instead of `description`, `qty` instead of `quantity`, `price` instead of `unit_price`, `amount` instead of `total`. The normalization logic already exists in `LineItemsTable` and will be reused.
- **Large number of items:** Modal body is scrollable. No pagination needed (invoices rarely exceed 50 items).
- **Concurrent edits with header fields:** Line item changes are independent from header field edits. Both are merged into the same `saveDraft()` call.
- **Undo history:** The existing undo mechanism captures a snapshot before each save, which includes `ocrRaw`. Line item changes are automatically included in undo history.

## Out of Scope

- GL account mapping per line item
- VAT per line item
- Unit of measurement field
- Drag-to-reorder line items
- Import line items from CSV
