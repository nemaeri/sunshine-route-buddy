import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Banknote, Clock, Users, AlertTriangle, HandCoins, Hourglass, Info, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Card } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/finance-overview")({
  component: FinanceOverviewPage,
  head: () => ({ meta: [{ title: "Finance Overview — JEC" }] }),
});

const KES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 })
    .format(n || 0)
    .replace("KES", "KES ");

function compactKES(n: number) {
  if (Math.abs(n) >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `KES ${Math.round(n / 1_000)}K`;
  return `KES ${Math.round(n || 0)}`;
}

function StatCard({
  icon: Icon,
  iconBg,
  iconFg,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconFg: string;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <Card className="p-5">
      <div className={`size-10 rounded-lg flex items-center justify-center mb-4 ${iconBg}`}>
        <Icon className={`size-5 ${iconFg}`} />
      </div>
      <div className="font-display font-bold text-2xl text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </Card>
  );
}

function FinanceOverviewPage() {
  const qc = useQueryClient();
  const [payFor, setPayFor] = useState<null | { id: string; name: string; balance: number }>(null);
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  const invoicesQ = useQuery({
    queryKey: ["fin-overview", "invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, student_id, total_amount, balance, student:students(first_name, last_name, admission_no, class:classes(name))");
      if (error) throw error;
      return data || [];
    },
  });

  const recentPaymentsQ = useQuery({
    queryKey: ["fin-overview", "recent-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, paid_on, reference, invoice:invoices(id, student:students(first_name, last_name, class:classes(name)))")
        .order("paid_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
  });

  const payrollQ = useQuery({
    queryKey: ["fin-overview", "payroll", year, month],
    queryFn: async () => {
      const { data: runs } = await supabase
        .from("payroll_runs")
        .select("id, status")
        .eq("period_year", year)
        .eq("period_month", month);
      const run = runs?.[0];
      if (!run) return { net: 0, unpaid: 0, hasRun: false };
      const { data: slips } = await supabase
        .from("payslips")
        .select("net_pay")
        .eq("payroll_run_id", run.id);
      const net = (slips || []).reduce((a, s) => a + Number(s.net_pay || 0), 0);
      // "unpaid" heuristic: if run is not 'paid', count all lines as unpaid
      const unpaid = run.status === "paid" ? 0 : (slips?.length || 0);
      return { net, unpaid, hasRun: true };
    },
  });

  const gradeCollectionQ = useQuery({
    queryKey: ["fin-overview", "by-grade"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("amount, invoice:invoices(student:students(class:classes(name, grade_level)))");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const p of data || []) {
        const cls: any = (p as any).invoice?.student?.class;
        const key = cls?.grade_level || cls?.name || "Unassigned";
        map.set(key, (map.get(key) || 0) + Number((p as any).amount || 0));
      }
      return Array.from(map.entries())
        .map(([grade, total]) => ({ grade, total }))
        .sort((a, b) => b.total - a.total);
    },
  });

  const stats = useMemo(() => {
    const invs = (invoicesQ.data || []) as any[];
    let collected = 0;
    let outstanding = 0;
    type SAgg = {
      id: string;
      name: string;
      admission: string;
      className: string;
      total: number;
      balance: number;
    };
    const byStudent = new Map<string, SAgg>();
    for (const i of invs) {
      const total = Number(i.total_amount || 0);
      const bal = Number(i.balance || 0);
      collected += Math.max(0, total - bal);
      outstanding += bal;
      const s = i.student;
      const agg = byStudent.get(i.student_id) || {
        id: i.student_id,
        name: s ? `${s.first_name} ${s.last_name}` : "Unknown",
        admission: s?.admission_no || "—",
        className: s?.class?.name || "—",
        total: 0,
        balance: 0,
      };
      agg.total += total;
      agg.balance += bal;
      byStudent.set(i.student_id, agg);
    }
    const all = Array.from(byStudent.values());
    const clearedList = all
      .filter((s) => s.total > 0 && s.balance <= 0)
      .sort((a, b) => b.total - a.total);
    const defaultersList = all
      .filter((s) => s.balance > 0)
      .sort((a, b) => b.balance - a.balance);
    return {
      collected,
      outstanding,
      cleared: clearedList.length,
      defaulters: defaultersList.length,
      clearedList,
      defaultersList,
    };
  }, [invoicesQ.data]);

  const maxGrade = Math.max(1, ...(gradeCollectionQ.data || []).map((g) => g.total));

  return (
    <>
      <PageHeader
        title="Finance Overview"
        description="Read-only summary · Payments recorded by Accounts"
      />

      <Card className="p-4 mb-6 border-l-4 border-l-primary">
        <div className="flex gap-3">
          <Info className="size-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm">Recording payments</div>
            <p className="text-sm text-muted-foreground mt-1">
              Only the <span className="font-semibold text-foreground">Accounts</span> role can record payments and issue receipts. Data below loads live from the ledger.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          icon={Banknote}
          iconBg="bg-emerald-100"
          iconFg="text-emerald-600"
          value={compactKES(stats.collected)}
          label="Collected (all)"
        />
        <StatCard
          icon={Clock}
          iconBg="bg-rose-100"
          iconFg="text-rose-600"
          value={compactKES(stats.outstanding)}
          label="Outstanding"
        />
        <StatCard
          icon={Users}
          iconBg="bg-sky-100"
          iconFg="text-sky-600"
          value={stats.cleared}
          label="Students cleared"
        />
        <StatCard
          icon={AlertTriangle}
          iconBg="bg-amber-100"
          iconFg="text-amber-600"
          value={stats.defaulters}
          label="Defaulters"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5">
          <div className="size-10 rounded-lg flex items-center justify-center mb-4 bg-indigo-100">
            <HandCoins className="size-5 text-indigo-600" />
          </div>
          <div className="font-display font-bold text-2xl text-foreground">
            {KES(payrollQ.data?.net || 0)}
          </div>
          <div className="text-sm text-muted-foreground mt-1">Payroll net (this month)</div>
          <div className="text-xs text-muted-foreground mt-1">{monthLabel}</div>
        </Card>
        <Card className="p-5">
          <div className="size-10 rounded-lg flex items-center justify-center mb-4 bg-amber-100">
            <Hourglass className="size-5 text-amber-600" />
          </div>
          <div className="font-display font-bold text-2xl text-foreground">
            {payrollQ.data?.unpaid ?? 0}
          </div>
          <div className="text-sm text-muted-foreground mt-1">Salary lines unpaid</div>
          <Link to="/payroll" className="text-xs text-primary hover:underline mt-1 inline-block">
            Open payroll
          </Link>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="font-display font-bold">Recent Payments</div>
            <Link to="/all-payments" className="text-xs text-muted-foreground hover:text-foreground">
              Latest ledger rows
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-5 py-3">Student</th>
                  <th className="text-left font-medium px-5 py-3">Class</th>
                  <th className="text-left font-medium px-5 py-3">Amount</th>
                  <th className="text-left font-medium px-5 py-3">For</th>
                  <th className="text-left font-medium px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentPaymentsQ.isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : (recentPaymentsQ.data || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">
                      No payments yet
                    </td>
                  </tr>
                ) : (
                  (recentPaymentsQ.data || []).map((p: any) => {
                    const s = p.invoice?.student;
                    return (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="px-5 py-3 font-medium">
                          {s ? `${s.first_name} ${s.last_name}` : "—"}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {s?.class?.name || "—"}
                        </td>
                        <td className="px-5 py-3 text-emerald-600 font-semibold">
                          {KES(Number(p.amount))}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {p.reference || "—"}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {new Date(p.paid_on).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <div className="font-display font-bold mb-4">Collection by grade</div>
          {gradeCollectionQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (gradeCollectionQ.data || []).length === 0 ? (
            <div className="text-sm text-muted-foreground">No collections yet</div>
          ) : (
            <div className="space-y-3">
              {(gradeCollectionQ.data || []).map((g) => (
                <div key={g.grade}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{g.grade}</span>
                    <span className="text-muted-foreground">{KES(g.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-brand-gold"
                      style={{ width: `${(g.total / maxGrade) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <div className="font-display font-bold">Defaulters</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Students with an outstanding balance
              </div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">
              {stats.defaultersList?.length || 0}
            </span>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-5 py-3">Student</th>
                  <th className="text-left font-medium px-5 py-3">Adm. No</th>
                  <th className="text-left font-medium px-5 py-3">Class</th>
                  <th className="text-right font-medium px-5 py-3">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(stats.defaultersList || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">
                      No defaulters
                    </td>
                  </tr>
                ) : (
                  stats.defaultersList!.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 font-medium">{s.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{s.admission}</td>
                      <td className="px-5 py-3 text-muted-foreground">{s.className}</td>
                      <td className="px-5 py-3 text-right text-rose-600 font-semibold">
                        {KES(s.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <div className="font-display font-bold">Students cleared</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Fully paid for current invoices
              </div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
              {stats.clearedList?.length || 0}
            </span>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-5 py-3">Student</th>
                  <th className="text-left font-medium px-5 py-3">Adm. No</th>
                  <th className="text-left font-medium px-5 py-3">Class</th>
                  <th className="text-right font-medium px-5 py-3">Paid</th>
                </tr>
              </thead>
              <tbody>
                {(stats.clearedList || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">
                      No cleared students yet
                    </td>
                  </tr>
                ) : (
                  stats.clearedList!.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 font-medium">{s.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{s.admission}</td>
                      <td className="px-5 py-3 text-muted-foreground">{s.className}</td>
                      <td className="px-5 py-3 text-right text-emerald-600 font-semibold">
                        {KES(s.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
