import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeacherStaff } from "@/hooks/useTeacherStaff";
import { Card } from "@/components/PageHeader";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/teacher/classes")({
  component: TeacherClassesPage,
  head: () => ({ meta: [{ title: "My Classes — Teacher" }] }),
});

function TeacherClassesPage() {
  const { data: staff } = useTeacherStaff();
  const staffId = staff?.id;

  const classesQ = useQuery({
    enabled: !!staffId,
    queryKey: ["t-classes-list", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, grade_level, stream")
        .eq("class_teacher_id", staffId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">My classes</h1>
        <p className="text-sm text-muted-foreground">Homeroom streams</p>
      </div>

      {(classesQ.data ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No classes assigned.</Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(classesQ.data ?? []).map((c: any) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-md bg-[#11314a] text-white flex items-center justify-center text-xs font-bold">
                  G{(c.grade_level ?? "").replace(/[^0-9]/g, "") || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-base truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">Homeroom · Grade {c.grade_level}</p>
                </div>
                <Link to="/teacher/classes/$classId" params={{ classId: c.id }} className="text-sm font-semibold text-[#11314a] hover:underline inline-flex items-center gap-1">
                  Roster <ChevronRight className="size-4" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
