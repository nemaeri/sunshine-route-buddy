import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardCheck,
  Wallet,
  CalendarCheck2,
  Bus,
  Megaphone,
  Settings,
  LogOut,
  UserCog,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles?: AppRole[]; // if undefined, show to all auth users
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/students", label: "Student Directory", icon: GraduationCap, roles: ["admin", "teacher"] },
  { to: "/classes", label: "Classes", icon: Users, roles: ["admin", "teacher"] },
  { to: "/attendance", label: "Attendance", icon: ClipboardCheck, roles: ["admin", "teacher"] },
  { to: "/staff", label: "Staff Registry", icon: UserCog, roles: ["admin", "finance"] },
  { to: "/finance", label: "Financial Records", icon: Wallet, roles: ["admin", "finance"] },
  { to: "/bus", label: "Transport / Bus", icon: Bus },
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/my-children", label: "My Children", icon: GraduationCap, roles: ["parent"] },
  { to: "/settings", label: "Settings", icon: Settings },
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

  const items = NAV.filter((n) => !n.roles || n.roles.some((r) => roles.includes(r)));
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

        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {items.map((item) => {
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
