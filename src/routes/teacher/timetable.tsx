import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeacherStaff } from "@/hooks/useTeacherStaff";
import { Card } from "@/components/PageHeader";

export const Route = createFileRoute("/teacher/timetable")({
  component: TeacherTimetablePage,
  head: () => ({ meta: [{ title: "Timetable — Teacher" }] }),
});

const DAY_NAMES = ["Sun","Monday","Tuesday","Wednesday","Thursday","Friday","Sat"];

function TeacherTimetablePage() {
  const { data: staff } = useTeacherStaff();
  const staffId = staff?.id;
  const today = new Date();

  const slotsQ = useQuery({
    enabled: !!staffId,
    queryKey: ["t-timetable", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_slots")
        .select("id, day_of_week, start_time, end_time, classes(name), subjects(name)")
        .eq("teacher_id", staffId!)
        .order("day_of_week").order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Build period grid: distinct start_time → label P1..Pn
  const sortedTimes = Array.from(new Set((slotsQ.data ?? []).map((s: any) => s.start_time))).sort();
  const periodLabel = (t: string) => `P${sortedTimes.indexOf(t) + 1}`;

  const dows = [1, 2, 3, 4, 5];
  const todayDow = today.getDay();
  const todaysSlots = (slotsQ.data ?? []).filter((s: any) => s.day_of_week === todayDow);
  const todayStr = today.toISOString().slice(0,10);
  const year = today.getFullYear();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">Timetable</h1>
        <p className="text-sm text-muted-foreground">Your weekly schedule (Africa/Nairobi)</p>
      </div>

      <p className="text-sm text-muted-foreground">
        Today ({todayStr}, {today.toLocaleDateString(undefined, { weekday: "long" })}) — Nairobi time
      </p>

      {todaysSlots.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">No lessons on your timetable for today. Ask admin to add your slots for academic year {year}.</Card>
      ) : (
        <Card className="p-4">
          <p className="text-sm font-semibold mb-2">Today's lessons</p>
          <ul className="divide-y divide-border">
            {todaysSlots.map((s: any) => (
              <li key={s.id} className="py-2 flex justify-between text-sm">
                <span><b>{s.subjects?.name}</b> — {s.classes?.name}</span>
                <span className="font-mono text-muted-foreground">{s.start_time?.slice(0,5)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div>
        <h2 className="font-display font-bold text-lg mb-2">Full week</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Period</th>
                {dows.map((d) => <th key={d} className="text-left font-semibold px-4 py-3">{DAY_NAMES[d]}</th>)}
              </tr>
            </thead>
            <tbody>
              {sortedTimes.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No slots scheduled.</td></tr>
              ) : sortedTimes.map((t) => (
                <tr key={t} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs">{periodLabel(t as string)}</td>
                  {dows.map((d) => {
                    const slot = (slotsQ.data ?? []).find((s: any) => s.day_of_week === d && s.start_time === t);
                    return (
                      <td key={d} className="px-4 py-3">
                        {slot ? (
                          <div>
                            <p className="font-semibold text-sm">{(slot as any).subjects?.name}</p>
                            <p className="text-xs text-muted-foreground">{(slot as any).classes?.name}</p>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="flex gap-2">
        <Link to="/teacher/subjects" className="text-sm rounded-md border border-border bg-white px-3 py-1.5 hover:bg-secondary">My subjects</Link>
        <Link to="/teacher/dashboard" className="text-sm rounded-md bg-[#11314a] text-white px-3 py-1.5 hover:bg-[#1d4d72]">Dashboard</Link>
      </div>
    </div>
  );
}
