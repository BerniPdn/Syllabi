import { computeGrades, daysUntil, letterFor } from "./grade-engine";
import type { Course } from "./types";

/**
 * Four insight categories.
 * Order = display order.
 */
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

const round = (value: number, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const average = (values: number[]) =>
  values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);

export type InsightFacts = ReturnType<typeof buildInsightFacts>;

export function buildInsightFacts(course: Course, now = new Date()) {
  const snapshot = computeGrades(course);

  const totalWeight = snapshot.totalWeight || 100;

  /*
   * CURRENT GRADE
   */

  const currentGrade = snapshot.totalWeight > 0 ? round((snapshot.earnedWeight / snapshot.totalWeight) * 100) : null;

  const currentLetter = currentGrade !== null ? letterFor(currentGrade) : null;

  /*
   * GRADED ASSIGNMENTS
   *
   * Ordered chronologically so we can detect trends.
   */

  const orderKey = (dueDate: string | null) => (dueDate ? new Date(dueDate).getTime() : Number.POSITIVE_INFINITY);

  const gradedOrdered = [...snapshot.graded].sort(
    (a, b) => orderKey(a.assignment.dueDate) - orderKey(b.assignment.dueDate),
  );

  const graded = gradedOrdered.map((item) => ({
    name: item.assignment.name,
    component: item.category.name,
    score: round(item.score),
    weightPercent: round(item.effectiveWeight),
    dueDate: item.assignment.dueDate,
  }));

  /*
   * PERFORMANCE / TRAJECTORY
   */

  const scores = gradedOrdered.map((item) => item.score);

  const midpoint = Math.ceil(scores.length / 2);

  const earlierScores = scores.slice(0, midpoint);
  const recentScores = scores.slice(midpoint);

  const earlierAverage = average(earlierScores);
  const recentAverage = average(recentScores);

  const change = earlierAverage !== null && recentAverage !== null ? round(recentAverage - earlierAverage) : null;

  let direction: "improving" | "declining" | "stable" | "insufficient_data" = "insufficient_data";

  if (change !== null) {
    if (change >= 5) {
      direction = "improving";
    } else if (change <= -5) {
      direction = "declining";
    } else {
      direction = "stable";
    }
  }

  const trajectory = {
    earlierAverage,
    recentAverage,
    change,
    direction,
    hasEnoughData: earlierScores.length >= 1 && recentScores.length >= 1,
  };

  /*
   * UPCOMING ASSIGNMENTS
   */

  const upcoming = snapshot.remaining
    .map((item) => ({
      name: item.assignment.name,
      component: item.category.name,
      weightPercent: round(item.effectiveWeight),
      dueDate: item.assignment.dueDate,

      daysUntilDue: item.assignment.dueDate ? daysUntil(item.assignment.dueDate, now) : null,

      /*
       * Percentage of the remaining grade represented
       * by this assignment.
       */
      shareOfRemaining: round((snapshot.impact[item.assignment.id] ?? 0) * 100),

      /*
       * Maximum number of final-grade percentage points
       * represented by this assignment.
       */
      maxFinalGradeSwing: round((item.effectiveWeight / totalWeight) * 100),
    }))
    .sort((a, b) => {
      if (a.daysUntilDue === null) return 1;
      if (b.daysUntilDue === null) return -1;

      return a.daysUntilDue - b.daysUntilDue;
    });

  /*
   * LEVERAGE
   *
   * Same upcoming assignments, ranked by
   * potential impact on the final grade.
   */

  const leverage = [...upcoming]
    .sort((a, b) => b.maxFinalGradeSwing - a.maxFinalGradeSwing)
    .map((item) => ({
      name: item.name,
      component: item.component,
      weightPercent: item.weightPercent,
      maxFinalGradeSwing: item.maxFinalGradeSwing,
      shareOfRemaining: item.shareOfRemaining,
      dueDate: item.dueDate,
      daysUntilDue: item.daysUntilDue,
    }));

  /*
   * COURSE COMPONENT PERFORMANCE
   *
   * This lets the AI identify things like:
   *
   * "Exams are 60% of the course and your exam
   * average is 68%."
   */

  const componentMap = new Map<
    string,
    {
      name: string;
      totalWeight: number;
      gradedWeight: number;
      scores: number[];
      remainingWeight: number;
    }
  >();

  for (const category of course.gradingCategories ?? []) {
    componentMap.set(category.name, {
      name: category.name,
      totalWeight: category.weight,
      gradedWeight: 0,
      scores: [],
      remainingWeight: category.weight,
    });
  }

  for (const item of snapshot.graded) {
    const name = item.category.name;

    if (!componentMap.has(name)) {
      componentMap.set(name, {
        name,
        totalWeight: item.category.weight,
        gradedWeight: 0,
        scores: [],
        remainingWeight: item.category.weight,
      });
    }

    const component = componentMap.get(name)!;

    component.gradedWeight += item.effectiveWeight;
    component.scores.push(item.score);

    component.remainingWeight = Math.max(0, component.totalWeight - component.gradedWeight);
  }

  const components = Array.from(componentMap.values()).map((component) => {
    const averageScore = average(component.scores);

    return {
      name: component.name,
      weightPercent: round(component.totalWeight),
      gradedWeightPercent: round(component.gradedWeight),
      remainingWeightPercent: round(component.remainingWeight),
      averageScore,

      /*
       * Difference between this component's performance
       * and the student's current overall grade.
       */
      scoreVsCourse: averageScore !== null && currentGrade !== null ? round(averageScore - currentGrade) : null,

      assignmentCount: component.scores.length,
    };
  });

  /*
   * COMPONENTS WITH THE MOST REMAINING WEIGHT
   */

  const highImpactComponents = [...components]
    .filter((component) => component.remainingWeightPercent > 0)
    .sort((a, b) => b.remainingWeightPercent - a.remainingWeightPercent);

  /*
   * GENUINE PERFORMANCE RISKS
   *
   * We only flag a component when:
   * - it is worth at least 20%
   * - the student has graded work in it
   * - performance is below 75%
   * - there is still meaningful weight remaining
   */

  const risks = components
    .filter(
      (component) =>
        component.averageScore !== null &&
        component.remainingWeightPercent > 0 &&
        component.weightPercent >= 20 &&
        component.averageScore < 75,
    )
    .sort((a, b) => {
      const aRisk = a.weightPercent * (100 - (a.averageScore ?? 100));

      const bRisk = b.weightPercent * (100 - (b.averageScore ?? 100));

      return bRisk - aRisk;
    });

  /*
   * HIGH-IMPACT UPCOMING WORK
   */

  const highImpactUpcoming = upcoming.filter((item) => item.maxFinalGradeSwing >= 10 || item.weightPercent >= 10);

  /*
   * IMPORTANT UPCOMING WORK
   *
   * Assignments due within 14 days with meaningful weight.
   */

  const urgentUpcoming = upcoming
    .filter(
      (item) =>
        item.daysUntilDue !== null && item.daysUntilDue >= 0 && item.daysUntilDue <= 14 && item.weightPercent >= 5,
    )
    .sort((a, b) => {
      const aScore = a.weightPercent / Math.max(1, a.daysUntilDue ?? 1);

      const bScore = b.weightPercent / Math.max(1, b.daysUntilDue ?? 1);

      return bScore - aScore;
    });

  /*
   * AI-READY FACTS
   */

  return {
    course: {
      name: course.name,
      code: course.code,
    },

    grade: {
      current: currentGrade,
      letter: currentLetter,

      totalGradedWeight: round(snapshot.totalWeight),

      remainingWeight: round(Math.max(0, 100 - snapshot.totalWeight)),
    },

    performance: {
      overallAverage: currentGrade,
      earlierAverage,
      recentAverage,
      change,
      direction,
      gradedAssignmentCount: graded.length,
    },

    trajectory,

    graded,

    components,

    highImpactComponents,

    upcoming,

    leverage,

    risks,

    highImpactUpcoming,

    urgentUpcoming,
  };
}
