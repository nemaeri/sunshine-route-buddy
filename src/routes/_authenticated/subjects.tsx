import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { BookOpen, Plus, Search, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/subjects")({
  component: SubjectsPage,
  head: () => ({ meta: [{ title: "Subjects — JEC" }] }),
});

const GRADE_LEVELS = [
  "Pre-primary (PP)",
  ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`),
];

type Subject = { id: string; code: string; name: string; grade_levels: string[] };

function SubjectsPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Subject | null>(null);
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, code, name, grade_levels")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Subject[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subject deleted");
      qc.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter((x) =>
      x.name.toLowerCase().includes(s) ||
      x.code.toLowerCase().includes(s) ||
      x.grade_levels.some((g) => g.toLowerCase().includes(s))
    );
  }, [q.data, search]);

  return (
    <>
      <PageHeader
        title="Subjects"
        description="CBC subject catalog mapped to grade levels"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="pl-9 w-64"
                placeholder="Search subjects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {isAdmin && (
              <Button onClick={() => { setEditing(null); setOpen(true); }}>
                <Plus className="size-4 mr-1" /> New subject
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-medium px-5 py-3">Subject</th>
                <th className="text-left font-medium px-5 py-3">Code</th>
                <th className="text-left font-medium px-5 py-3">Grade Levels</th>
                {isAdmin && <th className="px-5 py-3 w-24" />}
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!q.isLoading && filtered.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
                  No subjects yet. Click "New subject" to add one.
                </td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-md bg-brand-gold/15 text-brand-gold flex items-center justify-center">
                        <BookOpen className="size-4" />
                      </div>
                      <span className="font-medium">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{s.code}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.grade_levels.length === 0 && <span className="text-xs text-muted-foreground italic">All grades</span>}
                      {s.grade_levels.map((g) => (
                        <span key={g} className="text-[10px] uppercase tracking-wide bg-secondary text-muted-foreground px-2 py-0.5 rounded">{g}</span>
                      ))}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${s.name}?`)) del.mutate(s.id); }}>
                          <Trash2 className="size-3.5 text-rose-600" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <SubjectDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["subjects"] })}
      />
    </>
  );
}

function SubjectDialog({
  open, onOpenChange, editing, onSaved,
}: { open: boolean; onOpenChange: (o: boolean) => void; editing: Subject | null; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [grades, setGrades] = useState<string[]>([]);

  // sync on open
  useMemo(() => {
    if (open) {
      setName(editing?.name ?? "");
      setCode(editing?.code ?? "");
      setGrades(editing?.grade_levels ?? []);
    }
  }, [open, editing]);

  const m = useMutation({
    mutationFn: async () => {
      const payload = { name, code, grade_levels: grades };
      if (editing) {
        const { error } = await supabase.from("subjects").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subjects").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Subject updated" : "Subject added");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const toggle = (g: string) =>
    setGrades((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Edit subject" : "Add subject"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mathematics" />
            </div>
            <div>
              <Label>Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MATH" />
            </div>
          </div>
          <div>
            <Label>Applicable grade levels</Label>
            <div className="mt-2 flex flex-wrap gap-1.5 max-h-56 overflow-auto">
              {GRADE_LEVELS.map((g) => {
                const on = grades.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggle(g)}
                    className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"}`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">Leave empty to apply to all grades.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!name || !code || m.isPending}>
            {m.isPending ? "Saving…" : editing ? "Save changes" : "Add subject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
