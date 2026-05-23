import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
  head: () => ({ meta: [{ title: "Students — JEC" }] }),
});

function StudentsPage() {
  const q = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, admission_no, first_name, last_name, gender, active, classes(name)")
        .order("admission_no");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader title="Student Directory" description="Active learners across all CBC grades" />
      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            <tr>
              <th className="px-6 py-3">Adm No.</th>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Class</th>
              <th className="px-6 py-3">Gender</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.isLoading && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {q.data?.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                No students yet. Admins can add students from the admin tools (coming in next phase UI).
              </td></tr>
            )}
            {q.data?.map((s: any) => (
              <tr key={s.id}>
                <td className="px-6 py-4 font-mono text-xs">{s.admission_no}</td>
                <td className="px-6 py-4 font-medium">{s.first_name} {s.last_name}</td>
                <td className="px-6 py-4 text-muted-foreground">{s.classes?.name ?? "—"}</td>
                <td className="px-6 py-4 capitalize text-muted-foreground">{s.gender ?? "—"}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${s.active ? "bg-emerald-50 text-emerald-600" : "bg-secondary text-muted-foreground"}`}>
                    {s.active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
