import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
  head: () => ({ meta: [{ title: "Students — JEC" }] }),
});

function StudentsPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");

  const classesQ = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const studentsQ = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, admission_no, first_name, last_name, gender, active, class_id, classes(name)")
        .order("admission_no");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (studentsQ.data ?? []).filter((st: any) => {
      if (classFilter !== "all" && st.class_id !== classFilter) return false;
      if (!s) return true;
      return (
        st.admission_no.toLowerCase().includes(s) ||
        `${st.first_name} ${st.last_name}`.toLowerCase().includes(s)
      );
    });
  }, [studentsQ.data, search, classFilter]);

  return (
    <>
      <PageHeader
        title="Student Directory"
        description="Active learners across all CBC grades"
        actions={
          isAdmin ? (
            <AddStudentDialog
              classes={classesQ.data ?? []}
              onCreated={() => qc.invalidateQueries({ queryKey: ["students"] })}
            />
          ) : null
        }
      />

      <Card className="p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or admission number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="all">All classes</option>
          {classesQ.data?.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            <tr>
              <th className="px-6 py-3">Adm No.</th>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Class</th>
              <th className="px-6 py-3">Gender</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {studentsQ.isLoading && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!studentsQ.isLoading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                No students found.
              </td></tr>
            )}
            {filtered.map((s: any) => (
              <tr key={s.id}>
                <td className="px-6 py-4 font-mono text-xs">{s.admission_no}</td>
                <td className="px-6 py-4 font-medium">{s.first_name} {s.last_name}</td>
                <td className="px-6 py-4 text-muted-foreground">{s.classes?.name ?? "—"}</td>
                <td className="px-6 py-4 capitalize text-muted-foreground">{s.gender ?? "—"}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${s.active ? "bg-emerald-50 text-emerald-600" : "bg-secondary text-muted-foreground"}`}>
                    {s.active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function AddStudentDialog({ classes, onCreated }: { classes: any[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [adm, setAdm] = useState("");
  const [gender, setGender] = useState("male");
  const [dob, setDob] = useState("");
  const [classId, setClassId] = useState<string>("");

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").insert({
        first_name: first,
        last_name: last,
        admission_no: adm,
        gender: gender as any,
        date_of_birth: dob || null,
        class_id: classId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Student admitted");
      setOpen(false);
      setFirst(""); setLast(""); setAdm(""); setDob(""); setClassId("");
      onCreated();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4 mr-1" /> Add student</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Admit new learner</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First name</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} /></div>
            <div><Label>Last name</Label><Input value={last} onChange={(e) => setLast(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Admission No.</Label><Input value={adm} onChange={(e) => setAdm(e.target.value)} placeholder="JEC-2026-001" /></div>
            <div>
              <Label>Gender</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date of birth</Label><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
            <div>
              <Label>Class</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">— Unassigned —</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!first || !last || !adm || m.isPending}>
            {m.isPending ? "Saving…" : "Admit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
