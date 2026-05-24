import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/PageHeader";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/teacher/classes/$classId")({
  component: ClassRosterPage,
  head: () => ({ meta: [{ title: "Class roster — Teacher" }] }),
});

function ClassRosterPage() {
  const { classId } = Route.useParams();

  const classQ = useQuery({
    queryKey: ["t-class", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes").select("id, name, grade_level").eq("id", classId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const studentsQ = useQuery({
    queryKey: ["t-class-students", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, admission_no, first_name, last_name")
        .eq("class_id", classId)
        .eq("active", true)
        .order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Attendance % over last 30 days (per student)
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const attQ = useQuery({
    enabled: !!studentsQ.data && studentsQ.data.length > 0,
    queryKey: ["t-class-att", classId, since],
    queryFn: async () => {
      const ids = (studentsQ.data ?? []).map((s) => s.id);
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status")
        .in("student_id", ids)
        .gte("date", since);
      if (error) throw error;
      const map: Record<string, { total: number; present: number }> = {};
      (data ?? []).forEach((r: any) => {
        const m = map[r.student_id] ?? (map[r.student_id] = { total: 0, present: 0 });
        m.total += 1;
        if (r.status === "present" || r.status === "late") m.present += 1;
      });
      return map;
    },
  });

  // Latest score per student
  const scoresQ = useQuery({
    enabled: !!studentsQ.data && studentsQ.data.length > 0,
    queryKey: ["t-class-scores", classId],
    queryFn: async () => {
      const ids = (studentsQ.data ?? []).map((s) => s.id);
      const { data, error } = await supabase
        .from("assessment_scores")
        .select("student_id, score, created_at, assessments(name, max_score, subjects(name))")
        .in("student_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const latest: Record<string, any> = {};
      (data ?? []).forEach((r: any) => {
        if (!latest[r.student_id]) latest[r.student_id] = r;
      });
      return latest;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl">Class roster</h1>
          <p className="text-sm text-muted-foreground">{classQ.data?.name ?? "—"} · {studentsQ.data?.length ?? 0} students</p>
        </div>
        <Link to="/teacher/classes" className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary inline-flex items-center gap-2">
          <ArrowLeft className="size-4" /> All classes
        </Link>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
            <tr>
              <th className="text-left font-semibold px-4 py-3 w-12">#</th>
              <th className="text-left font-semibold px-4 py-3">Student</th>
              <th className="text-left font-semibold px-4 py-3">Adm No.</th>
              <th className="text-left font-semibold px-4 py-3">Att. (30d)</th>
              <th className="text-right font-semibold px-4 py-3">Latest score</th>
            </tr>
          </thead>
          <tbody>
            {studentsQ.isLoading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : (studentsQ.data ?? []).length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No students.</td></tr>
            ) : (studentsQ.data ?? []).map((s, i) => {
              const att = attQ.data?.[s.id];
              const pct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null;
              const sc = scoresQ.data?.[s.id];
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 text-[#11314a] font-semibold">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{s.first_name} {s.last_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.admission_no}</td>
                  <td className="px-4 py-3">{pct === null ? "—" : `${pct}%`}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {sc ? <>{sc.assessments?.subjects?.name ?? "—"}: {Number(sc.score).toFixed(2)}/{Number(sc.assessments?.max_score ?? 100).toFixed(2)}</> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
