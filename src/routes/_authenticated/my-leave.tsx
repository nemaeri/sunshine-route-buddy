import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Plus, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-leave")({
  component: MyLeavePage,
  head: () => ({ meta: [{ title: "My Leave — JEC" }] }),
});

const LEAVE_TYPES = [
  "annual","sick","compassionate","maternity","paternity","study","unpaid","other",
];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

function daysBetween(a: string, b: string) {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.floor(ms / 86400000) + 1);
}

function MyLeavePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState<string>("");
  const [leaveType, setLeaveType] = useState("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const staffQ = useQuery({
    queryKey: ["staff-light"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff").select("id, first_name, last_name, designation").eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const leaveQ = useQuery({
    queryKey: ["my-leave", staffId],
    queryFn: async () => {
      let query = supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
      if (staffId) query = query.eq("staff_id", staffId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const currentYear = new Date().getFullYear();
  const balancesQ = useQuery({
    queryKey: ["leave-balances", staffId, currentYear],
    enabled: !!staffId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("leave_balances")
        .select("*")
        .eq("staff_id", staffId)
        .eq("year", currentYear);
      if (error) throw error;
      return (data ?? []) as Array<{
        leave_type: string; entitled_days: number | null; carried_over_days: number;
        used_days: number; remaining_days: number | null;
      }>;
    },
  });

  const currentBalance = useMemo(
    () => (balancesQ.data ?? []).find((b) => b.leave_type === leaveType),
    [balancesQ.data, leaveType],
  );

  const days = useMemo(() => daysBetween(startDate, endDate), [startDate, endDate]);

  const submitM = useMutation({
    mutationFn: async () => {
      if (!staffId) throw new Error("Pick a staff member");
      if (!startDate || !endDate) throw new Error("Pick start and end dates");
      if (days < 1) throw new Error("End date must be on or after start date");
      const { error } = await supabase.from("leave_requests").insert({
        staff_id: staffId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        days,
        reason: reason || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave request submitted");
      qc.invalidateQueries({ queryKey: ["my-leave"] });
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      qc.invalidateQueries({ queryKey: ["leave-balances"] });
      setOpen(false);
      setStartDate(""); setEndDate(""); setReason(""); setLeaveType("annual");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to submit"),
  });

  const cancelM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leave_requests").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request cancelled");
      qc.invalidateQueries({ queryKey: ["my-leave"] });
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      qc.invalidateQueries({ queryKey: ["leave-balances"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <PageHeader
        title="My leave"
        description="Apply for time off and track your requests"
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/leave-requests"><ShieldCheck className="size-4 mr-2" />Approvals</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="size-4 mr-2" />New request</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New leave request</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Staff member</Label>
                    <select
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value)}
                      className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Select…</option>
                      {(staffQ.data ?? []).map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.first_name} {s.last_name}{s.designation ? ` · ${s.designation}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Leave type</Label>
                    <select
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value)}
                      className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm capitalize"
                    >
                      {LEAVE_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                    </select>
                    {staffId && currentBalance ? (
                      <div className="text-xs text-muted-foreground mt-1">
                        {currentBalance.remaining_days === null
                          ? "No limit (unpaid)"
                          : <>Remaining this year: <span className="font-medium text-foreground">{currentBalance.remaining_days}</span> / {(currentBalance.entitled_days ?? 0) + currentBalance.carried_over_days} day(s)</>}
                      </div>
                    ) : !staffId ? (
                      <div className="text-xs text-muted-foreground mt-1">Select a staff member to see balance</div>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Start</Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div>
                      <Label>End</Label>
                      <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Duration: <span className="font-medium text-foreground">{days} day{days === 1 ? "" : "s"}</span>
                  </div>
                  <div>
                    <Label>Reason</Label>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. family event" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => submitM.mutate()} disabled={submitM.isPending}>
                    {submitM.isPending ? "Submitting…" : "Submit"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1 min-w-[280px]">
            <Label className="text-xs text-muted-foreground">View staff member</Label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">All staff</option>
              {(staffQ.data ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
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
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : (leaveQ.data ?? []).length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No leave requests yet.</td></tr>
            ) : (leaveQ.data ?? []).map((r: any) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3 capitalize">{r.leave_type}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.start_date} – {r.end_date}</td>
                <td className="px-4 py-3">{r.days}</td>
                <td className="px-4 py-3 max-w-[260px] truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded border text-xs ${STATUS_BADGE[r.status] ?? ""}`}>
                    {r.status}
                  </span>
                  {r.decision_note ? <div className="text-xs text-muted-foreground mt-1">{r.decision_note}</div> : null}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status === "pending" ? (
                    <Button size="sm" variant="outline" onClick={() => cancelM.mutate(r.id)}>Cancel</Button>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
