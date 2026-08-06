import { DEFAULT_SCALE, type GradeScaleStep } from "./types";
import type { ExtractedScaleStep } from "./syllabus-extraction";

/**
 * Every course needs a usable grading scale. We take whatever the syllabus
 * stated (or the student edited), drop unusable rows, and fall back to the
 * default scale when nothing is left.
 */
export function normalizeScale(steps: ExtractedScaleStep[] | null | undefined): GradeScaleStep[] {
  const cleaned = (steps ?? [])
    .map((step) => ({ letter: step.letter?.trim() ?? "", min: step.min }))
    .filter(
      (step): step is GradeScaleStep =>
        step.letter.length > 0 && typeof step.min === "number" && Number.isFinite(step.min),
    )
    .map((step) => ({ letter: step.letter, min: Math.min(100, Math.max(0, step.min)) }))
    .sort((a, b) => b.min - a.min);

  return cleaned.length > 0 ? cleaned : DEFAULT_SCALE;
}

/** Editable representation, always populated so the editor is never blank. */
export function scaleForEditing(steps: ExtractedScaleStep[] | null | undefined) {
  return (steps ?? []).length > 0
    ? (steps as ExtractedScaleStep[])
    : DEFAULT_SCALE.map((step) => ({ letter: step.letter, min: step.min as number | null }));
}
