import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Lock, Search } from "lucide-react";
import { PageHeader, Card } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasAnyRole } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/student-ledger")({
  component: StudentLedgerPage,
  head: () => ({ meta: [{ title: "Student Ledger — JEC" }] }),
});

const KES = (n: number) =>
  `KES ${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n || 0)}`;

function StudentLedgerPage() {
  const { roles } = useAuth();
  const canRecord = hasAnyRole(roles, ["finance", "admin"]);
  const [search, setSearch] = useState("");
  const [stream, setStream] = useState<string>("all");

  const invoicesQ = useQuery({
    queryKey: ["student-ledger", "invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, student_id, total_amount, balance, student:students(id, first_name, last_name, admission_no, class:classes(name, stream))"
        );
      if (error) throw error;
      return data || [];
    },
  });

  const rows = useMemo(() => {
    type Row = {
      id: string;
      name: string;
      admission: string;
      className: string;
      stream: string;
      invoiced: number;
      paid: number;
      balance: number;
    };
    const map = new Map<string, Row>();
    for (const i of (invoicesQ.data || []) as any[]) {
      const s = i.student;
      if (!s) continue;
      const total = Number(i.total_amount || 0);
      const bal = Number(i.balance || 0);
      const r =
        map.get(i.student_id) || {
          id: i.student_id,
          name: `${s.first_name} ${s.last_name}`,
          admission: s.admission_no || "—",
          className: s.class?.name || "—",
          stream: s.class?.stream || "",
          invoiced: 0,
          paid: 0,
          balance: 0,
        };
      r.invoiced += total;
      r.balance += bal;
      r.paid += Math.max(0, total - bal);
      map.set(i.student_id, r);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [invoicesQ.data]);

  const streams = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.stream && set.add(r.stream));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (stream !== "all" && r.stream !== stream) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.admission.toLowerCase().includes(q) ||
        r.className.toLowerCase().includes(q)
      );
    });
  }, [rows, search, stream]);

  return (
    <>
      <PageHeader title="Student Ledger" description="Fee status (view only)">
        <div className="relative">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-background w-64"
          />
        </div>
      </PageHeader>

      {!canRecord && (
        <Card className="p-4 mb-6 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <Lock className="size-4 text-muted-foreground" />
            <p className="text-sm">
              <span className="font-semibold">Recording payments</span> is limited to the Accounts role.
            </p>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="font-display font-bold">All Students – Fee Status</div>
          <select
            value={stream}
            onChange={(e) => setStream(e.target.value)}
            className="text-sm rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="all">All streams</option>
            {streams.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-muted-foreground border-b border-border bg-muted/30">
                <th className="text-left font-medium px-5 py-3">Student</th>
                <th className="text-left font-medium px-5 py-3">Class</th>
                <th className="text-left font-medium px-5 py-3">Invoiced</th>
                <th className="text-left font-medium px-5 py-3">Paid</th>
                <th className="text-left font-medium px-5 py-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              {invoicesQ.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    No students found
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-4 font-medium">{r.name}</td>
                    <td className="px-5 py-4 text-muted-foreground">{r.className}</td>
                    <td className="px-5 py-4">{KES(r.invoiced)}</td>
                    <td className="px-5 py-4">{KES(r.paid)}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          r.balance > 0
                            ? "bg-rose-100 text-rose-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {KES(r.balance)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
