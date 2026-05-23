import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_authenticated/subjects")({
  component: () => (
    <Placeholder
      title="Subjects"
      description="Manage the CBC subject catalog per grade"
    />
  ),
  head: () => ({ meta: [{ title: "Subjects — JEC" }] }),
});
