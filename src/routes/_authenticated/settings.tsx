import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — JEC" }] }),
});

function SettingsPage() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).single()).data,
  });

  useEffect(() => {
    if (profile.data) {
      setFullName(profile.data.full_name ?? "");
      setPhone(profile.data.phone ?? "");
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Profile updated"),
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <>
      <PageHeader title="Settings" description="Profile and school configuration" />

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-6 p-6">
          <h3 className="font-display font-bold mb-4">My profile</h3>
          <div className="space-y-3">
            <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
            <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </div>
        </Card>

        {isAdmin && (
          <Card className="col-span-12 lg:col-span-6 p-6">
            <TermsManager />
          </Card>
        )}
      </div>
    </>
  );
}

function TermsManager() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    academic_year: new Date().getFullYear(),
    term_number: 1,
    start_date: "",
    end_date: "",
  });

  const termsQ = useQuery({
    queryKey: ["terms-list"],
    queryFn: async () => (await supabase.from("terms").select("*").order("academic_year", { ascending: false }).order("term_number")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("terms").insert(form);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Term added"); qc.invalidateQueries({ queryKey: ["terms-list"] }); },
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

  return (
    <>
      <h3 className="font-display font-bold mb-4">Academic terms</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><Label>Year</Label><Input type="number" value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: Number(e.target.value) })} /></div>
        <div>
          <Label>Term</Label>
          <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.term_number} onChange={(e) => setForm({ ...form, term_number: Number(e.target.value) })}>
            <option value={1}>Term 1</option><option value={2}>Term 2</option><option value={3}>Term 3</option>
          </select>
        </div>
        <div><Label>Start</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
        <div><Label>End</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
      </div>
      <Button size="sm" onClick={() => add.mutate()} disabled={!form.start_date || !form.end_date || add.isPending}>Add term</Button>

      <ul className="mt-5 divide-y divide-border border-t border-border">
        {termsQ.data?.map((t: any) => (
          <li key={t.id} className="py-2 flex items-center justify-between text-sm">
            <span>
              {t.academic_year} · Term {t.term_number}
              <span className="text-[11px] text-muted-foreground ml-2">{t.start_date} → {t.end_date}</span>
            </span>
            {t.is_current ? (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">CURRENT</span>
            ) : (
              <button onClick={() => setCurrent.mutate(t.id)} className="text-[11px] text-brand-navy underline">Set current</button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
