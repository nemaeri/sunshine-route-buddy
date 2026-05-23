import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_authenticated/leave-requests")({
  component: () => (
    <Placeholder
      title="Leave Requests"
      description="Review and approve staff leave applications"
    />
  ),
  head: () => ({ meta: [{ title: "Leave Requests — JEC" }] }),
});
