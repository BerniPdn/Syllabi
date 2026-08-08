import type { CourseInsight, InsightCategory, InsightFacts } from "./insights";

const CATEGORY_BRIEF: Record<InsightCategory, string> = {
  overview:
    "overview — \"How is my grade built?\" Name the component that dominates the grade with its weight. Structure only: no advice, no upcoming work, no performance talk.",
  policies:
    "policies — \"Which rule can hurt me?\" ONE policy from `policies` that carries real consequence, stated as its practical effect. Never restate course structure.",
  priorities:
    "priorities — \"What's next?\" Lead with the single nearest item from `upcoming`: name, weight, date. Nothing else.",
  performance:
    "performance — \"What's my pattern?\" One pattern across `componentPerformance`/`graded`: strongest or weakest component, consistency or swing. Never mention the current grade number, target grade, or weights.",
  recommendation:
    "recommendation — \"What do I do?\" Exactly one concrete next action. This is the ONLY category allowed to advise.",
};

export const INSIGHTS_SYSTEM_PROMPT = `You are Syllabi's insight writer for a single university course.

You receive a JSON object of ALREADY-CALCULATED facts. You never calculate, estimate or invent anything: every number, name, weight and date you mention must appear verbatim in the facts.

Write exactly five insights, one per category, in this order: overview, policies, priorities, performance, recommendation.

Category contracts:
${(Object.keys(CATEGORY_BRIEF) as InsightCategory[]).map((key) => `- ${CATEGORY_BRIEF[key]}`).join("\n")}

Style — a student must get the point in under 5 seconds:
- MAXIMUM 2 short sentences and 25 words per insight. Shorter is better.
- Lead with the key fact or number in the first four words. No warm-ups ("Your course is structured around…").
- Plain, calm, second person. No markdown, no bullets, no emoji, no hedging.
- Never repeat a fact, number or idea across two insights.
- Example of the register wanted: "Exams drive most of your grade (60%). Focus here for the biggest impact." / "Next up: Exam I (20%) on Oct 1."

Other rules:
- If the facts do not support a category (no policies, no graded work, nothing upcoming), set that insight's "body" to an empty string. Never fill the gap with generic advice.
- tone: "attention" only when something needs action or is at risk, "positive" when clearly on track, otherwise "neutral".
- title: 2-4 words, specific, scannable.`;

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
            enum: ["overview", "policies", "priorities", "performance", "recommendation"],
          },
          title: { type: "string" },
          body: { type: "string" },
          tone: { type: "string", enum: ["positive", "neutral", "attention"] },
        },
      },
    },
  },
} as const;


const ORDER: InsightCategory[] = [
  "overview",
  "policies",
  "priorities",
  "performance",
  "recommendation",
];

export function parseInsights(raw: string): CourseInsight[] {
  let parsed: { insights?: CourseInsight[] } | null = null;
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
    byCategory.set(insight.category, {
      category: insight.category,
      title: insight.title?.trim() || "",
      body: insight.body.trim(),
      tone: insight.tone ?? "neutral",
    });
  }

  return ORDER.map((category) => byCategory.get(category)).filter(
    (insight): insight is CourseInsight => Boolean(insight),
  );
}
