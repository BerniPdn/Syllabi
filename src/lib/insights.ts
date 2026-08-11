import { computeGrades, daysUntil, letterFor } from "./grade-engine";
import type { Course } from "./types";

/** The four insight categories. Order = display order. */
export const INSIGHT_CATEGORIES = ["leverage", "trajectory", "risk", "action"] as const;

export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

export const INSIGHT_CTAS = ["simulator", "assignments", "policies"] as const;
export type InsightCta = (typeof INSIGHT_CTAS)[number];

export type CourseInsight = {
  category: InsightCategory;
  title: string;
  body: string;
  tone: "positive" | "neutral" | "attention";
  cta?: InsightCta | null;
};

export const CATEGORY_LABELS: Record<InsightCategory, string> = {
  leverage: "What actually matters",
  trajectory: "Grade trajectory",
  risk: "Risk detection",
  action: "Recommended action",
};

export const CATEGORY_QUESTIONS: Record<InsightCategory, string> = {
  leverage: "Where does my effort have the most impact?",
  trajectory: "How is my performance changing over time?",
  risk: "What could seriously hurt my final outcome?",
  action: "What should I do next?",
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

const average = (values: number[]) =>
  values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);

export function buildInsightFacts(course: Course, now = new Date()) {
  const snapshot = computeGrades(course);

  const components = course.categories.map((category) => ({
    name: category.name,
    weightPercent: category.weight,
  }));

  const orderKey = (dueDate: string | null) =>
    dueDate ? new Date(dueDate).getTime() : Number.POSITIVE_INFINITY;

  const gradedOrdered = [...snapshot.graded].sort(
    (a, b) => orderKey(a.assignment.dueDate) - orderKey(b.assignment.dueDate),
  );

  const graded = gradedOrdered.map((item) => ({
    name: item.assignment.name,
    component: item.category.name,
    score: item.score,
    weightPercent: round(item.effectiveWeight),
    dueDate: item.assignment.dueDate,
  }));

  const totalWeight = snapshot.totalWeight || 100;

  const upcoming = snapshot.remaining
    .map((item) => ({
      name: item.assignment.name,
      component: item.category.name,
      weightPercent: round(item.effectiveWeight),
      dueDate: item.assignment.dueDate,
      daysUntilDue: item.assignment.dueDate ? daysUntil(item.assignment.dueDate, now) : null,
      shareOfRemaining: round((snapshot.impact[item.assignment.id] ?? 0) * 100),
      /** Final-grade points between scoring 0 and 100 on this item. */
      maxFinalGradeSwing: round((item.effectiveWeight / totalWeight) * 100),
    }))
    .sort((a, b) => {
      if (a.daysUntilDue === null) return 1;
      if (b.daysUntilDue === null) return -1;
      return a.daysUntilDue - b.daysUntilDue;
    });

  /** Same list, ranked by grade leverage instead of date. */
  const leverage = [...upcoming]
    .sort((a, b) => b.maxFinalGradeSwing - a.maxFinalGradeSwing)
    .map((item) => ({
      name: item.name,
      component: item.component,
      weightPercent: item.weightPercent,
      maxFinalGradeSwing: item.maxFinalGradeSwing,
      shareOfRemaining: item.shareOfRemaining,
    }));

  const componentPerformance = course.categories
    .map((category) => {
      const scores = gradedOrdered
        .filter((item) => item.category.id === category.id)
        .map((item) => item.score!);
      const remainingWeight = snapshot.remaining
        .filter((item) => item.category.id === category.id)
        .reduce((sum, item) => sum + item.effectiveWeight, 0);
      if (scores.length === 0) {
        return {
          component: category.name,
          componentWeightPercent: category.weight,
          gradedCount: 0,
          averageScore: null,
          lowestScore: null,
          highestScore: null,
          spread: null,
          firstScore: null,
          lastScore: null,
          remainingWeightPercent: round(remainingWeight),
        };
      }
      return {
        component: category.name,
        componentWeightPercent: category.weight,
        gradedCount: scores.length,
        averageScore: average(scores),
        lowestScore: Math.min(...scores),
        highestScore: Math.max(...scores),
        spread: round(Math.max(...scores) - Math.min(...scores)),
        firstScore: scores[0]!,
        lastScore: scores.at(-1)!,
        remainingWeightPercent: round(remainingWeight),
      };
    })
    .filter((entry) => entry.gradedCount > 0 || entry.remainingWeightPercent > 0);

  // ----- Trajectory (deterministic) -----
  const scoresInOrder = gradedOrdered.map((item) => item.score!);
  const windowSize = Math.min(3, Math.floor(scoresInOrder.length / 2));
  const earlier = windowSize > 0 ? scoresInOrder.slice(0, windowSize) : [];
  const recent = windowSize > 0 ? scoresInOrder.slice(-windowSize) : [];
  const earlierAverage = average(earlier);
  const recentAverage = average(recent);
  const delta =
    earlierAverage !== null && recentAverage !== null ? round(recentAverage - earlierAverage) : null;

  const trajectory = {
    gradedCount: scoresInOrder.length,
    /** Below 4 graded items there is not enough signal to claim a trend. */
    hasEnoughData: scoresInOrder.length >= 4 && delta !== null,
    windowSize,
    earlierAverage,
    recentAverage,
    delta,
    direction:
      delta === null ? null : delta >= 3 ? "improving" : delta <= -3 ? "declining" : "stable",
    scoresInOrder,
    componentTrends: componentPerformance
      .filter((entry) => entry.gradedCount >= 2)
      .map((entry) => ({
        component: entry.component,
        gradedCount: entry.gradedCount,
        firstScore: entry.firstScore,
        lastScore: entry.lastScore,
        change: round((entry.lastScore ?? 0) - (entry.firstScore ?? 0)),
      })),
  };

  // ----- Risk (deterministic) -----
  const topTwo = leverage.slice(0, 2);
  const topTwoShareOfRemaining = round(
    topTwo.reduce((sum, item) => sum + item.shareOfRemaining, 0),
  );
  const needed = snapshot.neededOnRemaining;

  const weakHighWeightComponents = componentPerformance
    .filter(
      (entry) =>
        entry.averageScore !== null &&
        entry.componentWeightPercent >= 20 &&
        entry.averageScore < course.targetGrade,
    )
    .map((entry) => ({
      component: entry.component,
      componentWeightPercent: entry.componentWeightPercent,
      averageScore: entry.averageScore,
      remainingWeightPercent: entry.remainingWeightPercent,
    }))
    .sort((a, b) => b.componentWeightPercent - a.componentWeightPercent);

  const risk = {
    remainingWeightPercent: snapshot.remainingWeight,
    concentration: {
      topItems: topTwo.map((item) => item.name),
      shareOfRemaining: topTwoShareOfRemaining,
      shareOfFinalGrade: round(topTwo.reduce((sum, item) => sum + item.maxFinalGradeSwing, 0)),
    },
    neededAverageOnRemaining: needed,
    targetFeasibility:
      needed === null
        ? "no_remaining_work"
        : needed <= 0
          ? "already_met"
          : needed > 100
            ? "impossible"
            : needed >= 93
              ? "very_hard"
              : needed >= 80
                ? "demanding"
                : "comfortable",
    weakHighWeightComponents,
    gapToTarget:
      snapshot.currentGrade === null ? null : round(snapshot.currentGrade - course.targetGrade),
  };

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
      currentLetter:
        snapshot.currentGrade === null ? null : letterFor(snapshot.currentGrade, course.scale),
        projectedGrade: snapshot.currentGrade === null ? null : snapshot.projectedGrade, neededAverageOnRemaining: snapshot.neededOnRemaining,
      gradedWeightPercent: snapshot.gradedWeight,
      remainingWeightPercent: snapshot.remainingWeight,
      completionPercent: round(snapshot.completion * 100),
    },
    graded,
    upcoming,
    leverage,
    componentPerformance,
    trajectory,
    risk,
    policies: course.policies,
  };
}

/** Not enough data to say anything useful. */
export function hasInsightData(facts: InsightFacts) {
  return (
    facts.components.length > 0 ||
    facts.graded.length > 0 ||
    facts.upcoming.length > 0 ||
    facts.policies.length > 0
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
    // Bumped when the insight contract changes so stale cached rows are ignored.
    version: "v3-plain",
    target: [facts.course.targetGrade, facts.course.targetLetter],
    components: facts.components,
    graded: facts.graded.map((item) => [item.name, item.component, item.score, item.weightPercent]),
    upcoming: facts.upcoming
      .map((item) => [item.name, item.component, item.weightPercent, item.dueDate])
      .sort(),
    policies: facts.policies,
  });
}
