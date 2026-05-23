import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Pencil, Banknote, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fee-structure")({
  component: FeeStructurePage,
  head: () => ({ meta: [{ title: "Fee Structure — JEC" }] }),
});

const GRADE_LEVELS = [
  "Pre-primary (PP)",
  ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`),
];

type FeeItem = { id: string; term_id: string; grade_level: string; item_name: string; amount: number };
type Term = { id: string; academic_year: number; term_number: number; is_current: boolean };

function FeeStructurePage() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("finance");
  const qc = useQueryClient();

  const [termId, setTermId] = useState<string>("");
  const [grade, setGrade] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FeeItem | null>(null);

  const termsQ = useQuery({
    queryKey: ["terms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terms")
        .select("id, academic_year, term_number, is_current")
        .order("academic_year", { ascending: false })
        .order("term_number", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Term[];
    },
  });

  useEffect(() => {
    if (!termId && termsQ.data?.length) {
      const current = termsQ.data.find((t) => t.is_current) ?? termsQ.data[0];
      setTermId(current.id);
    }
  }, [termsQ.data, termId]);

  const itemsQ = useQuery({
    enabled: !!termId,
    queryKey: ["fee_items", termId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_items")
        .select("id, term_id, grade_level, item_name, amount")
        .eq("term_id", termId)
        .order("grade_level")
        .order("item_name");
      if (error) throw error;
      return (data ?? []) as FeeItem[];
    },
  });

  const filtered = useMemo(
    () => (itemsQ.data ?? []).filter((i) => grade === "all" || i.grade_level === grade),
    [itemsQ.data, grade]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, FeeItem[]>();
    filtered.forEach((it) => {
      const arr = map.get(it.grade_level) ?? [];
      arr.push(it);
      map.set(it.grade_level, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const totalAll = filtered.reduce((s, i) => s + Number(i.amount ?? 0), 0);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fee_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item deleted");
      qc.invalidateQueries({ queryKey: ["fee_items", termId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <>
      <PageHeader
        title="Fee Structure"
        description="Define fee items per grade and term"
        actions={
          canEdit && termId ? (
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="size-4 mr-1" /> Add fee item
            </Button>
          ) : null
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48">
            <Label className="text-xs">Term</Label>
            <select
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
            >
              {termsQ.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  Term {t.term_number} · {t.academic_year}{t.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-48">
            <Label className="text-xs">Grade level</Label>
            <select
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="all">All grades</option>
              {GRADE_LEVELS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="ml-auto flex gap-3">
            <div className="rounded-lg bg-emerald-50 text-emerald-700 px-4 py-2 flex items-center gap-2">
              <Banknote className="size-4" />
              <div>
                <div className="text-[10px] uppercase tracking-wider opacity-70">Total in view</div>
                <div className="font-display font-bold">{fmt(totalAll)}</div>
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 text-blue-700 px-4 py-2 flex items-center gap-2">
              <Wallet className="size-4" />
              <div>
                <div className="text-[10px] uppercase tracking-wider opacity-70">Items</div>
                <div className="font-display font-bold">{filtered.length}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {itemsQ.isLoading && <Card className="p-8 text-center text-muted-foreground text-sm">Loading…</Card>}
      {!itemsQ.isLoading && grouped.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No fee items for this selection. {canEdit && "Click \"Add fee item\" to start."}
        </Card>
      )}

      <div className="space-y-4">
        {grouped.map(([g, items]) => {
          const subtotal = items.reduce((s, i) => s + Number(i.amount ?? 0), 0);
          return (
            <Card key={g} className="overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
                <h3 className="font-display font-bold text-sm">{g}</h3>
                <span className="text-xs text-muted-foreground">Subtotal: <span className="font-bold text-foreground">{fmt(subtotal)}</span></span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left font-medium px-5 py-2">Item</th>
                    <th className="text-right font-medium px-5 py-2">Amount</th>
                    {canEdit && <th className="px-5 py-2 w-24" />}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-5 py-3">{it.item_name}</td>
                      <td className="px-5 py-3 text-right font-medium">{fmt(Number(it.amount))}</td>
                      {canEdit && (
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => { setEditing(it); setOpen(true); }}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${it.item_name}?`)) del.mutate(it.id); }}>
                              <Trash2 className="size-3.5 text-rose-600" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          );
        })}
      </div>

      <FeeItemDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        defaultTermId={termId}
        defaultGrade={grade !== "all" ? grade : GRADE_LEVELS[0]}
        onSaved={() => qc.invalidateQueries({ queryKey: ["fee_items", termId] })}
      />
    </>
  );
}

function fmt(n: number) {
  return `KES ${Math.round(n).toLocaleString()}`;
}

function FeeItemDialog({
  open, onOpenChange, editing, defaultTermId, defaultGrade, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  editing: FeeItem | null;
  defaultTermId: string; defaultGrade: string;
  onSaved: () => void;
}) {
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [grade, setGrade] = useState(defaultGrade);

  useEffect(() => {
    if (open) {
      setItemName(editing?.item_name ?? "");
      setAmount(editing ? String(editing.amount) : "");
      setGrade(editing?.grade_level ?? defaultGrade);
    }
  }, [open, editing, defaultGrade]);

  const m = useMutation({
    mutationFn: async () => {
      const payload = {
        term_id: defaultTermId,
        grade_level: grade,
        item_name: itemName,
        amount: Number(amount) || 0,
      };
      if (editing) {
        const { error } = await supabase.from("fee_items").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fee_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Item updated" : "Item added");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit fee item" : "Add fee item"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Grade level</Label>
            <select
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              {GRADE_LEVELS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <Label>Item name</Label>
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Tuition" />
          </div>
          <div>
            <Label>Amount (KES)</Label>
            <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!itemName || !amount || !grade || m.isPending}>
            {m.isPending ? "Saving…" : editing ? "Save changes" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
