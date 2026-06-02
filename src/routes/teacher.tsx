import { createFileRoute, Outlet } from "@tanstack/react-router";
import TeacherShell from "@/components/TeacherShell";

export const Route = createFileRoute("/teacher")({
  component: TeacherLayout,
});

function TeacherLayout() {
  return (
    <TeacherShell>
      <Outlet />
    </TeacherShell>
  );
}
