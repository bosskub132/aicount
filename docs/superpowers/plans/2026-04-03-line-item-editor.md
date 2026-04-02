# Line Item Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full CRUD (create, read, update, delete) for line items on the extraction page, with a batch-edit modal and inline delete.

**Architecture:** A new `LineItemEditorModal` component handles batch editing in an xl Modal. The existing `LineItemsTable` in `extractions/page.tsx` gains inline delete (Trash2 icon) and an "Edit All" button. Line item changes are stored in a dedicated `editedLineItems` state and merged into the existing `saveDraft()` flow via `ocrRaw.line_items`. No new API endpoints needed.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, lucide-react icons, existing Modal/Button/Input components

**Spec:** `docs/superpowers/specs/2026-04-03-line-item-editor-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/line-item-editor-modal.tsx` | Create | Batch edit modal with add/edit/remove items, auto-calc totals |
| `src/app/(app)/extractions/page.tsx` | Modify | Wire up modal state, inline delete, integrate with saveDraft |

---

### Task 1: Create LineItemEditorModal Component

**Files:**
- Create: `src/components/line-item-editor-modal.tsx`

- [ ] **Step 1: Create the type and component skeleton**

```typescript
// src/components/line-item-editor-modal.tsx
"use client";

import { useState, useCallback } from "react";
import { Trash2, Plus } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

export interface LineItemEdit {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  isManualTotal: boolean;
}

interface LineItemEditorModalProps {
  open: boolean;
  items: LineItemEdit[];
  currency: string;
  onSave: (items: LineItemEdit[]) => void;
  onClose: () => void;
}

function generateItemId() {
  return crypto.randomUUID();
}

function calcTotal(qty: number, price: number, discount: number): number {
  return Math.round((qty * price - discount) * 100) / 100;
}

function createBlankItem(): LineItemEdit {
  return {
    id: generateItemId(),
    description: "",
    quantity: 1,
    unit_price: 0,
    discount: 0,
    total: 0,
    isManualTotal: false,
  };
}

export function LineItemEditorModal({ open, items, currency, onSave, onClose }: LineItemEditorModalProps) {
  const [working, setWorking] = useState<LineItemEdit[]>([]);

  // Reset working copy when modal opens with new items
  const handleOpen = useCallback(() => {
    setWorking(items.length > 0 ? items.map((i) => ({ ...i })) : [createBlankItem()]);
  }, [items]);

  // Sync working state when modal opens
  if (open && working.length === 0 && items.length === 0) {
    // Will be set via useEffect below
  }

  return null; // placeholder — filled in next step
}
```

- [ ] **Step 2: Implement the full modal body with item cards**

Replace the `return null` in `LineItemEditorModal` with:

```typescript
export function LineItemEditorModal({ open, items, currency, onSave, onClose }: LineItemEditorModalProps) {
  const [working, setWorking] = useState<LineItemEdit[]>([]);

  // Reset working copy each time modal opens
  useState(() => {
    // handled via open prop change
  });

  // When open transitions to true, snapshot items into working state
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setWorking(items.length > 0 ? items.map((i) => ({ ...i })) : []);
    }
    prevOpenRef.current = open;
  }, [open, items]);

  const updateItem = useCallback((id: string, field: keyof LineItemEdit, value: string | number | boolean) => {
    setWorking((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        // Auto-calc total unless manually overridden
        if (field === "total") {
          updated.isManualTotal = true;
        } else if (
          (field === "quantity" || field === "unit_price" || field === "discount") &&
          !updated.isManualTotal
        ) {
          updated.total = calcTotal(
            field === "quantity" ? (value as number) : updated.quantity,
            field === "unit_price" ? (value as number) : updated.unit_price,
            field === "discount" ? (value as number) : updated.discount,
          );
        }
        return updated;
      }),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setWorking((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addItem = useCallback(() => {
    setWorking((prev) => [...prev, createBlankItem()]);
  }, []);

  const handleSave = useCallback(() => {
    onSave(working);
  }, [working, onSave]);

  const subtotal = working.reduce((sum, item) => sum + (item.total || 0), 0);
  const symbol = currency === "THB" ? "฿" : currency + " ";

  const actions = (
    <div className="flex w-full items-center justify-between">
      <span className="text-sm font-medium text-[var(--card-foreground)]">
        Subtotal: {symbol}
        {subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave}>
          Save All
        </Button>
      </div>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={`Edit Line Items (${working.length})`} size="xl" actions={actions}>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto">
        {working.map((item, idx) => (
          <div key={item.id} className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                Item {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="flex items-center gap-1 text-xs text-[var(--destructive)] hover:underline"
              >
                <Trash2 className="h-3 w-3" />
                Remove
              </button>
            </div>
            <div className="space-y-2">
              <Input
                label="Description"
                value={item.description}
                onChange={(e) => updateItem(item.id, "description", e.target.value)}
              />
              <div className="grid grid-cols-4 gap-2">
                <Input
                  label="Quantity"
                  type="number"
                  value={item.quantity || ""}
                  className="text-right"
                  onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value) || 0)}
                />
                <Input
                  label="Unit Price"
                  type="number"
                  value={item.unit_price || ""}
                  className="text-right"
                  onChange={(e) => updateItem(item.id, "unit_price", Number(e.target.value) || 0)}
                />
                <Input
                  label="Discount"
                  type="number"
                  value={item.discount || ""}
                  className="text-right"
                  onChange={(e) => updateItem(item.id, "discount", Number(e.target.value) || 0)}
                />
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[var(--card-foreground)]">
                    Total{" "}
                    {!item.isManualTotal && (
                      <span className="font-normal text-[var(--primary)]">(auto)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={item.total || ""}
                    className="h-9 w-full rounded-md border border-[var(--border)] bg-white px-3 text-right text-sm text-[var(--card-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        // Clear → reset to auto
                        updateItem(item.id, "isManualTotal", false);
                        setWorking((prev) =>
                          prev.map((it) =>
                            it.id === item.id
                              ? { ...it, isManualTotal: false, total: calcTotal(it.quantity, it.unit_price, it.discount) }
                              : it,
                          ),
                        );
                      } else {
                        updateItem(item.id, "total", Number(val) || 0);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] py-2.5 text-sm text-[var(--primary)] hover:bg-[var(--muted)]"
      >
        <Plus className="h-4 w-4" />
        Add Line Item
      </button>
    </Modal>
  );
}
```

