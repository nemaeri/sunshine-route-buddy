import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Plus, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/exams")({
  component: ExamsPage,
  head: () => ({ meta: [{ title: "Exams & Reports — JEC" }] }),
});

// CBC performance bands
function cbcBand(pct: number): { label: string; tone: string } {
  if (pct >= 80) return { label: "Exceeding Expectation", tone: "bg-emerald-100 text-emerald-800" };
  if (pct >= 65) return { label: "Meeting Expectation", tone: "bg-sky-100 text-sky-800" };
  if (pct >= 50) return { label: "Approaching Expectation", tone: "bg-amber-100 text-amber-800" };
  return { label: "Below Expectation", tone: "bg-rose-100 text-rose-800" };
}

function ExamsPage() {
  const { roles, user } = useAuth();
  const isStaff = roles.includes("admin") || roles.includes("teacher");
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const assessmentsQ = useQuery({
    queryKey: ["assessments"],
    queryFn: async () => {
      const [a, c, s, t] = await Promise.all([
        supabase.from("assessments").select("id, name, assessment_type, max_score, assessment_date, class_id, subject_id, term_id").order("assessment_date", { ascending: false }),
        supabase.from("classes").select("id, name, grade_level"),
        supabase.from("subjects").select("id, name, code"),
        supabase.from("terms").select("id, academic_year, term_number"),
      ]);
      if (a.error) throw a.error;
      const cm = new Map((c.data ?? []).map((x: any) => [x.id, x]));
      const sm = new Map((s.data ?? []).map((x: any) => [x.id, x]));
      const tm = new Map((t.data ?? []).map((x: any) => [x.id, x]));
      return (a.data ?? []).map((x: any) => ({
        ...x, classes: cm.get(x.class_id), subjects: sm.get(x.subject_id), terms: tm.get(x.term_id),
      }));
    },
  });

  return (
    <>
      <PageHeader
        title="Exams & Report Cards"
        description="CBC competency assessments and student performance tracking"
        actions={isStaff ? <NewAssessmentDialog userId={user?.id ?? null} onCreated={() => qc.invalidateQueries({ queryKey: ["assessments"] })} /> : null}
      />

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-5 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-secondary/40">
            <h3 className="font-display font-bold text-sm">Assessments</h3>
          </div>
          {assessmentsQ.isLoading && <p className="p-6 text-sm text-muted-foreground">Loading…</p>}
          {assessmentsQ.data?.length === 0 && <p className="p-6 text-sm text-muted-foreground">No assessments yet.</p>}
          <ul className="divide-y divide-border max-h-[600px] overflow-y-auto">
            {assessmentsQ.data?.map((a: any) => (
              <li key={a.id}>
                <button
                  onClick={() => setSelected(a.id)}
                  className={`w-full text-left px-5 py-3 hover:bg-secondary/40 transition ${selected === a.id ? "bg-secondary/60" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{a.name}</p>
                    <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-brand-gold/15 text-brand-gold">{a.assessment_type}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {a.classes?.name} · {a.subjects?.name} · {new Date(a.assessment_date).toLocaleDateString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="col-span-12 lg:col-span-7">
          {selected ? (
            <GradebookPanel assessmentId={selected} canEdit={isStaff} userId={user?.id ?? null} />
          ) : (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              <FileText className="size-8 mx-auto mb-3 opacity-40" />
              Select an assessment to enter or view scores.
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function GradebookPanel({ assessmentId, canEdit, userId }: { assessmentId: string; canEdit: boolean; userId: string | null }) {
  const qc = useQueryClient();
  const [scores, setScores] = useState<Record<string, { score: string; comment: string }>>({});

  const assessmentQ = useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("id, name, max_score, class_id, subjects:subject_id(name)")
        .eq("id", assessmentId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const rosterQ = useQuery({
    enabled: !!assessmentQ.data?.class_id,
    queryKey: ["roster", assessmentQ.data?.class_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, admission_no, first_name, last_name")
        .eq("class_id", assessmentQ.data!.class_id)
        .eq("active", true)
        .order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const existingQ = useQuery({
    queryKey: ["assessment-scores", assessmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_scores")
        .select("student_id, score, comment")
        .eq("assessment_id", assessmentId);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const next: Record<string, { score: string; comment: string }> = {};
    (rosterQ.data ?? []).forEach((s: any) => { next[s.id] = { score: "", comment: "" }; });
    (existingQ.data ?? []).forEach((r: any) => {
      next[r.student_id] = { score: r.score?.toString() ?? "", comment: r.comment ?? "" };
    });
    setScores(next);
  }, [rosterQ.data, existingQ.data]);

  const maxScore = Number(assessmentQ.data?.max_score ?? 100);

  const save = useMutation({
    mutationFn: async () => {
      await supabase.from("assessment_scores").delete().eq("assessment_id", assessmentId);
      const rows = Object.entries(scores)
        .filter(([, v]) => v.score !== "")
        .map(([student_id, v]) => {
          const score = Number(v.score);
          const pct = (score / maxScore) * 100;
          return {
            assessment_id: assessmentId,
            student_id,
            score,
            performance_level: cbcBand(pct).label,
            comment: v.comment || null,
            recorded_by: userId,
          };
        });
      if (rows.length === 0) return;
      const { error } = await supabase.from("assessment_scores").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Scores saved");
      qc.invalidateQueries({ queryKey: ["assessment-scores", assessmentId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4 bg-secondary/30">
        <div>
          <h3 className="font-display font-bold">{assessmentQ.data?.name}</h3>
          <p className="text-xs text-muted-foreground">{assessmentQ.data?.subjects?.name} · Max {maxScore}</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save scores"}
          </Button>
        )}
      </div>
      <ul className="divide-y divide-border max-h-[600px] overflow-y-auto">
        {rosterQ.data?.map((s: any) => {
          const v = scores[s.id] ?? { score: "", comment: "" };
          const pct = v.score ? (Number(v.score) / maxScore) * 100 : null;
          const band = pct !== null ? cbcBand(pct) : null;
          return (
            <li key={s.id} className="px-5 py-3 grid grid-cols-12 gap-3 items-center">
              <div className="col-span-5">
                <p className="text-sm font-medium">{s.first_name} {s.last_name}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{s.admission_no}</p>
              </div>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  type="number"
                  className="h-9 w-20"
                  value={v.score}
                  disabled={!canEdit}
                  onChange={(e) => setScores((m) => ({ ...m, [s.id]: { ...v, score: e.target.value } }))}
                />
                <span className="text-[11px] text-muted-foreground">/ {maxScore}</span>
              </div>
              <div className="col-span-4">
                {band && (
                  <span className={`text-[10px] font-bold px-2 py-1 rounded ${band.tone}`}>
                    {band.label}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function NewAssessmentDialog({ userId, onCreated }: { userId: string | null; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", class_id: "", subject_id: "", term_id: "",
    assessment_type: "cat", max_score: 100, assessment_date: new Date().toISOString().slice(0, 10),
  });

  const classes = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });
  const subjects = useQuery({
    queryKey: ["subjects-list"],
    queryFn: async () => (await supabase.from("subjects").select("id, name, code").order("name")).data ?? [],
  });
  const terms = useQuery({
    queryKey: ["terms-list"],
    queryFn: async () => (await supabase.from("terms").select("id, academic_year, term_number").order("academic_year", { ascending: false })).data ?? [],
  });

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assessments").insert({ ...form, created_by: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assessment created");
      setOpen(false);
      onCreated();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New assessment</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create assessment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Term 2 CAT 1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Class</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                <option value="">—</option>
                {classes.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Subject</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                <option value="">—</option>
                {subjects.data?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Term</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.term_id} onChange={(e) => setForm({ ...form, term_id: e.target.value })}>
                <option value="">—</option>
                {terms.data?.map((t: any) => <option key={t.id} value={t.id}>{t.academic_year} T{t.term_number}</option>)}
              </select>
            </div>
            <div>
              <Label>Type</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.assessment_type} onChange={(e) => setForm({ ...form, assessment_type: e.target.value })}>
                <option value="cat">CAT</option>
                <option value="exam">Exam</option>
                <option value="project">Project</option>
                <option value="oral">Oral</option>
              </select>
            </div>
            <div><Label>Max score</Label><Input type="number" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: Number(e.target.value) })} /></div>
          </div>
          <div><Label>Date</Label><Input type="date" value={form.assessment_date} onChange={(e) => setForm({ ...form, assessment_date: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!form.name || !form.class_id || !form.subject_id || !form.term_id || m.isPending}>
            {m.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
