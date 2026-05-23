import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Megaphone, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/announcements")({
  component: AnnouncementsPage,
  head: () => ({ meta: [{ title: "Announcements — JEC" }] }),
});

function AnnouncementsPage() {
  const { roles, user } = useAuth();
  const canPost = roles.includes("admin") || roles.includes("teacher");
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, body, audience, created_at, target_class_id, classes:target_class_id ( name )")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader
        title="Announcements"
        description="School-wide broadcasts and class notices"
        actions={canPost ? (
          <ComposeDialog
            userId={user?.id ?? null}
            onPosted={() => qc.invalidateQueries({ queryKey: ["announcements"] })}
          />
        ) : null}
      />

      <div className="space-y-3">
        {q.isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}
        {q.data?.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No announcements yet.
          </Card>
        )}
        {q.data?.map((a: any) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-md bg-brand-gold/15 text-brand-gold flex items-center justify-center shrink-0">
                <Megaphone className="size-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-bold text-base">{a.title}</h3>
                  <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                    {a.audience === "class" ? `Class: ${a.classes?.name ?? "—"}` : a.audience}
                  </span>
                </div>
                <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{a.body}</p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function ComposeDialog({ userId, onPosted }: { userId: string | null; onPosted: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "parents" | "staff" | "class">("all");
  const [classId, setClassId] = useState<string>("");

  const classesQ = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("announcements").insert({
        title, body, audience,
        target_class_id: audience === "class" ? classId || null : null,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement posted");
      setOpen(false);
      setTitle(""); setBody(""); setAudience("all"); setClassId("");
      onPosted();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4 mr-1" /> New announcement</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Compose announcement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Message</Label><Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Audience</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={audience}
                onChange={(e) => setAudience(e.target.value as any)}
              >
                <option value="all">Everyone</option>
                <option value="parents">Parents</option>
                <option value="staff">Staff</option>
                <option value="class">Specific class</option>
              </select>
            </div>
            {audience === "class" && (
              <div>
                <Label>Class</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  <option value="">— Pick class —</option>
                  {classesQ.data?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => m.mutate()}
            disabled={!title || !body || (audience === "class" && !classId) || m.isPending}
          >
            {m.isPending ? "Posting…" : "Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
