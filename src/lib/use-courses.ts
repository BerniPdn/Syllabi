import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { courseFromRow } from "@/lib/course-mapping";
import type { Course } from "@/lib/types";

export const coursesQueryKey = ["courses"] as const;

/**
 * Real course list for the signed-in user (RLS scopes rows to the owner).
 * Shared by the dashboard and the app shell navigation so both stay in sync.
 */
export function useCourses() {
  return useQuery<Course[]>({
    queryKey: coursesQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, extracted, status, updated_at")
        .eq("status", "ready")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(courseFromRow);
    },
  });
}
