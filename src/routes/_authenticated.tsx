import { createFileRoute, Outlet } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  // Auth temporarily bypassed — super admin dashboard opens directly.
  // Login page will be re-enabled later.
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
