import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TeacherShell } from "@/components/TeacherShell";
import { supabase } from "@/integrations/supabase/client";
import { redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/teacher")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
  },
  component: TeacherLayout,
});

function TeacherLayout() {
  return (
    <TeacherShell>
      <Outlet />
    </TeacherShell>
  );
}
