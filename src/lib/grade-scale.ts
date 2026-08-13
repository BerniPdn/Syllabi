import { DEFAULT_SCALE, type GradeScaleStep } from "./types";
import type { ExtractedScaleStep } from "./syllabus-extraction";

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

/** Deterministic ordering: highest cutoff first, best letter first on ties. */
export function compareScaleSteps(
  a: { letter: string; min: number },
  b: { letter: string; min: number },
) {
  if (b.min !== a.min) return b.min - a.min;
  const rankA = letterRank(a.letter);
  const rankB = letterRank(b.letter);
  if (rankA !== null && rankB !== null && rankA !== rankB) return rankA - rankB;
  if (rankA === null && rankB !== null) return 1;
  if (rankB === null && rankA !== null) return -1;
  return a.letter.trim().localeCompare(b.letter.trim());
}

const canonicalLetter = (letter: string) => letter.trim().toUpperCase().replace(/\s+/g, "");

/**
 * Collapses duplicate grading-scale entries so a scale always has unique
 * letters AND unique cutoffs. Duplicates are resolved deterministically:
 * the first occurrence of a letter wins, and when two different letters
 * share a cutoff the better letter keeps it (the other is dropped).
 * Invalid rows (blank letter, missing cutoff) are preserved as-is by
 * callers that need editing state; this function only handles complete rows.
 */
export function dedupeScaleSteps<T extends { letter: string; min: number }>(steps: T[]): T[] {
  const byLetter = new Map<string, T>();
  for (const step of steps) {
    const key = canonicalLetter(step.letter);
    if (!key || byLetter.has(key)) continue;
    byLetter.set(key, step);
  }

  const ordered = [...byLetter.values()].sort(compareScaleSteps);

  const byMin = new Map<number, T>();
  for (const step of ordered) {
    if (byMin.has(step.min)) continue; // first in deterministic order wins
    byMin.set(step.min, step);
  }

  return [...byMin.values()].sort(compareScaleSteps);
}

/**
 * Every course needs a usable grading scale. We take whatever the syllabus
 * stated (or the student edited), drop unusable rows, deduplicate, and fall
 * back to the default scale when nothing is left.
 */
export function normalizeScale(steps: ExtractedScaleStep[] | null | undefined): GradeScaleStep[] {
  const cleaned = (steps ?? [])
    .map((step) => ({ letter: step.letter?.trim() ?? "", min: step.min }))
    .filter(
      (step): step is GradeScaleStep =>
        step.letter.length > 0 && typeof step.min === "number" && Number.isFinite(step.min),
    )
    .map((step) => ({ letter: step.letter, min: Math.min(100, Math.max(0, step.min)) }));

  const deduped = dedupeScaleSteps(cleaned);

  return deduped.length > 0 ? deduped : DEFAULT_SCALE;
}

/**
 * Cleans + dedupes the editable representation before it is persisted, keeping
 * only complete rows. Used by the save path so repeated reviews/updates can
 * never write duplicate cutoffs.
 */
export function scaleForSaving(
  steps: { letter: string; min: number | null }[] | null | undefined,
): { letter: string; min: number }[] {
  const complete = (steps ?? [])
    .map((step) => ({ letter: step.letter?.trim() ?? "", min: step.min }))
    .filter(
      (step): step is { letter: string; min: number } =>
        step.letter.length > 0 && typeof step.min === "number" && Number.isFinite(step.min),
    )
    .map((step) => ({ letter: step.letter, min: Math.min(100, Math.max(0, step.min)) }));

  return dedupeScaleSteps(complete);
}

/** Editable representation, always populated so the editor is never blank. */
export function scaleForEditing(steps: ExtractedScaleStep[] | null | undefined) {
  return (steps ?? []).length > 0
    ? (steps as ExtractedScaleStep[])
    : DEFAULT_SCALE.map((step) => ({ letter: step.letter, min: step.min as number | null }));
}

/**
 * A grading scale is only usable when every letter appears once, every cutoff
 * is unique, and a higher letter never requires a lower cutoff than a lower
 * letter. Returns human-readable problems (empty = valid).
 */
export function validateScaleOrder(
  steps: { letter: string; min: number | null }[] | null | undefined,
): string[] {
  const errors: string[] = [];

  const present = (steps ?? []).map((step) => ({
    letter: step.letter?.trim() ?? "",
    min: step.min,
  }));

  const letterCounts = new Map<string, string>();
  const duplicateLetters = new Set<string>();
  for (const step of present) {
    const key = canonicalLetter(step.letter);
    if (!key) continue;
    if (letterCounts.has(key)) duplicateLetters.add(letterCounts.get(key)!);
    else letterCounts.set(key, step.letter);
  }
  for (const letter of duplicateLetters) {
    errors.push(`${letter} appears more than once. Each letter grade needs a single cutoff.`);
  }

  const minGroups = new Map<number, string[]>();
  for (const step of present) {
    if (typeof step.min !== "number" || !Number.isFinite(step.min) || !step.letter) continue;
    const key = canonicalLetter(step.letter);
    const group = minGroups.get(step.min) ?? [];
    if (!group.some((letter) => canonicalLetter(letter) === key)) group.push(step.letter);
    minGroups.set(step.min, group);
  }
  for (const [min, letters] of minGroups) {
    if (letters.length > 1) {
      errors.push(
        `${letters.join(" and ")} both start at ${min}%. Give each letter grade its own cutoff.`,
      );
    }
  }

  const ranked = present
    .map((step) => ({ ...step, rank: letterRank(step.letter) }))
    .filter(
      (step): step is { letter: string; min: number; rank: number } =>
        step.rank !== null && typeof step.min === "number" && Number.isFinite(step.min),
    );

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
