import { supabase } from "@/integrations/supabase/client";

/**
 * Lifecycle rule: a course only becomes a real, persistent course once the
 * student completes Review and it reaches `status = 'ready'`. Every other
 * state (processing / extracting / review / draft / failed) is a temporary
 * artifact of the upload flow, so it gets deleted the moment the flow can't
 * continue (abandoned, failed, replaced by another upload).
 *
 * Idempotent: calling it for an already-deleted or already-ready course is a
 * no-op. Never deletes a ready course — that path is the explicit
 * "delete course" action in the workspace.
 */
export async function discardDraftCourse(courseId: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) return; // signed out: RLS would reject anyway, nothing to clean.

  const { data: course, error: fetchError } = await supabase
    .from("courses")
    .select("id, status, file_path")
    .eq("id", courseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!course) return; // already gone
  if (course.status === "ready") return; // a real course, never auto-deleted

  await removeCourseRow(userId, course);
}

/**
 * Safety net for rows that escaped the flow (closed tab, crash, older builds).
 * Runs when the student is demonstrably not inside the upload flow, and only
 * touches rows older than `minAgeMs` so a live extraction in another tab is
 * never destroyed mid-flight.
 */
export async function sweepAbandonedCourses(minAgeMs = 3 * 60 * 1000): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) return;

  const cutoff = new Date(Date.now() - minAgeMs).toISOString();
  const { data: rows, error } = await supabase
    .from("courses")
    .select("id, status, file_path")
    .eq("user_id", userId)
    .neq("status", "ready")
    .lt("updated_at", cutoff);
  if (error) throw error;

  for (const row of rows ?? []) {
    await removeCourseRow(userId, row);
  }
}

async function removeCourseRow(
  userId: string,
  course: { id: string; status: string; file_path: string | null },
) {
  // Grades/insights can't exist before `ready`, but delete them explicitly so
  // cleanup stays correct even if that ever changes.
  const { error: gradesError } = await supabase
    .from("grades")
    .delete()
    .eq("course_id", course.id)
    .eq("user_id", userId);
  if (gradesError) throw gradesError;

  const { error: insightsError } = await supabase
    .from("insights")
    .delete()
    .eq("course_id", course.id)
    .eq("user_id", userId);
  if (insightsError) throw insightsError;

  if (course.file_path) {
    const { error: storageError } = await supabase.storage
      .from("syllabi")
      .remove([course.file_path]);
    // A missing object is fine (idempotent re-runs); anything else is real.
    if (storageError && !/not found/i.test(storageError.message)) throw storageError;
  }

  const { error: deleteError } = await supabase
    .from("courses")
    .delete()
    .eq("id", course.id)
    .eq("user_id", userId)
    .neq("status", "ready");
  if (deleteError) throw deleteError;
}
