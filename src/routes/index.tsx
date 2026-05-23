import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { GraduationCap, Bus, ClipboardCheck, Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 bg-brand-navy rounded-lg flex items-center justify-center font-display font-bold text-brand-gold">
              J
            </div>
            <div className="leading-tight">
              <h1 className="font-display font-bold text-base">JEC Nairobi</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Educational Centre</p>
            </div>
          </div>
          <Link
            to={user ? "/dashboard" : "/auth"}
            className="inline-flex items-center rounded-md bg-brand-navy text-white px-4 py-2 text-sm font-medium hover:bg-brand-navy/90"
          >
            {loading ? "…" : user ? "Open dashboard" : "Sign in"}
          </Link>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-8 py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-gold mb-3">
            Excellence Through Learning
          </p>
          <h1 className="font-display font-bold text-5xl tracking-tight text-foreground leading-tight">
            The complete school operations platform for Jayden Educational Centre.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            CBC-aligned student records, daily attendance, fees, exam reports, payroll and{" "}
            <span className="text-brand-navy font-semibold">live school-bus GPS</span> for parents — in
            one calm, secure system.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center rounded-md bg-brand-navy text-white px-6 py-3 text-sm font-semibold hover:bg-brand-navy/90"
            >
              Get started
            </Link>
            <a
              href="#features"
              className="inline-flex items-center rounded-md border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-secondary"
            >
              Explore features
            </a>
          </div>
        </div>

        <div id="features" className="grid grid-cols-4 gap-6 mt-20">
          {[
            { i: GraduationCap, t: "Students & Classes", d: "CBC Grade 1–6, admissions, parent links." },
            { i: ClipboardCheck, t: "Daily Attendance", d: "One-tap class roll. Parents notified instantly." },
            { i: Wallet, t: "Fees & Payroll", d: "KES invoicing, KRA-2024 PAYE, NHIF, NSSF." },
            { i: Bus, t: "Live Bus Tracking", d: "Drivers share GPS; parents see the bus on a map." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="bg-card rounded-xl border border-border p-6">
              <div className="size-10 rounded-lg bg-brand-navy/10 text-brand-navy flex items-center justify-center mb-4">
                <Icon className="size-5" />
              </div>
              <h3 className="font-display font-bold">{t}</h3>
              <p className="text-sm text-muted-foreground mt-1">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Jayden Educational Centre · Chokaa Town, Kangundo Road, Nairobi · REG/2012/NRB/0047
      </footer>
    </div>
  );
}
