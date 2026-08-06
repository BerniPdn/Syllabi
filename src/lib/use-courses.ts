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

      const courses = (data ?? []).map(courseFromRow);
      if (courses.length === 0) return courses;

      // Saved scores live in `grades`; merge them in so dashboard cards show the
      // same current grade / completion as the course workspace.
      const { data: gradeRows, error: gradesError } = await supabase
        .from("grades")
        .select("course_id, assignment_key, score")
        .in(
          "course_id",
          courses.map((course) => course.id),
        );
      if (gradesError) throw gradesError;

      const byCourse = new Map<string, Record<string, number>>();
      for (const row of gradeRows ?? []) {
        const map = byCourse.get(row.course_id) ?? {};
        map[row.assignment_key] = Number(row.score);
        byCourse.set(row.course_id, map);
      }

      return courses.map((course) => {
        const scores = byCourse.get(course.id);
        if (!scores) return course;
        return {
          ...course,
          assignments: course.assignments.map((assignment) => ({
            ...assignment,
            score: scores[assignment.id] ?? null,
          })),
        };
      });
    },
  });
}

