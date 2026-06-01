import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";

export async function requireRoles(allowed: AppRole[]) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw redirect({ to: "/auth" });

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id);

  const roles = (data ?? []).map((r: any) => r.role as AppRole);
  const hasAccess = allowed.some(r => roles.includes(r));
  if (!hasAccess) throw redirect({ to: "/dashboard" });
}
