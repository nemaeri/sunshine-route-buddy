import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, Card } from "@/components/PageHeader";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — JEC" }] }),
});

function Dashboard() {
  const { user, roles } = useAuth();

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [students, staff, attendanceToday, classes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("staff").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("attendance").select("status").eq("date", new Date().toISOString().slice(0, 10)),
        supabase.from("classes").select("id, name, grade_level"),
      ]);
      const att = attendanceToday.data ?? [];
      const present = att.filter((a) => a.status === "present").length;
      const pct = att.length ? Math.round((present / att.length) * 100) : 0;
      return {
        students: students.count ?? 0,
        staff: staff.count ?? 0,
        attendancePct: pct,
        classes: classes.data ?? [],
      };
    },
  });

  const announcements = useQuery({
    queryKey: ["announcements-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, body, created_at")
        .order("created_at", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  const chartData = (stats.data?.classes ?? []).slice(0, 6).map((c) => ({
    name: c.grade_level,
    students: Math.floor(Math.random() * 40) + 25, // placeholder per-class count until aggregation added
  }));

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.user_metadata?.full_name || user?.email}`}
        description={`Signed in as ${roles.join(", ") || "user"} · ${new Date().toLocaleDateString("en-KE", { weekday: "long", month: "long", day: "numeric" })}`}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard label="Students" value={stats.data?.students ?? "—"} hint="Active enrollment" />
        <StatCard label="Staff" value={stats.data?.staff ?? "—"} hint="On payroll" />
        <StatCard
          label="Attendance"
          value={`${stats.data?.attendancePct ?? 0}%`}
          hint="Today"
          accent={(stats.data?.attendancePct ?? 0) >= 90 ? "emerald" : "gold"}
        />
        <StatCard label="Fees Collected" value="72%" hint="KES 4.2M / Term 2" accent="gold" />
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Chart */}
        <Card className="col-span-12 lg:col-span-8 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-bold text-foreground">Enrollment by Grade</h3>
            <span className="text-xs text-muted-foreground">CBC Grade levels</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "hsl(var(--accent) / 0.3)" }} />
                <Bar dataKey="students" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill="oklch(0.31 0.13 265)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Announcements */}
        <Card className="col-span-12 lg:col-span-4 p-6">
          <h3 className="font-display font-bold text-foreground mb-4">School Announcements</h3>
          {announcements.data?.length ? (
            <div className="space-y-4">
              {announcements.data.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <div className="size-2 mt-1.5 rounded-full bg-brand-gold shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-foreground">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground">{a.body.slice(0, 80)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          )}
        </Card>

        {/* Bus widget */}
        <Card className="col-span-12 lg:col-span-8 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-foreground">Fleet Tracking</h3>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-red-500 animate-pulse" />
              Live GPS
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Bus tracking goes live in Phase 5. Drivers will share GPS; parents will see the bus on a Google Map.
          </p>
        </Card>

        <Card className="col-span-12 lg:col-span-4 p-6 bg-brand-navy text-white">
          <h3 className="font-display font-bold mb-2">CBC Reports</h3>
          <p className="text-xs text-white/70 mb-4">
            End-of-term competency reports for Grade 1–6 will be available in Phase 3.
          </p>
          <button className="w-full py-2 bg-white text-brand-navy rounded-lg text-xs font-bold">
            Roadmap
          </button>
        </Card>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent = "navy",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "navy" | "gold" | "emerald";
}) {
  const colorMap = {
    navy: "text-brand-navy",
    gold: "text-brand-gold",
    emerald: "text-brand-emerald",
  };
  return (
    <Card className="p-6">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-display font-bold ${colorMap[accent]}`}>{value}</span>
        {hint ? <span className="text-[11px] text-muted-foreground font-medium">{hint}</span> : null}
      </div>
    </Card>
  );
}
