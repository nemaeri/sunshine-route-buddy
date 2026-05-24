import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeacherStaff } from "@/hooks/useTeacherStaff";
import { Card } from "@/components/PageHeader";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Send, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/teacher/leave")({
  component: TeacherLeavePage,
  head: () => ({ meta: [{ title: "Leave — Teacher" }] }),
});

function daysBetween(a: string, b: string) {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.floor(ms / 86400000) + 1);
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

function TeacherLeavePage() {
  const qc = useQueryClient();
  const { data: staff } = useTeacherStaff();
  const staffId = staff?.id;
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const days = useMemo(() => daysBetween(start, end), [start, end]);
  const year = new Date().getFullYear();

  const requestsQ = useQuery({
    enabled: !!staffId,
    queryKey: ["t-leave-requests", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests").select("*").eq("staff_id", staffId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const approvedDays = (requestsQ.data ?? [])
    .filter((r: any) => r.status === "approved" && new Date(r.start_date).getFullYear() === year)
    .reduce((sum: number, r: any) => sum + (r.days ?? 0), 0);

  const submit = useMutation({
    mutationFn: async () => {
      if (!staffId) throw new Error("No staff record");
      if (!start || !end) throw new Error("Pick start and end");
      if (days < 1) throw new Error("End date must be on or after start");
      const { error } = await supabase.from("leave_requests").insert({
        staff_id: staffId, leave_type: "annual",
        start_date: start, end_date: end, days, reason: reason || null, status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submitted");
      setStart(""); setEnd(""); setReason("");
      qc.invalidateQueries({ queryKey: ["t-leave-requests"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">Leave</h1>
        <p className="text-sm text-muted-foreground">Submit requests · View status</p>
      </div>

      <Card className="p-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Approved leave this year</p>
        <p className="font-display font-bold text-xl">{approvedDays} days</p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="font-display font-bold text-lg mb-3">New request</h2>
          <div className="space-y-3">
            <div>
              <Label>From</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Reason</Label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={() => submit.mutate()}
              disabled={submit.isPending}
              className="w-full bg-[#11314a] text-white rounded-md py-2.5 flex items-center justify-center gap-2 text-sm font-semibold hover:bg-[#1d4d72] disabled:opacity-50"
            >
              <Send className="size-4" /> {submit.isPending ? "Submitting…" : "Submit"}
            </button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg">My requests</h2>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["t-leave-requests"] })}
              className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary inline-flex items-center gap-1.5"
            >
              <RefreshCw className="size-3.5" /> Refresh
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left font-semibold py-2">Dates</th>
                <th className="text-left font-semibold py-2">Days</th>
                <th className="text-left font-semibold py-2">Status</th>
                <th className="text-left font-semibold py-2">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {requestsQ.isLoading ? <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Loading…</td></tr> :
                (requestsQ.data ?? []).length === 0 ? <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No requests yet.</td></tr> :
                (requestsQ.data ?? []).map((r: any) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 whitespace-nowrap">{r.start_date} → {r.end_date}</td>
                    <td className="py-2">{r.days}</td>
                    <td className="py-2">
                      <span className={`inline-block px-2 py-0.5 rounded border text-xs ${STATUS_BADGE[r.status] ?? ""}`}>{r.status}</span>
                    </td>
                    <td className="py-2 text-muted-foreground">{new Date(r.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
