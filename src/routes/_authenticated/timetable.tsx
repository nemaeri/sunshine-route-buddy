import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Pencil, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/timetable")({
  component: TimetablePage,
  head: () => ({ meta: [{ title: "Timetable — JEC" }] }),
});

const DAYS = [
  { num: 1, name: "Monday" },
  { num: 2, name: "Tuesday" },
  { num: 3, name: "Wednesday" },
  { num: 4, name: "Thursday" },
  { num: 5, name: "Friday" },
];

type Slot = {
  id: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  subjects?: { name: string; code: string } | null;
  profiles?: { full_name: string } | null;
};

function TimetablePage() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("head_teacher");
  const qc = useQueryClient();
  const [classId, setClassId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Slot | null>(null);

  const classesQ = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () =>
      (await supabase.from("classes").select("id, name, grade_level").order("name")).data ?? [],
  });

  useEffect(() => {
    if (!classId && classesQ.data?.[0]) setClassId(classesQ.data[0].id);
  }, [classesQ.data, classId]);

  const subjectsQ = useQuery({
    queryKey: ["subjects-list"],
    queryFn: async () => (await supabase.from("subjects").select("id, name, code").order("name")).data ?? [],
  });

  const teachersQ = useQuery({
    queryKey: ["teachers-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").order("full_name")).data ?? [],
  });

  const slotsQ = useQuery({
    enabled: !!classId,
    queryKey: ["timetable", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_slots")
        .select("id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, subjects:subject_id(name, code), profiles:teacher_id(full_name)")
        .eq("class_id", classId)
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as any as Slot[];
    },
  });

  const byDay = useMemo(() => {
    const map = new Map<number, Slot[]>();
    DAYS.forEach((d) => map.set(d.num, []));
    (slotsQ.data ?? []).forEach((s) => {
      const arr = map.get(s.day_of_week) ?? [];
      arr.push(s);
      map.set(s.day_of_week, arr);
    });
    return map;
  }, [slotsQ.data]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timetable_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Slot removed");
      qc.invalidateQueries({ queryKey: ["timetable", classId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <>
      <PageHeader
        title="Timetable"
        description="Weekly class schedule"
        actions={
          canEdit && classId ? (
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="size-4 mr-1" /> Add slot
            </Button>
          ) : null
        }
      />

      {!classesQ.isLoading && (classesQ.data?.length ?? 0) === 0 ? (
        <Card className="p-10 text-center">
          <CalendarDays className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-display font-bold text-lg">No classes yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Create at least one class before building a timetable.
          </p>
          <Link to="/classes">
            <Button><Plus className="size-4 mr-1" /> Go to Classes</Button>
          </Link>
        </Card>
      ) : (
        <Card className="p-4 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64">
              <Label className="text-xs">Class</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                {classesQ.data?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {DAYS.map((d) => {
          const list = byDay.get(d.num) ?? [];
          return (
            <Card key={d.num} className="overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-secondary/30 flex items-center gap-2">
                <CalendarDays className="size-4 text-brand-navy" />
                <h3 className="font-display font-bold text-sm">{d.name}</h3>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">{list.length} slots</span>
              </div>
              <div className="p-2 space-y-2 min-h-32">
                {list.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">No classes</p>
                )}
                {list.map((s) => (
                  <div key={s.id} className="rounded-md border border-border bg-card p-2.5 hover:border-primary/50 transition-colors group">
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                    </div>
                    <div className="font-medium text-sm mt-0.5">
                      {s.subjects?.name ?? <span className="italic text-muted-foreground">No subject</span>}
                    </div>
                    {s.profiles?.full_name && (
                      <div className="text-[11px] text-muted-foreground">{s.profiles.full_name}</div>
                    )}
                    {s.room && (
                      <div className="text-[11px] text-muted-foreground">Room {s.room}</div>
                    )}
                    {canEdit && (
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditing(s); setOpen(true); }}>
                          <Pencil className="size-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { if (confirm("Remove this slot?")) del.mutate(s.id); }}>
                          <Trash2 className="size-3 text-rose-600" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <SlotDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        classId={classId}
        subjects={subjectsQ.data ?? []}
        teachers={teachersQ.data ?? []}
        onSaved={() => qc.invalidateQueries({ queryKey: ["timetable", classId] })}
      />
    </>
  );
}

function SlotDialog({
  open, onOpenChange, editing, classId, subjects, teachers, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  editing: Slot | null; classId: string;
  subjects: any[]; teachers: any[];
  onSaved: () => void;
}) {
  const [day, setDay] = useState(1);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:40");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [room, setRoom] = useState("");

  useEffect(() => {
    if (open) {
      setDay(editing?.day_of_week ?? 1);
      setStartTime(editing?.start_time?.slice(0, 5) ?? "08:00");
      setEndTime(editing?.end_time?.slice(0, 5) ?? "08:40");
      setSubjectId(editing?.subject_id ?? "");
      setTeacherId(editing?.teacher_id ?? "");
      setRoom(editing?.room ?? "");
    }
  }, [open, editing]);

  const m = useMutation({
    mutationFn: async () => {
      const payload = {
        class_id: classId,
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
        subject_id: subjectId || null,
        teacher_id: teacherId || null,
        room: room || null,
      };
      if (editing) {
        const { error } = await supabase.from("timetable_slots").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("timetable_slots").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Slot updated" : "Slot added");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit slot" : "Add timetable slot"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Day</Label>
            <select
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            >
              {DAYS.map((d) => <option key={d.num} value={d.num}>{d.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Subject</Label>
            <select
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">— Select subject —</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div>
            <Label>Teacher</Label>
            <select
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.full_name || "Unnamed"}</option>)}
            </select>
          </div>
          <div>
            <Label>Room</Label>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Room 12" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!startTime || !endTime || m.isPending}>
            {m.isPending ? "Saving…" : editing ? "Save changes" : "Add slot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
