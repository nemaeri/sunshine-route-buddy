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
import { Plus, Bus, MapPin, Navigation, GripVertical } from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/_authenticated/bus")({
  component: BusPage,
  head: () => ({ meta: [{ title: "Transport — JEC" }] }),
});

function BusPage() {
  const { roles, user } = useAuth();
  const isAdmin = roles.includes("admin");
  const isDriver = roles.includes("driver");
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const routesQ = useQuery({
    queryKey: ["routes"],
    queryFn: async () => (await supabase.from("routes").select("id, name, description, active").order("name")).data ?? [],
  });

  useEffect(() => {
    if (!selected && routesQ.data?.[0]) setSelected(routesQ.data[0].id);
  }, [routesQ.data, selected]);

  return (
    <>
      <PageHeader
        title="Transport & Bus Tracking"
        description="School routes, vehicles, and live bus positions"
        actions={isAdmin ? <NewRouteDialog onDone={() => qc.invalidateQueries({ queryKey: ["routes"] })} /> : null}
      />

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-4 overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center gap-2">
            <Bus className="size-4" />
            <h3 className="font-display font-bold text-sm">Routes</h3>
          </div>
          {routesQ.data?.length === 0 && <p className="p-6 text-sm text-muted-foreground">No routes yet.</p>}
          <ul className="divide-y divide-border">
            {routesQ.data?.map((r: any) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelected(r.id)}
                  className={`w-full text-left px-5 py-3 hover:bg-secondary/40 ${selected === r.id ? "bg-secondary/60" : ""}`}
                >
                  <p className="text-sm font-medium">{r.name}</p>
                  {r.description && <p className="text-[11px] text-muted-foreground">{r.description}</p>}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="col-span-12 lg:col-span-8 space-y-6">
          {selected && <RouteDetail routeId={selected} isAdmin={isAdmin} isDriver={isDriver} userId={user?.id ?? null} />}
        </div>
      </div>
    </>
  );
}

function RouteDetail({ routeId, isAdmin, isDriver, userId }: { routeId: string; isAdmin: boolean; isDriver: boolean; userId: string | null }) {
  const qc = useQueryClient();

  const stopsQ = useQuery({
    queryKey: ["stops", routeId],
    queryFn: async () => (await supabase.from("stops").select("*").eq("route_id", routeId).order("sequence")).data ?? [],
  });

  const today = new Date().toISOString().slice(0, 10);
  const assignmentQ = useQuery({
    queryKey: ["assignment-today", routeId, today],
    queryFn: async () => (await supabase.from("route_assignments")
      .select("id, status, shift, vehicles:vehicle_id(plate_no, label)")
      .eq("route_id", routeId)
      .eq("service_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()).data,
  });

  const positionsQ = useQuery({
    enabled: !!assignmentQ.data?.id,
    queryKey: ["positions", assignmentQ.data?.id],
    queryFn: async () => (await supabase.from("bus_positions")
      .select("lat, lng, speed_kph, heading, recorded_at")
      .eq("assignment_id", assignmentQ.data!.id)
      .order("recorded_at", { ascending: false })
      .limit(1)).data ?? [],
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!assignmentQ.data?.id) return;
    const channel = supabase
      .channel(`bus-${assignmentQ.data.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bus_positions", filter: `assignment_id=eq.${assignmentQ.data.id}` },
        () => qc.invalidateQueries({ queryKey: ["positions", assignmentQ.data!.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [assignmentQ.data?.id, qc]);

  const last = positionsQ.data?.[0];

  const sendPing = useMutation({
    mutationFn: async () => {
      if (!assignmentQ.data?.id) throw new Error("No active assignment");
      if (!navigator.geolocation) throw new Error("Geolocation not supported");
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true })
      );
      const { error } = await supabase.from("bus_positions").insert({
        assignment_id: assignmentQ.data.id,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        speed_kph: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null,
        heading: pos.coords.heading ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Position broadcast"),
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const points: [number, number][] = [
    ...(stopsQ.data ?? []).filter((s: any) => s.lat && s.lng).map((s: any) => [Number(s.lat), Number(s.lng)] as [number, number]),
    ...(last ? [[Number(last.lat), Number(last.lng)] as [number, number]] : []),
  ];
  const bbox = points.length
    ? (() => {
        const lats = points.map((p) => p[0]); const lngs = points.map((p) => p[1]);
        const pad = 0.01;
        return `${Math.min(...lngs) - pad},${Math.min(...lats) - pad},${Math.max(...lngs) + pad},${Math.max(...lats) + pad}`;
      })()
    : "36.75,-1.32,36.90,-1.20";

  const markerParam = last ? `&marker=${last.lat},${last.lng}` : "";

  return (
    <>
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
          <h3 className="font-display font-bold text-sm flex items-center gap-2"><Navigation className="size-4" /> Live position</h3>
          {last && (
            <span className="text-[11px] text-muted-foreground">
              Updated {new Date(last.recorded_at).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="aspect-[16/9] bg-secondary">
          <iframe
            key={bbox + markerParam}
            title="Bus map"
            className="w-full h-full"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${markerParam}`}
          />
        </div>
        <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs">
            {assignmentQ.data ? (
              <>
                <span className="font-bold">{assignmentQ.data.vehicles?.plate_no}</span> · {assignmentQ.data.vehicles?.label} · {assignmentQ.data.shift}
                <span className={`ml-2 px-2 py-0.5 rounded text-[10px] uppercase font-bold ${assignmentQ.data.status === "in_progress" ? "bg-emerald-100 text-emerald-800" : "bg-secondary text-muted-foreground"}`}>
                  {assignmentQ.data.status}
                </span>
              </>
            ) : <span className="text-muted-foreground">No active trip today.</span>}
          </div>
          {isDriver && assignmentQ.data && (
            <Button size="sm" onClick={() => sendPing.mutate()} disabled={sendPing.isPending}>
              {sendPing.isPending ? "Sending…" : "Broadcast my location"}
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
          <h3 className="font-display font-bold text-sm flex items-center gap-2"><MapPin className="size-4" /> Stops</h3>
          {isAdmin && <NewStopDialog routeId={routeId} nextSeq={(stopsQ.data?.length ?? 0) + 1} onDone={() => qc.invalidateQueries({ queryKey: ["stops", routeId] })} />}
        </div>
        {stopsQ.data?.length === 0 && <p className="p-6 text-sm text-muted-foreground">No stops on this route yet.</p>}
        {stopsQ.data && stopsQ.data.length > 0 && (
          <SortableStops stops={stopsQ.data} routeId={routeId} isAdmin={isAdmin} />
        )}
      </Card>
    </>
  );
}

function NewRouteDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("routes").insert(form);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Route added"); setOpen(false); setForm({ name: "", description: "" }); onDone(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New route</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create route</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Westlands – Lavington" /></div>
          <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!form.name || m.isPending}>{m.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewStopDialog({ routeId, nextSeq, onDone }: { routeId: string; nextSeq: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", lat: "", lng: "", scheduled_pickup: "", scheduled_dropoff: "" });

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stops").insert({
        route_id: routeId, sequence: nextSeq, name: form.name,
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        scheduled_pickup: form.scheduled_pickup || null,
        scheduled_dropoff: form.scheduled_dropoff || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Stop added"); setOpen(false); setForm({ name: "", lat: "", lng: "", scheduled_pickup: "", scheduled_dropoff: "" }); onDone(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="size-3 mr-1" /> Stop</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add stop</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Latitude</Label><Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="-1.2921" /></div>
            <div><Label>Longitude</Label><Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="36.8219" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Pickup time</Label><Input type="time" value={form.scheduled_pickup} onChange={(e) => setForm({ ...form, scheduled_pickup: e.target.value })} /></div>
            <div><Label>Dropoff time</Label><Input type="time" value={form.scheduled_dropoff} onChange={(e) => setForm({ ...form, scheduled_dropoff: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!form.name || m.isPending}>{m.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableStops({ stops, routeId, isAdmin }: { stops: any[]; routeId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [items, setItems] = useState(stops);
  useEffect(() => { setItems(stops); }, [stops]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorder = useMutation({
    mutationFn: async (next: any[]) => {
      const updates = next.map((s, i) => ({ id: s.id, sequence: i + 1 }));
      const changed = updates.filter((u) => {
        const prev = stops.find((s) => s.id === u.id);
        return prev && prev.sequence !== u.sequence;
      });
      await Promise.all(
        changed.map((u) => supabase.from("stops").update({ sequence: u.sequence }).eq("id", u.id))
      );
    },
    onSuccess: () => { toast.success("Order saved"); qc.invalidateQueries({ queryKey: ["stops", routeId] }); },
    onError: (e: any) => { toast.error(e.message ?? "Failed to save order"); setItems(stops); },
  });

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((s) => s.id === active.id);
    const newIdx = items.findIndex((s) => s.id === over.id);
    const next = arrayMove(items, oldIdx, newIdx);
    setItems(next);
    reorder.mutate(next);
  };

  if (!isAdmin) {
    return (
      <ol className="divide-y divide-border">
        {items.map((s, i) => <StopRow key={s.id} stop={s} index={i} />)}
      </ol>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ol className="divide-y divide-border">
          {items.map((s, i) => <SortableStopRow key={s.id} stop={s} index={i} />)}
        </ol>
      </SortableContext>
      {reorder.isPending && <p className="px-5 py-2 text-[11px] text-muted-foreground">Saving order…</p>}
    </DndContext>
  );
}

function StopRow({ stop, index, dragHandle }: { stop: any; index: number; dragHandle?: React.ReactNode }) {
  return (
    <li className="px-5 py-3 flex items-center justify-between bg-card">
      <div className="flex items-center gap-3">
        {dragHandle}
        <span className="size-7 rounded-full bg-brand-navy text-white text-xs font-bold flex items-center justify-center">{index + 1}</span>
        <div>
          <p className="text-sm font-medium">{stop.name}</p>
          <p className="text-[11px] text-muted-foreground">
            Pickup {stop.scheduled_pickup ?? "—"} · Dropoff {stop.scheduled_dropoff ?? "—"}
          </p>
        </div>
      </div>
      {stop.lat && stop.lng && (
        <a
          href={`https://www.openstreetmap.org/?mlat=${stop.lat}&mlon=${stop.lng}#map=17/${stop.lat}/${stop.lng}`}
          target="_blank" rel="noreferrer"
          className="text-[11px] text-brand-navy underline"
        >
          Open in map
        </a>
      )}
    </li>
  );
}

function SortableStopRow({ stop, index }: { stop: any; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <StopRow
        stop={stop}
        index={index}
        dragHandle={
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground touch-none"
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </div>
  );
}
