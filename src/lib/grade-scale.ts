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

/**
 * Ranks a letter grade so cutoff order can be validated: A+ > A > A- > B+ ...
 * Unknown letters return null and are skipped by the order check.
 */
export function letterRank(letter: string): number | null {
  const cleaned = letter.trim().toUpperCase();
  const match = /^([A-F])\s*([+-])?$/.exec(cleaned);
  if (!match) return null;
  const base = "ABCDEF".indexOf(match[1]!);
  const modifier = match[2] === "+" ? -1 : match[2] === "-" ? 1 : 0;
  // Lower score = higher grade.
  return base * 3 + modifier;
}

/**
 * A grading scale is only usable when a higher letter never requires a lower
 * cutoff than a lower letter. Returns human-readable problems (empty = valid).
 */
export function validateScaleOrder(
  steps: { letter: string; min: number | null }[] | null | undefined,
): string[] {
  const ranked = (steps ?? [])
    .map((step) => ({
      letter: step.letter.trim(),
      min: step.min,
      rank: letterRank(step.letter ?? ""),
    }))
    .filter(
      (step): step is { letter: string; min: number; rank: number } =>
        step.rank !== null && typeof step.min === "number" && Number.isFinite(step.min),
    );

  const errors: string[] = [];
  for (let i = 0; i < ranked.length; i += 1) {
    for (let j = i + 1; j < ranked.length; j += 1) {
      const a = ranked[i]!;
      const b = ranked[j]!;
      const higher = a.rank < b.rank ? a : b;
      const lower = a.rank < b.rank ? b : a;
      if (higher.rank === lower.rank) continue;
      if (higher.min < lower.min) {
        errors.push(
          `${higher.letter} (${higher.min}%) can't require a lower cutoff than ${lower.letter} (${lower.min}%). Higher letter grades need equal or higher percentages.`,
        );
      }
    }
  }
  return errors;
}
