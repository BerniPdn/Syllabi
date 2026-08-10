import type { CourseInsight, InsightCategory } from "./insights";

const CATEGORY_BRIEF: Record<InsightCategory, string> = {
  leverage:
    'leverage — "Where does my effort have the most impact on my final grade?" Use `leverage` (ranked by maxFinalGradeSwing) plus `componentPerformance`. Name ONE item or component and its grade leverage: weight and/or how many final-grade points it can swing. You may also call out an item with surprisingly LOW leverage when that is the more useful truth. Never give advice, never mention deadlines, never describe trends or risk.',
  trajectory:
    'trajectory — "How is my performance changing over time?" Use `trajectory` only. Describe the direction with the two averages (earlierAverage vs recentAverage) or a component trend. If `trajectory.hasEnoughData` is false, return an empty body — never invent a trend. Never advise, never mention weights or leverage or risk.',
  risk: 'risk — "What could seriously hurt my final outcome?" Use `risk` (concentration, neededAverageOnRemaining, targetFeasibility, weakHighWeightComponents, gapToTarget) or a genuinely risky item from `policies`. Explain WHY it could hurt the outcome, with the number. Must be a different observation than the leverage insight — restating that one assessment is big is NOT a risk. If nothing is genuinely at risk, return an empty body.',
  action:
    'action — "What should I do next?" The synthesis layer, and the ONLY category allowed to advise. Exactly one concrete, evidence-based next step that follows from the other three insights, referencing the specific component or assessment. No generic advice ("study harder", "stay organized", "keep it up") unless the data gives a concrete reason.',
};

export const INSIGHTS_SYSTEM_PROMPT = `You are Syllabi's academic intelligence layer for a single university course.

You receive a JSON object of ALREADY-CALCULATED facts. You never calculate, estimate or invent anything: every number, name, weight and date you mention must appear verbatim in the facts.

Write exactly four insights, one per category, in this order: leverage, trajectory, risk, action.

Category contracts:
${(Object.keys(CATEGORY_BRIEF) as InsightCategory[]).map((key) => `- ${CATEGORY_BRIEF[key]}`).join("\n")}

NO REPETITION — this is the hardest rule. Each insight must answer a fundamentally different question. Never reuse the same observation, number or framing in two insights. If the final exam is the leverage insight, risk may only mention it for a genuinely different reason (e.g. the score now needed to reach the target).

Style — a student must get the point in under 5 seconds:
- MAXIMUM 2 short sentences and 28 words per insight. Shorter is better.
- Lead with the key fact or number in the first four words. No warm-ups.
- Plain, calm, second person. No markdown, no bullets, no emoji, no hedging.
- Examples of the register wanted: "Your final exam decides the most (35% of your grade, up to 35 points of swing)." / "You're trending upward: 78% on your first three scores, 89% on your last three." / "55% of your remaining grade sits in two exams." / "Prioritize the final exam: exams are 50% of your grade and your exam average is 72%."

Other rules:
- If the facts do not support a category, set that insight's "body" to an empty string. Never fill the gap with generic filler.
- tone: "attention" only when something needs action or is at risk, "positive" when clearly on track, otherwise "neutral".
- title: 2-5 words, specific, scannable.
- cta: only on the action insight, and only when it clearly helps — "simulator" (test scores needed), "assignments" (enter or check scores), "policies" (a policy is the risk). Otherwise null.`;

export const INSIGHTS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["insights"],
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "title", "body", "tone"],
        properties: {
          category: {
            type: "string",
            enum: ["leverage", "trajectory", "risk", "action"],
          },
          title: { type: "string" },
          body: { type: "string" },
          tone: { type: "string", enum: ["positive", "neutral", "attention"] },
          cta: { type: "string", enum: ["simulator", "assignments", "policies", "none"] },
        },
      },
    },
  },
} as const;

const ORDER: InsightCategory[] = ["leverage", "trajectory", "risk", "action"];
const CTAS = ["simulator", "assignments", "policies"] as const;

export function parseInsights(raw: string): CourseInsight[] {
  let parsed: { insights?: (CourseInsight & { cta?: string })[] } | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const list = parsed?.insights ?? [];

  const byCategory = new Map<InsightCategory, CourseInsight>();
  for (const insight of list) {
    if (!ORDER.includes(insight.category)) continue;
    if (!insight.body?.trim()) continue;
    if (byCategory.has(insight.category)) continue;
    const cta = CTAS.find((entry) => entry === insight.cta) ?? null;
    byCategory.set(insight.category, {
      category: insight.category,
      title: insight.title?.trim() || "",
      body: insight.body.trim(),
      tone: insight.tone ?? "neutral",
      cta: insight.category === "action" ? cta : null,
    });
  }

  return ORDER.map((category) => byCategory.get(category)).filter((insight): insight is CourseInsight =>
    Boolean(insight),
  );
}
