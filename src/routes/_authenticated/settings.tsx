import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Upload, Save, Plus, Trash2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — JEC" }] }),
});

const LEAVE_TYPES = ["annual", "sick", "compassionate", "maternity", "paternity", "study", "unpaid"] as const;
const ALL_ROLES = ["admin", "head_teacher", "teacher", "finance", "driver", "parent"] as const;

function SettingsPage() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("head_teacher");

  return (
    <>
      <PageHeader title="Settings" description="School profile, leave policies, users and academic terms" />
      {!canEdit && (
        <Card className="p-4 mb-4 text-sm text-muted-foreground">
          You have read-only access. Admins and head teachers can edit these settings.
        </Card>
      )}
      <Tabs defaultValue="school">
        <TabsList className="mb-4">
          <TabsTrigger value="school">School profile</TabsTrigger>
          <TabsTrigger value="leave">Leave policies</TabsTrigger>
          <TabsTrigger value="users">Users &amp; roles</TabsTrigger>
          <TabsTrigger value="terms">Academic terms</TabsTrigger>
        </TabsList>
        <TabsContent value="school"><SchoolProfileTab canEdit={canEdit} /></TabsContent>
        <TabsContent value="leave"><LeavePoliciesTab canEdit={canEdit} /></TabsContent>
        <TabsContent value="users"><UsersRolesTab canEdit={roles.includes("admin")} /></TabsContent>
        <TabsContent value="terms"><TermsTab canEdit={canEdit} /></TabsContent>
      </Tabs>
    </>
  );
}

