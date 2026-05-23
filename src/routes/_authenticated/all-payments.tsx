import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_authenticated/all-payments")({
  component: () => (
    <Placeholder
      title="All Payments"
      description="Cashbook of every payment received across all invoices"
    />
  ),
  head: () => ({ meta: [{ title: "All Payments — JEC" }] }),
});
