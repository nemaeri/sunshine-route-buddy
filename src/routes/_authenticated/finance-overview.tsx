import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_authenticated/finance-overview")({
  component: () => (
    <Placeholder
      title="Finance Overview"
      description="KPIs: collections, outstanding balances, expense ratios"
    />
  ),
  head: () => ({ meta: [{ title: "Finance Overview — JEC" }] }),
});
