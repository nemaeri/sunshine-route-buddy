import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_authenticated/student-ledger")({
  component: () => (
    <Placeholder
      title="Student Ledger"
      description="Per-student statement of invoices, payments, and balance"
    />
  ),
  head: () => ({ meta: [{ title: "Student Ledger — JEC" }] }),
});
