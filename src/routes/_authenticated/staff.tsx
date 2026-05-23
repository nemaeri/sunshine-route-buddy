import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Search, UserPlus, Users, Calculator, Headphones, Ban, Pencil, Pause, Play, Save,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffPage,
  head: () => ({ meta: [{ title: "Staff Dashboard — JEC" }] }),
});

const ROLES = ["Teacher", "Accountant", "Support Staff", "Deputy Head", "Head Teacher"] as const;
type Role = (typeof ROLES)[number];

const SUBJECTS = [
  "Agriculture", "CRE / IRE", "Creative Arts", "English", "Kiswahili",
  "Mathematics", "Physical & Health Education", "Science & Technology", "Social Studies",
];

const SUPPORT_JOBS = [
  "Cleaner", "Cook", "Security Guard", "Groundskeeper",
  "Driver", "Bus Assistant", "Transport Manager",
  "Nurse", "Receptionist", "Storekeeper", "Other",
];
const ALL_JOB_OPTIONS = [
  "Teacher", "Head Teacher", "Deputy Head", "Accountant",
  ...SUPPORT_JOBS.filter((j) => j !== "Other"),
];

async function syncRoles(staffId: string, primary: string, extras: string[]) {
  await supabase.from("staff_roles").delete().eq("staff_id", staffId);
  const rows = [
    { staff_id: staffId, role_label: primary, is_primary: true },
    ...extras
      .filter((r) => r && r !== primary)
      .map((r) => ({ staff_id: staffId, role_label: r, is_primary: false })),
  ];
  if (rows.length) await supabase.from("staff_roles").insert(rows);
}


function roleBucket(designation: string | null | undefined): "teacher" | "accountant" | "support" | "admin" {
  const d = (designation ?? "").toLowerCase();
  if (d.includes("teacher") || d.includes("head")) return "teacher";
  if (d.includes("accountant") || d.includes("finance")) return "accountant";
  if (d.includes("admin")) return "admin";
  return "support";
}

function StaffPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "teachers" | "accounts" | "support">("all");

  const staffQ = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").order("last_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rolesQ = useQuery({
    queryKey: ["staff-roles-all"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_roles").select("staff_id, role_label, is_primary");
      return data ?? [];
    },
  });

  const rolesByStaff = useMemo(() => {
    const m: Record<string, string[]> = {};
    (rolesQ.data ?? []).forEach((r: any) => {
      if (r.is_primary) return;
      (m[r.staff_id] ??= []).push(r.role_label);
    });
    return m;
  }, [rolesQ.data]);

  const stats = useMemo(() => {
    const all = staffQ.data ?? [];
    const teachers = all.filter((s: any) => roleBucket(s.designation) === "teacher").length;
    const accountants = all.filter((s: any) => roleBucket(s.designation) === "accountant").length;
    const support = all.filter((s: any) => roleBucket(s.designation) === "support").length;
    const suspended = all.filter((s: any) => !s.active).length;
    return { teachers, accountants, support, suspended };
  }, [staffQ.data]);

  const filtered = useMemo(() => {
    let rows = staffQ.data ?? [];
    if (tab === "teachers") rows = rows.filter((s: any) => roleBucket(s.designation) === "teacher");
    if (tab === "accounts") rows = rows.filter((s: any) => roleBucket(s.designation) === "accountant");
    if (tab === "support") rows = rows.filter((s: any) => roleBucket(s.designation) === "support");
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((s: any) =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q) ||
        (s.designation ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [staffQ.data, tab, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["staff"] });
    qc.invalidateQueries({ queryKey: ["staff-roles-all"] });
  };

  return (
    <>
      <PageHeader
        title="Staff dashboard"
        description="Browse staff, open profiles, and manage teaching assignments"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search…"
                className="pl-9 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <NewStaffDialog onDone={invalidate} />
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users className="size-5" />} value={String(stats.teachers)} label="Teachers" tone="blue" />
        <StatCard icon={<Calculator className="size-5" />} value={String(stats.accountants)} label="Accountants" tone="amber" />
        <StatCard icon={<Headphones className="size-5" />} value={String(stats.support)} label="Support" tone="violet" />
        <StatCard icon={<Ban className="size-5" />} value={String(stats.suspended)} label="Suspended" tone="rose" />
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-display font-bold flex items-center gap-2">
            Staff
            <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
              {staffQ.data?.length ?? 0}
            </span>
          </h3>
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md">
            {([
              ["all", "All"], ["teachers", "Teachers"], ["accounts", "Accounts"], ["support", "Support"],
            ] as const).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-4 py-1.5 rounded text-sm transition-colors ${tab === k ? "bg-primary text-primary-foreground" : "hover:bg-background"}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-medium px-5 py-3">Name</th>
                <th className="text-left font-medium px-5 py-3">Role</th>
                <th className="text-left font-medium px-5 py-3">Email</th>
                <th className="text-left font-medium px-5 py-3">Phone</th>
                <th className="text-left font-medium px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {staffQ.isLoading && <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">Loading…</td></tr>}
              {!staffQ.isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No staff in this view.</td></tr>
              )}
              {filtered.map((s: any) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-4 font-medium">{s.first_name} {s.last_name}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                        {s.designation || "—"}
                      </span>
                      {(rolesByStaff[s.id] ?? []).map((r) => (
                        <span key={r} className="inline-flex items-center px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-medium border border-violet-100">
                          +{r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{s.email || "—"}</td>
                  <td className="px-5 py-4 text-muted-foreground">{s.phone || "—"}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${s.active ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"}`}>
                      {s.active ? "active" : "suspended"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <EditStaffDialog staff={s} onDone={invalidate} />
                      <button
                        title={s.active ? "Suspend" : "Reactivate"}
                        onClick={async () => {
                          const { error } = await supabase.from("staff").update({ active: !s.active }).eq("id", s.id);
                          if (error) toast.error(error.message); else { toast.success(s.active ? "Suspended" : "Reactivated"); invalidate(); }
                        }}
                        className={`size-8 inline-flex items-center justify-center rounded-md border ${s.active ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100" : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"}`}
                      >
                        {s.active ? <Pause className="size-4" /> : <Play className="size-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function StatCard({
  icon, value, label, tone,
}: { icon: React.ReactNode; value: string; label: string; tone: "blue" | "amber" | "violet" | "rose" }) {
  const tones: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    amber: "bg-amber-100 text-amber-600",
    violet: "bg-violet-100 text-violet-600",
    rose: "bg-rose-100 text-rose-600",
  };
  return (
    <Card className="p-5">
      <div className={`inline-flex items-center justify-center size-10 rounded-lg ${tones[tone]} mb-4`}>{icon}</div>
      <div className="font-display font-bold text-3xl text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </Card>
  );
}

type StaffForm = {
  first_name: string;
  last_name: string;
  role: Role;
  phone: string;
  email: string;
  subjects: string[];
  assigned_classes: string[];
  national_id: string;
  support_job: string;
  support_job_other: string;
  extra_roles: string[];
};

const emptyForm: StaffForm = {
  first_name: "", last_name: "", role: "Teacher", phone: "", email: "",
  subjects: [], assigned_classes: [], national_id: "", support_job: "Cleaner", support_job_other: "",
  extra_roles: [],
};

function StaffFormFields({ form, setForm, classes }: {
  form: StaffForm; setForm: (f: StaffForm) => void; classes: Array<{ id: string; name: string }>;
}) {
  const isTeacher = form.role === "Teacher" || form.role === "Deputy Head" || form.role === "Head Teacher";
  const isSupport = form.role === "Support Staff";

  return (
    <div className="space-y-5 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>First Name</Label>
          <Input className="mt-1.5" placeholder="e.g. Mary" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
        </div>
        <div>
          <Label>Last Name</Label>
          <Input className="mt-1.5" placeholder="e.g. Njeri" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Role</Label>
          <select
            className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <Label>Phone Number</Label>
          <Input className="mt-1.5" placeholder="07XX XXX XXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </div>

      <div>
        <Label>Email (login)</Label>
        <Input className="mt-1.5" type="email" placeholder="name@school.ke" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>

      {isSupport && (
        <div>
          <Label>Support Job</Label>
          <select
            className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={form.support_job}
            onChange={(e) => setForm({ ...form, support_job: e.target.value })}
          >
            {SUPPORT_JOBS.map((j) => <option key={j}>{j}</option>)}
          </select>
          {form.support_job === "Other" && (
            <Input
              className="mt-2"
              placeholder="Specify the support role (e.g. Gardener, IT Technician)"
              value={form.support_job_other}
              onChange={(e) => setForm({ ...form, support_job_other: e.target.value })}
            />
          )}
          <p className="text-xs text-muted-foreground mt-1.5">Pick the specific job this support staff handles day-to-day.</p>
        </div>
      )}

      {isTeacher && (
        <>
          <div>
            <Label>Subjects Teaching</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {SUBJECTS.map((sub) => {
                const active = form.subjects.includes(sub);
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setForm({
                      ...form,
                      subjects: active ? form.subjects.filter((x) => x !== sub) : [...form.subjects, sub],
                    })}
                    className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"}`}
                  >
                    {sub}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Selections are for your records; directory sync can be added later.</p>
          </div>

          <div>
            <Label>Assign Class / Stream</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {classes.length === 0 && <p className="text-xs text-muted-foreground">No classes yet — add one on the Classes & Streams tab.</p>}
              {classes.map((c) => {
                const active = form.assigned_classes.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setForm({
                      ...form,
                      assigned_classes: active ? form.assigned_classes.filter((x) => x !== c.id) : [...form.assigned_classes, c.id],
                    })}
                    className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"}`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div>
        <Label>ID / National ID No.</Label>
        <Input className="mt-1.5" placeholder="e.g. 12345678" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
      </div>
    </div>
  );
}

function buildPayload(form: StaffForm) {
  const isSupport = form.role === "Support Staff";
  const designation = isSupport
    ? (form.support_job === "Other" ? form.support_job_other || "Support Staff" : form.support_job)
    : form.role;
  let department: string;
  if (isSupport) department = "Support";
  else if (form.role === "Accountant") department = "Finance";
  else if (form.role === "Teacher" && form.subjects.length) department = form.subjects.join(", ");
  else department = form.role;
  return { designation, department };
}

function NewStaffDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(emptyForm);

  const classesQ = useQuery({
    queryKey: ["staff-classes"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id, name").order("name");
      return data ?? [];
    },
  });

  const m = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase.from("staff").select("id", { count: "exact", head: true });
      const seq = String((existing as any)?.length ?? Date.now() % 10000).padStart(4, "0");
      const staff_no = `STF-${seq}`;
      const { designation, department } = buildPayload(form);
      const { error } = await supabase.from("staff").insert({
        first_name: form.first_name,
        last_name: form.last_name,
        staff_no,
        designation,
        department,
        email: form.email || null,
        phone: form.phone || null,
        kra_pin: form.national_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Staff added"); setOpen(false); setForm(emptyForm); onDone(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(emptyForm); }}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4 mr-1" /> Add Staff</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" /> Add Staff Member
          </DialogTitle>
        </DialogHeader>
        <StaffFormFields form={form} setForm={setForm} classes={classesQ.data ?? []} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => m.mutate()}
            disabled={
              !form.first_name ||
              !form.last_name ||
              (form.role === "Support Staff" && form.support_job === "Other" && !form.support_job_other.trim()) ||
              m.isPending
            }
          >

            <Save className="size-4 mr-1" /> {m.isPending ? "Saving…" : "Save Staff"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditStaffDialog({ staff, onDone }: { staff: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const isSupportRow = roleBucket(staff.designation) === "support";
  const initialRole: Role = isSupportRow ? "Support Staff"
    : (ROLES as readonly string[]).includes(staff.designation) ? (staff.designation as Role)
    : staff.designation?.toLowerCase().includes("accountant") ? "Accountant"
    : "Teacher";
  const [form, setForm] = useState<StaffForm>({
    ...emptyForm,
    first_name: staff.first_name ?? "",
    last_name: staff.last_name ?? "",
    role: initialRole,
    phone: staff.phone ?? "",
    email: staff.email ?? "",
    national_id: staff.kra_pin ?? "",
    support_job: isSupportRow && SUPPORT_JOBS.includes(staff.designation) ? staff.designation : "Other",
    support_job_other: isSupportRow && !SUPPORT_JOBS.includes(staff.designation) ? (staff.designation ?? "") : "",
    subjects: !isSupportRow && staff.department ? staff.department.split(",").map((s: string) => s.trim()).filter((s: string) => SUBJECTS.includes(s)) : [],
  });

  const classesQ = useQuery({
    queryKey: ["staff-classes"],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const m = useMutation({
    mutationFn: async () => {
      const { designation, department } = buildPayload(form);
      const { error } = await supabase.from("staff").update({
        first_name: form.first_name,
        last_name: form.last_name,
        designation,
        department,
        email: form.email || null,
        phone: form.phone || null,
        kra_pin: form.national_id || null,
      }).eq("id", staff.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Staff updated"); setOpen(false); onDone(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button title="Edit" className="size-8 inline-flex items-center justify-center rounded-md border bg-background hover:bg-muted">
          <Pencil className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-primary" /> Edit Staff Member
          </DialogTitle>
        </DialogHeader>
        <StaffFormFields form={form} setForm={setForm} classes={classesQ.data ?? []} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            <Save className="size-4 mr-1" /> {m.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
