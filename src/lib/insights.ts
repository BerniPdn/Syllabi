import { computeGrades, daysUntil, letterFor } from "./grade-engine";
import type { Course } from "./types";

/** The five insight categories. Order = display order. */
export const INSIGHT_CATEGORIES = ["overview", "policies", "priorities", "performance", "recommendation"] as const;

export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

export type CourseInsight = {
  category: InsightCategory;
  title: string;
  body: string;
  tone: "positive" | "neutral" | "attention";
};

export const CATEGORY_LABELS: Record<InsightCategory, string> = {
  overview: "Course overview",
  policies: "Important policies",
  priorities: "Upcoming priorities",
  performance: "Performance analysis",
  recommendation: "Personalized recommendation",
};

/**
 * Deterministic facts for the AI to interpret. Every number here comes from the
 * existing grade engine — the model never calculates anything.
 */
export type InsightFacts = ReturnType<typeof buildInsightFacts>;

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function buildInsightFacts(course: Course, now = new Date()) {
  const snapshot = computeGrades(course);

  const components = course.categories.map((category) => ({
    name: category.name,
    weightPercent: category.weight,
  }));

  const graded = snapshot.graded.map((item) => ({
    name: item.assignment.name,
    component: item.category.name,
    score: item.score,
    weightPercent: round(item.effectiveWeight),
  }));

  const upcoming = snapshot.remaining
    .map((item) => ({
      name: item.assignment.name,
      component: item.category.name,
      weightPercent: round(item.effectiveWeight),
      dueDate: item.assignment.dueDate,
      daysUntilDue: item.assignment.dueDate ? daysUntil(item.assignment.dueDate, now) : null,
      shareOfRemaining: round((snapshot.impact[item.assignment.id] ?? 0) * 100),
    }))
    .sort((a, b) => {
      if (a.daysUntilDue === null) return 1;
      if (b.daysUntilDue === null) return -1;
      return a.daysUntilDue - b.daysUntilDue;
    });

  const componentPerformance = course.categories
    .map((category) => {
      const scores = snapshot.graded.filter((item) => item.category.id === category.id).map((item) => item.score!);
      if (scores.length === 0) return null;
      const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      return {
        component: category.name,
        gradedCount: scores.length,
        averageScore: round(average),
        lowestScore: Math.min(...scores),
        highestScore: Math.max(...scores),
        spread: round(Math.max(...scores) - Math.min(...scores)),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return {
    course: {
      name: course.name,
      code: course.code,
      semester: course.semester,
      targetGrade: course.targetGrade,
      targetLetter: letterFor(course.targetGrade, course.scale),
    },
    components,
    grading: {
      currentGrade: snapshot.currentGrade,
      currentLetter: snapshot.currentGrade === null ? null : letterFor(snapshot.currentGrade, course.scale),
      projectedGrade: snapshot.projectedGrade,
      neededAverageOnRemaining: snapshot.neededOnRemaining,
      gradedWeightPercent: snapshot.gradedWeight,
      remainingWeightPercent: snapshot.remainingWeight,
      completionPercent: round(snapshot.completion * 100),
    },
    graded,
    upcoming,
    componentPerformance,
    policies: course.policies,
  };
}

/** Not enough data to say anything useful. */
export function hasInsightData(facts: InsightFacts) {
  return (
    facts.components.length > 0 || facts.graded.length > 0 || facts.upcoming.length > 0 || facts.policies.length > 0
  );
}

/**
 * Stable cache key for insights: only the course data that should trigger a
 * regeneration (components, scale/target, assignments, grades, policies).
 * Deliberately excludes time-derived values like `daysUntilDue` so simply
 * opening the page on a later day does not re-generate.
 */
export function insightsSignature(facts: InsightFacts) {
  return JSON.stringify({
    target: [facts.course.targetGrade, facts.course.targetLetter],
    components: facts.components,
    graded: facts.graded.map((item) => [item.name, item.component, item.score, item.weightPercent]),
    upcoming: facts.upcoming.map((item) => [item.name, item.component, item.weightPercent, item.dueDate]).sort(),
    policies: facts.policies,
  });
}
