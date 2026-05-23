import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_authenticated/payroll")({
  component: () => (
    <Placeholder
      title="Payroll"
      description="Run monthly payroll with KRA-compliant PAYE, SHIF, NSSF, and Housing Levy"
    />
  ),
  head: () => ({ meta: [{ title: "Payroll — JEC" }] }),
});
