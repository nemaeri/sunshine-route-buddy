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

export const Route = createFileRoute("/teacher/marks")({
  component: TeacherMarksPage,
  head: () => ({ meta: [{ title: "Marks Entry — Teacher" }] }),
});

function TeacherMarksPage() {
  const { user } = useAuth();
  const { data: staff } = useTeacherStaff();
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});

  // Classes (homeroom + taught)
  const classesQ = useQuery({
    enabled: !!staff?.id,
    queryKey: ["t-marks-classes", staff?.id],
    queryFn: async () => {
      const [{ data: own }, { data: taught }] = await Promise.all([
        supabase.from("classes").select("id, name, grade_level").eq("class_teacher_id", staff!.id),
        supabase.from("timetable_slots").select("classes(id, name, grade_level)").eq("teacher_id", staff!.id),
      ]);
      const map = new Map<string, any>();
      (own ?? []).forEach((c: any) => map.set(c.id, c));
      (taught ?? []).forEach((s: any) => { if (s.classes) map.set(s.classes.id, s.classes); });
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
  });
  useEffect(() => { if (!classId && classesQ.data?.[0]) setClassId(classesQ.data[0].id); }, [classesQ.data, classId]);

  // Subjects teacher teaches in this class (via timetable slots)
  const subjectsQ = useQuery({
    enabled: !!staff?.id && !!classId,
    queryKey: ["t-marks-subjects", staff?.id, classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_slots").select("subjects(id, name)")
        .eq("teacher_id", staff!.id).eq("class_id", classId);
      if (error) throw error;
      const map = new Map<string, any>();
      (data ?? []).forEach((s: any) => { if (s.subjects) map.set(s.subjects.id, s.subjects); });
      return [...map.values()];
    },
  });
  useEffect(() => { if (subjectsQ.data && subjectsQ.data[0]) setSubjectId(subjectsQ.data[0].id); else setSubjectId(""); }, [subjectsQ.data]);

  // Assessments for class+subject
  const assessmentsQ = useQuery({
    enabled: !!classId && !!subjectId,
    queryKey: ["t-marks-assessments", classId, subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("id, name, assessment_type, max_score, assessment_date")
        .eq("class_id", classId).eq("subject_id", subjectId)
        .order("assessment_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => { if (assessmentsQ.data && assessmentsQ.data[0]) setAssessmentId(assessmentsQ.data[0].id); else setAssessmentId(""); }, [assessmentsQ.data]);

  const studentsQ = useQuery({
    enabled: !!classId,
    queryKey: ["t-marks-students", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students").select("id, admission_no, first_name, last_name")
        .eq("class_id", classId).eq("active", true).order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const existingQ = useQuery({
    enabled: !!assessmentId,
    queryKey: ["t-marks-existing", assessmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_scores").select("student_id, score").eq("assessment_id", assessmentId);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const next: Record<string, string> = {};
    (existingQ.data ?? []).forEach((r: any) => { next[r.student_id] = String(r.score ?? ""); });
    setScores(next);
  }, [existingQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!assessmentId) throw new Error("Pick an assessment");
      const rows = Object.entries(scores)
        .filter(([, v]) => v !== "" && v !== null)
        .map(([student_id, v]) => ({
          assessment_id: assessmentId, student_id, score: Number(v),
          recorded_by: user?.id ?? null,
        }));
      if (rows.length === 0) return;
      await supabase.from("assessment_scores").delete().eq("assessment_id", assessmentId).in("student_id", rows.map(r => r.student_id));
      const { error } = await supabase.from("assessment_scores").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marks saved"); qc.invalidateQueries({ queryKey: ["t-marks-existing", assessmentId] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const selectedClass = useMemo(() => classesQ.data?.find((c: any) => c.id === classId), [classesQ.data, classId]);
  const selectedSubject = useMemo(() => subjectsQ.data?.find((s: any) => s.id === subjectId), [subjectsQ.data, subjectId]);
  const selectedAssessment = useMemo(() => assessmentsQ.data?.find((a: any) => a.id === assessmentId), [assessmentsQ.data, assessmentId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">Marks</h1>
        <p className="text-sm text-muted-foreground">{selectedClass?.name ?? "—"}</p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <Label>Period</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>
              <option value="">Select…</option>
              {(assessmentsQ.data ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Subject</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {(subjectsQ.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={() => save.mutate()}
          disabled={!assessmentId || save.isPending}
          className="bg-[#11314a] text-white rounded-md px-4 py-2 flex items-center gap-2 text-sm font-semibold hover:bg-[#1d4d72] disabled:opacity-50"
        >
          <Save className="size-4" /> {save.isPending ? "Saving…" : "Save filled marks"}
        </button>
      </Card>

      <Card className="p-5 bg-gradient-to-b from-white to-secondary/40">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Marks are for</p>
        <p className="font-display font-bold text-xl mt-1">{selectedSubject?.name ?? "—"}</p>
        <p className="text-sm text-muted-foreground">{selectedAssessment?.name ?? "—"} · {selectedClass?.name ?? "—"}</p>
      </Card>

      <div>
        <h2 className="font-display font-bold text-lg mb-3">Students</h2>
        {!assessmentId ? (
          <Card className="p-6 text-sm text-muted-foreground">Select a Period (assessment) to enter marks.</Card>
        ) : (studentsQ.data ?? []).length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No students in this class.</Card>
        ) : (
          <div className="space-y-2">
            {(studentsQ.data ?? []).map((s) => (
              <Card key={s.id} className="p-4">
                <p className="font-semibold text-sm">{s.first_name} {s.last_name}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700 mt-1">{selectedSubject?.name ?? ""}</p>
                <p className="text-xs font-mono text-muted-foreground">{s.admission_no}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="number"
                    min={0}
                    max={Number(selectedAssessment?.max_score ?? 100)}
                    step="0.01"
                    placeholder="Tap to enter"
                    value={scores[s.id] ?? ""}
                    onChange={(e) => setScores((sc) => ({ ...sc, [s.id]: e.target.value }))}
                    className="max-w-[180px]"
                  />
                  <span className="text-xs text-muted-foreground">/ {Number(selectedAssessment?.max_score ?? 100)}</span>
                </div>
              </Card>
            ))}
            <p className="text-xs text-muted-foreground">Tap a student to enter or edit marks.</p>
          </div>
        )}
      </div>
    </div>
  );
}
