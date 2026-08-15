import { supabase } from "@/integrations/supabase/client";
import type { CourseInsight } from "./insights";

export type StoredInsights = {
  insights: CourseInsight[];
  signature: string;
  generatedAt: string;
};

/** Reads the persisted insights row for a course (owner-scoped by RLS). */
export async function fetchStoredInsights(courseId: string): Promise<StoredInsights | null> {
  const { data, error } = await supabase
    .from("insights")
    .select("body, signature, generated_at")
    .eq("course_id", courseId)
    .maybeSingle();

    if (error) {
      console.error("[insights-store] failed to fetch stored insights", error);
      return null;
    }
    if (!data) return null;
  
    const body = data.body as unknown;
    if (!Array.isArray(body)) {
      console.error("[insights-store] stored insights body is not an array", { courseId, body });
      return null;
    }
  
    return {
      insights: body as CourseInsight[],
      signature: data.signature,
      generatedAt: data.generated_at,
    };
}

/** Persists the latest insights for a course, replacing any previous row. */
export async function saveStoredInsights(
  courseId: string,
  signature: string,
  insights: CourseInsight[],
) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;

  await supabase.from("insights").upsert(
    {
      user_id: userId,
      course_id: courseId,
      body: insights as unknown as never,
      signature,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "course_id" },
  );
}
