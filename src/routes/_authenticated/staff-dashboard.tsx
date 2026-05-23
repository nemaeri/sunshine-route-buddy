import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_authenticated/staff-dashboard")({
  component: () => (
    <Placeholder
      title="Staff Dashboard"
      description="Overview for teachers and non-admin staff"
    />
  ),
  head: () => ({ meta: [{ title: "Staff Dashboard — JEC" }] }),
});
