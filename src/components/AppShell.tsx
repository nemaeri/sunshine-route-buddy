import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Bus,
  Settings,
  LogOut,
  LayoutGrid,
  CalendarDays,
  PlaneTakeoff,
  BookOpen,
  CalendarRange,
  Receipt,
  CreditCard,
  FileSpreadsheet,
  PieChart,
  Banknote,
  BookUser,
  BarChart3,
  
  Baby,
  Wallet,
  LineChart,
  ClipboardCheck,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles?: AppRole[];
};

type NavSection = { title: string; items: NavItem[]; roles?: AppRole[] };

const ADMINISH: AppRole[] = ["admin", "head_teacher", "finance"];

const SECTIONS: NavSection[] = [
  // Parent portal — only parents see this
  {
    title: "Menu",
    roles: ["parent"],
    items: [
      { to: "/my-children", label: "My Children", icon: Baby, roles: ["parent"] },
      { to: "/my-fees", label: "Fees & Payments", icon: Wallet, roles: ["parent"] },
      { to: "/my-performance", label: "Performance", icon: LineChart, roles: ["parent"] },
      { to: "/my-attendance", label: "Attendance", icon: ClipboardCheck, roles: ["parent"] },
      { to: "/bus", label: "Transport", icon: Bus, roles: ["parent"] },
    ],
  },
  {
    title: "Main",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ADMINISH },
      { to: "/students", label: "Students", icon: GraduationCap, roles: ADMINISH },
      { to: "/classes", label: "Classes & Streams", icon: Users, roles: ADMINISH },
      { to: "/staff-dashboard", label: "Staff dashboard", icon: LayoutGrid, roles: ADMINISH },
      { to: "/leave-requests", label: "Leave requests", icon: CalendarDays, roles: ADMINISH },
      { to: "/my-leave", label: "My leave", icon: PlaneTakeoff, roles: ADMINISH },
    ],
  },
  {
    title: "School",
    items: [
      { to: "/settings", label: "Settings", icon: Settings, roles: ADMINISH },
      { to: "/bus", label: "Transport", icon: Bus, roles: ADMINISH },
    ],
  },
  {
    title: "Academic",
    items: [
      { to: "/subjects", label: "Subjects", icon: BookOpen, roles: ADMINISH },
      { to: "/timetable", label: "Timetable", icon: CalendarRange, roles: ADMINISH },
      { to: "/fee-structure", label: "Fee Structure", icon: Receipt, roles: ADMINISH },
    ],
  },
  {
    title: "Finance",
    items: [
      { to: "/all-payments", label: "All payments", icon: CreditCard, roles: ADMINISH },
      { to: "/financial-statement", label: "Financial statement", icon: FileSpreadsheet, roles: ADMINISH },
      { to: "/finance-overview", label: "Finance Overview", icon: PieChart, roles: ADMINISH },
      { to: "/payroll", label: "Payroll", icon: Banknote, roles: ADMINISH },
      { to: "/student-ledger", label: "Student Ledger", icon: BookUser, roles: ADMINISH },
    ],
  },
  {
    title: "Insights",
    items: [
      { to: "/reports", label: "Reports", icon: BarChart3, roles: ADMINISH },
    ],
  },
];


function termLabel() {
  const m = new Date().getMonth() + 1;
  if (m <= 4) return "Term 1";
  if (m <= 8) return "Term 2";
  return "Term 3";
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, signOut } = useAuth();
  const location = useRouterState({ select: (s) => s.location.pathname });

  const visibleSections = SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((n) => !n.roles || n.roles.some((r) => roles.includes(r))),
  })).filter((s) => s.items.length > 0);
  const primaryRole = roles[0] ?? "user";

  return (
    <div className="min-h-screen bg-background flex font-sans text-foreground">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-6">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="size-10 bg-brand-gold rounded-lg flex items-center justify-center font-display font-bold text-xl text-brand-navy">
              J
            </div>
            <div className="leading-tight">
              <h1 className="font-display font-bold text-lg tracking-tight">JEC Nairobi</h1>
              <p className="text-[10px] text-white/60 uppercase tracking-widest">Educational Centre</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-2 overflow-y-auto">
          {visibleSections.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-white/40">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = location === item.to || location.startsWith(item.to + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`px-3 py-2 rounded-md flex items-center gap-3 text-sm transition-colors ${
                        active
                          ? "bg-white/10 text-white font-medium"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {active ? (
                        <span className="size-2 rounded-full bg-brand-gold" />
                      ) : (
                        <Icon className="size-4 opacity-70" />
                      )}
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="bg-brand-emerald/20 p-3 rounded-lg border border-brand-emerald/30">
            <p className="text-[11px] text-brand-emerald font-bold uppercase mb-1">Term Status</p>
            <p className="text-xs text-white/90">{termLabel()} • {new Date().getFullYear()}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 text-xs text-white/70 hover:text-white transition-colors"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="font-display font-bold text-xl text-foreground">Jayden Educational Centre</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground text-xs font-medium capitalize">
              {termLabel()}, {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight">
                {user?.user_metadata?.full_name || user?.email}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tighter capitalize">
                {primaryRole}
              </p>
            </div>
            <div className="size-10 rounded-full bg-secondary border border-border flex items-center justify-center text-sm font-semibold text-muted-foreground">
              {(user?.email?.[0] ?? "?").toUpperCase()}
            </div>
          </div>
        </header>

        <div className="flex-1 p-8">{children}</div>
      </main>
    </div>
  );
}
