import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <Placeholder
      title="Reports"
      description="Academic, attendance, and finance reports for management"
    />
  ),
  head: () => ({ meta: [{ title: "Reports — JEC" }] }),
});
