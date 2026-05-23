import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Check, X, Clock, AlertCircle } from "lucide-react";

type Status = "present" | "absent" | "late" | "excused";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
  head: () => ({ meta: [{ title: "Attendance — JEC" }] }),
});

function AttendancePage() {
  const { user, roles } = useAuth();
  const canMark = roles.includes("admin") || roles.includes("teacher");
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [classId, setClassId] = useState<string>("");
  const [marks, setMarks] = useState<Record<string, Status>>({});

  const classesQ = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!classId && classesQ.data?.[0]) setClassId(classesQ.data[0].id);
  }, [classesQ.data, classId]);

  const rosterQ = useQuery({
    enabled: !!classId,
    queryKey: ["roster", classId],
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

  const existingQ = useQuery({
    enabled: !!classId && !!date,
    queryKey: ["attendance", classId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status")
        .eq("class_id", classId)
        .eq("date", date);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const next: Record<string, Status> = {};
    (rosterQ.data ?? []).forEach((s: any) => { next[s.id] = "present"; });
    (existingQ.data ?? []).forEach((r: any) => { next[r.student_id] = r.status as Status; });
    setMarks(next);
  }, [rosterQ.data, existingQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      // delete then insert (simple upsert by composite)
      await supabase.from("attendance").delete().eq("class_id", classId).eq("date", date);
      const rows = Object.entries(marks).map(([student_id, status]) => ({
        student_id, status, class_id: classId, date, marked_by: user?.id ?? null,
      }));
      if (rows.length === 0) return;
      const { error } = await supabase.from("attendance").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance saved");
      qc.invalidateQueries({ queryKey: ["attendance", classId, date] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const counts = Object.values(marks).reduce(
    (a, s) => { a[s] = (a[s] ?? 0) + 1; return a; },
    {} as Record<string, number>
  );

  return (
    <>
      <PageHeader
        title="Daily Attendance"
        description="One-tap roll for class teachers"
        actions={canMark ? (
          <Button onClick={() => save.mutate()} disabled={!classId || save.isPending}>
            {save.isPending ? "Saving…" : "Save roll"}
          </Button>
        ) : null}
      />

      <Card className="p-4 mb-4 flex flex-wrap items-end gap-4">
        <div>
          <Label>Class</Label>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classesQ.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <Pill label="Present" value={counts.present ?? 0} tone="emerald" />
          <Pill label="Absent" value={counts.absent ?? 0} tone="rose" />
          <Pill label="Late" value={counts.late ?? 0} tone="amber" />
          <Pill label="Excused" value={counts.excused ?? 0} tone="slate" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {rosterQ.isLoading && <p className="p-8 text-center text-sm text-muted-foreground">Loading roster…</p>}
        {!rosterQ.isLoading && rosterQ.data?.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No active students in this class.</p>
        )}
        {rosterQ.data && rosterQ.data.length > 0 && (
          <ul className="divide-y divide-border">
            {rosterQ.data.map((s: any) => (
              <li key={s.id} className="px-6 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">{s.first_name} {s.last_name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{s.admission_no}</p>
                </div>
                <div className="flex gap-1">
                  {(["present","absent","late","excused"] as Status[]).map((st) => (
                    <StatusBtn
                      key={st}
                      status={st}
                      active={marks[s.id] === st}
                      disabled={!canMark}
                      onClick={() => setMarks((m) => ({ ...m, [s.id]: st }))}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Pill({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <span className={`px-2.5 py-1 rounded-md font-bold ${tones[tone]}`}>
      {value} {label}
    </span>
  );
}

function StatusBtn({ status, active, disabled, onClick }: { status: Status; active: boolean; disabled?: boolean; onClick: () => void }) {
  const map: Record<Status, { icon: any; label: string; cls: string }> = {
    present: { icon: Check, label: "P", cls: "bg-emerald-600 text-white border-emerald-600" },
    absent: { icon: X, label: "A", cls: "bg-rose-600 text-white border-rose-600" },
    late: { icon: Clock, label: "L", cls: "bg-amber-500 text-white border-amber-500" },
    excused: { icon: AlertCircle, label: "E", cls: "bg-slate-600 text-white border-slate-600" },
  };
  const m = map[status];
  const Icon = m.icon;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={status}
      className={`size-9 rounded-md border flex items-center justify-center text-xs font-bold transition ${
        active ? m.cls : "bg-background border-border text-muted-foreground hover:bg-secondary"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <Icon className="size-4" />
    </button>
  );
}
