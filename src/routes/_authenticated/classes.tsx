import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Plus, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/classes")({
  component: ClassesPage,
  head: () => ({ meta: [{ title: "Classes — JEC" }] }),
});

function ClassesPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["classes-with-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, grade_level, stream, academic_year, students(count)")
        .order("grade_level");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader
        title="Classes"
        description="CBC grades, streams & class teachers"
        action={isAdmin ? <AddClassDialog onCreated={() => qc.invalidateQueries({ queryKey: ["classes-with-count"] })} /> : null}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {q.isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}
        {q.data?.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground col-span-full">
            No classes yet. {isAdmin ? "Click 'Add class' to create one." : "Ask an admin to set up classes."}
          </Card>
        )}
        {q.data?.map((c: any) => (
          <Card key={c.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  {c.grade_level}{c.stream ? ` • ${c.stream}` : ""}
                </p>
                <h3 className="font-display font-bold text-lg mt-1">{c.name}</h3>
              </div>
              <span className="text-xs text-muted-foreground">{c.academic_year}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" />
              <span>{c.students?.[0]?.count ?? 0} learners</span>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function AddClassDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("Grade 1");
  const [stream, setStream] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("classes").insert({
        name,
        grade_level: grade,
        stream: stream || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Class created");
      setOpen(false);
      setName("");
      setStream("");
      onCreated();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4 mr-1" /> Add class</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New class</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Grade 4 Eagles" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Grade level</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              >
                {["PP1","PP2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Stream (optional)</Label>
              <Input value={stream} onChange={(e) => setStream(e.target.value)} placeholder="Eagles" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={!name || m.isPending}>
            {m.isPending ? "Saving…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
