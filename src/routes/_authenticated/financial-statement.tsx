import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_authenticated/financial-statement")({
  component: () => (
    <Placeholder
      title="Financial Statement"
      description="Income vs. expenditure summary by term"
    />
  ),
  head: () => ({ meta: [{ title: "Financial Statement — JEC" }] }),
});
