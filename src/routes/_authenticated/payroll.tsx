import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Plus, UserPlus, Lock, Trash2, Sigma, Minus, Wallet, Hourglass, BadgeCheck, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payroll")({
  component: PayrollPage,
  head: () => ({ meta: [{ title: "Payroll — JEC" }] }),
});

function kes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n || 0);
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function PayrollPage() {
  const { roles, user } = useAuth();
  const canManage = roles.includes("admin") || roles.includes("finance");
  const qc = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const runsQ = useQuery({
    queryKey: ["payroll-runs"],
    queryFn: async () => {
      const r = await supabase
        .from("payroll_runs")
        .select("id, period_month, period_year, status, created_at")
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  // auto-select first run when loaded
  useEffect(() => {
    if (!selectedRunId && runsQ.data && runsQ.data.length > 0) {
      setSelectedRunId(runsQ.data[0].id);
    }
  }, [runsQ.data, selectedRunId]);

  const run = useMemo(
    () => runsQ.data?.find((r) => r.id === selectedRunId) ?? null,
    [runsQ.data, selectedRunId]
  );
  const locked = run?.status === "locked";

  const linesQ = useQuery({
    queryKey: ["payslips", selectedRunId],
    enabled: !!selectedRunId,
    queryFn: async () => {
      const r = await supabase
        .from("payslips")
        .select("id, staff_id, basic_salary, allowances, gross_pay, paye, nhif, nssf, housing_levy, other_deductions, net_pay, paid_on, paid_method, paid_reference, paid_amount")
        .eq("payroll_run_id", selectedRunId!)
        .order("created_at", { ascending: true });
      if (r.error) throw r.error;
      const staffIds = Array.from(new Set((r.data ?? []).map((x) => x.staff_id)));
      const s = staffIds.length
        ? await supabase.from("staff").select("id, first_name, last_name, designation, basic_salary").in("id", staffIds)
        : { data: [] as any[] };
      const sm = new Map(((s as any).data ?? []).map((x: any) => [x.id, x]));
      return (r.data ?? []).map((x: any) => ({ ...x, staff: sm.get(x.staff_id) }));
    },
  });

  const lines = linesQ.data ?? [];
  const totals = useMemo(() => {
    const gross = lines.reduce((a, l: any) => a + Number(l.gross_pay || 0), 0);
    const ded = lines.reduce((a, l: any) => a + Number(l.paye || 0) + Number(l.nhif || 0) + Number(l.nssf || 0) + Number(l.housing_levy || 0) + Number(l.other_deductions || 0), 0);
    const net = lines.reduce((a, l: any) => a + Number(l.net_pay || 0), 0);
    const unpaid = lines.filter((l: any) => !l.paid_on).length;
    return { gross, ded, net, unpaid };
  }, [lines]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["payroll-runs"] });
    qc.invalidateQueries({ queryKey: ["payslips", selectedRunId] });
    qc.invalidateQueries({ queryKey: ["fin-overview"] });
  };

  const toggleLock = useMutation({
    mutationFn: async () => {
      if (!run) return;
      const r = await supabase
        .from("payroll_runs")
        .update({ status: locked ? "draft" : "locked" })
        .eq("id", run.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success(locked ? "Period unlocked" : "Period locked");
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePeriod = useMutation({
    mutationFn: async () => {
      if (!run) return;
      const p = await supabase.from("payslips").delete().eq("payroll_run_id", run.id);
      if (p.error) throw p.error;
      const r = await supabase.from("payroll_runs").delete().eq("id", run.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Period deleted");
      setSelectedRunId(null);
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Create periods and salary lines · Lock when ready for payment"
        actions={
          canManage && <NewPeriodDialog userId={user?.id ?? null} onDone={(id) => { setSelectedRunId(id); refresh(); }} />
        }
      />

      {/* Period selector */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <Label className="text-xs">Pay period</Label>
            <Select value={selectedRunId ?? ""} onValueChange={(v) => setSelectedRunId(v)}>
              <SelectTrigger><SelectValue placeholder={runsQ.isLoading ? "Loading…" : "Select a period"} /></SelectTrigger>
              <SelectContent>
                {(runsQ.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {MONTHS[r.period_month - 1]} {r.period_year} · {r.status}
                  </SelectItem>
                ))}
                {(runsQ.data ?? []).length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No periods yet</div>}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={refresh}><RefreshCw className="size-4 mr-1" /> Refresh</Button>
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon={<Sigma className="size-5" />} tone="emerald" label="Gross" value={kes(totals.gross)} />
        <StatCard icon={<Minus className="size-5" />} tone="amber" label="Deductions" value={kes(totals.ded)} />
        <StatCard icon={<Wallet className="size-5" />} tone="blue" label="Net payable" value={kes(totals.net)} />
        <StatCard icon={<Hourglass className="size-5" />} tone="rose" label="Unpaid lines" value={String(totals.unpaid)} />
      </div>

      {/* Period settings */}
      {run && (
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-base">Period settings</h3>
            <span className={`text-[11px] font-bold tracking-widest px-2 py-1 rounded-md ${locked ? "bg-foreground text-background" : "bg-emerald-100 text-emerald-700"}`}>
              {locked ? "locked" : "draft"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && <AddStaffLineDialog runId={run.id} locked={locked} onDone={refresh} />}
            {canManage && (
              <Button variant="outline" onClick={() => toggleLock.mutate()} disabled={toggleLock.isPending}>
                <Lock className="size-4 mr-1" /> Toggle lock
              </Button>
            )}
            {canManage && (
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => {
                if (confirm("Delete this period and all its payslip lines?")) deletePeriod.mutate();
              }} disabled={deletePeriod.isPending}>
                <Trash2 className="size-4 mr-1" /> Delete period
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Lines table */}
      {run && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Staff</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-right px-4 py-3">Gross</th>
                  <th className="text-right px-4 py-3">Deductions</th>
                  <th className="text-right px-4 py-3">Net</th>
                  <th className="text-left px-4 py-3">Paid</th>
                  <th className="text-left px-4 py-3">Reference</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {linesQ.isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
                {!linesQ.isLoading && lines.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No salary lines. Click "Add staff line" to add one.</td></tr>
                )}
                {lines.map((l: any) => {
                  const ded = Number(l.paye || 0) + Number(l.nhif || 0) + Number(l.nssf || 0) + Number(l.housing_levy || 0) + Number(l.other_deductions || 0);
                  return (
                    <tr key={l.id} className="hover:bg-secondary/20">
                      <td className="px-4 py-3 font-medium">{l.staff ? `${l.staff.first_name} ${l.staff.last_name}` : "—"}</td>
                      <td className="px-4 py-3">{l.staff?.designation ?? "—"}</td>
                      <td className="px-4 py-3 text-right">{kes(Number(l.gross_pay))}</td>
                      <td className="px-4 py-3 text-right">{kes(ded)}</td>
                      <td className="px-4 py-3 text-right font-bold">{kes(Number(l.net_pay))}</td>
                      <td className="px-4 py-3">
                        {l.paid_on ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold"><BadgeCheck className="size-3.5" /> {new Date(l.paid_on).toLocaleDateString()}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{l.paid_reference ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {canManage && !l.paid_on && (
                          <RecordSalaryPaymentDialog line={l} userId={user?.id ?? null} onDone={refresh} />
                        )}
                        {canManage && l.paid_on && (
                          <Button variant="ghost" size="sm" onClick={async () => {
                            const r = await supabase.from("payslips").update({ paid_on: null, paid_method: null, paid_reference: null, paid_amount: null, paid_by: null }).eq("id", l.id);
                            if (r.error) toast.error(r.error.message); else { toast.success("Marked unpaid"); refresh(); }
                          }}>Undo</Button>
                        )}
                        {canManage && !locked && (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                            if (!confirm("Remove this salary line?")) return;
                            const r = await supabase.from("payslips").delete().eq("id", l.id);
                            if (r.error) toast.error(r.error.message); else { toast.success("Removed"); refresh(); }
                          }}>Remove</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function StatCard({ icon, tone, label, value }: { icon: React.ReactNode; tone: "emerald"|"amber"|"blue"|"rose"; label: string; value: string }) {
  const toneCls = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    rose: "bg-rose-100 text-rose-700",
  }[tone];
  return (
    <Card className="p-5">
      <div className={`size-10 rounded-md flex items-center justify-center ${toneCls}`}>{icon}</div>
      <p className="text-2xl md:text-3xl font-display font-bold text-brand-navy mt-4">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </Card>
  );
}

function NewPeriodDialog({ userId, onDone }: { userId: string | null; onDone: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const m = useMutation({
    mutationFn: async () => {
      const r = await supabase
        .from("payroll_runs")
        .insert({ period_month: month, period_year: year, status: "draft", created_by: userId })
        .select("id")
        .single();
      if (r.error) throw r.error;
      return r.data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Period created");
      setOpen(false);
      onDone(id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4 mr-1" /> New period</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New pay period</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Month</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((n, i) => <SelectItem key={i} value={String(i+1)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Year</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddStaffLineDialog({ runId, locked, onDone }: { runId: string; locked: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [basic, setBasic] = useState(0);
  const [allowances, setAllowances] = useState(0);
  const [paye, setPaye] = useState(0);
  const [nhif, setNhif] = useState(0);
  const [nssf, setNssf] = useState(0);
  const [housing, setHousing] = useState(0);
  const [other, setOther] = useState(0);

  const staffQ = useQuery({
    queryKey: ["staff-active"],
    queryFn: async () => {
      const r = await supabase.from("staff").select("id, first_name, last_name, basic_salary, designation").eq("active", true).order("first_name");
      if (r.error) throw r.error;
      return r.data ?? [];
    },
    enabled: open,
  });

  useEffect(() => {
    const s = staffQ.data?.find((x) => x.id === staffId);
    if (s) setBasic(Number(s.basic_salary || 0));
  }, [staffId, staffQ.data]);

  const gross = basic + allowances;
  const ded = paye + nhif + nssf + housing + other;
  const net = gross - ded;

  const m = useMutation({
    mutationFn: async () => {
      if (!staffId) throw new Error("Pick a staff member");
      const r = await supabase.from("payslips").insert({
        payroll_run_id: runId,
        staff_id: staffId,
        basic_salary: basic,
        allowances,
        gross_pay: gross,
        paye, nhif, nssf, housing_levy: housing, other_deductions: other,
        net_pay: net,
      });
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Line added");
      setOpen(false);
      setStaffId(""); setBasic(0); setAllowances(0); setPaye(0); setNhif(0); setNssf(0); setHousing(0); setOther(0);
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={locked}><UserPlus className="size-4 mr-1" /> Add staff line</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add salary line</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Staff</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {(staffQ.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}{s.designation ? ` · ${s.designation}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Basic salary" value={basic} onChange={setBasic} />
            <NumField label="Allowances" value={allowances} onChange={setAllowances} />
            <NumField label="PAYE" value={paye} onChange={setPaye} />
            <NumField label="NHIF / SHIF" value={nhif} onChange={setNhif} />
            <NumField label="NSSF" value={nssf} onChange={setNssf} />
            <NumField label="Housing levy" value={housing} onChange={setHousing} />
            <NumField label="Other deductions" value={other} onChange={setOther} />
          </div>
          <div className="rounded-md bg-secondary/40 px-3 py-2 text-sm flex justify-between">
            <span>Gross <span className="font-bold">{kes(gross)}</span></span>
            <span>Deductions <span className="font-bold">{kes(ded)}</span></span>
            <span>Net <span className="font-bold text-brand-navy">{kes(net)}</span></span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>Add line</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value || 0))} />
    </div>
  );
}

function RecordSalaryPaymentDialog({ line, userId, onDone }: { line: any; userId: string | null; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0,10));
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState<number>(Number(line.net_pay || 0));

  useEffect(() => { if (open) setAmount(Number(line.net_pay || 0)); }, [open, line.net_pay]);

  const m = useMutation({
    mutationFn: async () => {
      const r = await supabase.from("payslips").update({
        paid_on: paidOn,
        paid_method: method,
        paid_reference: reference || null,
        paid_amount: amount,
        paid_by: userId,
      }).eq("id", line.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Salary payment recorded");
      setOpen(false);
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Wallet className="size-4 mr-1" /> Pay</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record salary payment</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md bg-secondary/40 p-3">
            <div className="font-semibold">{line.staff?.first_name} {line.staff?.last_name}</div>
            <div className="text-xs text-muted-foreground">{line.staff?.designation}</div>
            <div className="mt-2 flex justify-between"><span>Net due</span><span className="font-bold">{kes(Number(line.net_pay))}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Paid on</Label>
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction ID / cheque no." />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Amount</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value || 0))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>Record payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
