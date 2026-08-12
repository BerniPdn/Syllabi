import { type Assignment, type Category, type Course } from "./types";
import { emptyExtraction, type ExtractedSyllabus } from "./syllabus-extraction";
import { inferAssignmentWeights } from "./assignment-weights";
import { normalizeScale } from "./grade-scale";


const slug = (value: string, fallback: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || fallback;

/**
 * Maps a saved course row (with its confirmed AI extraction) into the domain
 * Course shape the workspace + grade engine consume.
 */
export function courseFromRow(row: {
  id: string;
  title: string | null;
  extracted: unknown;
  target_grade?: number | string | null;
}): Course {
  const extracted: ExtractedSyllabus = {
    ...emptyExtraction(),
    ...((row.extracted ?? {}) as Partial<ExtractedSyllabus>),
  };

  const components = extracted.grading_components ?? [];
  const categories: Category[] = components.map((component, index) => ({
    id: slug(component.name, `component-${index}`),
    name: component.name || `Component ${index + 1}`,
    weight: component.weight ?? 0,
  }));

  const fallbackCategory: Category | null =
    categories.length === 0 ? { id: "overall", name: "Overall", weight: 100 } : null;
  const allCategories = fallbackCategory ? [fallbackCategory] : categories;

  const { assignments: weighted } = inferAssignmentWeights(
    components,
    extracted.assignments ?? [],
  );

  const UNASSIGNED_CATEGORY_ID = "unassigned";

  const assignments: Assignment[] = weighted.map((assignment, index) => {
    const componentName = assignment.component?.trim();
    // Same rule the review screen uses: an assignment belongs to a component
    // only on an exact (trimmed) name match. Anything else — including a
    // near-miss from case, punctuation, or a renamed/deleted component — is
    // genuinely unassigned, not silently folded into an arbitrary category.
    const matched = componentName
      ? allCategories.find((category) => category.name.trim() === componentName)
      : undefined;
  
    return {
      id: `a-${index}`,
      categoryId: matched ? matched.id : UNASSIGNED_CATEGORY_ID,
      name: assignment.name || `Assignment ${index + 1}`,
      weight: assignment.weight ?? null,
      dueDate: assignment.due_date ?? null,
      score: null,
    };
  });
  
  // If anything landed in Unassigned, surface it as a real category with
  // weight 0 — visible in the workspace, but contributing nothing to the
  // grade math (no skew, unlike falling into allCategories[0]).
  if (assignments.some((a) => a.categoryId === UNASSIGNED_CATEGORY_ID)) {
    allCategories.push({ id: UNASSIGNED_CATEGORY_ID, name: "Unassigned", weight: 0 });
  }
  
  // Grading components with a weight but no listed assignments (Participation,
  // Attendance, Discussion, ...) are still part of the final grade, so they get a
  // single gradable row of their own. Stable id so saved grades keep matching.
  for (const category of allCategories) {
    if (assignments.some((assignment) => assignment.categoryId === category.id)) continue;
    assignments.push({
      id: `component-${category.id}`,
      categoryId: category.id,
      name: category.name,
      weight: null,
      dueDate: null,
      score: null,
    });
  }

  return {
    id: row.id,
    name: extracted.course_name?.trim() || row.title?.trim() || "Untitled course",
    code: extracted.course_code?.trim() || "",
    professor: extracted.professor?.trim() || "",
    semester: extracted.semester?.trim() || "",
    // Persisted, student-chosen target. The fallback only covers legacy rows
    // fetched without the column (numeric comes back as a string from PostgREST).
    targetGrade: Number.isFinite(Number(row.target_grade)) ? Number(row.target_grade) : 90,
    scale: normalizeScale(extracted.grade_scale),
    categories: allCategories,
    assignments,
    policies: extracted.policies ?? [],
  };
}
