import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { Check, X, Percent } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-attendance")({
  component: MyAttendancePage,
  head: () => ({ meta: [{ title: "Attendance — JEC" }] }),
});

function MyAttendancePage() {
  const { user } = useAuth();

  const childrenQ = useQuery({
    enabled: !!user,
    queryKey: ["ma-children", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_parents")
        .select("students:student_id ( id, first_name, last_name, classes:class_id ( name ) )")
        .eq("parent_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.students).filter(Boolean);
    },
  });

  const ids: string[] = (childrenQ.data ?? []).map((s: any) => s.id);

  const attQ = useQuery({
    enabled: ids.length > 0,
    queryKey: ["ma-att", ids],
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status, date")
        .in("student_id", ids)
        .gte("date", since)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`${ids.length} learner${ids.length === 1 ? "" : "s"} · last 90 days`}
      />

      {childrenQ.data?.map((child: any) => {
        const rows = (attQ.data ?? []).filter((r: any) => r.student_id === child.id);
        const present = rows.filter((r: any) => r.status === "present").length;
        const absent = rows.filter((r: any) => r.status === "absent").length;
        const rate = rows.length ? Math.round((present / rows.length) * 100) : 0;
        const last28 = rows.slice(0, 28).reverse();

        return (
          <Card key={child.id} className="mb-4 overflow-hidden">
            <div className="px-5 py-3 bg-secondary/50 border-b border-border">
              <h3 className="font-display font-bold text-lg">
                {child.first_name} {child.last_name}
              </h3>
              <p className="text-xs text-muted-foreground">{child.classes?.name}</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-3 mb-5">
                <Stat icon={<Check className="size-4" />} value={present} label="Present" tone="emerald" />
                <Stat icon={<X className="size-4" />} value={absent} label="Absent" tone="red" />
                <Stat icon={<Percent className="size-4" />} value={`${rate}%`} label="Rate" tone="navy" />
              </div>

              <p className="text-sm font-semibold mb-2">
                Last 28 school days{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (tap squares for date)
                </span>
              </p>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: 28 }).map((_, i) => {
                  const r = last28[i];
                  const color = !r
                    ? "bg-secondary"
                    : r.status === "present"
                      ? "bg-brand-emerald"
                      : r.status === "absent"
                        ? "bg-red-400"
                        : "bg-amber-400";
                  return (
                    <div
                      key={i}
                      title={r ? `${r.date} · ${r.status}` : "No record"}
                      className={`size-4 rounded ${color}`}
                    />
                  );
                })}
              </div>
            </div>
          </Card>
        );
      })}
    </>
  );
}

function Stat({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  tone: "emerald" | "red" | "navy";
}) {
  const map = {
    emerald: "bg-brand-emerald/15 text-brand-emerald",
    red: "bg-red-100 text-red-500",
    navy: "bg-brand-navy/10 text-brand-navy",
  };
  return (
    <div className="rounded-lg border border-border p-3 flex items-center gap-3">
      <div className={`size-9 rounded-md flex items-center justify-center ${map[tone]}`}>
        {icon}
      </div>
      <div>
        <p className="font-display font-bold text-xl leading-none">{value}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">
          {label}
        </p>
      </div>
    </div>
  );
}
