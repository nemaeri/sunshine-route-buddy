import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, RefreshCw, Check, X, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leave-requests")({
  component: LeaveRequestsPage,
  head: () => ({ meta: [{ title: "Leave Requests — JEC" }] }),
});

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type TypeFilter = "all" | "annual" | "sick" | "compassionate" | "maternity" | "paternity" | "study" | "unpaid" | "other";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

function LeaveRequestsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [decision, setDecision] = useState<{ id: string; action: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  const staffQ = useQuery({
    queryKey: ["staff-light"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, first_name, last_name, designation");
      if (error) throw error;
      return data ?? [];
    },
  });

  const leaveQ = useQuery({
    queryKey: ["leave-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const staffMap = useMemo(() => {
    const m: Record<string, { name: string; role: string }> = {};
    (staffQ.data ?? []).forEach((s: any) => {
      m[s.id] = {
        name: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim(),
        role: s.designation ?? "—",
      };
    });
    return m;
  }, [staffQ.data]);

  const filtered = useMemo(() => {
    const all = leaveQ.data ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((r: any) => {
      if (status !== "all" && r.status !== status) return false;
      if (typeFilter !== "all" && r.leave_type !== typeFilter) return false;
      if (fromDate && r.end_date < fromDate) return false;
      if (toDate && r.start_date > toDate) return false;
      if (q) {
        const s = staffMap[r.staff_id];
        const haystack = [
          s?.name, s?.role, r.reason, r.leave_type, r.status,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [leaveQ.data, status, typeFilter, fromDate, toDate, search, staffMap]);

  const counts = useMemo(() => {
    const all = leaveQ.data ?? [];
    return {
      all: all.length,
      pending: all.filter((r: any) => r.status === "pending").length,
      approved: all.filter((r: any) => r.status === "approved").length,
      rejected: all.filter((r: any) => r.status === "rejected").length,
    };
  }, [leaveQ.data]);

  const decideM = useMutation({
    mutationFn: async ({ id, action, note }: { id: string; action: "approved" | "rejected"; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: action,
          decided_by: user?.id ?? null,
          decided_at: new Date().toISOString(),
          decision_note: note || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Request ${vars.action}`);
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      setDecision(null);
      setNote("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const clearFilters = () => {
    setStatus("all"); setTypeFilter("all"); setSearch(""); setFromDate(""); setToDate("");
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Leave requests"
        description="Approve or reject staff time-off applications"
        actions={
          <Button asChild variant="outline">
            <Link to="/my-leave"><CalendarDays className="size-4 mr-2" />My leave</Link>
          </Button>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <div className="flex gap-1">
              {(["all","pending","approved","rejected"] as StatusFilter[]).map((s) => (
                <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
                  {s[0].toUpperCase()+s.slice(1)} <span className="ml-1 text-xs opacity-70">({counts[s]})</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1 min-w-[160px]">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="all">All types</option>
              <option value="annual">Annual</option>
              <option value="sick">Sick</option>
              <option value="compassionate">Compassionate</option>
              <option value="maternity">Maternity</option>
              <option value="paternity">Paternity</option>
              <option value="study">Study</option>
              <option value="unpaid">Unpaid</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 w-40" />
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <Label className="text-xs text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, role, reason…"
                className="h-9 pl-8"
              />
            </div>
          </div>

          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={clearFilters}>Clear</Button>
            <Button variant="default" onClick={() => leaveQ.refetch()}>
              <RefreshCw className="size-4 mr-2" />Refresh
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Staff</th>
              <th className="text-left font-medium px-4 py-3">Role</th>
              <th className="text-left font-medium px-4 py-3">Type</th>
              <th className="text-left font-medium px-4 py-3">Dates</th>
              <th className="text-left font-medium px-4 py-3">Days</th>
              <th className="text-left font-medium px-4 py-3">Reason</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-right font-medium px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {leaveQ.isLoading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                {(leaveQ.data ?? []).length === 0 ? "No leave requests yet." : "No requests match your filters."}
              </td></tr>
            ) : filtered.map((r: any) => {
              const s = staffMap[r.staff_id];
              return (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{s?.name ?? "Unknown"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s?.role ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{r.leave_type}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.start_date} – {r.end_date}</td>
                  <td className="px-4 py-3">{r.days}</td>
                  <td className="px-4 py-3 max-w-[260px] truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded border text-xs ${STATUS_BADGE[r.status] ?? ""}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "pending" ? (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => { setDecision({ id: r.id, action: "approved" }); setNote(""); }}
                        >
                          <Check className="size-4 mr-1" />Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-rose-600 border-rose-200 hover:bg-rose-50"
                          onClick={() => { setDecision({ id: r.id, action: "rejected" }); setNote(""); }}
                        >
                          <X className="size-4 mr-1" />Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {r.decided_at ? new Date(r.decided_at).toLocaleDateString() : ""}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!decision} onOpenChange={(o) => { if (!o) { setDecision(null); setNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.action === "approved" ? "Approve leave request" : "Reject leave request"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason or comment…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>Cancel</Button>
            <Button
              onClick={() => decision && decideM.mutate({ id: decision.id, action: decision.action, note })}
              className={decision?.action === "approved" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              variant={decision?.action === "rejected" ? "destructive" : "default"}
              disabled={decideM.isPending}
            >
              {decideM.isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
