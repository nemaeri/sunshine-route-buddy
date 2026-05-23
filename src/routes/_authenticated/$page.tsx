import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Card } from "@/components/PageHeader";

const PLACEHOLDERS: Record<string, { title: string; body: string }> = {
  classes: { title: "Classes", body: "Set up CBC Grade 1–6 with streams and assign class teachers. Building in next iteration." },
  attendance: { title: "Daily Attendance", body: "One-tap class roll for teachers; parents notified instantly. Coming in next iteration." },
  staff: { title: "Staff Registry", body: "Teaching and non-teaching staff, KRA PIN, NHIF, NSSF. Coming with payroll phase." },
  finance: { title: "Financial Records", body: "Fee structures, invoices, M-Pesa payments. Phase 4." },
  bus: { title: "Transport / Bus", body: "Live GPS tracking for parents, route management for admin, driver app. Phase 5 — needs Google Maps connector." },
  announcements: { title: "Announcements", body: "Broadcast to parents, staff or specific classes." },
  "my-children": { title: "My Children", body: "Parent view: attendance, fees, report cards, bus tracking." },
  settings: { title: "Settings", body: "School profile, term dates, roles." },
};

export const Route = createFileRoute("/_authenticated/$page")({
  component: GenericPage,
});

function GenericPage() {
  const { page } = Route.useParams();
  const p = PLACEHOLDERS[page] ?? { title: page, body: "Coming soon." };
  return (
    <>
      <PageHeader title={p.title} description="Module preview" />
      <Card className="p-8">
        <p className="text-sm text-muted-foreground max-w-2xl">{p.body}</p>
        <p className="text-xs text-muted-foreground mt-4">
          This module is part of the JEC build plan. Ask in chat to build it out next.
        </p>
      </Card>
    </>
  );
}
