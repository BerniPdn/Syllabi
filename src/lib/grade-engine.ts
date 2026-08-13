import type { Assignment, Category, Course, GradeScaleStep } from "./types";

/**
 * Deterministic grade engine. No AI, no network, no side effects.
 * Every number shown anywhere in Syllabi comes from here.
 */

export type ScoreOverrides = Record<string, number | null>;

export type WeightedItem = {
  assignment: Assignment;
  category: Category;
  /** Share of the FINAL grade this item carries, in percent. */
  effectiveWeight: number;
  score: number | null;
};

export type GradeSnapshot = {
  items: WeightedItem[];
  graded: WeightedItem[];
  remaining: WeightedItem[];
  /** Weighted average of graded work only, 0-100. null when nothing is graded. */
  currentGrade: number | null;
  /** Final grade if remaining work scores `assumption`, 0-100. */
  projectedGrade: number;
  /** Score needed, on average, across all remaining work to hit the target. */
  neededOnRemaining: number | null;
  gradedWeight: number;
  remainingWeight: number;
  totalWeight: number;
  completion: number; // 0-1
  /** Each remaining item's share of what's left to earn, 0-1. */
  impact: Record<string, number>;
  weightsValid: boolean;
};

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const MIN_SCORE = 0;
export const MAX_SCORE = 100;

export const clampScore = (value: number) => Math.min(MAX_SCORE, Math.max(MIN_SCORE, value));

/** True when a raw input string is a number inside the allowed 0-100 range. */
export const isValidScoreInput = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed === "") return true;
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(trimmed)) return false;
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) && value >= MIN_SCORE && value <= MAX_SCORE;
};

export function letterFor(score: number, scale: GradeScaleStep[]): string {
  // Deduped + deterministically ordered so duplicate cutoffs can never make the
  // resolved letter depend on the order rows came back from the database.
  const ordered = dedupeScaleSteps([...scale]).sort(compareScaleSteps);
  return ordered.find((step) => score >= step.min)?.letter ?? ordered.at(-1)?.letter ?? "—";
}


export function minScoreForLetter(letter: string, scale: GradeScaleStep[]): number {
  return scale.find((step) => step.letter === letter)?.min ?? 0;
}

/** Spread each category's weight across its assignments. */
export function buildItems(
  categories: Category[],
  assignments: Assignment[],
  overrides: ScoreOverrides = {},
): WeightedItem[] {
  const items: WeightedItem[] = [];

  for (const category of categories) {
    const inCategory = assignments.filter((a) => a.categoryId === category.id);
    if (inCategory.length === 0) continue;

    const relativeTotal = inCategory.reduce((sum, a) => sum + (a.weight ?? 1), 0);

    for (const assignment of inCategory) {
      const relative = assignment.weight ?? 1;
      items.push({
        assignment,
        category,
        effectiveWeight: relativeTotal === 0 ? 0 : (category.weight * relative) / relativeTotal,
        score: assignment.id in overrides ? overrides[assignment.id]! : assignment.score,
      });
    }
  }

  return items;
}

export function computeGrades(
  course: Pick<Course, "categories" | "assignments" | "targetGrade">,
  overrides: ScoreOverrides = {},
  options: { assumeRemaining?: "current" | "target" | "none" } = {},
): GradeSnapshot {
  const items = buildItems(course.categories, course.assignments, overrides);
  const graded = items.filter((item) => item.score !== null);
  const remaining = items.filter((item) => item.score === null);

  const totalWeight = items.reduce((sum, item) => sum + item.effectiveWeight, 0);
  const gradedWeight = graded.reduce((sum, item) => sum + item.effectiveWeight, 0);
  const remainingWeight = remaining.reduce((sum, item) => sum + item.effectiveWeight, 0);

  const earnedPoints = graded.reduce(
    (sum, item) => sum + (item.score! / 100) * item.effectiveWeight,
    0,
  );

  const currentGrade = gradedWeight > 0 ? round((earnedPoints / gradedWeight) * 100) : null;

  const assume = options.assumeRemaining ?? "current";
  const assumedScore =
    assume === "none" ? 0 : assume === "target" ? course.targetGrade : (currentGrade ?? course.targetGrade);

  const projectedPoints = earnedPoints + (assumedScore / 100) * remainingWeight;
  const projectedGrade = totalWeight > 0 ? round((projectedPoints / totalWeight) * 100) : 0;

  const neededOnRemaining =
    remainingWeight > 0
      ? round((((course.targetGrade / 100) * totalWeight - earnedPoints) / remainingWeight) * 100)
      : null;

  const impact: Record<string, number> = {};
  for (const item of remaining) {
    impact[item.assignment.id] =
      remainingWeight > 0 ? item.effectiveWeight / remainingWeight : 0;
  }

  return {
    items,
    graded,
    remaining,
    currentGrade,
    projectedGrade,
    neededOnRemaining,
    gradedWeight: round(gradedWeight),
    remainingWeight: round(remainingWeight),
    totalWeight: round(totalWeight),
    completion: totalWeight > 0 ? gradedWeight / totalWeight : 0,
    impact,
    weightsValid: Math.abs(totalWeight - 100) < 0.5,
  };
}

/** Projected grade with explicit simulated values for remaining work. */
export function simulate(
  course: Pick<Course, "categories" | "assignments" | "targetGrade">,
  simulated: Record<string, number>,
): GradeSnapshot {
  const overrides: ScoreOverrides = {};
  for (const [id, value] of Object.entries(simulated)) overrides[id] = clampScore(value);
  return computeGrades(course, overrides, { assumeRemaining: "current" });
}

export function nextDeadline(assignments: Assignment[], now = new Date()) {
  return (
    assignments
      .filter((a) => a.score === null && a.dueDate)
      .map((a) => ({ assignment: a, due: new Date(a.dueDate!) }))
      .filter((entry) => !Number.isNaN(entry.due.getTime()))
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .map((entry) => ({
        ...entry,
        daysUntil: Math.ceil((entry.due.getTime() - now.getTime()) / 86_400_000),
      }))
      .at(0) ?? null
  );
}

export function daysUntil(dateIso: string, now = new Date()) {
  return Math.ceil((new Date(dateIso).getTime() - now.getTime()) / 86_400_000);
}

/** Distance from target, used to pick a tone (never a raw color) in the UI. */
export function toneFor(score: number | null, target: number): "positive" | "neutral" | "attention" {
  if (score === null) return "neutral";
  if (score >= target) return "positive";
  if (score >= target - 4) return "neutral";
  return "attention";
}
