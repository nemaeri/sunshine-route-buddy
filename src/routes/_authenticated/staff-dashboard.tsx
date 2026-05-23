import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/staff-dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/staff" });
  },
});
