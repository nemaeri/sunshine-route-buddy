import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, LineChart, Receipt } from "lucide-react";
import { PageHeader, Card } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Reports — JEC" }] }),
});

type Tile = {
  to: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconFg: string;
};

const tiles: Tile[] = [
  {
    to: "/attendance",
    title: "Attendance Report",
    desc: "By class & date range",
    icon: FileText,
    iconBg: "bg-sky-100",
    iconFg: "text-sky-600",
  },
  {
    to: "/exams",
    title: "Academic Report",
    desc: "Ranks & mean scores",
    icon: LineChart,
    iconBg: "bg-emerald-100",
    iconFg: "text-emerald-600",
  },
  {
    to: "/student-ledger",
    title: "Fee / Arrears Report",
    desc: "Collections overview",
    icon: Receipt,
    iconBg: "bg-amber-100",
    iconFg: "text-amber-600",
  },
];

function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="Academic & financial reports" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to}>
            <Card className="p-6 hover:shadow-md hover:border-primary/40 transition cursor-pointer h-full">
              <div className={`size-11 rounded-lg flex items-center justify-center mb-5 ${t.iconBg}`}>
                <t.icon className={`size-5 ${t.iconFg}`} />
              </div>
              <div className="font-display font-bold text-lg text-foreground">{t.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{t.desc}</div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
