import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeacherStaff } from "@/hooks/useTeacherStaff";
import { Card } from "@/components/PageHeader";
import { Building2, Users, CalendarCheck, Pencil, BookOpen, CalendarRange, ChevronRight, Star } from "lucide-react";

export const Route = createFileRoute("/teacher/dashboard")({
  component: TeacherDashboard,
  head: () => ({ meta: [{ title: "My Dashboard — Teacher" }] }),
});



function TeacherDashboard() {
  const { data: staff } = useTeacherStaff();
  const staffId = staff?.id;
  const today = new Date();
  const todayIso = today.toISOString().slice(0,10);
  const dow = today.getDay();

  // Homeroom classes
  const classesQ = useQuery({
    enabled: !!staffId,
    queryKey: ["t-homeroom-classes", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, grade_level, stream")
        .eq("class_teacher_id", staffId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const classIds = (classesQ.data ?? []).map((c) => c.id);

  // Students in those homerooms
  const studentsQ = useQuery({
    enabled: classIds.length > 0,
    queryKey: ["t-students-count", classIds],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds)
        .eq("active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Attendance today (present/late/excused) across homerooms
  const todayAttQ = useQuery({
    enabled: classIds.length > 0,
    queryKey: ["t-att-today", classIds, todayIso],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds)
        .eq("date", todayIso)
        .in("status", ["present","late","excused"]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Teacher's timetable slots
  const slotsQ = useQuery({
    enabled: !!staffId,
    queryKey: ["t-slots", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_slots")
        .select("id, day_of_week, start_time, end_time, class_id, subject_id, classes(name), subjects(name)")
        .eq("teacher_id", staffId!)
        .order("day_of_week").order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });

  const todaysSlots = (slotsQ.data ?? []).filter((s: any) => s.day_of_week === dow);

  // Catalogue: distinct subjects taught
  const catalogue = Array.from(new Set((slotsQ.data ?? []).map((s: any) => s.subjects?.name).filter(Boolean)));

  // Marks pending: assessments for teacher's classes missing scores for their students
  const pendingMarksQ = useQuery({
    enabled: classIds.length > 0,
    queryKey: ["t-marks-pending", classIds],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("assessments")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const firstName = staff?.first_name ?? "Teacher";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">Good day, {staff?.designation ?? "Mrs."} {firstName}</h1>
        <p className="text-sm text-muted-foreground">{today.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Building2} value={classesQ.data?.length ?? 0} label="Classes" tone="sky" />
        <Stat icon={Users} value={studentsQ.data ?? 0} label="Students" tone="sky" />
        <Stat icon={CalendarCheck} value={todayAttQ.data ?? "—"} label="In today" tone="emerald" />
        <Stat icon={Pencil} value={pendingMarksQ.data ?? 0} label="Marks pending" tone="amber" />
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        Attendance "In today" counts pupils marked present, late, or excused. Marks pending is an estimate for the latest exam period. Dates use Africa/Nairobi.
      </p>

      <Card className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-display font-bold text-lg">Today's classes</h2>
            <p className="text-xs text-muted-foreground">From your school timetable (this week).</p>
          </div>
          <Link to="/teacher/timetable" className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary">Full timetable</Link>
        </div>
        {todaysSlots.length === 0 ? (
          <div className="rounded-md bg-secondary/50 border border-border p-4 text-sm text-muted-foreground">
            No lessons on your timetable for today. Open <Link to="/teacher/timetable" className="font-semibold text-foreground underline">Timetable</Link> or ask an administrator to publish your slots.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {todaysSlots.map((s: any) => (
              <li key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{s.subjects?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{s.classes?.name}</p>
                </div>
                <p className="text-xs font-mono text-muted-foreground">{s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-display font-bold text-lg mb-3">Teaching</h2>
        <p className="text-sm text-muted-foreground mb-3">Open subjects or timetable below. A quick peek from your catalogue loads here.</p>
        <div className="rounded-md border border-border bg-sky-50/40 p-3 mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700 mb-1">Catalogue</p>
          <p className="text-sm">{catalogue.length === 0 ? "No subjects assigned yet." : catalogue.join("  ·  ")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TileLink to="/teacher/subjects" icon={BookOpen} title="My subjects" desc="By grade you teach" />
          <TileLink to="/teacher/timetable" icon={CalendarRange} title="Timetable" desc="Weekly schedule" />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-display font-bold text-lg mb-3">Today</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/teacher/attendance" className="bg-[#11314a] text-white rounded-md py-3.5 flex items-center justify-center gap-2 text-sm font-semibold hover:bg-[#1d4d72] transition-colors">
            <CalendarCheck className="size-4" /> Mark attendance
          </Link>
          <Link to="/teacher/marks" className="bg-white border border-border rounded-md py-3.5 flex items-center justify-center gap-2 text-sm font-semibold hover:bg-secondary transition-colors">
            <Star className="size-4" /> Enter marks
          </Link>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-display font-bold text-lg mb-3">My classes</h2>
        {(classesQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No homeroom classes assigned.</p>
        ) : (
          <ul className="space-y-2">
            {(classesQ.data ?? []).map((c: any) => (
              <li key={c.id}>
                <Link to="/teacher/classes/$classId" params={{ classId: c.id }} className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-secondary transition-colors">
                  <div className="size-10 rounded-md bg-[#11314a] text-white flex items-center justify-center text-xs font-bold">
                    G{(c.grade_level ?? "").replace(/[^0-9]/g, "") || "?"}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">Homeroom</p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, value, label, tone }: { icon: any; value: any; label: string; tone: "sky"|"emerald"|"amber" }) {
  const tones = {
    sky: "bg-sky-100 text-sky-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  } as const;
  return (
    <Card className="p-5">
      <div className={`size-10 rounded-md flex items-center justify-center ${tones[tone]} mb-4`}>
        <Icon className="size-5" />
      </div>
      <p className="text-3xl font-display font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </Card>
  );
}

function TileLink({ to, icon: Icon, title, desc }: { to: string; icon: any; title: string; desc: string }) {
  return (
    <Link to={to as any} className="rounded-md border border-border p-4 bg-gradient-to-br from-white to-secondary/50 hover:border-[#11314a] transition-colors">
      <div className="size-10 rounded-md bg-[#11314a] text-white flex items-center justify-center mb-3">
        <Icon className="size-5" />
      </div>
      <p className="font-display font-bold text-base">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </Link>
  );
}