/* =========================== SCHOOL PROFILE =========================== */
function SchoolProfileTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<any>({});
  const [uploading, setUploading] = useState(false);

  const settingsQ = useQuery({
    queryKey: ["school-settings"],
    queryFn: async () => (await supabase.from("school_settings").select("*").limit(1).maybeSingle()).data,
  });

  const termsQ = useQuery({
    queryKey: ["terms-list"],
    queryFn: async () =>
      (await supabase.from("terms").select("id, academic_year, term_number").order("academic_year", { ascending: false }).order("term_number")).data ?? [],
  });

  useEffect(() => {
    if (settingsQ.data) setForm(settingsQ.data);
  }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { id, created_at, updated_at, ...patch } = form;
      const { error } = await supabase.from("school_settings").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("School settings saved");
      qc.invalidateQueries({ queryKey: ["school-settings"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const onUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) return toast.error("Max 2 MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logos/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("school-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("school-assets").getPublicUrl(path);
      setForm({ ...form, logo_url: pub.publicUrl });
      toast.success("Logo uploaded — remember to save");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (settingsQ.isLoading) return <Card className="p-6">Loading…</Card>;

  const disabled = !canEdit;

  return (
    <Card className="p-6">
      <h3 className="font-display font-bold mb-1">Branding &amp; contact</h3>
      <p className="text-sm text-muted-foreground mb-5">Logo, name, and contact show on login, sidebars, and receipts.</p>

      <div className="flex items-center gap-4 mb-5">
        {form.logo_url ? (
          <img src={form.logo_url} alt="Logo" className="h-20 w-20 object-contain rounded border border-border" />
        ) : (
          <div className="h-20 w-20 rounded border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">No logo</div>
        )}
        <div className="flex-1">
          <Label>School logo (PNG, JPG, WebP · max 2 MB)</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={disabled || uploading}
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-muted file:text-foreground file:text-sm"
          />
          {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading…</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="School name" full><Input disabled={disabled} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Tagline"><Input disabled={disabled} value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></Field>
        <Field label="Motto"><Input disabled={disabled} value={form.motto ?? ""} onChange={(e) => setForm({ ...form, motto: e.target.value })} /></Field>
        <Field label="P.O. Box"><Input disabled={disabled} value={form.p_o_box ?? ""} onChange={(e) => setForm({ ...form, p_o_box: e.target.value })} /></Field>
        <Field label="Town / location"><Input disabled={disabled} value={form.town ?? ""} onChange={(e) => setForm({ ...form, town: e.target.value })} /></Field>
        <Field label="Phone"><Input disabled={disabled} value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Email"><Input disabled={disabled} type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="M-Pesa paybill (display only)" full><Input disabled={disabled} value={form.paybill ?? ""} onChange={(e) => setForm({ ...form, paybill: e.target.value })} /></Field>
        <Field label="Bank details" full><Textarea disabled={disabled} rows={3} value={form.bank_details ?? ""} onChange={(e) => setForm({ ...form, bank_details: e.target.value })} /></Field>
        <Field label="Theme colour (hex)"><Input disabled={disabled} value={form.theme_color ?? ""} onChange={(e) => setForm({ ...form, theme_color: e.target.value })} placeholder="#0d5c3d" /></Field>
        <Field label="Current term (for reports & fees)">
          <Select disabled={disabled} value={form.current_term_id ?? ""} onValueChange={(v) => setForm({ ...form, current_term_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
            <SelectContent>
              {termsQ.data?.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>Term {t.term_number} · {t.academic_year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Footer text" full><Input disabled={disabled} value={form.footer_text ?? ""} onChange={(e) => setForm({ ...form, footer_text: e.target.value })} /></Field>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={() => save.mutate()} disabled={disabled || save.isPending}>
          <Save className="h-4 w-4 mr-2" /> {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

/* =========================== LEAVE POLICIES =========================== */
function LeavePoliciesTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();

  const policiesQ = useQuery({
    queryKey: ["leave-policies"],
    queryFn: async () => (await supabase.from("leave_policies").select("*").order("leave_type")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await supabase
        .from("leave_policies")
        .update({ default_days: row.default_days, carryover_pct: row.carryover_pct, max_carryover_days: row.max_carryover_days })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Policy updated"); qc.invalidateQueries({ queryKey: ["leave-policies"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Card className="p-6">
      <h3 className="font-display font-bold mb-1">Leave entitlements (default per staff per year)</h3>
      <p className="text-sm text-muted-foreground mb-5">
        These defaults seed each staff member's balance. Leave unused days carry over at the percentage set below.
        Leave the days field blank for unlimited (e.g. unpaid leave).
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3 font-semibold">Leave type</th>
              <th className="text-left p-3 font-semibold">Default days / year</th>
              <th className="text-left p-3 font-semibold">Carryover %</th>
              <th className="text-left p-3 font-semibold">Max carryover days</th>
              <th className="text-right p-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {policiesQ.data?.map((p: any) => (
              <PolicyRow key={p.id} row={p} canEdit={canEdit} onSave={(r) => save.mutate(r)} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PolicyRow({ row, canEdit, onSave }: { row: any; canEdit: boolean; onSave: (r: any) => void }) {
  const [local, setLocal] = useState(row);
  useEffect(() => setLocal(row), [row]);
  const dirty = JSON.stringify(local) !== JSON.stringify(row);
  return (
    <tr>
      <td className="p-3 capitalize font-medium">{row.leave_type}</td>
      <td className="p-3">
        <Input className="h-9 w-28" type="number" disabled={!canEdit} value={local.default_days ?? ""} onChange={(e) => setLocal({ ...local, default_days: e.target.value === "" ? null : Number(e.target.value) })} placeholder="∞" />
      </td>
      <td className="p-3">
        <Input className="h-9 w-24" type="number" disabled={!canEdit} value={local.carryover_pct ?? 0} onChange={(e) => setLocal({ ...local, carryover_pct: Number(e.target.value) })} />
      </td>
      <td className="p-3">
        <Input className="h-9 w-24" type="number" disabled={!canEdit} value={local.max_carryover_days ?? ""} onChange={(e) => setLocal({ ...local, max_carryover_days: e.target.value === "" ? null : Number(e.target.value) })} placeholder="—" />
      </td>
      <td className="p-3 text-right">
        <Button size="sm" variant="outline" disabled={!canEdit || !dirty} onClick={() => onSave(local)}>Save</Button>
      </td>
    </tr>
  );
}

/* =========================== USERS & ROLES =========================== */
function UsersRolesTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const usersQ = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const [{ data: profiles }, { data: rolesRows }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const byUser: Record<string, string[]> = {};
      (rolesRows ?? []).forEach((r: any) => {
        byUser[r.user_id] = [...(byUser[r.user_id] ?? []), r.role];
      });
      return (profiles ?? []).map((p: any) => ({ ...p, roles: byUser[p.id] ?? [] }));
    },
  });

  const addRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: string }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id, role: role as any });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Role added"); qc.invalidateQueries({ queryKey: ["users-with-roles"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const removeRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: string }) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", user_id).eq("role", role as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Role removed"); qc.invalidateQueries({ queryKey: ["users-with-roles"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return usersQ.data ?? [];
    return (usersQ.data ?? []).filter((u: any) =>
      (u.full_name ?? "").toLowerCase().includes(q) || (u.phone ?? "").toLowerCase().includes(q),
    );
  }, [usersQ.data, search]);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="font-display font-bold">User &amp; role management</h3>
          <p className="text-sm text-muted-foreground">Assign or revoke roles. Only admins can edit.</p>
        </div>
        <Input placeholder="Search by name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      {!canEdit && (
        <div className="mb-3 text-xs text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Read-only — only the Admin role can edit user roles.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3 font-semibold">Name</th>
              <th className="text-left p-3 font-semibold">Phone</th>
              <th className="text-left p-3 font-semibold">Roles</th>
              <th className="text-right p-3 font-semibold">Add role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u: any) => {
              const available = ALL_ROLES.filter((r) => !u.roles.includes(r));
              return (
                <tr key={u.id}>
                  <td className="p-3 font-medium">{u.full_name || <span className="text-muted-foreground italic">No name</span>}</td>
                  <td className="p-3 text-muted-foreground">{u.phone || "—"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                      {u.roles.map((r: string) => (
                        <Badge key={r} variant="secondary" className="gap-1">
                          {r}
                          {canEdit && (
                            <button onClick={() => removeRole.mutate({ user_id: u.id, role: r })} className="hover:text-destructive" title="Remove">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    {canEdit && available.length > 0 && (
                      <Select onValueChange={(v) => addRole.mutate({ user_id: u.id, role: v })}>
                        <SelectTrigger className="h-8 w-36 inline-flex"><SelectValue placeholder="+ Add role" /></SelectTrigger>
                        <SelectContent>
                          {available.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* =========================== ACADEMIC TERMS =========================== */
function TermsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    academic_year: new Date().getFullYear(),
    term_number: 1,
    start_date: "",
    end_date: "",
  });

  const termsQ = useQuery({
    queryKey: ["terms-list"],
    queryFn: async () =>
      (await supabase.from("terms").select("*").order("academic_year", { ascending: false }).order("term_number")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("terms").insert(form);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Term added"); qc.invalidateQueries({ queryKey: ["terms-list"] }); setForm({ ...form, start_date: "", end_date: "" }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const setCurrent = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("terms").update({ is_current: false }).neq("id", "00000000-0000-0000-0000-000000000000");
      const { error } = await supabase.from("terms").update({ is_current: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Current term updated"); qc.invalidateQueries({ queryKey: ["terms-list"] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("terms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Term removed"); qc.invalidateQueries({ queryKey: ["terms-list"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Card className="p-6">
      <h3 className="font-display font-bold mb-1">Academic terms</h3>
      <p className="text-sm text-muted-foreground mb-5">Define each term's dates and mark the current one for reports and fees.</p>

      {canEdit && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5 items-end p-4 rounded-lg bg-muted/30 border border-border">
          <div><Label className="mb-1.5 block">Year</Label><Input type="number" value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: Number(e.target.value) })} /></div>
          <div>
            <Label className="mb-1.5 block">Term</Label>
            <Select value={String(form.term_number)} onValueChange={(v) => setForm({ ...form, term_number: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Term 1</SelectItem>
                <SelectItem value="2">Term 2</SelectItem>
                <SelectItem value="3">Term 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="mb-1.5 block">Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          <div><Label className="mb-1.5 block">End date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          <Button onClick={() => add.mutate()} disabled={!form.start_date || !form.end_date || add.isPending}>
            <Plus className="h-4 w-4 mr-1.5" /> Add term
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3 font-semibold">Term</th>
              <th className="text-left p-3 font-semibold">Dates</th>
              <th className="text-left p-3 font-semibold">Status</th>
              <th className="text-right p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {termsQ.data?.map((t: any) => (
              <tr key={t.id}>
                <td className="p-3 font-medium">Term {t.term_number} · {t.academic_year}</td>
                <td className="p-3 text-muted-foreground">{t.start_date} → {t.end_date}</td>
                <td className="p-3">
                  {t.is_current ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Current</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="p-3 text-right space-x-2">
                  {canEdit && !t.is_current && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setCurrent.mutate(t.id)}>Set current</Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remove this term?")) del.mutate(t.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {(termsQ.data ?? []).length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No terms yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
