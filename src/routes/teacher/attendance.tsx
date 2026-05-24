import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherStaff } from "@/hooks/useTeacherStaff";
import { Card } from "@/components/PageHeader";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/teacher/attendance")({
  component: TeacherAttendancePage,
  head: () => ({ meta: [{ title: "Attendance — Teacher" }] }),
});

type Status = "present" | "absent";

function TeacherAttendancePage() {
  const { user } = useAuth();
  const { data: staff } = useTeacherStaff();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [classId, setClassId] = useState("");
  const [marks, setMarks] = useState<Record<string, Status>>({});

  // Teacher's homeroom + taught classes (union)
  const classesQ = useQuery({
    enabled: !!staff?.id,
    queryKey: ["t-att-classes", staff?.id],
    queryFn: async () => {
      const [{ data: own }, { data: taught }] = await Promise.all([
        supabase.from("classes").select("id, name, grade_level, stream").eq("class_teacher_id", staff!.id),
        supabase.from("timetable_slots").select("class_id, classes(id, name, grade_level, stream)").eq("teacher_id", staff!.id),
      ]);
      const map = new Map<string, any>();
      (own ?? []).forEach((c: any) => map.set(c.id, c));
      (taught ?? []).forEach((s: any) => { if (s.classes) map.set(s.classes.id, s.classes); });
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  // pick grade & stream from list (screenshot shows separate Class/Stream selects; we use single)
  useEffect(() => {
    if (!classId && classesQ.data?.[0]) setClassId(classesQ.data[0].id);
  }, [classesQ.data, classId]);

  const studentsQ = useQuery({
    enabled: !!classId,
    queryKey: ["t-att-students", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students").select("id, admission_no, first_name, last_name")
        .eq("class_id", classId).eq("active", true).order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const existingQ = useQuery({
    enabled: !!classId && !!date,
    queryKey: ["t-att-existing", classId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance").select("student_id, status")
        .eq("class_id", classId).eq("date", date);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const next: Record<string, Status> = {};
    (existingQ.data ?? []).forEach((r: any) => { next[r.student_id] = (r.status === "absent" ? "absent" : "present"); });
    setMarks(next);
  }, [existingQ.data, classId, date]);

  const save = useMutation({
    mutationFn: async () => {
      await supabase.from("attendance").delete().eq("class_id", classId).eq("date", date);
      const rows = (studentsQ.data ?? []).map((s) => ({
        student_id: s.id, class_id: classId, date,
        status: marks[s.id] ?? "present",
        marked_by: user?.id ?? null,
      }));
      if (rows.length === 0) return;
      const { error } = await supabase.from("attendance").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Attendance saved"); qc.invalidateQueries({ queryKey: ["t-att-existing", classId, date] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const selected = useMemo(() => classesQ.data?.find((c: any) => c.id === classId), [classesQ.data, classId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">Attendance</h1>
        <p className="text-sm text-muted-foreground">{selected?.name ?? "—"} · {date}</p>
      </div>

      <Card className="p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Class</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {(classesQ.data ?? []).map((c: any) => <option key={c.id} value={c.id}>Grade {c.grade_level}</option>)}
            </select>
          </div>
          <div>
            <Label>Stream</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {(classesQ.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Tap <b>Present</b> or <b>Absent</b> for each pupil, then save.</p>
        <button
          onClick={() => save.mutate()}
          disabled={!classId || save.isPending}
          className="w-full bg-[#11314a] text-white rounded-md py-3 flex items-center justify-center gap-2 text-sm font-semibold hover:bg-[#1d4d72] disabled:opacity-50"
        >
          <Save className="size-4" /> {save.isPending ? "Saving…" : "Save attendance"}
        </button>
      </Card>

      <div className="space-y-2">
        {studentsQ.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
          (studentsQ.data ?? []).length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">No students in this class.</Card> :
          (studentsQ.data ?? []).map((s) => {
            const status = marks[s.id] ?? "present";
            return (
              <Card key={s.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{s.first_name} {s.last_name}</p>
                  <p className="text-xs font-mono text-muted-foreground">{s.admission_no}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMarks((m) => ({ ...m, [s.id]: "present" }))}
                    className={`px-5 py-2 rounded-md border text-sm font-semibold transition-colors ${status === "present" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-border text-muted-foreground hover:bg-secondary"}`}
                  >Present</button>
                  <button
                    onClick={() => setMarks((m) => ({ ...m, [s.id]: "absent" }))}
                    className={`px-5 py-2 rounded-md border text-sm font-semibold transition-colors ${status === "absent" ? "bg-rose-600 text-white border-rose-600" : "bg-white border-border text-muted-foreground hover:bg-secondary"}`}
                  >Absent</button>
                </div>
              </Card>
            );
          })
        }
      </div>
    </div>
  );
}
