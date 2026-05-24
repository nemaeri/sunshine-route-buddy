import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeacherStaff } from "@/hooks/useTeacherStaff";
import { Card } from "@/components/PageHeader";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/teacher/transport")({
  component: TeacherTransportPage,
  head: () => ({ meta: [{ title: "Transport — Teacher" }] }),
});

function TeacherTransportPage() {
  const qc = useQueryClient();
  const { data: staff } = useTeacherStaff();
  const [routeId, setRouteId] = useState<string>("");

  const routesQ = useQuery({
    queryKey: ["t-routes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("routes").select("id, name, description, active").eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => { if (!routeId && routesQ.data?.[0]) setRouteId(routesQ.data[0].id); }, [routesQ.data, routeId]);

  const stopsQ = useQuery({
    enabled: !!routeId,
    queryKey: ["t-stops", routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stops").select("id, name, sequence, scheduled_pickup, scheduled_dropoff")
        .eq("route_id", routeId).order("sequence");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Teacher's homeroom students
  const studentsQ = useQuery({
    enabled: !!staff?.id,
    queryKey: ["t-tr-students", staff?.id],
    queryFn: async () => {
      const { data: classes } = await supabase.from("classes").select("id, name").eq("class_teacher_id", staff!.id);
      const classIds = (classes ?? []).map((c: any) => c.id);
      if (classIds.length === 0) return [];
      const { data, error } = await supabase
        .from("students")
        .select("id, admission_no, first_name, last_name, class_id, classes(name)")
        .in("class_id", classIds).eq("active", true).order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const assignsQ = useQuery({
    enabled: !!studentsQ.data && studentsQ.data.length > 0,
    queryKey: ["t-tr-assigns", studentsQ.data?.map((s) => s.id)],
    queryFn: async () => {
      const ids = (studentsQ.data ?? []).map((s) => s.id);
      const { data, error } = await supabase
        .from("student_stop_assignments")
        .select("id, student_id, stop_id, stops(id, name, route_id, scheduled_pickup)")
        .in("student_id", ids);
      if (error) throw error;
      const map: Record<string, any> = {};
      (data ?? []).forEach((r: any) => { map[r.student_id] = r; });
      return map;
    },
  });

  const [selStops, setSelStops] = useState<Record<string, string>>({});
  const [selRoutes, setSelRoutes] = useState<Record<string, string>>({});

  useEffect(() => {
    const sr: Record<string, string> = {};
    const ss: Record<string, string> = {};
    Object.values(assignsQ.data ?? {}).forEach((a: any) => {
      if (a.stops) { sr[a.student_id] = a.stops.route_id; ss[a.student_id] = a.stop_id; }
    });
    setSelRoutes(sr); setSelStops(ss);
  }, [assignsQ.data]);

  const allStopsByRoute = useMemo(() => {
    // We only loaded the selected route stops; for assignment dropdowns we need all routes' stops
    return {};
  }, []);

  const allStopsQ = useQuery({
    queryKey: ["t-tr-all-stops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stops").select("id, name, route_id, scheduled_pickup").order("sequence");
      if (error) throw error;
      const byRoute: Record<string, any[]> = {};
      (data ?? []).forEach((s: any) => { (byRoute[s.route_id] ??= []).push(s); });
      return byRoute;
    },
  });

  const save = useMutation({
    mutationFn: async (studentId: string) => {
      const stopId = selStops[studentId];
      if (!stopId) throw new Error("Pick a stop");
      const existing = assignsQ.data?.[studentId];
      if (existing) {
        const { error } = await supabase.from("student_stop_assignments").update({ stop_id: stopId }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("student_stop_assignments").insert({ student_id: studentId, stop_id: stopId, shift: "both" });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["t-tr-assigns"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const clear = useMutation({
    mutationFn: async (studentId: string) => {
      const existing = assignsQ.data?.[studentId];
      if (!existing) return;
      const { error } = await supabase.from("student_stop_assignments").delete().eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cleared"); qc.invalidateQueries({ queryKey: ["t-tr-assigns"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const selectedRoute = routesQ.data?.find((r: any) => r.id === routeId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">Bus & van routes</h1>
        <p className="text-sm text-muted-foreground">View routes and assign pupils to stops</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg">Routes</h2>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["t-routes"] })}
              className="text-xs rounded-md border border-border px-2.5 py-1 hover:bg-secondary inline-flex items-center gap-1.5"
            ><RefreshCw className="size-3" /> Reload</button>
          </div>
          <div className="space-y-2">
            {(routesQ.data ?? []).map((r: any) => (
              <button
                key={r.id}
                onClick={() => setRouteId(r.id)}
                className={`w-full text-left rounded-md p-3 transition-colors ${routeId === r.id ? "bg-sky-500 text-white" : "bg-secondary/40 hover:bg-secondary"}`}
              >
                <p className="font-bold text-sm uppercase">{r.name}</p>
                {r.description && <p className={`text-xs mt-0.5 ${routeId === r.id ? "text-white/80" : "text-muted-foreground"}`}>{r.description}</p>}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display font-bold text-lg mb-3">{selectedRoute?.name ?? "—"}</h2>
          <p className="text-sm font-semibold mb-2">Stops (order = run sequence)</p>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left font-semibold py-2 w-12">#</th>
                <th className="text-left font-semibold py-2">Place</th>
                <th className="text-left font-semibold py-2">Morning pick-up</th>
                <th className="text-left font-semibold py-2">Evening drop-off</th>
              </tr>
            </thead>
            <tbody>
              {(stopsQ.data ?? []).length === 0 ? <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No stops.</td></tr> :
                (stopsQ.data ?? []).map((s: any, i: number) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-2 text-[#11314a] font-semibold">{i + 1}</td>
                    <td className="py-2">{s.name}</td>
                    <td className="py-2 font-mono">{s.scheduled_pickup?.slice(0,5) ?? "—"}</td>
                    <td className="py-2 font-mono">{s.scheduled_dropoff?.slice(0,5) ?? "—"}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-display font-bold text-lg mb-4">Pupils and route status</h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left font-semibold py-2">Pupil</th>
              <th className="text-left font-semibold py-2">Class</th>
              <th className="text-left font-semibold py-2">Status</th>
              <th className="text-left font-semibold py-2">Route</th>
              <th className="text-left font-semibold py-2">Stop</th>
              <th className="text-right font-semibold py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {(studentsQ.data ?? []).length === 0 ? <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No homeroom pupils.</td></tr> :
              (studentsQ.data ?? []).map((s: any) => {
                const isSet = !!assignsQ.data?.[s.id];
                const studentRouteId = selRoutes[s.id] ?? "";
                const studentStops = allStopsQ.data?.[studentRouteId] ?? [];
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-2">
                      <span className="font-semibold">{s.first_name} {s.last_name}</span>{" "}
                      <span className="text-xs text-muted-foreground">({s.admission_no})</span>
                    </td>
                    <td className="py-2">{s.classes?.name ?? "—"}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isSet ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                        {isSet ? "Set" : "None"}
                      </span>
                    </td>
                    <td className="py-2">
                      <select
                        value={studentRouteId}
                        onChange={(e) => { setSelRoutes((r) => ({ ...r, [s.id]: e.target.value })); setSelStops((ss) => ({ ...ss, [s.id]: "" })); }}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">Select…</option>
                        {(routesQ.data ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </td>
                    <td className="py-2">
                      <select
                        value={selStops[s.id] ?? ""}
                        onChange={(e) => setSelStops((ss) => ({ ...ss, [s.id]: e.target.value }))}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        disabled={!studentRouteId}
                      >
                        <option value="">Select…</option>
                        {studentStops.map((st: any) => (
                          <option key={st.id} value={st.id}>{st.name}{st.scheduled_pickup ? ` · AM ${st.scheduled_pickup.slice(0,5)}` : ""}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 text-right space-x-2">
                      <button onClick={() => save.mutate(s.id)} className="bg-[#11314a] text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-[#1d4d72]">Save</button>
                      <button onClick={() => clear.mutate(s.id)} className="text-xs font-semibold text-rose-700 hover:underline">Clear</button>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </Card>
    </div>
  );
}
