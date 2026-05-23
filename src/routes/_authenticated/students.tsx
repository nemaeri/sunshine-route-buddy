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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { Plus, Search, CreditCard, Pencil, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
  head: () => ({ meta: [{ title: "Students — Milimani Hillcrest" }] }),
});

type StudentRow = {
  id: string;
  admission_no: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
  boarding: boolean;
  lunch: boolean;
  parent_name: string | null;
  parent_phone: string | null;
  status: string;
  classes: { id: string; name: string; grade_level: string; stream: string | null } | null;
  invoices: { balance: number | null; status: string | null }[];
};

function StudentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [streamFilter, setStreamFilter] = useState<string>("all");

  const classesQ = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, grade_level, stream")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const studentsQ = useQuery({
    queryKey: ["students-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select(
          "id, admission_no, first_name, last_name, class_id, boarding, lunch, parent_name, parent_phone, status, classes(id,name,grade_level,stream), invoices(balance,status)"
        )
        .order("admission_no");
      if (error) throw error;
      return (data ?? []) as unknown as StudentRow[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return (studentsQ.data ?? []).filter((st) => {
      if (statusFilter !== "all" && (st.status ?? "active") !== statusFilter) return false;
      if (streamFilter !== "all" && st.class_id !== streamFilter) return false;
      if (!s) return true;
      return (
        st.admission_no.toLowerCase().includes(s) ||
        `${st.first_name} ${st.last_name}`.toLowerCase().includes(s) ||
        (st.parent_name ?? "").toLowerCase().includes(s)
      );
    });
  }, [studentsQ.data, search, statusFilter, streamFilter]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("students")
        .update({ status, active: status === "active" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["students-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Students"
        description={`${filtered.length} pupils · filtered results update as you search`}
        actions={
          <>
            <div className="relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 w-64"
                placeholder="Search pupils…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <EnrollStudentDialog
              classes={classesQ.data ?? []}
              onCreated={() => qc.invalidateQueries({ queryKey: ["students-full"] })}
            />
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">All Students</h2>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>
            <Select value={streamFilter} onValueChange={setStreamFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All streams" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All streams</SelectItem>
                {classesQ.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              <tr>
                <th className="px-6 py-3">Student</th>
                <th className="px-6 py-3">Adm No.</th>
                <th className="px-6 py-3">Class</th>
                <th className="px-6 py-3">Fees</th>
                <th className="px-6 py-3">Parent/Guardian</th>
                <th className="px-6 py-3">Fee Balance</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {studentsQ.isLoading && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!studentsQ.isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">No students found.</td></tr>
              )}
              {filtered.map((s) => {
                const initials = `${s.first_name[0] ?? ""}${s.last_name[0] ?? ""}`.toUpperCase();
                const feeProgramme = `${s.boarding ? "Boarding" : "Day"} · ${s.lunch ? "Lunch" : "No lunch"}`;
                const totalBalance = (s.invoices ?? []).reduce((sum, i) => sum + Number(i.balance ?? 0), 0);
                const hasInvoice = (s.invoices ?? []).length > 0;
                const status = s.status ?? "active";
                return (
                  <tr key={s.id} className="hover:bg-secondary/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {initials}
                        </div>
                        <span className="font-medium text-foreground">{s.first_name} {s.last_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{s.admission_no}</td>
                    <td className="px-6 py-4 text-muted-foreground">{s.classes?.name ?? "—"}</td>
                    <td className="px-6 py-4 text-muted-foreground">{feeProgramme}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {s.parent_name ? (
                        <span>
                          {s.parent_name}
                          {s.parent_phone && <span className="text-foreground/60"> · {s.parent_phone}</span>}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-4">
                      {!hasInvoice ? (
                        <span className="text-muted-foreground text-xs">No invoice</span>
                      ) : totalBalance <= 0 ? (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-600">Paid</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-600">
                          KSh {totalBalance.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="size-8" title="Fees">
                          <CreditCard className="size-4" />
                        </Button>
                        <EditStudentDialog
                          student={s}
                          classes={classesQ.data ?? []}
                          onSaved={() => qc.invalidateQueries({ queryKey: ["students-full"] })}
                        />
                        {status === "active" ? (
                          <Button size="sm" variant="outline"
                            onClick={() => setStatus.mutate({ id: s.id, status: "suspended" })}>
                            Suspend
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline"
                            onClick={() => setStatus.mutate({ id: s.id, status: "active" })}>
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-600",
    suspended: "bg-amber-50 text-amber-600",
    withdrawn: "bg-secondary text-muted-foreground",
  };
  const label = status[0].toUpperCase() + status.slice(1);
  return (
    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${styles[status] ?? styles.withdrawn}`}>
      {label}
    </span>
  );
}

type ClassRow = { id: string; name: string; grade_level: string; stream: string | null };

type StudentForm = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  boarding: boolean;
  lunch: boolean;
  grade_level: string;
  class_id: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  home_address: string;
};

const emptyForm: StudentForm = {
  first_name: "", last_name: "", date_of_birth: "", gender: "",
  boarding: false, lunch: false,
  grade_level: "", class_id: "",
  parent_name: "", parent_phone: "", parent_email: "", home_address: "",
};

function StudentFormFields({ form, setForm, classes }: {
  form: StudentForm;
  setForm: (f: StudentForm) => void;
  classes: ClassRow[];
}) {
  const grades = useMemo(
    () => Array.from(new Set(classes.map((c) => c.grade_level))).sort(),
    [classes]
  );
  const streamsForGrade = useMemo(
    () => classes.filter((c) => c.grade_level === form.grade_level),
    [classes, form.grade_level]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>First Name</Label><Input placeholder="e.g. John" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
        <div><Label>Last Name</Label><Input placeholder="e.g. Mwangi" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Date of Birth</Label>
          <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
        </div>
        <div>
          <Label>Gender</Label>
          <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Fee programme</Label>
        <ToggleGroup
          type="multiple"
          variant="outline"
          className="justify-start mt-1"
          value={[form.boarding ? "boarding" : "", form.lunch ? "lunch" : ""].filter(Boolean)}
          onValueChange={(values) => setForm({ ...form, boarding: values.includes("boarding"), lunch: values.includes("lunch") })}
        >
          <ToggleGroupItem value="boarding">Boarding</ToggleGroupItem>
          <ToggleGroupItem value="lunch">School lunch</ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground mt-1">Used with fee structure (day vs boarding vs optional lunch).</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Grade</Label>
          <Select value={form.grade_level} onValueChange={(v) => setForm({ ...form, grade_level: v, class_id: "" })}>
            <SelectTrigger><SelectValue placeholder="Select Grade" /></SelectTrigger>
            <SelectContent>
              {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Stream / Class</Label>
          <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })} disabled={!form.grade_level}>
            <SelectTrigger><SelectValue placeholder={form.grade_level ? "Select stream" : "Select grade first"} /></SelectTrigger>
            <SelectContent>
              {streamsForGrade.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><Label>Parent/Guardian Name</Label><Input placeholder="Full name" value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} /></div>
        <div><Label>Parent Phone</Label><Input placeholder="07XX XXX XXX" value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} /></div>
      </div>

      <div>
        <Label>Parent Email (optional)</Label>
        <Input type="email" placeholder="parent@email.com" value={form.parent_email} onChange={(e) => setForm({ ...form, parent_email: e.target.value })} />
      </div>

      <div>
        <Label>Home Address</Label>
        <Input placeholder="Area / Town" value={form.home_address} onChange={(e) => setForm({ ...form, home_address: e.target.value })} />
      </div>
    </div>
  );
}

function EnrollStudentDialog({ classes, onCreated }: { classes: ClassRow[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StudentForm>(emptyForm);

  const m = useMutation({
    mutationFn: async () => {
      const year = new Date().getFullYear();
      const { count } = await supabase.from("students").select("id", { count: "exact", head: true });
      const seq = String((count ?? 0) + 1).padStart(4, "0");
      const admission_no = `ADM-${year}-${seq}`;
      const { error } = await supabase.from("students").insert({
        admission_no,
        first_name: form.first_name,
        last_name: form.last_name,
        date_of_birth: form.date_of_birth || null,
        gender: (form.gender || null) as "male" | "female" | null,
        class_id: form.class_id || null,
        boarding: form.boarding,
        lunch: form.lunch,
        parent_name: form.parent_name || null,
        parent_phone: form.parent_phone || null,
        parent_email: form.parent_email || null,
        home_address: form.home_address || null,
        status: "active",
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Student enrolled");
      setOpen(false);
      setForm(emptyForm);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to enroll"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4 mr-1" /> Enroll Student</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Enroll New Student</DialogTitle></DialogHeader>
        <StudentFormFields form={form} setForm={setForm} classes={classes} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!form.first_name || !form.last_name || m.isPending}>
            <Save className="size-4 mr-1" />
            {m.isPending ? "Saving…" : "Enroll Student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditStudentDialog({ student, classes, onSaved }: {
  student: StudentRow;
  classes: ClassRow[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StudentForm>(() => ({
    first_name: student.first_name,
    last_name: student.last_name,
    date_of_birth: "",
    gender: "",
    boarding: student.boarding,
    lunch: student.lunch,
    grade_level: student.classes?.grade_level ?? "",
    class_id: student.class_id ?? "",
    parent_name: student.parent_name ?? "",
    parent_phone: student.parent_phone ?? "",
    parent_email: "",
    home_address: "",
  }));

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").update({
        first_name: form.first_name,
        last_name: form.last_name,
        date_of_birth: form.date_of_birth || null,
        gender: (form.gender || null) as "male" | "female" | null,
        class_id: form.class_id || null,
        boarding: form.boarding,
        lunch: form.lunch,
        parent_name: form.parent_name || null,
        parent_phone: form.parent_phone || null,
        parent_email: form.parent_email || null,
        home_address: form.home_address || null,
      }).eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      setOpen(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" className="size-8" title="Edit">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Student</DialogTitle></DialogHeader>
        <StudentFormFields form={form} setForm={setForm} classes={classes} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            <Save className="size-4 mr-1" />
            {m.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
