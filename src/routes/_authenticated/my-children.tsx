import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { Baby, Wallet, CalendarCheck2, Star, BarChart3, Calendar, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-children")({
  component: MyChildrenPage,
  head: () => ({ meta: [{ title: "My Children — JEC" }] }),
});

function MyChildrenPage() {
  const { user } = useAuth();

  const profileQ = useQuery({
    enabled: !!user,
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const q = useQuery({
    enabled: !!user,
    queryKey: ["my-children", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_parents")
        .select(`
          relationship, is_primary,
          students:student_id (
            id, admission_no, first_name, last_name, status, photo_url,
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
      const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status, date")
        .in("student_id", childIds)
        .gte("date", since);
      if (error) throw error;
      return data ?? [];
    },
  });

  const invQ = useQuery({
    enabled: childIds.length > 0,
    queryKey: ["children-invoices", childIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("student_id, balance")
        .in("student_id", childIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const scoresQ = useQuery({
    enabled: childIds.length > 0,
    queryKey: ["children-scores", childIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_scores")
        .select("student_id, score, assessments:assessment_id(max_score)")
        .in("student_id", childIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const attSummary = (sid: string) => {
    const rows = (attendanceQ.data ?? []).filter((r: any) => r.student_id === sid);
    const present = rows.filter((r: any) => r.status === "present").length;
    const total = rows.length;
    const pct = total ? Math.round((present / total) * 100) : null;
    return { present, total, pct };
  };

  const balanceFor = (sid: string) =>
    (invQ.data ?? []).filter((r: any) => r.student_id === sid).reduce((a: number, r: any) => a + Number(r.balance || 0), 0);

  const scoreAvg = (sid: string) => {
    const rows = (scoresQ.data ?? []).filter((r: any) => r.student_id === sid && r.assessments?.max_score);
    if (!rows.length) return null;
    const pct = rows.reduce((a: number, r: any) => a + (Number(r.score) / Number(r.assessments.max_score)) * 100, 0) / rows.length;
    return Math.round(pct * 10) / 10;
  };

  const totalBalance = (invQ.data ?? []).reduce((a: number, r: any) => a + Number(r.balance || 0), 0);
  const overallAtt = (() => {
    const rows = attendanceQ.data ?? [];
    if (!rows.length) return null;
    return Math.round((rows.filter((r: any) => r.status === "present").length / rows.length) * 100);
  })();
  const overallScore = (() => {
    const rows = (scoresQ.data ?? []).filter((r: any) => r.assessments?.max_score);
    if (!rows.length) return null;
    return Math.round(rows.reduce((a: number, r: any) => a + (Number(r.score) / Number(r.assessments.max_score)) * 100, 0) / rows.length);
  })();

  const firstName = profileQ.data?.full_name?.split(" ")[0] || "Parent";

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-foreground">My Children</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back, {profileQ.data?.full_name || "Parent"}</p>
      </div>

      {/* Overview */}
      <section className="mb-8">
        <h2 className="font-display font-bold text-base mb-3">Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={<Baby className="size-5" />} tint="bg-sky-50 text-sky-600" label="Children" value={`${childIds.length}`} />
          <StatTile icon={<Wallet className="size-5" />} tint="bg-amber-50 text-amber-600" label="Balance" value={`KES ${totalBalance.toLocaleString()}`} />
          <StatTile icon={<CalendarCheck2 className="size-5" />} tint="bg-emerald-50 text-emerald-600" label="Attendance" value={overallAtt == null ? "—" : `${overallAtt}%`} />
          <StatTile icon={<Star className="size-5" />} tint="bg-violet-50 text-violet-600" label="Scores" value={overallScore == null ? "—" : `${overallScore}%`} />
        </div>
      </section>

      {/* Children */}
      <section className="mb-8">
        <h2 className="font-display font-bold text-base mb-3">Your children</h2>
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
            const att = attSummary(s.id);
            const bal = balanceFor(s.id);
            const sc = scoreAvg(s.id);
            return (
              <Card key={s.id} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="size-14 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-white flex items-center justify-center text-base font-display font-bold">
                    {s.first_name?.[0]}{s.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-lg leading-tight">
                      {s.first_name} {s.last_name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.classes?.name ?? "Unassigned"} · Adm · <span className="font-mono">{s.admission_no}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                    {s.status || "Active"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-secondary p-3 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Attendance</p>
                    <p className="font-display font-bold text-xl mt-1 text-brand-navy">
                      {att.pct == null ? "—" : `${att.pct}%`} <span className="text-xs font-semibold text-muted-foreground">· {att.total}d</span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Scores</p>
                    <p className="font-display font-bold text-xl mt-1 text-brand-navy">
                      {sc == null ? "—" : `${sc}%`} <span className="text-xs font-semibold text-muted-foreground">avg</span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-center gap-3">
                  <div className="size-10 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Wallet className="size-5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-amber-700 font-bold">Balance</p>
                    <p className="font-display font-bold text-lg text-amber-900">KES {bal.toLocaleString()}</p>
                  </div>
                </div>

                <Link
                  to="/my-fees"
                  search={{ student: s.id }}
                  className="mt-3 flex items-center justify-center gap-2 w-full text-sm font-bold px-3 py-2.5 rounded-md bg-gradient-to-r from-brand-navy to-sky-700 text-white hover:opacity-95"
                >
                  <Receipt className="size-4" /> Fees
                </Link>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link
                    to="/my-performance"
                    className="flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-md border border-border hover:bg-secondary"
                  >
                    <BarChart3 className="size-4" /> Scores
                  </Link>
                  <Link
                    to="/my-attendance"
                    className="flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-md border border-border hover:bg-secondary"
                  >
                    <Calendar className="size-4" /> Attend
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display font-bold text-base mb-2">Notices</h2>
        <p className="text-sm text-muted-foreground">School announcements will show here when messaging is on.</p>
      </section>
    </>
  );
}

function StatTile({ icon, tint, label, value }: { icon: React.ReactNode; tint: string; label: string; value: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`size-10 rounded-lg flex items-center justify-center ${tint}`}>{icon}</div>
      <div>
        <p className="font-display font-bold text-base leading-tight">{value}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-0.5">{label}</p>
      </div>
    </Card>
  );
}
