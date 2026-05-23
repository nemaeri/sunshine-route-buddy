import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_authenticated/timetable")({
  component: () => (
    <Placeholder title="Timetable" description="Weekly class schedule by stream and teacher" />
  ),
  head: () => ({ meta: [{ title: "Timetable — JEC" }] }),
});
