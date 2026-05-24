import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TeacherStaff = {
  id: string;
  first_name: string;
  last_name: string;
  designation: string | null;
  staff_no: string;
};

export function useTeacherStaff() {
  const { user } = useAuth();
  return useQuery({
    enabled: !!user?.id,
    queryKey: ["teacher-staff", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, first_name, last_name, designation, staff_no")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as TeacherStaff | null);
    },
  });
}
