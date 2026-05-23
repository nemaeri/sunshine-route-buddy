import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_authenticated/fee-structure")({
  component: () => (
    <Placeholder
      title="Fee Structure"
      description="Define fee items per grade and term"
    />
  ),
  head: () => ({ meta: [{ title: "Fee Structure — JEC" }] }),
});
