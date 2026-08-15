import type { SupabaseClient } from "@supabase/supabase-js";
import { courseFromRow } from "@/lib/course-mapping";
import { buildInsightFacts, type InsightFacts } from "@/lib/insights";

/**
 * Rebuilds the deterministic insight facts from the database instead of
 * trusting whatever the client had in memory. Keeps generated insights from
 * contradicting the numbers the workspace actually shows.
 */
export async function buildFactsFromDatabase(
  supabase: SupabaseClient,
  courseId: string,
): Promise<InsightFacts | null> {
  const { data: row, error } = await supabase
    .from("courses")
    .select("id, title, extracted, target_grade")
    .eq("id", courseId)
    .eq("status", "ready")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  const { data: gradeRows, error: gradesError } = await supabase
    .from("grades")
    .select("assignment_key, score")
    .eq("course_id", courseId);
  if (gradesError) throw new Error(gradesError.message);

  const scores = new Map<string, number>();
  for (const grade of gradeRows ?? []) {
    scores.set(grade.assignment_key as string, Number(grade.score));
  }

  const course = courseFromRow(row as Parameters<typeof courseFromRow>[0]);
  return buildInsightFacts({
    ...course,
    assignments: course.assignments.map((assignment) => ({
      ...assignment,
      score: scores.has(assignment.id) ? (scores.get(assignment.id) as number) : null,
    })),
  });
}
