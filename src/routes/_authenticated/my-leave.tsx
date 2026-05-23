import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_authenticated/my-leave")({
  component: () => (
    <Placeholder title="My Leave" description="Apply for and track your leave balance" />
  ),
  head: () => ({ meta: [{ title: "My Leave — JEC" }] }),
});
