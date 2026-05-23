import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Layers, GitBranch, GraduationCap, BarChart3, Banknote, Hourglass, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/classes")({
  component: ClassesPage,
  head: () => ({ meta: [{ title: "Classes & Streams — JEC" }] }),
});

const GRADE_LEVELS = [
  "Play Group",
  "PP1",
  "PP2",
  ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`),
];
const STREAM_OPTIONS = ["Stream A", "Stream B", "Stream C", "Stream D"];

type ClassRow = {
  id: string;
  name: string;
  grade_level: string;
  stream: string | null;
  academic_year: number;
  class_teacher_id: string | null;
};

function ClassesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const classesQ = useQuery({
    queryKey: ["classes-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, grade_level, stream, academic_year, class_teacher_id")
        .order("grade_level");
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  });

  const teachersQ = useQuery({
    queryKey: ["teachers-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const studentsQ = useQuery({
    queryKey: ["classes-students-agg"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, class_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const feesQ = useQuery({
    queryKey: ["classes-fees-agg"],
    queryFn: async () => {
      const [{ data: invs }, { data: pays }] = await Promise.all([
        supabase.from("invoices").select("student_id, balance, total_amount"),
        supabase.from("payments").select("amount, invoice_id"),
      ]);
      return { invoices: invs ?? [], payments: pays ?? [] };
    },
  });

  const teacherMap = useMemo(() => {
    const m = new Map<string, string>();
    (teachersQ.data ?? []).forEach((t: any) => m.set(t.id, t.full_name));
    return m;
  }, [teachersQ.data]);

  // Group classes by grade_level
  const grouped = useMemo(() => {
    const classes = classesQ.data ?? [];
    const students = studentsQ.data ?? [];
    const invoices = feesQ.data?.invoices ?? [];
    const payments = feesQ.data?.payments ?? [];

    const studentsByClass = new Map<string, string[]>();
    students.forEach((s: any) => {
      if (!s.class_id) return;
      const arr = studentsByClass.get(s.class_id) ?? [];
      arr.push(s.id);
      studentsByClass.set(s.class_id, arr);
    });

    const balanceByStudent = new Map<string, number>();
    const paidByStudent = new Map<string, number>();
    const invoiceToStudent = new Map<string, string>();
    invoices.forEach((inv: any) => {
      invoiceToStudent.set(inv.id, inv.student_id);
      balanceByStudent.set(inv.student_id, (balanceByStudent.get(inv.student_id) ?? 0) + Number(inv.balance ?? 0));
    });
    payments.forEach((p: any) => {
      const sid = invoiceToStudent.get(p.invoice_id);
      if (!sid) return;
      paidByStudent.set(sid, (paidByStudent.get(sid) ?? 0) + Number(p.amount ?? 0));
    });

    const byGrade = new Map<string, { grade: string; classes: ClassRow[]; students: number; paid: number; balance: number; teachers: Set<string> }>();
    classes.forEach((c) => {
      const g = byGrade.get(c.grade_level) ?? { grade: c.grade_level, classes: [], students: 0, paid: 0, balance: 0, teachers: new Set<string>() };
      g.classes.push(c);
      if (c.class_teacher_id) g.teachers.add(c.class_teacher_id);
      const sids = studentsByClass.get(c.id) ?? [];
      g.students += sids.length;
      sids.forEach((sid) => {
        g.paid += paidByStudent.get(sid) ?? 0;
        g.balance += balanceByStudent.get(sid) ?? 0;
      });
      byGrade.set(c.grade_level, g);
    });
    return Array.from(byGrade.values());
  }, [classesQ.data, studentsQ.data, feesQ.data]);

  const filtered = grouped.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (g.grade.toLowerCase().includes(q)) return true;
    return Array.from(g.teachers).some((tid) => (teacherMap.get(tid) ?? "").toLowerCase().includes(q));
  });

  const totalClasses = grouped.length;
  const totalStreams = (classesQ.data ?? []).length;
  const totalStudents = grouped.reduce((s, g) => s + g.students, 0);
  const avgPerClass = totalClasses ? Math.round(totalStudents / totalClasses) : 0;
  const totalPaid = grouped.reduce((s, g) => s + g.paid, 0);
  const totalBalance = grouped.reduce((s, g) => s + g.balance, 0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["classes-full"] });
    qc.invalidateQueries({ queryKey: ["classes-students-agg"] });
    qc.invalidateQueries({ queryKey: ["classes-fees-agg"] });
  };

  return (
    <>
      <PageHeader
        title="Classes"
        description={`${totalClasses} ${totalClasses === 1 ? "class" : "classes"} · ${totalStreams} ${totalStreams === 1 ? "stream" : "streams"} in view`}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search class or teacher…"
                className="pl-9 w-72"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <AddClassDialog teachers={teachersQ.data ?? []} onCreated={invalidate} />
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard icon={<Layers className="size-5" />} value={String(totalClasses)} label="Classes" tone="blue" />
        <StatCard icon={<GitBranch className="size-5" />} value={String(totalStreams)} label="Streams" tone="amber" />
        <StatCard icon={<GraduationCap className="size-5" />} value={String(totalStudents)} label="Students" tone="emerald" />
        <StatCard icon={<BarChart3 className="size-5" />} value={String(avgPerClass)} label="Avg / class" tone="violet" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Banknote className="size-5" />} value={formatKes(totalPaid)} label="Fees paid" tone="emerald" big />
        <StatCard icon={<Hourglass className="size-5" />} value={formatKes(totalBalance)} label="Outstanding" tone="rose" big />
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-display font-bold">All Classes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-medium px-5 py-3">Class</th>
                <th className="text-left font-medium px-5 py-3">Class Teachers</th>
                <th className="text-left font-medium px-5 py-3">Streams</th>
                <th className="text-left font-medium px-5 py-3">Students</th>
                <th className="text-left font-medium px-5 py-3">Fee Paid</th>
                <th className="text-left font-medium px-5 py-3">Fee Balance</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {classesQ.isLoading && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!classesQ.isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                  No classes yet. Click "Add Class" to create one.
                </td></tr>
              )}
              {filtered.map((g) => {
                const teachers = Array.from(g.teachers).map((id) => teacherMap.get(id)).filter(Boolean).join(", ");
                return (
                  <tr key={g.grade} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-4 font-medium">{g.grade}</td>
                    <td className="px-5 py-4 text-muted-foreground">{teachers || <span className="italic">Unassigned</span>}</td>
                    <td className="px-5 py-4">{g.classes.length}</td>
                    <td className="px-5 py-4">{g.students}</td>
                    <td className="px-5 py-4 text-emerald-600 font-medium">{formatKes(g.paid)}</td>
                    <td className="px-5 py-4">{formatKes(g.balance)}</td>
                    <td className="px-5 py-4 text-right">
                      <Link to="/students" className="text-primary hover:underline text-sm">View</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-xs text-muted-foreground text-right border-t border-border">
          {filtered.length} of {grouped.length} class rows in table
        </div>
      </Card>
    </>
  );
}

function formatKes(n: number) {
  if (!n) return "KES 0";
  if (n >= 1000) return `KES ${n.toLocaleString()}`;
  return `KES ${n}`;
}

function StatCard({
  icon, value, label, tone, big,
}: { icon: React.ReactNode; value: string; label: string; tone: "blue" | "amber" | "emerald" | "violet" | "rose"; big?: boolean }) {
  const tones: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    amber: "bg-amber-100 text-amber-600",
    emerald: "bg-emerald-100 text-emerald-600",
    violet: "bg-violet-100 text-violet-600",
    rose: "bg-rose-100 text-rose-600",
  };
  return (
    <Card className="p-5">
      <div className={`inline-flex items-center justify-center size-10 rounded-lg ${tones[tone]} mb-4`}>{icon}</div>
      <div className={`font-display font-bold text-foreground ${big ? "text-3xl" : "text-3xl"}`}>{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </Card>
  );
}

function AddClassDialog({ teachers, onCreated }: { teachers: Array<{ id: string; full_name: string }>; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [grade, setGrade] = useState(GRADE_LEVELS[0]);
  const [streams, setStreams] = useState<string[]>([]);
  const [noStreams, setNoStreams] = useState(false);
  const [teacherId, setTeacherId] = useState<string>("");

  const reset = () => {
    setGrade(GRADE_LEVELS[0]);
    setStreams([]);
    setNoStreams(false);
    setTeacherId("");
  };

  const toggleStream = (s: string) => {
    setNoStreams(false);
    setStreams((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const m = useMutation({
    mutationFn: async () => {
      const rows: Array<{ name: string; grade_level: string; stream: string | null; class_teacher_id: string | null }> = [];
      if (noStreams || streams.length === 0) {
        rows.push({ name: grade, grade_level: grade, stream: null, class_teacher_id: teacherId || null });
      } else {
        streams.forEach((s) => {
          const letter = s.replace("Stream ", "");
          rows.push({ name: `${grade} ${letter}`, grade_level: grade, stream: letter, class_teacher_id: teacherId || null });
        });
      }
      const { error } = await supabase.from("classes").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Class created");
      setOpen(false);
      reset();
      onCreated();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4 mr-1" /> Add Class</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" /> Add Class / Stream
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div>
            <Label>Grade Level</Label>
            <select
              className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              {GRADE_LEVELS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <Label>Streams</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {STREAM_OPTIONS.map((s) => {
                const active = streams.includes(s) && !noStreams;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStream(s)}
                    className={`px-4 py-2 rounded-md border text-sm transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"}`}
                  >
                    {s}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => { setNoStreams(true); setStreams([]); }}
                className={`px-4 py-2 rounded-md border text-sm transition-colors ${noStreams ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"}`}
              >
                No Streams
              </button>
            </div>
          </div>
          <div>
            <Label>Class Teacher</Label>
            <select
              className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              <option value="">— Select Teacher —</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name || "Unnamed"}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || (!noStreams && streams.length === 0 && false)}
          >
            {m.isPending ? "Saving…" : "Create Class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