Add `useRef, useEffect` to the import line:

```typescript
import { useState, useCallback, useRef, useEffect } from "react";
```

- [ ] **Step 3: Verify component compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/line-item-editor-modal.tsx
git commit -m "feat: add LineItemEditorModal component for batch line item editing"
```

---

### Task 2: Add Inline Delete and Edit All Button to LineItemsTable

**Files:**
- Modify: `src/app/(app)/extractions/page.tsx` — `LineItemsTable` function (lines 142-193)

- [ ] **Step 1: Update LineItemsTable signature and add Trash2 import**

At the top of `extractions/page.tsx`, add `Trash2` to the lucide-react import:

```typescript
import {
  ChevronDown,
  Save,
  Send,
  Undo2,
  User,
  FileText,
  DollarSign,
  Package,
  BookOpen,
  AlertTriangle,
  Trash2,
  Pencil,
} from "lucide-react";
```

- [ ] **Step 2: Replace the LineItemsTable function**

Replace the entire `LineItemsTable` function (lines 142-193) with:

```typescript
function LineItemsTable({
  items,
  currency,
  editable,
  onDelete,
  onEditAll,
}: {
  items: any[];
  currency: string;
  editable?: boolean;
  onDelete?: (index: number) => void;
  onEditAll?: () => void;
}) {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-6 text-[var(--muted-foreground)]">
        <Package className="h-5 w-5" />
        <span className="text-sm">No line items extracted</span>
        {editable && onEditAll && (
          <button
            type="button"
            onClick={onEditAll}
            className="mt-1 text-sm text-[var(--primary)] hover:underline"
          >
            + Add line items
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {editable && onEditAll && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onEditAll}
            className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
          >
            <Pencil className="h-3 w-3" />
            Edit All
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--muted)] text-left text-[var(--muted-foreground)]">
              <th className="w-10 px-3 py-2 text-center font-medium">#</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Unit Price</th>
              <th className="px-3 py-2 text-right font-medium">Discount</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              {editable && onDelete && <th className="w-10 px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => {
              const desc = typeof item === "string" ? item : item?.description || item?.name || "-";
              const qty = item?.quantity ?? item?.qty ?? "";
              const unitPrice = item?.unit_price ?? item?.price ?? "";
              const discount = item?.discount;
              const total = item?.total ?? item?.amount ?? "";
              return (
                <tr key={idx} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 text-center text-[var(--muted-foreground)]">{idx + 1}</td>
                  <td className="px-3 py-2 text-[var(--foreground)]">{desc}</td>
                  <td className="px-3 py-2 text-right text-[var(--foreground)]">{qty}</td>
                  <td className="px-3 py-2 text-right text-[var(--foreground)]">
                    {unitPrice !== "" ? formatCurrency(unitPrice, currency) || unitPrice : "-"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--foreground)]">
                    {discount != null ? formatCurrency(discount, currency) || String(discount) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-[var(--foreground)]">
                    {total !== "" ? formatCurrency(total, currency) || total : "-"}
                  </td>
                  {editable && onDelete && (
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => onDelete(idx)}
                        className="text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                        title="Delete item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify component compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors (LineItemsTable usage will temporarily break — fixed in Task 3)

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/extractions/page.tsx
git commit -m "feat: add inline delete and edit-all button to LineItemsTable"
```

---

### Task 3: Wire Up State and Modal in ExtractionsContent

**Files:**
- Modify: `src/app/(app)/extractions/page.tsx` — `ExtractionsContent` function

- [ ] **Step 1: Add imports and state**

Add the import at the top of the file (after other component imports):

```typescript
import { LineItemEditorModal, type LineItemEdit } from "@/components/line-item-editor-modal";
```

Inside `ExtractionsContent`, after the existing state declarations (after line ~289 `const [comparingDuplicate, ...]`), add:

```typescript
const [lineItemModalOpen, setLineItemModalOpen] = useState(false);
const [editedLineItems, setEditedLineItems] = useState<LineItemEdit[] | null>(null);
```

- [ ] **Step 2: Add helper functions for line item operations**

After the `hasEdits` declaration, add:

```typescript
const lineItemsEdited = editedLineItems !== null;
const displayLineItems = editedLineItems
  ? editedLineItems.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
      discount: i.discount,
      total: i.total,
    }))
  : lineItems;
```

Update the `hasEdits` line to include line item changes:

```typescript
const hasEdits = Object.keys(editValues).length > 0 || lineItemsEdited;
```

Add the line item action handlers:

```typescript
function normalizeToLineItemEdit(item: any): LineItemEdit {
  return {
    id: crypto.randomUUID(),
    description: typeof item === "string" ? item : item?.description || item?.name || "",
    quantity: Number(item?.quantity ?? item?.qty ?? 1) || 1,
    unit_price: Number(item?.unit_price ?? item?.price ?? 0) || 0,
    discount: Number(item?.discount ?? 0) || 0,
    total: Number(item?.total ?? item?.amount ?? 0) || 0,
    isManualTotal: true, // preserve OCR totals as manual
  };
}

function handleEditAllLineItems() {
  const source = editedLineItems ?? lineItems;
  setLineItemModalOpen(true);
}

function handleSaveLineItems(items: LineItemEdit[]) {
  setEditedLineItems(items);
  setLineItemModalOpen(false);
}

function handleDeleteLineItem(index: number) {
  const source = editedLineItems ?? lineItems.map(normalizeToLineItemEdit);
  setEditedLineItems(source.filter((_, i) => i !== index));
}
```

- [ ] **Step 3: Update LineItemsTable usage**

Find the `<LineItemsTable items={lineItems} currency={currency} />` call (around line 1025) and replace with:

```typescript
<LineItemsTable
  items={displayLineItems}
  currency={currency}
  editable={canEdit}
  onDelete={handleDeleteLineItem}
  onEditAll={handleEditAllLineItems}
/>
```

- [ ] **Step 4: Add the modal render**

Right before the `<DuplicateCompareModal` render (around line 1040), add:

```typescript
<LineItemEditorModal
  open={lineItemModalOpen}
  items={
    editedLineItems ??
    lineItems.map(normalizeToLineItemEdit)
  }
  currency={currency}
  onSave={handleSaveLineItems}
  onClose={() => setLineItemModalOpen(false)}
/>
```

- [ ] **Step 5: Update saveDraft to include line items**

In the `saveDraft()` function, after the amounts update block (after the `if ("subtotal" in editValues ...)` block, around line 416), add:

```typescript
if (editedLineItems) {
  updatedOcrRaw.line_items = editedLineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount: item.discount,
    total: item.total,
  }));
}
```

Also update the reset after successful save. Find `setEditValues({})` in the success path (around line 450) and add after it:

```typescript
setEditedLineItems(null);
```

- [ ] **Step 6: Verify full compilation**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/extractions/page.tsx
git commit -m "feat: wire up line item editor modal and inline delete in extraction page"
```

---

### Task 4: Manual Testing and Polish

**Files:**
- Possibly modify: `src/components/line-item-editor-modal.tsx`, `src/app/(app)/extractions/page.tsx`

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test the following scenarios**

Open a document in editable status (ACTION_REQUIRED, DRAFT) on the extraction page:

1. **Line items display:** Verify items show with trash icons and "Edit All" button
2. **Inline delete:** Click trash icon — item disappears, "Save" button activates
3. **Edit All modal:** Click "Edit All" — modal opens with all items as cards
4. **Edit item:** Change description, qty, price — total auto-calculates
5. **Manual total:** Edit total field directly — "(auto)" label disappears
6. **Clear total:** Clear the total field — auto-calc resumes
7. **Add item:** Click "+ Add Line Item" — blank card appears
8. **Remove in modal:** Click "Remove" on a card — card disappears
9. **Save All:** Click "Save All" — modal closes, table updates with changes
10. **Save draft:** Click the page "Save" button — changes persist to API
11. **Non-editable status:** Open an APPROVED document — no trash icons, no "Edit All" button
12. **Empty line items:** Open a document with no line items — shows "No line items extracted" + "Add line items" link

- [ ] **Step 3: Fix any issues found during testing**

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: polish line item editor after manual testing"
```
