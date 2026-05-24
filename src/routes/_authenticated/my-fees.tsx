import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { Smartphone, Landmark, FileText, User, X, Upload, Printer } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/my-fees")({
  component: MyFeesPage,
  validateSearch: (search: Record<string, unknown>) => ({
    student: typeof search.student === "string" ? search.student : undefined,
  }),
  head: () => ({ meta: [{ title: "Fees & Payments — JEC" }] }),
});

const fmt = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

function MyFeesPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const [selectedStudent, setSelectedStudent] = useState<string | undefined>(search.student);
  const [openForm, setOpenForm] = useState<"mpesa" | "bank" | null>(null);
  const [formPupil, setFormPupil] = useState<string | undefined>(undefined);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const schoolQ = useQuery({
    queryKey: ["mf-school"],
    queryFn: async () => {
      const { data } = await supabase.from("school_settings").select("*").maybeSingle();
      return data;
    },
  });

  const childrenQ = useQuery({
    enabled: !!user,
    queryKey: ["mf-children", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_parents")
        .select("students:student_id ( id, first_name, last_name, admission_no, classes:class_id ( name ) )")
        .eq("parent_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.students).filter(Boolean);
    },
  });

  const ids = (childrenQ.data ?? []).map((s: any) => s.id);

  const invQ = useQuery({
    enabled: ids.length > 0,
    queryKey: ["mf-inv", ids],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, student_id, total_amount, balance, status, due_date")
        .in("student_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });

  const payQ = useQuery({
    enabled: !!invQ.data && invQ.data.length > 0,
    queryKey: ["mf-pay", invQ.data?.map((i: any) => i.id)],
    queryFn: async () => {
      const invIds = invQ.data!.map((i: any) => i.id);
      const { data, error } = await supabase
        .from("payments")
        .select("id, invoice_id, amount, method, reference, paid_on, notes:reference")
        .in("invoice_id", invIds)
        .order("paid_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeStudent = selectedStudent && ids.includes(selectedStudent)
    ? selectedStudent
    : ids[1] ?? ids[0];

  const activeInvoices = activeStudent
    ? (invQ.data ?? []).filter((i: any) => i.student_id === activeStudent)
    : (invQ.data ?? []);

  const activePayments = activeStudent
    ? (payQ.data ?? []).filter((p: any) => {
        const inv = (invQ.data ?? []).find((i: any) => i.id === p.invoice_id);
        return inv?.student_id === activeStudent;
      })
    : (payQ.data ?? []);

  const totals = activeInvoices.reduce(
    (acc, i: any) => ({
      charges: acc.charges + Number(i.total_amount || 0),
      balance: acc.balance + Number(i.balance || 0),
    }),
    { charges: 0, balance: 0 },
  );
  const paid = totals.charges - totals.balance;

  const activeChild = (childrenQ.data ?? []).find((c: any) => c.id === activeStudent);
  const subtitle = activeChild
    ? `${activeChild.first_name} ${activeChild.last_name} · ${activeChild.classes?.name ?? ""}`
    : "All linked pupils";

  const childName = (sid: string) => {
    const s = (childrenQ.data ?? []).find((c: any) => c.id === sid);
    return s ? `${s.first_name} ${s.last_name}` : "—";
  };
  const studentIdForInvoice = (iid: string) =>
    (invQ.data ?? []).find((i: any) => i.id === iid)?.student_id ?? "";

  return (
    <>
      <PageHeader title="Fees & Payments" description={subtitle} />

      {/* Child selector */}
      {childrenQ.data && childrenQ.data.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {childrenQ.data.map((child: any) => {
            const active = child.id === activeStudent;
            return (
              <Link
                key={child.id}
                to="/my-fees"
                search={{ student: child.id }}
                onClick={() => setSelectedStudent(child.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? "bg-brand-navy text-white"
                    : "bg-card border border-border text-foreground hover:bg-secondary"
                }`}
              >
                <User className="size-4" />
                {child.first_name}
              </Link>
            );
          })}
        </div>
      )}

      <Card className="p-6 mb-6 text-white relative overflow-hidden bg-gradient-to-br from-brand-navy to-brand-navy/80">
        <div className="absolute -right-12 -top-12 size-48 rounded-full bg-white/5" />
        <p className="text-[11px] uppercase tracking-widest text-white/70 font-bold">
          {activeStudent ? "Balance" : "Net balance (all linked pupils)"}
        </p>
        <p className="font-display font-bold text-5xl mt-2">{fmt(totals.balance)}</p>
        <p className="text-xs text-white/70 mt-2">
          Charges: {fmt(totals.charges)} · Paid: {fmt(paid)}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => {
            setOpenForm(openForm === "mpesa" ? null : "mpesa");
            if (!formPupil) setFormPupil(activeStudent);
          }}
          className={`p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
            openForm === "mpesa"
              ? "bg-gradient-to-br from-brand-navy to-brand-navy/80 text-white"
              : "bg-card border border-border hover:bg-secondary"
          }`}
        >
          <Smartphone className="size-4" /> M-Pesa
        </button>
        <button
          onClick={() => {
            setOpenForm(openForm === "bank" ? null : "bank");
            if (!formPupil) setFormPupil(activeStudent);
          }}
          className={`p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
            openForm === "bank"
              ? "bg-gradient-to-br from-brand-navy to-brand-navy/80 text-white"
              : "bg-card border border-border hover:bg-secondary"
          }`}
        >
          <Landmark className="size-4" /> Bank
        </button>
      </div>

      {openForm && (
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-lg">
              {openForm === "mpesa" ? "Pay via M-Pesa" : "Bank / payslip"}
            </h3>
            <button
              onClick={() => setOpenForm(null)}
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setOpenForm(null);
            }}
          >
            <div>
              <label className="text-sm font-semibold block mb-1.5">Pupil</label>
              <select
                value={formPupil ?? ""}
                onChange={(e) => setFormPupil(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm"
              >
                {(childrenQ.data ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                    {c.classes?.name ? ` · ${c.classes.name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold block mb-1.5">Amount paid (KES)</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 7500"
                className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-semibold block mb-1.5">Purpose</label>
              <input
                type="text"
                placeholder="e.g. Term 2 Tuition"
                className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm"
              />
            </div>

            {openForm === "mpesa" ? (
              <>
                <div>
                  <label className="text-sm font-semibold block mb-1.5">M-Pesa code</label>
                  <input
                    type="text"
                    placeholder="e.g. SJK7H2A9B1"
                    className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-1.5">Phone used (optional)</label>
                  <input
                    type="tel"
                    placeholder="07XX XXX XXX"
                    className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-semibold block mb-1.5">
                    Bank / reference (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Receipt or transaction ref"
                    className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-1.5">
                    Payment date (optional)
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-1.5">
                    Payslip scan (PDF, JPG, PNG · max 5 MB)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-secondary file:text-foreground file:font-semibold"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-gradient-to-br from-brand-navy to-brand-navy/80 text-white font-bold flex items-center justify-center gap-2"
            >
              <Upload className="size-4" /> Submit
            </button>
          </form>
        </Card>
      )}


      <h3 className="font-display font-bold text-lg mb-3">Payment history</h3>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            <tr>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Pupil</th>
              <th className="text-left px-4 py-3">Amount</th>
              <th className="text-left px-4 py-3">For / Ref</th>
              <th className="text-left px-4 py-3">Method</th>
              <th className="text-left px-4 py-3">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {(activePayments ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No payments yet.
                </td>
              </tr>
            )}
            {activePayments?.map((p: any) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3">{new Date(p.paid_on).toLocaleDateString()}</td>
                <td className="px-4 py-3">{childName(studentIdForInvoice(p.invoice_id))}</td>
                <td className="px-4 py-3 font-semibold">{fmt(Number(p.amount))}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.reference ?? "—"}</td>
                <td className="px-4 py-3">{p.method}</td>
                <td className="px-4 py-3">
                  <button className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary inline-flex items-center gap-1">
                    <FileText className="size-3" /> Open receipt
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
