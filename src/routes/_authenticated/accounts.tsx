import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, Trash2, BookOpen, NotebookPen, Scale, Library, Search, X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/accounts")({
  component: AccountsPage,
  head: () => ({ meta: [{ title: "Accounts — JEC" }] }),
});

const ACCOUNT_TYPES = [
  { key: "asset", label: "Asset", side: "debit" as const, tone: "bg-blue-50 text-blue-700 border-blue-100" },
  { key: "liability", label: "Liability", side: "credit" as const, tone: "bg-rose-50 text-rose-700 border-rose-100" },
  { key: "equity", label: "Equity", side: "credit" as const, tone: "bg-violet-50 text-violet-700 border-violet-100" },
  { key: "income", label: "Income", side: "credit" as const, tone: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  { key: "expense", label: "Expense", side: "debit" as const, tone: "bg-amber-50 text-amber-700 border-amber-100" },
];

function kes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n || 0);
}
function tone(t: string) {
  return ACCOUNT_TYPES.find((x) => x.key === t)?.tone ?? "bg-secondary text-muted-foreground";
}

function AccountsPage() {
  const { roles } = useAuth();
  const canManage = roles.length === 0 ? true : roles.includes("admin") || roles.includes("finance");

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Chart of accounts, journal entries, general ledger and trial balance"
      />
      {!canManage && (
        <Card className="p-4 mb-4 text-sm text-muted-foreground">
          Read-only view — only Admin and Finance can post journal entries.
        </Card>
      )}
      <Tabs defaultValue="coa">
        <TabsList className="mb-4">
          <TabsTrigger value="coa"><Library className="size-4 mr-1.5" /> Chart of accounts</TabsTrigger>
          <TabsTrigger value="journal"><NotebookPen className="size-4 mr-1.5" /> Journal entries</TabsTrigger>
          <TabsTrigger value="ledger"><BookOpen className="size-4 mr-1.5" /> General ledger</TabsTrigger>
          <TabsTrigger value="trial"><Scale className="size-4 mr-1.5" /> Trial balance</TabsTrigger>
        </TabsList>
        <TabsContent value="coa"><ChartOfAccountsTab canManage={canManage} /></TabsContent>
        <TabsContent value="journal"><JournalTab canManage={canManage} /></TabsContent>
        <TabsContent value="ledger"><LedgerTab /></TabsContent>
        <TabsContent value="trial"><TrialBalanceTab /></TabsContent>
      </Tabs>
    </>
  );
}

