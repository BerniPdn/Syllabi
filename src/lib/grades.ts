import { supabase } from "@/integrations/supabase/client";

/** Saved scores for one course, keyed by the assignment id from the extraction. */
export type GradeMap = Record<string, number>;

export async function fetchGrades(courseId: string): Promise<GradeMap> {
  const { data, error } = await supabase
    .from("grades")
    .select("assignment_key, score")
    .eq("course_id", courseId);
  if (error) throw error;

  const map: GradeMap = {};
  for (const row of data ?? []) map[row.assignment_key] = Number(row.score);
  return map;
}

export async function saveGrade(courseId: string, assignmentKey: string, score: number) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error("You need to be signed in to save a grade.");

  const { error } = await supabase.from("grades").upsert(
    { user_id: userId, course_id: courseId, assignment_key: assignmentKey, score },
    { onConflict: "user_id,course_id,assignment_key" },
  );
  if (error) throw error;
}

export async function deleteGrade(courseId: string, assignmentKey: string) {
  const { error } = await supabase
    .from("grades")
    .delete()
    .eq("course_id", courseId)
    .eq("assignment_key", assignmentKey);
  if (error) throw error;
}
