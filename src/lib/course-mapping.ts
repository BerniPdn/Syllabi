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

  const assignments: Assignment[] = (extracted.assignments ?? []).map((assignment, index) => {
    const matched = assignment.component
      ? allCategories.find(
          (category) =>
            category.name.toLowerCase() === assignment.component!.trim().toLowerCase() ||
            category.id === slug(assignment.component!, ""),
        )
      : undefined;
    return {
      id: `a-${index}`,
      categoryId: (matched ?? allCategories[0])!.id,
      name: assignment.name || `Assignment ${index + 1}`,
      weight: assignment.weight ?? null,
      dueDate: assignment.due_date ?? null,
      score: null,
    };
  });

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
    targetGrade: 90,
    scale: normalizeScale(extracted.grade_scale),
    categories: allCategories,
    assignments,
    policies: extracted.policies ?? [],
  };
}