/* ------------------------- shared queries ------------------------- */
function useAccounts() {
  return useQuery({
    queryKey: ["coa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useLines() {
  return useQuery({
    queryKey: ["journal-lines-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_lines")
        .select("id, account_id, debit, credit, line_memo, entry_id, journal_entries:entry_id (entry_no, entry_date, memo, reference, posted)")
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* =========================== CHART OF ACCOUNTS =========================== */
function ChartOfAccountsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const accountsQ = useAccounts();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: accountsQ.data?.length ?? 0 };
    ACCOUNT_TYPES.forEach((t) => { c[t.key] = (accountsQ.data ?? []).filter((a: any) => a.account_type === t.key).length; });
    return c;
  }, [accountsQ.data]);

  const filtered = useMemo(() => {
    let rows = accountsQ.data ?? [];
    if (typeFilter !== "all") rows = rows.filter((a: any) => a.account_type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((a: any) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
    }
    return rows;
  }, [accountsQ.data, search, typeFilter]);

  const toggleActive = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await supabase.from("chart_of_accounts").update({ active: !row.active }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["coa"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chart_of_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Account deleted"); qc.invalidateQueries({ queryKey: ["coa"] }); },
    onError: (e: any) => toast.error(e.message ?? "Cannot delete — account may be referenced by journal entries"),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatPill label="All accounts" value={counts.all} active={typeFilter === "all"} onClick={() => setTypeFilter("all")} />
        {ACCOUNT_TYPES.map((t) => (
          <StatPill key={t.key} label={t.label} value={counts[t.key] ?? 0} active={typeFilter === t.key} onClick={() => setTypeFilter(t.key)} />
        ))}
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9 w-72" placeholder="Search by code or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {canManage && <NewAccountDialog onDone={() => qc.invalidateQueries({ queryKey: ["coa"] })} />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Code</th>
                <th className="text-left px-5 py-3 font-medium">Name</th>
                <th className="text-left px-5 py-3 font-medium">Type</th>
                <th className="text-left px-5 py-3 font-medium">Normal</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {accountsQ.isLoading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!accountsQ.isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No accounts.</td></tr>
              )}
              {filtered.map((a: any) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3 font-mono text-xs">{a.code}</td>
                  <td className="px-5 py-3 font-medium">
                    {a.name}
                    {a.description && <p className="text-xs text-muted-foreground font-normal">{a.description}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${tone(a.account_type)}`}>
                      {a.account_type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground">{a.normal_side}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest ${a.active ? "bg-emerald-100 text-emerald-800" : "bg-secondary text-muted-foreground"}`}>
                      {a.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {canManage && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive.mutate(a)}>
                          {a.active ? "Disable" : "Enable"}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700"
                          onClick={() => { if (confirm(`Delete ${a.code} ${a.name}?`)) remove.mutate(a.id); }}>
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatPill({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition-colors ${active ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/30"}`}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="text-2xl font-display font-bold mt-0.5">{value}</p>
    </button>
  );
}

function NewAccountDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", account_type: "asset", normal_side: "debit", description: "" });

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("chart_of_accounts").insert(form as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Account created"); setOpen(false); setForm({ code: "", name: "", account_type: "asset", normal_side: "debit", description: "" }); onDone(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New account</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New account</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="6000" /></div>
          <div>
            <Label>Type</Label>
            <Select value={form.account_type} onValueChange={(v) => {
              const def = ACCOUNT_TYPES.find((t) => t.key === v)!;
              setForm({ ...form, account_type: v, normal_side: def.side });
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Marketing & Advertising" /></div>
          <div>
            <Label>Normal balance</Label>
            <Select value={form.normal_side} onValueChange={(v) => setForm({ ...form, normal_side: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="debit">Debit</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!form.code || !form.name || m.isPending}>
            {m.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================== JOURNAL =========================== */
function JournalTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const entriesQ = useQuery({
    queryKey: ["journal-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("id, entry_no, entry_date, memo, reference, posted, created_at, journal_lines(debit, credit, account_id, line_memo, chart_of_accounts:account_id (code, name))")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const e = entriesQ.data ?? [];
    const dr = e.reduce((s, x: any) => s + (x.journal_lines ?? []).reduce((a: number, l: any) => a + Number(l.debit), 0), 0);
    return { count: e.length, dr };
  }, [entriesQ.data]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Entries</p>
          <p className="text-3xl font-display font-bold mt-1">{totals.count}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total posted (debits)</p>
          <p className="text-3xl font-display font-bold mt-1 text-brand-navy">{kes(totals.dr)}</p>
        </Card>
        <Card className="p-5 flex items-center justify-end">
          {canManage && <NewJournalDialog onDone={() => qc.invalidateQueries({ queryKey: ["journal-entries"] })} />}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-display font-bold text-sm">Recent journal entries</h3>
        </div>
        {entriesQ.isLoading && <p className="p-6 text-sm text-muted-foreground">Loading…</p>}
        {entriesQ.data?.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No entries yet. Create your first journal entry.</p>}
        <ul className="divide-y divide-border">
          {entriesQ.data?.map((e: any) => {
            const dr = (e.journal_lines ?? []).reduce((a: number, l: any) => a + Number(l.debit), 0);
            return (
              <li key={e.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-bold">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{e.entry_no}</span>
                      {e.memo || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.entry_date).toLocaleDateString()} {e.reference ? `· Ref ${e.reference}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{kes(dr)}</p>
                    <p className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold">{e.posted ? "Posted" : "Draft"}</p>
                  </div>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="text-left py-1 font-medium">Account</th>
                        <th className="text-right py-1 font-medium w-28">Debit</th>
                        <th className="text-right py-1 font-medium w-28">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(e.journal_lines ?? []).map((l: any, i: number) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="py-1.5">
                            <span className="font-mono text-[11px] text-muted-foreground mr-2">{l.chart_of_accounts?.code}</span>
                            {l.chart_of_accounts?.name}
                            {l.line_memo && <span className="text-muted-foreground"> · {l.line_memo}</span>}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{Number(l.debit) ? kes(Number(l.debit)) : ""}</td>
                          <td className="py-1.5 text-right tabular-nums">{Number(l.credit) ? kes(Number(l.credit)) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function NewJournalDialog({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const accountsQ = useAccounts();
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState({ entry_date: new Date().toISOString().slice(0, 10), memo: "", reference: "" });
  const [lines, setLines] = useState<Array<{ account_id: string; debit: string; credit: string; line_memo: string }>>([
    { account_id: "", debit: "", credit: "", line_memo: "" },
    { account_id: "", debit: "", credit: "", line_memo: "" },
  ]);

  const totalDr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDr > 0 && totalDr === totalCr;

  const setLine = (i: number, patch: Partial<typeof lines[number]>) =>
    setLines((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((arr) => [...arr, { account_id: "", debit: "", credit: "", line_memo: "" }]);
  const removeLine = (i: number) => setLines((arr) => arr.filter((_, idx) => idx !== i));

  const m = useMutation({
    mutationFn: async () => {
      const entry_no = `JE-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000 + 100000)}`;
      const { data: created, error } = await supabase
        .from("journal_entries")
        .insert({ ...entry, entry_no, created_by: user?.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      const rows = lines
        .filter((l) => l.account_id && (Number(l.debit) || Number(l.credit)))
        .map((l, i) => ({
          entry_id: created.id,
          account_id: l.account_id,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          line_memo: l.line_memo || null,
          position: i,
        }));
      const { error: lerr } = await supabase.from("journal_lines").insert(rows);
      if (lerr) {
        // rollback: trigger likely fired, so the entry is bad — delete it
        await supabase.from("journal_entries").delete().eq("id", created.id);
        throw lerr;
      }
    },
    onSuccess: () => {
      toast.success("Journal entry posted");
      setOpen(false);
      setEntry({ entry_date: new Date().toISOString().slice(0, 10), memo: "", reference: "" });
      setLines([{ account_id: "", debit: "", credit: "", line_memo: "" }, { account_id: "", debit: "", credit: "", line_memo: "" }]);
      onDone();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to post"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New journal entry</Button></DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>New journal entry</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Date</Label><Input type="date" value={entry.entry_date} onChange={(e) => setEntry({ ...entry, entry_date: e.target.value })} /></div>
          <div className="col-span-2"><Label>Memo</Label><Input value={entry.memo} onChange={(e) => setEntry({ ...entry, memo: e.target.value })} placeholder="e.g. Bank deposit of M-Pesa float" /></div>
          <div className="col-span-3"><Label>Reference</Label><Input value={entry.reference} onChange={(e) => setEntry({ ...entry, reference: e.target.value })} placeholder="Optional · invoice no, slip no" /></div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <Label>Lines</Label>
            <Button size="sm" variant="outline" onClick={addLine}><Plus className="size-3.5 mr-1" /> Add line</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-2 font-medium">Account</th>
                  <th className="text-left p-2 font-medium">Memo</th>
                  <th className="text-right p-2 font-medium w-32">Debit</th>
                  <th className="text-right p-2 font-medium w-32">Credit</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2">
                      <Select value={l.account_id} onValueChange={(v) => setLine(i, { account_id: v })}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                          {accountsQ.data?.filter((a: any) => a.active).map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2"><Input className="h-9" value={l.line_memo} onChange={(e) => setLine(i, { line_memo: e.target.value })} /></td>
                    <td className="p-2"><Input className="h-9 text-right tabular-nums" type="number" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} /></td>
                    <td className="p-2"><Input className="h-9 text-right tabular-nums" type="number" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} /></td>
                    <td className="p-2">
                      <Button size="icon" variant="ghost" onClick={() => removeLine(i)} disabled={lines.length <= 2}>
                        <X className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="p-2 text-right" colSpan={2}>Totals</td>
                  <td className="p-2 text-right tabular-nums">{kes(totalDr)}</td>
                  <td className="p-2 text-right tabular-nums">{kes(totalCr)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <p className={`text-xs mt-2 ${balanced ? "text-emerald-600" : "text-amber-600"}`}>
            {balanced ? "✓ Entry is balanced" : `Difference: ${kes(Math.abs(totalDr - totalCr))} — debits must equal credits`}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!balanced || m.isPending}>
            {m.isPending ? "Posting…" : "Post entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================== GENERAL LEDGER =========================== */
function LedgerTab() {
  const accountsQ = useAccounts();
  const linesQ = useLines();
  const [accountId, setAccountId] = useState<string>("");

  const account = accountsQ.data?.find((a: any) => a.id === accountId);
  const rows = useMemo(() => {
    if (!accountId) return [];
    return (linesQ.data ?? [])
      .filter((l: any) => l.account_id === accountId)
      .sort((a: any, b: any) =>
        new Date(a.journal_entries?.entry_date ?? 0).getTime() -
        new Date(b.journal_entries?.entry_date ?? 0).getTime()
      );
  }, [linesQ.data, accountId]);

  let running = 0;
  const sign = account?.normal_side === "credit" ? -1 : 1;

  return (
    <Card className="p-5">
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <div className="max-w-md w-full">
          <Label className="mb-1.5 block">Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Pick an account to view its ledger" /></SelectTrigger>
            <SelectContent>
              {accountsQ.data?.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {account && (
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Normal balance</p>
            <p className="text-sm font-bold capitalize">{account.normal_side}</p>
          </div>
        )}
      </div>

      {!accountId ? (
        <p className="p-8 text-center text-sm text-muted-foreground">Select an account above to see its transactions.</p>
      ) : rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">No transactions for {account?.name} yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Entry</th>
                <th className="text-left px-3 py-2 font-medium">Memo</th>
                <th className="text-right px-3 py-2 font-medium w-28">Debit</th>
                <th className="text-right px-3 py-2 font-medium w-28">Credit</th>
                <th className="text-right px-3 py-2 font-medium w-32">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((l: any) => {
                running += sign * (Number(l.debit) - Number(l.credit));
                return (
                  <tr key={l.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(l.journal_entries?.entry_date).toLocaleDateString()}</td>
                    <td className="px-3 py-2 font-mono text-xs">{l.journal_entries?.entry_no}</td>
                    <td className="px-3 py-2">{l.line_memo || l.journal_entries?.memo || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(l.debit) ? kes(Number(l.debit)) : ""}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(l.credit) ? kes(Number(l.credit)) : ""}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{kes(running)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* =========================== TRIAL BALANCE =========================== */
function TrialBalanceTab() {
  const accountsQ = useAccounts();
  const linesQ = useLines();

  const rows = useMemo(() => {
    const byAcc: Record<string, { dr: number; cr: number }> = {};
    (linesQ.data ?? []).forEach((l: any) => {
      byAcc[l.account_id] ??= { dr: 0, cr: 0 };
      byAcc[l.account_id].dr += Number(l.debit);
      byAcc[l.account_id].cr += Number(l.credit);
    });
    return (accountsQ.data ?? [])
      .map((a: any) => {
        const v = byAcc[a.id] ?? { dr: 0, cr: 0 };
        const net = v.dr - v.cr;
        const onSide = a.normal_side === "debit" ? net : -net;
        return {
          ...a,
          dr_total: v.dr,
          cr_total: v.cr,
          balance_dr: onSide >= 0 && a.normal_side === "debit" ? Math.abs(onSide) : (a.normal_side === "credit" && onSide < 0 ? Math.abs(onSide) : 0),
          balance_cr: onSide >= 0 && a.normal_side === "credit" ? Math.abs(onSide) : (a.normal_side === "debit" && onSide < 0 ? Math.abs(onSide) : 0),
        };
      })
      .filter((r) => r.dr_total || r.cr_total);
  }, [accountsQ.data, linesQ.data]);

  const totDr = rows.reduce((s, r) => s + r.balance_dr, 0);
  const totCr = rows.reduce((s, r) => s + r.balance_cr, 0);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-bold">Trial balance</h3>
          <p className="text-xs text-muted-foreground">All posted balances, grouped by account.</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded font-semibold ${Math.round(totDr) === Math.round(totCr) ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
          {Math.round(totDr) === Math.round(totCr) ? "Balanced" : `Off by ${kes(Math.abs(totDr - totCr))}`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Code</th>
              <th className="text-left px-3 py-2 font-medium">Account</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-right px-3 py-2 font-medium w-32">Debit</th>
              <th className="text-right px-3 py-2 font-medium w-32">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No posted transactions yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${tone(r.account_type)}`}>
                    {r.account_type}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.balance_dr ? kes(r.balance_dr) : ""}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.balance_cr ? kes(r.balance_cr) : ""}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-muted/30 font-bold">
              <td className="px-3 py-2" colSpan={3}>Totals</td>
              <td className="px-3 py-2 text-right tabular-nums">{kes(totDr)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{kes(totCr)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
