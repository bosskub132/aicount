"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

function calcTotal(qty: number, price: number, discount: number): number {
  return Math.round((qty * price - discount) * 100) / 100;
}

function createBlankItem(): LineItemEdit {
  return {
    id: crypto.randomUUID(),
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
      <span className="text-sm font-medium text-[var(--card-foreground)] tabular-nums">
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
