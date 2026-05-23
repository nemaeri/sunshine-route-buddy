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
import { Plus, Trash2, Pencil, Zap, Search, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fee-structure")({
  component: FeeStructurePage,
  head: () => ({ meta: [{ title: "Fee Structure — JEC" }] }),
});

const GRADE_LEVELS = [
  "Play Group", "PP1", "PP2",
  ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`),
];
const GRADE_ORD: Record<string, number> = Object.fromEntries(GRADE_LEVELS.map((g, i) => [g, i]));

// short chip labels
const GRADE_CHIPS: { label: string; value: string }[] = [
  { label: "PP", value: "PP1" }, // shorthand grouping (PP1+PP2 share band typically)
  ...Array.from({ length: 12 }, (_, i) => ({ label: `G${i + 1}`, value: `Grade ${i + 1}` })),
];

type Kind = "common" | "band";
type AppliesTo = "all" | "day" | "boarding" | "lunch";
type FeeItem = {
  id: string;
  term_id: string;
  grade_level: string | null;
  grade_from: string | null;
  grade_to: string | null;
  kind: Kind;
  applies_to: AppliesTo;
  item_name: string;
  amount: number;
};
type Term = { id: string; academic_year: number; term_number: number; is_current: boolean };

function FeeStructurePage() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("finance");
  const qc = useQueryClient();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set()); // empty = all
  const [kindFilter, setKindFilter] = useState<Set<Kind>>(new Set(["common", "band"]));
  const [search, setSearch] = useState("");
  const [applyTermId, setApplyTermId] = useState<string>("");

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

  const yearTerms = useMemo(
    () => (termsQ.data ?? []).filter((t) => t.academic_year === year)
      .sort((a, b) => b.term_number - a.term_number),
    [termsQ.data, year]
  );

  // initialize selectedTerms when year changes
  useEffect(() => {
    setSelectedTerms(new Set(yearTerms.map((t) => t.id)));
    if (yearTerms.length && !yearTerms.find((t) => t.id === applyTermId)) {
      const current = yearTerms.find((t) => t.is_current) ?? yearTerms[0];
      setApplyTermId(current.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, termsQ.data]);

  const termIds = yearTerms.map((t) => t.id);

  const itemsQ = useQuery({
    enabled: termIds.length > 0,
    queryKey: ["fee_items_year", year, termIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_items")
        .select("id, term_id, grade_level, grade_from, grade_to, kind, applies_to, item_name, amount")
        .in("term_id", termIds);
      if (error) throw error;
      return (data ?? []) as FeeItem[];
    },
  });

  const allItems = itemsQ.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((it) => {
      if (!selectedTerms.has(it.term_id)) return false;
      if (!kindFilter.has(it.kind)) return false;
      // grade filter
      if (selectedGrades.size > 0) {
        if (it.kind === "common") {
          // common lines always pass grade filter (per UX note)
        } else {
          const from = GRADE_ORD[it.grade_from ?? ""] ?? 0;
          const to = GRADE_ORD[it.grade_to ?? ""] ?? GRADE_LEVELS.length - 1;
          const matches = [...selectedGrades].some((g) => {
            const o = GRADE_ORD[g];
            return o >= from && o <= to;
          });
          if (!matches) return false;
        }
      }
      if (q) {
        const hay = [it.item_name, it.kind, it.applies_to, it.grade_from, it.grade_to, String(it.amount)]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allItems, selectedTerms, selectedGrades, kindFilter, search]);

  const byTerm = useMemo(() => {
    const map = new Map<string, FeeItem[]>();
    filtered.forEach((it) => {
      const arr = map.get(it.term_id) ?? [];
      arr.push(it);
      map.set(it.term_id, arr);
    });
    return yearTerms.filter((t) => map.has(t.id)).map((t) => [t, map.get(t.id)!] as const);
  }, [filtered, yearTerms]);

  const projectedTotal = filtered.reduce((s, i) => s + Number(i.amount ?? 0), 0);

  // Pupil counts (active students)
  const pupilsQ = useQuery({
    queryKey: ["pupils_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fee_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Line deleted");
      qc.invalidateQueries({ queryKey: ["fee_items_year"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  // Apply charges → generate/update invoices for the chosen term
  const apply = useMutation({
    mutationFn: async () => {
      if (!applyTermId) throw new Error("Pick a term");
      const [studentsRes, classesRes, itemsRes, invoicesRes, paymentsRes] = await Promise.all([
        supabase.from("students").select("id, class_id, boarding, lunch").eq("active", true),
        supabase.from("classes").select("id, grade_level"),
        supabase.from("fee_items").select("*").eq("term_id", applyTermId),
        supabase.from("invoices").select("id, student_id, term_id").eq("term_id", applyTermId),
        supabase.from("payments").select("invoice_id, amount"),
      ]);
      for (const r of [studentsRes, classesRes, itemsRes, invoicesRes, paymentsRes]) {
        if (r.error) throw r.error;
      }
      const classMap = new Map<string, string>(
        (classesRes.data ?? []).map((c: any) => [c.id, c.grade_level])
      );
      const items = (itemsRes.data ?? []) as FeeItem[];
      const existingInv = new Map<string, string>(
        (invoicesRes.data ?? []).map((i: any) => [i.student_id, i.id])
      );
      const paidByInvoice = new Map<string, number>();
      (paymentsRes.data ?? []).forEach((p: any) => {
        paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0));
      });

      const toInsert: any[] = [];
      const toUpdate: { id: string; total: number; balance: number }[] = [];
      let touched = 0;

      for (const s of (studentsRes.data ?? []) as any[]) {
        const grade = s.class_id ? classMap.get(s.class_id) : null;
        if (!grade) continue;
        const gO = GRADE_ORD[grade];
        if (gO == null) continue;
        let total = 0;
        for (const it of items) {
          // applies_to filter
          if (it.applies_to === "boarding" && !s.boarding) continue;
          if (it.applies_to === "day" && s.boarding) continue;
          if (it.applies_to === "lunch" && !s.lunch) continue;
          if (it.kind === "band") {
            const from = GRADE_ORD[it.grade_from ?? ""];
            const to = GRADE_ORD[it.grade_to ?? ""];
            if (from == null || to == null) continue;
            if (gO < from || gO > to) continue;
          }
          total += Number(it.amount ?? 0);
        }
        const existingId = existingInv.get(s.id);
        if (existingId) {
          const paid = paidByInvoice.get(existingId) ?? 0;
          toUpdate.push({ id: existingId, total, balance: Math.max(0, total - paid) });
        } else {
          toInsert.push({ student_id: s.id, term_id: applyTermId, total_amount: total, balance: total, status: total > 0 ? "pending" : "paid" });
        }
        touched++;
      }

      if (toInsert.length) {
        const { error } = await supabase.from("invoices").insert(toInsert);
        if (error) throw error;
      }
      for (const u of toUpdate) {
        const { error } = await supabase.from("invoices")
          .update({ total_amount: u.total, balance: u.balance, status: u.balance <= 0 ? "paid" : "pending" })
          .eq("id", u.id);
        if (error) throw error;
      }
      return { touched, inserted: toInsert.length, updated: toUpdate.length };
    },
    onSuccess: (r) => {
      toast.success(`Applied to ${r.touched} student(s) · ${r.inserted} new, ${r.updated} updated`);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to apply"),
  });

  const toggle = <T,>(s: Set<T>, v: T) => {
    const next = new Set(s);
    next.has(v) ? next.delete(v) : next.add(v);
    return next;
  };

  return (
    <>
      <PageHeader
        title="Fee Structure"
        description="Cards + filters · Save persists the whole year"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Main */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div>
                <h3 className="font-display font-bold">Configure lines</h3>
                <p className="text-xs text-muted-foreground">
                  Use filters on the right. <b>Save</b> happens per line.
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Label className="text-xs">Year</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value) || currentYear)}
                  className="w-24 h-9"
                />
                {canEdit && (
                  <Button onClick={() => { setEditing(null); setOpen(true); }} size="sm">
                    <Plus className="size-4 mr-1" /> Add line
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-48"
                value={applyTermId}
                onChange={(e) => setApplyTermId(e.target.value)}
              >
                <option value="">Apply charges — pick term</option>
                {yearTerms.map((t) => (
                  <option key={t.id} value={t.id}>
                    Term {t.term_number} · {t.academic_year}{t.is_current ? " (current)" : ""}
                  </option>
                ))}
              </select>
              {canEdit && (
                <Button
                  onClick={() => {
                    if (!applyTermId) return toast.error("Pick a term first");
                    if (!confirm("Generate / update invoices for every active student in this term?")) return;
                    apply.mutate();
                  }}
                  disabled={apply.isPending}
                  size="sm"
                >
                  <Zap className="size-4 mr-1" />
                  {apply.isPending ? "Applying…" : "Apply to students"}
                </Button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search item name, kind, grade band…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Showing {filtered.length} of {allItems.length} line(s)
            </div>
          </Card>

          {itemsQ.isLoading && <Card className="p-8 text-center text-sm text-muted-foreground">Loading…</Card>}

          {!itemsQ.isLoading && byTerm.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No fee lines match. {canEdit && "Click \"Add line\" to start."}
            </Card>
          )}

          {byTerm.map(([term, items]) => (
            <div key={term.id}>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Term {term.term_number}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {items.map((it) => (
                  <LineCard
                    key={it.id}
                    item={it}
                    canEdit={canEdit}
                    onEdit={() => { setEditing(it); setOpen(true); }}
                    onDelete={() => { if (confirm(`Delete "${it.item_name}"?`)) del.mutate(it.id); }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar filters */}
        <Card className="p-4 h-fit lg:sticky lg:top-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Filters</div>
          <div className="text-xs text-muted-foreground mb-3">
            {allItems.length} line(s) · {yearTerms.length} term(s) · Proj <b className="text-foreground">{fmt(projectedTotal)}</b>
            {pupilsQ.data != null && <> · {pupilsQ.data} pupil(s)</>}
          </div>

          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Terms (this year)</div>
            <div className="flex flex-wrap gap-1">
              {yearTerms.map((t) => (
                <Chip key={t.id} active={selectedTerms.has(t.id)} onClick={() => setSelectedTerms(toggle(selectedTerms, t.id))}>
                  Term {t.term_number}
                </Chip>
              ))}
              <Chip onClick={() => setSelectedTerms(new Set(yearTerms.map((t) => t.id)))} muted>All</Chip>
              <Chip onClick={() => setSelectedTerms(new Set())} muted>None</Chip>
            </div>
          </div>

          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Grades</div>
            <div className="text-[10px] text-muted-foreground mb-1">
              {selectedGrades.size === 0 ? "All grades " : `${selectedGrades.size} selected `}
              <span className="opacity-70">— Common lines always pass grade filters.</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <Chip
                active={selectedGrades.size === 0}
                onClick={() => setSelectedGrades(new Set())}
              >
                All grades
              </Chip>
              {GRADE_CHIPS.map((g) => (
                <Chip
                  key={g.value}
                  active={selectedGrades.has(g.value)}
                  onClick={() => setSelectedGrades(toggle(selectedGrades, g.value))}
                >
                  {g.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Line kind</div>
            <div className="flex flex-wrap gap-1">
              <Chip active={kindFilter.has("common")} onClick={() => setKindFilter(toggle(kindFilter, "common"))}>Common</Chip>
              <Chip active={kindFilter.has("band")} onClick={() => setKindFilter(toggle(kindFilter, "band"))}>Grade bands</Chip>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setSelectedTerms(new Set(yearTerms.map((t) => t.id)));
              setSelectedGrades(new Set());
              setKindFilter(new Set(["common", "band"]));
              setSearch("");
            }}
          >
            <RotateCcw className="size-3.5 mr-1" /> Reset filters & search
          </Button>
        </Card>
      </div>

      <FeeItemDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        terms={yearTerms}
        defaultTermId={editing?.term_id ?? yearTerms[0]?.id ?? ""}
        onSaved={() => qc.invalidateQueries({ queryKey: ["fee_items_year"] })}
      />
    </>
  );
}

function Chip({
  children, active, onClick, muted,
}: { children: React.ReactNode; active?: boolean; onClick?: () => void; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-2.5 h-7 rounded-md text-xs border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : muted
            ? "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
            : "bg-background text-foreground border-border hover:bg-muted",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function LineCard({
  item, canEdit, onEdit, onDelete,
}: { item: FeeItem; canEdit: boolean; onEdit: () => void; onDelete: () => void }) {
  const bandLabel = item.kind === "band"
    ? `${shortGrade(item.grade_from)}–${shortGrade(item.grade_to)}`
    : "All classes";
  const appliesLabel = ({
    all: "All pupils",
    day: "Day only",
    boarding: "Boarding",
    lunch: "Lunch opt-in",
  } as const)[item.applies_to] ?? item.applies_to;
  return (
    <Card className="p-3 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <span className={[
          "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-semibold",
          item.kind === "common"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700",
        ].join(" ")}>
          {item.kind === "common" ? "Common" : "Band"}
        </span>
        <span className="font-display font-bold text-base tabular-nums">{Math.round(Number(item.amount)).toLocaleString()}</span>
      </div>
      <div className="mt-2 font-medium text-sm leading-tight">{item.item_name}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {bandLabel} · {appliesLabel}
      </div>
      {canEdit && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs flex-1" onClick={onEdit}>
            <Pencil className="size-3 mr-1" /> Edit
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onDelete}>
            <Trash2 className="size-3.5 text-rose-600" />
          </Button>
        </div>
      )}
    </Card>
  );
}

function shortGrade(g: string | null) {
  if (!g) return "—";
  if (g === "Play Group") return "PG";
  if (g === "PP1" || g === "PP2") return g;
  const m = g.match(/Grade (\d+)/);
  return m ? `G${m[1]}` : g;
}

function fmt(n: number) {
  return `KES ${Math.round(n).toLocaleString()}`;
}

function FeeItemDialog({
  open, onOpenChange, editing, terms, defaultTermId, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  editing: FeeItem | null;
  terms: Term[];
  defaultTermId: string;
  onSaved: () => void;
}) {
  const [termId, setTermId] = useState(defaultTermId);
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<Kind>("common");
  const [appliesTo, setAppliesTo] = useState<AppliesTo>("all");
  const [gradeFrom, setGradeFrom] = useState<string>("PP1");
  const [gradeTo, setGradeTo] = useState<string>("Grade 6");

  useEffect(() => {
    if (open) {
      setTermId(editing?.term_id ?? defaultTermId);
      setItemName(editing?.item_name ?? "");
      setAmount(editing ? String(editing.amount) : "");
      setKind((editing?.kind as Kind) ?? "common");
      setAppliesTo((editing?.applies_to as AppliesTo) ?? "all");
      setGradeFrom(editing?.grade_from ?? "PP1");
      setGradeTo(editing?.grade_to ?? "Grade 6");
    }
  }, [open, editing, defaultTermId]);

  const m = useMutation({
    mutationFn: async () => {
      const payload: any = {
        term_id: termId,
        item_name: itemName,
        amount: Number(amount) || 0,
        kind,
        applies_to: appliesTo,
        grade_from: kind === "band" ? gradeFrom : null,
        grade_to: kind === "band" ? gradeTo : null,
        grade_level: kind === "band" ? gradeFrom : null, // legacy field
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
      toast.success(editing ? "Line updated" : "Line added");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const valid = !!termId && !!itemName && !!amount && (kind === "common" || (gradeFrom && gradeTo));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit fee line" : "Add fee line"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Term</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>Term {t.term_number} · {t.academic_year}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Kind</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
              >
                <option value="common">Common (all pupils)</option>
                <option value="band">Grade band</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Item name</Label>
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Tuition" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Applies to</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={appliesTo}
                onChange={(e) => setAppliesTo(e.target.value as AppliesTo)}
              >
                <option value="all">All pupils</option>
                <option value="day">Day only</option>
                <option value="boarding">Boarding only</option>
                <option value="lunch">Lunch opt-in only</option>
              </select>
            </div>
          </div>

          {kind === "band" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Grade from</Label>
                <select
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={gradeFrom}
                  onChange={(e) => setGradeFrom(e.target.value)}
                >
                  {GRADE_LEVELS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <Label>Grade to</Label>
                <select
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={gradeTo}
                  onChange={(e) => setGradeTo(e.target.value)}
                >
                  {GRADE_LEVELS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!valid || m.isPending}>
            {m.isPending ? "Saving…" : editing ? "Save changes" : "Add line"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
