import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeacherStaff } from "@/hooks/useTeacherStaff";
import { Card } from "@/components/PageHeader";
import { Layers, BookOpen } from "lucide-react";

export const Route = createFileRoute("/teacher/subjects")({
  component: TeacherSubjectsPage,
  head: () => ({ meta: [{ title: "My subjects — Teacher" }] }),
});

function TeacherSubjectsPage() {
  const { data: staff } = useTeacherStaff();
  const staffId = staff?.id;

  const slotsQ = useQuery({
    enabled: !!staffId,
    queryKey: ["t-subjects-via-slots", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_slots")
        .select("subject_id, class_id, subjects(id, name), classes(grade_level, name)")
        .eq("teacher_id", staffId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Group: grade_level -> Map(subject_id -> subject_name)
  const byGrade: Record<string, { id: string; name: string }[]> = {};
  const allClasses = new Set<string>();
  const distinctSubjects = new Set<string>();
  (slotsQ.data ?? []).forEach((s: any) => {
    if (!s.subjects || !s.classes) return;
    const grade = s.classes.grade_level ?? "Unassigned";
    allClasses.add(s.classes.name);
    const key = `${grade}::${s.subjects.id}`;
    distinctSubjects.add(key);
    if (!byGrade[grade]) byGrade[grade] = [];
    if (!byGrade[grade].some((x) => x.id === s.subjects.id)) {
      byGrade[grade].push({ id: s.subjects.id, name: s.subjects.name });
    }
  });

  const gradesSorted = Object.keys(byGrade).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">My subjects</h1>
        <p className="text-sm text-muted-foreground">{distinctSubjects.size} subjects across your grades</p>
      </div>

      <Card className="p-8 text-center bg-gradient-to-b from-white to-secondary/40">
        <div className="size-14 rounded-md bg-[#11314a] text-white inline-flex items-center justify-center mb-3">
          <Layers className="size-6" />
        </div>
        <h2 className="font-display font-bold text-xl">Your teaching load</h2>
        <p className="text-sm text-muted-foreground mt-1">{[...allClasses].join(" · ") || "No classes"}</p>
      </Card>

      {gradesSorted.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No subjects yet — ask admin to publish your timetable.</Card>
      ) : gradesSorted.map((grade) => (
        <Card key={grade} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">Grade {grade}</h3>
            <span className="text-xs text-muted-foreground">{byGrade[grade].length} subject{byGrade[grade].length === 1 ? "" : "s"}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {byGrade[grade].map((s) => (
              <div key={s.id} className="rounded-md border border-border p-3 flex items-center gap-3">
                <div className="size-9 rounded-md bg-sky-100 text-sky-700 flex items-center justify-center">
                  <BookOpen className="size-4" />
                </div>
                <p className="font-medium text-sm">{s.name}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
