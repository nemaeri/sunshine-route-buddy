import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Upload, Download, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/all-payments")({
  component: AllPaymentsPage,
  head: () => ({ meta: [{ title: "Payment tracker — JEC" }] }),
});

function kes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n || 0);
}

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function startOfWeek(d: Date) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }

function receiptNo(p: { paid_on: string; created_at: string; id: string }) {
  const y = new Date(p.paid_on || p.created_at).getFullYear();
  // last 6 chars of uuid, hex → number, mod 999999
  const tail = p.id.replace(/-/g, "").slice(-6);
  const n = (parseInt(tail, 16) % 999999).toString().padStart(6, "0");
  return `RCT-${y}-${n}`;
}

function AllPaymentsPage() {
  const { roles, user } = useAuth();
  const canManage = roles.includes("admin") || roles.includes("finance");
  const [receiptId, setReceiptId] = useState<string | null>(null);

  // Default date range: this month
  const today = new Date();
  const [from, setFrom] = useState(ymd(startOfMonth(today)));
  const [to, setTo] = useState(ymd(today));
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedCat, setAppliedCat] = useState("");

  const paymentsQ = useQuery({
    queryKey: ["all-payments"],
    queryFn: async () => {
      const p = await supabase
        .from("payments")
        .select("id, amount, method, reference, paid_on, created_at, invoice_id")
        .order("paid_on", { ascending: false })
        .limit(1000);
      if (p.error) throw p.error;
      const invIds = Array.from(new Set((p.data ?? []).map((x) => x.invoice_id)));
      if (!invIds.length) return [];
      const inv = await supabase.from("invoices").select("id, student_id, term_id, notes").in("id", invIds);
      const sIds = Array.from(new Set((inv.data ?? []).map((i) => i.student_id)));
      const tIds = Array.from(new Set((inv.data ?? []).map((i) => i.term_id)));
      const [st, te] = await Promise.all([
        sIds.length ? supabase.from("students").select("id, first_name, last_name, admission_no").in("id", sIds) : Promise.resolve({ data: [] as any[] }),
        tIds.length ? supabase.from("terms").select("id, academic_year, term_number").in("id", tIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const im = new Map((inv.data ?? []).map((x: any) => [x.id, x]));
      const sm = new Map((st.data ?? []).map((x: any) => [x.id, x]));
      const tm = new Map((te.data ?? []).map((x: any) => [x.id, x]));
      return (p.data ?? []).map((x: any) => {
        const i = im.get(x.invoice_id);
        return {
          ...x,
          student: i ? sm.get(i.student_id) : null,
          term: i ? tm.get(i.term_id) : null,
          category: (i?.notes as string) || "—",
        };
      });
    },
  });

  const all = paymentsQ.data ?? [];

  const feeCategoriesQ = useQuery({
    queryKey: ["fee-categories"],
    queryFn: async () => {
      const r = await supabase.from("fee_items").select("name").order("name");
      if (r.error) throw r.error;
      return Array.from(new Set((r.data ?? []).map((x: any) => x.name as string))).sort();
    },
  });

  const categories = useMemo(() => {
    const s = new Set<string>(feeCategoriesQ.data ?? []);
    all.forEach((p: any) => { if (p.category && p.category !== "—") s.add(p.category); });
    return Array.from(s).sort();
  }, [all, feeCategoriesQ.data]);

  // Cards — always over ALL payments (not filtered)
  const cards = useMemo(() => {
    const tStr = ymd(today);
    const wStr = ymd(startOfWeek(today));
    const mStr = ymd(startOfMonth(today));
    const sum = (pred: (p: any) => boolean) => all.filter(pred).reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
    return {
      today: sum((p) => p.paid_on === tStr),
      week: sum((p) => p.paid_on >= wStr),
      month: sum((p) => p.paid_on >= mStr),
      mpesa: sum((p) => p.paid_on >= mStr && p.method === "mpesa"),
      bank: sum((p) => p.paid_on >= mStr && p.method === "bank"),
      cash: sum((p) => p.paid_on >= mStr && (p.method === "cash" || p.method === "adjustment")),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  // Filtered table
  const rows = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    return all.filter((p: any) => {
      if (p.paid_on < appliedFrom || p.paid_on > appliedTo) return false;
      if (appliedCat && p.category !== appliedCat) return false;
      if (q) {
        const name = `${p.student?.first_name ?? ""} ${p.student?.last_name ?? ""}`.toLowerCase();
        const adm = (p.student?.admission_no ?? "").toLowerCase();
        const ref = (p.reference ?? "").toLowerCase();
        const rcpt = receiptNo(p).toLowerCase();
        if (!name.includes(q) && !adm.includes(q) && !ref.includes(q) && !rcpt.includes(q)) return false;
      }
      return true;
    });
  }, [all, appliedFrom, appliedTo, appliedSearch, appliedCat]);

  const apply = () => { setAppliedFrom(from); setAppliedTo(to); setAppliedSearch(search); setAppliedCat(category); };

  const exportCsv = () => {
    const header = ["date", "receipt", "student", "admission_no", "category", "amount", "method", "reference"];
    const lines = [header.join(",")].concat(
      rows.map((p: any) => [
        p.paid_on,
        receiptNo(p),
        p.student ? `${p.student.first_name} ${p.student.last_name}` : "",
        p.student?.admission_no ?? "",
        (p.category ?? "").replace(/,/g, " "),
        p.amount,
        p.method,
        (p.reference ?? "").replace(/,/g, " "),
      ].join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `payments-${appliedFrom}_to_${appliedTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const unpaidCount = useMemo(() => {
    // count unique students with unpaid balance (rough — placeholder pending invoice query)
    return 0;
  }, []);

  return (
    <>
      <PageHeader
        title="Payment tracker"
        description="Search, filter, export"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><Download className="size-4 mr-1" /> Export CSV</Button>
            {canManage && <CsvTemplateButton />}
            {canManage && <BulkImportDialog onDone={() => qc.invalidateQueries({ queryKey: ["all-payments"] })} userId={user?.id ?? null} />}
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <StatCard label="Today" value={kes(cards.today)} />
        <StatCard label="This week" value={kes(cards.week)} />
        <StatCard label="This month" value={kes(cards.month)} />
        <StatCard label="M-Pesa (MTD)" value={kes(cards.mpesa)} />
        <StatCard label="Bank (MTD)" value={kes(cards.bank)} />
        <StatCard label="Cash & Adj. (MTD)" value={kes(cards.cash)} />
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {unpaidCount} active pupils with unpaid balance · MTD = month to date by method
      </p>

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <Label className="text-xs">Search</Label>
            <Input placeholder="Name, adm, ref, receipt" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={apply}>Apply</Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Receipt</th>
                <th className="text-left px-4 py-3">Student</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Method</th>
                <th className="text-left px-4 py-3">Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paymentsQ.isLoading && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!paymentsQ.isLoading && rows.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No payments match the current filters.</td></tr>
              )}
              {rows.map((p: any) => (
                <tr key={p.id} className="hover:bg-secondary/20">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(p.paid_on).toLocaleDateString()} · {new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-4 py-3"><span className="text-primary underline">{receiptNo(p)}</span></td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.student ? `${p.student.first_name} ${p.student.last_name}` : "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{p.student?.admission_no}</div>
                  </td>
                  <td className="px-4 py-3">{p.category}</td>
                  <td className="px-4 py-3 text-right font-bold">{kes(Number(p.amount))}</td>
                  <td className="px-4 py-3 capitalize">{p.method.replace("mpesa", "M-Pesa")}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{p.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-lg font-display font-bold text-brand-navy mt-1">{value}</p>
    </Card>
  );
}

function CsvTemplateButton() {
  const download = () => {
    const csv = [
      "admission_no,academic_year,term_number,amount_paid,method,reference,paid_on,total_amount",
      "ADM-2026-0001,2026,1,15000,mpesa,QGH8X1ABCD,2026-01-15,25000",
      "ADM-2026-0002,2026,1,25000,bank,TRX-99812,2026-01-20,25000",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "payments-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  return <Button variant="outline" onClick={download}><Download className="size-4 mr-1" /> Template</Button>;
}

type Row = {
  admission_no: string;
  academic_year: string;
  term_number: string;
  amount_paid: string;
  method?: string;
  reference?: string;
  paid_on?: string;
  total_amount?: string;
};

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const o: any = {};
    headers.forEach((h, i) => (o[h] = cells[i] ?? ""));
    return o as Row;
  });
}

function BulkImportDialog({ onDone, userId }: { onDone: () => void; userId: string | null }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const onFile = async (f: File) => {
    setFilename(f.name);
    const t = await f.text();
    setRows(parseCsv(t));
    setLog([]);
  };

  const run = async () => {
    setBusy(true);
    const out: string[] = [];
    let ok = 0, fail = 0;
    for (const r of rows) {
      try {
        const adm = r.admission_no?.trim();
        const yr = Number(r.academic_year);
        const tn = Number(r.term_number);
        const amt = Number(r.amount_paid);
        if (!adm || !yr || !tn || !amt) throw new Error("missing required fields");

        const st = await supabase.from("students").select("id").eq("admission_no", adm).maybeSingle();
        if (st.error || !st.data) throw new Error(`student ${adm} not found`);
        const te = await supabase.from("terms").select("id").eq("academic_year", yr).eq("term_number", tn).maybeSingle();
        if (te.error || !te.data) throw new Error(`term ${yr} T${tn} not found`);

        const existing = await supabase
          .from("invoices")
          .select("id, total_amount, balance")
          .eq("student_id", st.data.id)
          .eq("term_id", te.data.id)
          .maybeSingle();

        let invoiceId: string;
        let total: number;
        let balance: number;
        if (existing.data) {
          invoiceId = existing.data.id;
          total = Number(existing.data.total_amount);
          balance = Number(existing.data.balance);
        } else {
          total = Number(r.total_amount) || amt;
          balance = total;
          const ins = await supabase.from("invoices").insert({
            student_id: st.data.id, term_id: te.data.id,
            total_amount: total, balance, status: "pending",
            notes: "Pre-system invoice (bulk import)",
          }).select("id").single();
          if (ins.error) throw ins.error;
          invoiceId = ins.data.id;
        }

        const pay = await supabase.from("payments").insert({
          invoice_id: invoiceId,
          amount: amt,
          method: r.method?.trim() || "mpesa",
          reference: r.reference?.trim() || "Pre-system payment",
          paid_on: r.paid_on?.trim() || new Date().toISOString().slice(0, 10),
          recorded_by: userId,
        });
        if (pay.error) throw pay.error;

        const newBal = Math.max(0, balance - amt);
        const status = newBal === 0 ? "paid" : "partial";
        await supabase.from("invoices").update({ balance: newBal, status }).eq("id", invoiceId);

        ok++;
        out.push(`✓ ${adm} ${yr}T${tn} — ${amt}`);
      } catch (e: any) {
        fail++;
        out.push(`✗ ${r.admission_no} — ${e.message ?? "failed"}`);
      }
      setLog([...out]);
    }
    setBusy(false);
    toast.success(`Imported ${ok}, failed ${fail}`);
    if (ok > 0) onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setRows([]); setLog([]); setFilename(""); } }}>
      <DialogTrigger asChild><Button><Upload className="size-4 mr-1" /> Bulk import</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Bulk import historical payments</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            CSV columns: <code>admission_no, academic_year, term_number, amount_paid, method, reference, paid_on, total_amount</code>.
            For each row, an invoice is found/created for that student+term and a payment is recorded against it.
          </p>
          <div>
            <Label>CSV file</Label>
            <Input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            {filename && <p className="text-[11px] text-muted-foreground mt-1">{filename} · {rows.length} rows</p>}
          </div>
          {rows.length > 0 && (
            <div className="max-h-40 overflow-auto border rounded text-xs">
              <table className="w-full">
                <thead className="bg-secondary/40 sticky top-0">
                  <tr><th className="text-left p-2">Adm</th><th className="text-left p-2">Yr/T</th><th className="text-right p-2">Amount</th><th className="text-left p-2">Method</th><th className="text-left p-2">Ref</th></tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.admission_no}</td>
                      <td className="p-2">{r.academic_year}/{r.term_number}</td>
                      <td className="p-2 text-right">{r.amount_paid}</td>
                      <td className="p-2">{r.method}</td>
                      <td className="p-2">{r.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {log.length > 0 && (
            <div className="max-h-40 overflow-auto bg-secondary/30 rounded p-2 text-[11px] font-mono space-y-0.5">
              {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          <Button onClick={run} disabled={!rows.length || busy}>{busy ? "Importing…" : `Import ${rows.length} row(s)`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
