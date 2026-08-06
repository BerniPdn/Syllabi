import type { ExtractedAssignment, ExtractedComponent } from "./syllabus-extraction";

const round2 = (value: number) => Math.round(value * 100) / 100;

export const INFERRED_WEIGHT_NOTE =
  "Weight estimated based on the grading component total and number of assignments — edit it if your syllabus says otherwise.";

/**
 * Case B of the weight rules: a syllabus that only states a component total
 * ("Exams = 60%, three exams") leaves individual weights blank. We split the
 * component's remaining weight equally across those blanks so the grade math
 * never falls back to an arbitrary default. Inferred rows are reported back so
 * the UI can label them as estimates.
 */
export function inferAssignmentWeights(
  components: ExtractedComponent[],
  assignments: ExtractedAssignment[],
): { assignments: ExtractedAssignment[]; inferredIndexes: number[] } {
  const next = [...assignments];
  const inferredIndexes: number[] = [];

  for (const component of components) {
    const name = component.name?.trim();
    if (!name || component.weight === null || !Number.isFinite(component.weight)) continue;

    const indexes = next
      .map((assignment, index) => ({ assignment, index }))
      .filter(({ assignment }) => assignment.component?.trim() === name)
      .map(({ index }) => index);
    if (indexes.length === 0) continue;

    const blanks = indexes.filter((index) => next[index]!.weight === null);
    if (blanks.length === 0) continue;

    const stated = indexes
      .filter((index) => next[index]!.weight !== null)
      .reduce((sum, index) => sum + (next[index]!.weight ?? 0), 0);

    const remaining = component.weight - stated;
    if (remaining <= 0) continue;

    const share = round2(remaining / blanks.length);
    for (const index of blanks) {
      next[index] = { ...next[index]!, weight: share };
      inferredIndexes.push(index);
    }
  }

  return { assignments: next, inferredIndexes };
}
