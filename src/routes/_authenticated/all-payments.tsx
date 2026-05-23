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
import { Upload, Download, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/all-payments")({
  component: AllPaymentsPage,
  head: () => ({ meta: [{ title: "All Payments — JEC" }] }),
});

function kes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n || 0);
}

function AllPaymentsPage() {
  const { roles, user } = useAuth();
  const canManage = roles.includes("admin") || roles.includes("finance");
  const qc = useQueryClient();

  const paymentsQ = useQuery({
    queryKey: ["all-payments"],
    queryFn: async () => {
      const p = await supabase
        .from("payments")
        .select("id, amount, method, reference, paid_on, created_at, invoice_id")
        .order("paid_on", { ascending: false })
        .limit(500);
      if (p.error) throw p.error;
      const invIds = (p.data ?? []).map((x) => x.invoice_id);
      if (!invIds.length) return [];
      const inv = await supabase
        .from("invoices")
        .select("id, student_id, term_id")
        .in("id", invIds);
      const sIds = (inv.data ?? []).map((i) => i.student_id);
      const tIds = (inv.data ?? []).map((i) => i.term_id);
      const [st, te] = await Promise.all([
        sIds.length ? supabase.from("students").select("id, first_name, last_name, admission_no").in("id", sIds) : Promise.resolve({ data: [] as any[] }),
        tIds.length ? supabase.from("terms").select("id, academic_year, term_number").in("id", tIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const im = new Map((inv.data ?? []).map((x: any) => [x.id, x]));
      const sm = new Map((st.data ?? []).map((x: any) => [x.id, x]));
      const tm = new Map((te.data ?? []).map((x: any) => [x.id, x]));
      return (p.data ?? []).map((x: any) => {
        const i = im.get(x.invoice_id);
        return { ...x, student: i ? sm.get(i.student_id) : null, term: i ? tm.get(i.term_id) : null };
      });
    },
  });

  const totals = useMemo(() => {
    const list = paymentsQ.data ?? [];
    return {
      count: list.length,
      sum: list.reduce((a: number, p: any) => a + Number(p.amount || 0), 0),
    };
  }, [paymentsQ.data]);

  return (
    <>
      <PageHeader
        title="All Payments"
        description="Cashbook of every payment received across all invoices"
        actions={
          canManage ? (
            <div className="flex gap-2">
              <CsvTemplateButton />
              <BulkImportDialog onDone={() => qc.invalidateQueries({ queryKey: ["all-payments"] })} userId={user?.id ?? null} />
            </div>
          ) : null
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Payments recorded</p>
          <p className="text-3xl font-display font-bold text-brand-navy mt-1">{totals.count}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total collected</p>
          <p className="text-3xl font-display font-bold text-brand-navy mt-1">{kes(totals.sum)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center gap-2">
          <Wallet className="size-4" />
          <h3 className="font-display font-bold text-sm">Recent payments</h3>
        </div>
        {paymentsQ.isLoading && <p className="p-6 text-sm text-muted-foreground">Loading…</p>}
        {paymentsQ.data?.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No payments yet. Use “Bulk import” to load historical records.</p>}
        <ul className="divide-y divide-border">
          {paymentsQ.data?.map((p: any) => (
            <li key={p.id} className="px-5 py-3 flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {p.student ? `${p.student.first_name} ${p.student.last_name}` : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {p.student?.admission_no} {p.term ? `· ${p.term.academic_year} T${p.term.term_number}` : ""} · {new Date(p.paid_on).toLocaleDateString()} · {p.method}
                  {p.reference ? ` · ${p.reference}` : ""}
                </p>
              </div>
              <p className="text-sm font-bold">{kes(Number(p.amount))}</p>
            </li>
          ))}
        </ul>
      </Card>
    </>
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

        // Find or create invoice
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
