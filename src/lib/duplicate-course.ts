import { supabase } from "@/integrations/supabase/client";
import type { ExtractedSyllabus } from "@/lib/syllabus-extraction";

export type DuplicateCandidate = {
  id: string;
  name: string;
  code: string | null;
  professor: string | null;
  semester: string | null;
  reason: string;
};

function norm(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Deterministic (no AI) duplicate check.
 * A saved course is a likely duplicate when the course code matches, or the
 * course name matches closely — unless both courses state a different semester,
 * in which case retaking/reusing the same course is legitimate.
 */
export async function findDuplicateCourses(
  courseId: string,
  draft: ExtractedSyllabus,
): Promise<DuplicateCandidate[]> {
  const draftName = norm(draft.course_name);
  const draftCode = norm(draft.course_code);
  if (!draftName && !draftCode) return [];

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("courses")
    .select("id, title, extracted, status")
    .eq("user_id", userId)
    .eq("status", "ready")
    .neq("id", courseId);
  if (error || !data) return [];

  const draftSemester = norm(draft.semester);
  const draftProfessor = norm(draft.professor);
  const matches: DuplicateCandidate[] = [];

  for (const row of data) {
    const extracted = (row.extracted ?? {}) as Partial<ExtractedSyllabus>;
    const name = norm(extracted.course_name) || norm(row.title);
    const code = norm(extracted.course_code);
    const semester = norm(extracted.semester);
    const professor = norm(extracted.professor);

    // Same course in a different semester is a legitimate new course.
    if (draftSemester && semester && draftSemester !== semester) continue;

    const codeMatch = Boolean(draftCode && code && draftCode === code);
    const nameMatch =
      Boolean(draftName && name) &&
      (draftName === name || draftName.includes(name) || name.includes(draftName));

    if (!codeMatch && !nameMatch) continue;

    const reasons: string[] = [];
    if (codeMatch) reasons.push("same course code");
    if (nameMatch) reasons.push("same course name");
    if (draftProfessor && professor && draftProfessor === professor) {
      reasons.push("same professor");
    }
    if (draftSemester && semester && draftSemester === semester) {
      reasons.push("same semester");
    }

    matches.push({
      id: row.id,
      name: extracted.course_name?.trim() || row.title,
      code: extracted.course_code?.trim() || null,
      professor: extracted.professor?.trim() || null,
      semester: extracted.semester?.trim() || null,
      reason: reasons.join(" · "),
    });
  }

  return matches;
}
