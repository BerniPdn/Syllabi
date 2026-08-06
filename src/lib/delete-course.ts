import { supabase } from "@/integrations/supabase/client";

/**
 * Deletes a single course owned by the authenticated user.
 * Grades cascade via the courses foreign key; extracted syllabus data and
 * course metadata live on the course row itself, and the stored PDF is
 * removed from the `syllabi` bucket first so no orphaned file remains.
 */
export async function deleteCourse(courseId: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("You need to be signed in to delete a course.");
  const userId = userData.user.id;

  const { data: course, error: fetchError } = await supabase
    .from("courses")
    .select("id, file_path")
    .eq("id", courseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!course) throw new Error("This course no longer exists.");

  // Explicit grade removal keeps behaviour predictable even if the cascade changes.
  const { error: gradesError } = await supabase
    .from("grades")
    .delete()
    .eq("course_id", courseId)
    .eq("user_id", userId);
  if (gradesError) throw gradesError;

  if (course.file_path) {
    await supabase.storage.from("syllabi").remove([course.file_path]);
  }

  const { error: courseError } = await supabase
    .from("courses")
    .delete()
    .eq("id", courseId)
    .eq("user_id", userId);
  if (courseError) throw courseError;
}
