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
import { Plus, UserCog, Banknote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffPage,
  head: () => ({ meta: [{ title: "Staff & Payroll — JEC" }] }),
});

function kes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n || 0);
}

// Simplified Kenyan PAYE 2024+ bands (monthly)
function calcPAYE(taxable: number): number {
  let tax = 0;
  const bands = [
    { upTo: 24000, rate: 0.10 },
    { upTo: 32333, rate: 0.25 },
    { upTo: 500000, rate: 0.30 },
    { upTo: 800000, rate: 0.325 },
    { upTo: Infinity, rate: 0.35 },
  ];
  let prev = 0;
  for (const b of bands) {
    if (taxable <= prev) break;
    const slice = Math.min(taxable, b.upTo) - prev;
    if (slice > 0) tax += slice * b.rate;
    prev = b.upTo;
  }
  // Personal relief
  return Math.max(0, tax - 2400);
}
function calcNHIF(gross: number) {
  // simplified SHIF: 2.75% of gross, min 300
  return Math.max(300, Math.round(gross * 0.0275));
}
function calcNSSF(gross: number) {
  // Tier I + II cap KES 4320 (employee)
  return Math.min(Math.round(gross * 0.06), 4320);
}
function calcHousingLevy(gross: number) {
  return Math.round(gross * 0.015);
}

function StaffPage() {
  const { roles, user } = useAuth();
  const isAdmin = roles.includes("admin");
  const isFinance = roles.includes("finance") || isAdmin;
  const qc = useQueryClient();

  const staffQ = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").order("last_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader
        title="Staff & Payroll"
        description="Staff registry and KRA-compliant payroll computation"
        actions={isAdmin ? <NewStaffDialog onDone={() => qc.invalidateQueries({ queryKey: ["staff"] })} /> : null}
      />

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-7 overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center gap-2">
            <UserCog className="size-4" />
            <h3 className="font-display font-bold text-sm">Staff registry</h3>
          </div>
          {staffQ.isLoading && <p className="p-6 text-sm text-muted-foreground">Loading…</p>}
          {staffQ.data?.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No staff yet.</p>}
          <ul className="divide-y divide-border">
            {staffQ.data?.map((s: any) => (
              <li key={s.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{s.first_name} {s.last_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {s.designation ?? "—"} · {s.department ?? "—"} · {s.staff_no}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{kes(Number(s.basic_salary ?? 0))}</p>
                  <p className="text-[10px] text-muted-foreground">basic</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="col-span-12 lg:col-span-5">
          {isFinance ? (
            <PayrollPanel userId={user?.id ?? null} />
          ) : (
            <Card className="p-6 text-sm text-muted-foreground">Finance role required to run payroll.</Card>
          )}
        </div>
      </div>
    </>
  );
}

function PayrollPanel({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const runsQ = useQuery({
    queryKey: ["payroll_runs"],
    queryFn: async () => (await supabase.from("payroll_runs").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false })).data ?? [],
  });

  const run = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase.from("payroll_runs").select("id").eq("period_year", year).eq("period_month", month).maybeSingle();
      let runId = existing?.id;
      if (!runId) {
        const { data, error } = await supabase.from("payroll_runs")
          .insert({ period_year: year, period_month: month, status: "processed", created_by: userId })
          .select("id").single();
        if (error) throw error;
        runId = data.id;
      } else {
        await supabase.from("payslips").delete().eq("payroll_run_id", runId);
      }

      const { data: staff } = await supabase.from("staff").select("id, basic_salary").eq("active", true);
      const rows = (staff ?? []).map((s: any) => {
        const basic = Number(s.basic_salary ?? 0);
        const allowances = 0;
        const gross = basic + allowances;
        const nssf = calcNSSF(gross);
        const nhif = calcNHIF(gross);
        const housing = calcHousingLevy(gross);
        const taxable = Math.max(0, gross - nssf - housing);
        const paye = calcPAYE(taxable);
        const net = gross - nssf - nhif - housing - paye;
        return {
          payroll_run_id: runId,
          staff_id: s.id,
          basic_salary: basic,
          allowances,
          gross_pay: gross,
          paye,
          nhif,
          nssf,
          housing_levy: housing,
          other_deductions: 0,
          net_pay: net,
        };
      });
      if (rows.length === 0) throw new Error("No active staff to run payroll for");
      const { error } = await supabase.from("payslips").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payroll processed");
      qc.invalidateQueries({ queryKey: ["payroll_runs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center gap-2">
        <Banknote className="size-4" />
        <h3 className="font-display font-bold text-sm">Run payroll</h3>
      </div>
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Year</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div>
            <Label>Month</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString("en", { month: "long" })}</option>
              ))}
            </select>
          </div>
        </div>
        <Button onClick={() => run.mutate()} disabled={run.isPending} className="w-full">
          {run.isPending ? "Processing…" : "Process payroll"}
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Computes PAYE (KRA bands), SHIF 2.75%, NSSF tiers, and 1.5% housing levy. Personal relief KES 2,400 applied.
        </p>
      </div>
      <div className="px-5 py-3 border-t border-border bg-secondary/20">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Past runs</p>
        {runsQ.data?.length === 0 && <p className="text-xs text-muted-foreground">No runs yet.</p>}
        <ul className="space-y-1">
          {runsQ.data?.map((r: any) => (
            <li key={r.id} className="text-xs flex justify-between">
              <span>{new Date(r.period_year, r.period_month - 1).toLocaleString("en", { month: "long", year: "numeric" })}</span>
              <span className="text-emerald-700 font-bold">{r.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function NewStaffDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", staff_no: "", designation: "", department: "",
    email: "", phone: "", basic_salary: 0, kra_pin: "", nhif_no: "", nssf_no: "",
  });

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff").insert(form);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Staff added"); setOpen(false); onDone(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Add staff</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add staff member</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>First name</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
          <div><Label>Last name</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
          <div><Label>Staff no.</Label><Input value={form.staff_no} onChange={(e) => setForm({ ...form, staff_no: e.target.value })} /></div>
          <div><Label>Designation</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
          <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Basic salary (KES)</Label><Input type="number" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: Number(e.target.value) })} /></div>
          <div><Label>KRA PIN</Label><Input value={form.kra_pin} onChange={(e) => setForm({ ...form, kra_pin: e.target.value })} /></div>
          <div><Label>NHIF no.</Label><Input value={form.nhif_no} onChange={(e) => setForm({ ...form, nhif_no: e.target.value })} /></div>
          <div><Label>NSSF no.</Label><Input value={form.nssf_no} onChange={(e) => setForm({ ...form, nssf_no: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!form.first_name || !form.last_name || !form.staff_no || m.isPending}>
            {m.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
