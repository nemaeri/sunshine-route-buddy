import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Plus, Receipt, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finance")({
  component: FinancePage,
  head: () => ({ meta: [{ title: "Finance — JEC" }] }),
});

function kes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n || 0);
}

function FinancePage() {
  const { roles, user } = useAuth();
  const canManage = roles.includes("admin") || roles.includes("finance");
  const qc = useQueryClient();

  const invoicesQ = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const inv = await supabase
        .from("invoices")
        .select("id, total_amount, balance, due_date, status, created_at, student_id, term_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (inv.error) throw inv.error;
      const ids = (inv.data ?? []).map((i) => i.student_id);
      const tids = (inv.data ?? []).map((i) => i.term_id);
      const [st, te] = await Promise.all([
        ids.length ? supabase.from("students").select("id, first_name, last_name, admission_no").in("id", ids) : Promise.resolve({ data: [] as any[] }),
        tids.length ? supabase.from("terms").select("id, academic_year, term_number").in("id", tids) : Promise.resolve({ data: [] as any[] }),
      ]);
      const sm = new Map((st.data ?? []).map((x: any) => [x.id, x]));
      const tm = new Map((te.data ?? []).map((x: any) => [x.id, x]));
      return (inv.data ?? []).map((i: any) => ({ ...i, students: sm.get(i.student_id), terms: tm.get(i.term_id) }));
    },
  });

  const summary = (invoicesQ.data ?? []).reduce(
    (a, i: any) => {
      a.total += Number(i.total_amount);
      a.outstanding += Number(i.balance);
      a.count += 1;
      return a;
    },
    { total: 0, outstanding: 0, count: 0 }
  );

  return (
    <>
      <PageHeader
        title="Financial Records"
        description="Fee invoices, payments, and outstanding balances"
        actions={canManage ? (
          <NewInvoiceDialog onDone={() => { qc.invalidateQueries({ queryKey: ["invoices"] }); qc.invalidateQueries({ queryKey: ["fin-overview"] }); }} />
        ) : null}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Invoices</p>
          <p className="text-3xl font-display font-bold text-brand-navy mt-1">{summary.count}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total billed</p>
          <p className="text-3xl font-display font-bold text-brand-navy mt-1">{kes(summary.total)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Outstanding</p>
          <p className="text-3xl font-display font-bold text-brand-gold mt-1">{kes(summary.outstanding)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
          <h3 className="font-display font-bold text-sm flex items-center gap-2"><Receipt className="size-4" /> Recent invoices</h3>
        </div>
        {invoicesQ.isLoading && <p className="p-6 text-sm text-muted-foreground">Loading…</p>}
        {invoicesQ.data?.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No invoices yet.</p>}
        <ul className="divide-y divide-border">
          {invoicesQ.data?.map((i: any) => (
            <InvoiceRow key={i.id} invoice={i} canManage={canManage} userId={user?.id ?? null} />
          ))}
        </ul>
      </Card>
    </>
  );
}

function InvoiceRow({ invoice, canManage, userId }: { invoice: any; canManage: boolean; userId: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("mpesa");
  const [reference, setReference] = useState("");

  const pay = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Enter an amount");
      const { error } = await supabase.from("payments").insert({
        invoice_id: invoice.id, amount: amt, method, reference: reference || null,
        recorded_by: userId,
      });
      if (error) throw error;
      const newBal = Math.max(0, Number(invoice.balance) - amt);
      const newStatus = newBal === 0 ? "paid" : "partial";
      await supabase.from("invoices").update({ balance: newBal, status: newStatus }).eq("id", invoice.id);
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setOpen(false); setAmount(""); setReference("");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["all-payments"] });
      qc.invalidateQueries({ queryKey: ["fin-overview"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const statusTone: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-800",
    partial: "bg-amber-100 text-amber-800",
    pending: "bg-rose-100 text-rose-800",
  };

  return (
    <li className="px-5 py-3 flex items-center justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium">{invoice.students?.first_name} {invoice.students?.last_name}</p>
        <p className="text-[11px] text-muted-foreground">
          {invoice.students?.admission_no} · {invoice.terms?.academic_year} T{invoice.terms?.term_number}
          {invoice.due_date ? ` · due ${new Date(invoice.due_date).toLocaleDateString()}` : ""}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold">{kes(invoice.balance)}</p>
        <p className="text-[10px] text-muted-foreground">of {kes(invoice.total_amount)}</p>
      </div>
      <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded ${statusTone[invoice.status] ?? "bg-secondary text-muted-foreground"}`}>
        {invoice.status}
      </span>
      {canManage && Number(invoice.balance) > 0 && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline">Record payment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Amount (KES)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Method</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="mpesa">M-Pesa</option>
                    <option value="bank">Bank transfer</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div><Label>Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="QGH8X1..." /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => pay.mutate()} disabled={pay.isPending}>{pay.isPending ? "Saving…" : "Save payment"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </li>
  );
}

function NewInvoiceDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", term_id: "", total_amount: 0, due_date: "" });

  const students = useQuery({
    queryKey: ["students-list-fin"],
    queryFn: async () => (await supabase.from("students").select("id, first_name, last_name, admission_no").eq("active", true).order("first_name")).data ?? [],
  });
  const terms = useQuery({
    queryKey: ["terms-list"],
    queryFn: async () => (await supabase.from("terms").select("id, academic_year, term_number").order("academic_year", { ascending: false })).data ?? [],
  });

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("invoices").insert({
        student_id: form.student_id,
        term_id: form.term_id,
        total_amount: form.total_amount,
        balance: form.total_amount,
        due_date: form.due_date || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invoice created"); setOpen(false); onDone(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New invoice</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create invoice</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Student</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
              <option value="">—</option>
              {students.data?.map((s: any) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_no})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Term</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.term_id} onChange={(e) => setForm({ ...form, term_id: e.target.value })}>
                <option value="">—</option>
                {terms.data?.map((t: any) => <option key={t.id} value={t.id}>{t.academic_year} T{t.term_number}</option>)}
              </select>
            </div>
            <div><Label>Amount (KES)</Label><Input type="number" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: Number(e.target.value) })} /></div>
          </div>
          <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!form.student_id || !form.term_id || !form.total_amount || m.isPending}>
            {m.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
