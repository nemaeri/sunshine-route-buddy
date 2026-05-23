import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { Bus, CalendarCheck2, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-children")({
  component: MyChildrenPage,
  head: () => ({ meta: [{ title: "My Children — JEC" }] }),
});

function MyChildrenPage() {
  const { user } = useAuth();

  const q = useQuery({
    enabled: !!user,
    queryKey: ["my-children", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_parents")
        .select(`
          relationship, is_primary,
          students:student_id (
            id, admission_no, first_name, last_name, gender, photo_url,
            classes:class_id ( name, grade_level )
          )
        `)
        .eq("parent_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const childIds = (q.data ?? []).map((r: any) => r.students?.id).filter(Boolean);

  const attendanceQ = useQuery({
    enabled: childIds.length > 0,
    queryKey: ["children-attendance", childIds],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status, date")
        .in("student_id", childIds)
        .gte("date", since);
      if (error) throw error;
      return data ?? [];
    },
  });

  const summary = (sid: string) => {
    const rows = (attendanceQ.data ?? []).filter((r: any) => r.student_id === sid);
    const present = rows.filter((r: any) => r.status === "present").length;
    const total = rows.length;
    const pct = total ? Math.round((present / total) * 100) : null;
    return { present, total, pct };
  };

  const stopQ = useQuery({
    enabled: childIds.length > 0,
    queryKey: ["children-stops", childIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_stop_assignments")
        .select("student_id, shift, stops:stop_id ( name, scheduled_pickup, scheduled_dropoff, routes:route_id ( name ) )")
        .in("student_id", childIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader title="My Children" description="Attendance, transport and updates for your learners" />

      {q.isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}
      {q.data?.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No children linked to this account yet. Ask the school admin to link your learner(s).
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {q.data?.map((r: any) => {
          const s = r.students;
          if (!s) return null;
          const att = summary(s.id);
          const stops = (stopQ.data ?? []).filter((x: any) => x.student_id === s.id);
          return (
            <Card key={s.id} className="p-5">
              <div className="flex items-start gap-4">
                <div className="size-14 rounded-full bg-secondary border border-border flex items-center justify-center text-lg font-display font-bold text-muted-foreground">
                  {s.first_name?.[0]}{s.last_name?.[0]}
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-bold text-lg leading-tight">
                    {s.first_name} {s.last_name}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">{s.admission_no}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <GraduationCap className="size-3.5" /> {s.classes?.name ?? "Unassigned"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-secondary p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                    <CalendarCheck2 className="size-3" /> 30-day attendance
                  </p>
                  <p className="font-display font-bold text-2xl mt-1 text-brand-navy">
                    {att.pct == null ? "—" : `${att.pct}%`}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{att.present}/{att.total} days present</p>
                </div>
                <div className="rounded-lg bg-secondary p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                    <Bus className="size-3" /> Transport
                  </p>
                  {stops.length === 0 ? (
                    <p className="text-xs text-muted-foreground mt-2">No bus route assigned</p>
                  ) : stops.map((x: any, i: number) => (
                    <div key={i} className="mt-1">
                      <p className="text-xs font-semibold leading-tight">{x.stops?.name}</p>
                      <p className="text-[11px] text-muted-foreground">{x.stops?.routes?.name}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Link
                  to="/bus"
                  className="flex-1 text-center text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-md border border-border hover:bg-secondary"
                >
                  Track bus
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
