import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/my-performance")({
  component: MyPerformancePage,
  head: () => ({ meta: [{ title: "Academic performance — JEC" }] }),
});

function MyPerformancePage() {
  const { user } = useAuth();
  const [assessmentType, setAssessmentType] = useState("CAT 1");

  const childrenQ = useQuery({
    enabled: !!user,
    queryKey: ["mp-children", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_parents")
        .select("students:student_id ( id, first_name, last_name, class_id )")
        .eq("parent_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.students).filter(Boolean);
    },
  });

  const ids: string[] = (childrenQ.data ?? []).map((s: any) => s.id);

  const scoresQ = useQuery({
    enabled: ids.length > 0,
    queryKey: ["mp-scores", ids, assessmentType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_scores")
        .select(`
          score, student_id,
          assessments:assessment_id ( name, assessment_type, max_score, subjects:subject_id ( name ) )
        `)
        .in("student_id", ids);
      if (error) throw error;
      return (data ?? []).filter(
        (r: any) => r.assessments?.assessment_type === assessmentType,
      );
    },
  });

  const types = ["CAT 1", "CAT 2", "Mid-Term", "End-Term"];

  return (
    <>
      <PageHeader
        title="Academic performance"
        description={`${ids.length} learner${ids.length === 1 ? "" : "s"} · ${assessmentType}`}
      />

      <Card className="p-5 mb-6">
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Exam period
        </label>
        <select
          value={assessmentType}
          onChange={(e) => setAssessmentType(e.target.value)}
          className="mt-2 w-full px-4 py-3 rounded-lg border border-border bg-background font-medium"
        >
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Card>

      {childrenQ.data?.map((child: any) => {
        const rows = (scoresQ.data ?? []).filter((r: any) => r.student_id === child.id);
        const pct = rows.length
          ? rows.reduce(
              (a: number, r: any) =>
                a + (Number(r.score) / Number(r.assessments?.max_score || 100)) * 100,
              0,
            ) / rows.length
          : 0;
        return (
          <Card key={child.id} className="mb-4 overflow-hidden">
            <div className="px-5 py-3 bg-secondary/50 border-b border-border">
              <h3 className="font-display font-bold text-lg">
                {child.first_name} {child.last_name}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {rows.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No results recorded for {assessmentType} yet.
                </p>
              )}
              {rows.map((r: any, i: number) => {
                const max = Number(r.assessments?.max_score || 100);
                const score = Number(r.score);
                const w = Math.max(0, Math.min(100, (score / max) * 100));
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium">{r.assessments?.subjects?.name}</span>
                      <span className="font-bold text-brand-emerald">
                        {score}/{max}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-brand-emerald rounded-full"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {rows.length > 0 && (
                <div className="mt-2 rounded-lg bg-secondary px-4 py-3 flex items-center justify-between">
                  <span className="font-semibold">Overall average</span>
                  <span className="font-display font-bold text-xl text-brand-emerald">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </>
  );
}
