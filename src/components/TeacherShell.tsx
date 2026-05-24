import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherStaff } from "@/hooks/useTeacherStaff";
import {
  LayoutGrid,
  GraduationCap,
  BookOpen,
  CalendarRange,
  CheckSquare,
  Star,
  Palmtree,
  Bus,
  LogOut,
  RefreshCw,
  UserRound,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }> };

const NAV: NavItem[] = [
  { to: "/teacher/dashboard", label: "My Dashboard", icon: LayoutGrid },
  { to: "/teacher/classes", label: "My Classes", icon: GraduationCap },
  { to: "/teacher/subjects", label: "My subjects", icon: BookOpen },
  { to: "/teacher/timetable", label: "Timetable", icon: CalendarRange },
  { to: "/teacher/attendance", label: "Attendance", icon: CheckSquare },
  { to: "/teacher/marks", label: "Marks Entry", icon: Star },
  { to: "/teacher/leave", label: "Leave", icon: Palmtree },
  { to: "/teacher/transport", label: "Transport", icon: Bus },
];

export default function TeacherShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const staffQ = useTeacherStaff();
  const location = useRouterState({ select: (s) => s.location.pathname });

  const displayName =
    staffQ.data ? `${staffQ.data.first_name} ${staffQ.data.last_name}` :
    user?.user_metadata?.full_name || user?.email || "Teacher";

  return (
    <div className="min-h-screen flex bg-[#f3f5f8] text-foreground font-sans">
      <aside className="w-[260px] bg-[#11314a] text-white flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-5 flex items-center gap-3">
          <div className="size-11 bg-brand-gold rounded-lg flex items-center justify-center font-display font-bold text-xl text-brand-navy">
            J
          </div>
          <div className="leading-tight">
            <h1 className="font-display font-bold text-base">JEC Nairobi<br/>Educational Centre</h1>
            <p className="text-[10px] text-sky-300 font-bold uppercase tracking-widest mt-1">Teacher</p>
          </div>
        </div>

        <nav className="flex-1 px-3 pt-2 pb-4 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Menu</p>
          <div className="space-y-1">
            {NAV.map((item) => {
              const active = location === item.to || location.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-2.5 rounded-md flex items-center gap-3 text-sm transition-colors ${
                    active
                      ? "bg-[#1d4d72] text-white font-semibold"
                      : "text-white/75 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="px-3 pb-4 space-y-3">
          <div className="bg-[#0f2940] rounded-md p-2.5 flex items-center gap-2">
            <div className="size-9 rounded-md bg-emerald-500 flex items-center justify-center">
              <UserRound className="size-4 text-white" />
            </div>
            <div className="leading-tight flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{displayName}</p>
              <p className="text-[11px] text-white/60">Teacher</p>
            </div>
            <button onClick={signOut} title="Sign out" className="p-1.5 rounded hover:bg-white/10">
              <LogOut className="size-4 text-white/70" />
            </button>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-white/70 hover:text-white hover:bg-white/5"
          >
            <RefreshCw className="size-3.5" /> Refresh App
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 px-8 py-8 max-w-[1400px] w-full mx-auto">
          {staffQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading your profile…</p>
          ) : !staffQ.data ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
              <h2 className="font-semibold text-amber-900">No teacher record linked</h2>
              <p className="text-sm text-amber-800 mt-1">
                Your account isn't linked to a staff record yet. Please ask an admin to link your user to a staff profile in <span className="font-mono">Staff Registry</span>.
              </p>
            </div>
          ) : (
            children
          )}
        </div>
        <footer className="border-t border-border bg-white py-4 text-center text-xs text-muted-foreground">
          Powered by <span className="font-semibold text-foreground">Brance Technologies</span>
        </footer>
      </main>
    </div>
  );
}
