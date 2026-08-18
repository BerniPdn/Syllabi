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

  const deletedCourse = await deleteDraftCourseRow(userId, courseId);
  if (!deletedCourse) return;
  await removeDeletedCourseArtifacts(userId, deletedCourse);
}

/**
 * Safety net for rows that escaped the flow (closed tab, crash, older builds).
 * Runs when the student is demonstrably not inside the upload flow, and only
 * touches rows older than `minAgeMs` so neither a live extraction nor an open
 * Review Sheet in another tab is ever destroyed mid-flight. The window is
 * deliberately generous: reviewing a syllabus legitimately takes many minutes,
 * and deleting a draft out from under an open Review Sheet is far worse than
 * letting an invisible abandoned row live a few hours longer.
 */
export async function sweepAbandonedCourses(minAgeMs = 6 * 60 * 60 * 1000): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) return;

  const cutoff = new Date(Date.now() - minAgeMs).toISOString();
  const { data: rows, error } = await supabase
    .from("courses")
    .select("id")
    .eq("user_id", userId)
    .neq("status", "ready")
    .lt("updated_at", cutoff);
  if (error) throw error;

  for (const row of rows ?? []) {
    const deletedCourse = await deleteDraftCourseRow(userId, row.id);
    if (!deletedCourse) continue;
    await removeDeletedCourseArtifacts(userId, deletedCourse);
  }
}

async function deleteDraftCourseRow(userId: string, courseId: string) {
  const { data, error } = await supabase
    .from("courses")
    .delete()
    .eq("id", courseId)
    .eq("user_id", userId)
    .neq("status", "ready")
    .select("id, file_path")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function removeDeletedCourseArtifacts(
  userId: string,
  course: { id: string; file_path: string | null },
) {
  // Only clean up dependent rows/files after the course row was actually
  // deleted; otherwise a concurrent save could win the race and make it ready.
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
}
