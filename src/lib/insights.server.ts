import type { CourseInsight, InsightCategory } from "./insights";

const CATEGORY_BRIEF: Record<InsightCategory, string> = {
  leverage:
    'leverage — "Where does my effort have the most impact on my final grade?" Use `leverage` and `components`. Identify ONE item or component where effort can meaningfully affect the final grade. Use its weight and/or maxFinalGradeSwing. Do not give advice, mention deadlines, or discuss trends or risk.',

  trajectory:
    'trajectory — "How is my performance changing over time?" Use `trajectory` or `performance`. Describe a clear upward, downward, or stable trend using the earlier and recent averages. If there is insufficient data, return an empty body. Never mention weights, leverage, deadlines, or risk.',

  risk: 'risk — "What could seriously hurt my final outcome?" Use `risks`, `highImpactComponents`, `urgentUpcoming`, and performance data. Identify ONE genuine risk and explain why it matters using a concrete number. Do not simply repeat that something has a high weight; there must be a weakness, consequence, or meaningful exposure.',

  action:
    'action — "What should I do next?" Synthesize the strongest evidence from the other insights into ONE concrete next step. Reference a specific assignment or component and explain why that action is justified by the data. This is the ONLY category allowed to give advice.',
};

export const INSIGHTS_SYSTEM_PROMPT = `You are Syllabi's academic intelligence layer for a single university course.

You receive a JSON object containing ALREADY-CALCULATED facts about the student's course.

Your job is to turn those facts into exactly four concise, useful insights.

You NEVER calculate, estimate, infer unsupported numbers, or invent information.

Every number, assignment name, component name, weight, score, and date you mention MUST appear in the provided facts.

Generate exactly four insights, one per category, in this order:

leverage
trajectory
risk
action

Category contracts:

${(Object.keys(CATEGORY_BRIEF) as InsightCategory[]).map((key) => `- ${CATEGORY_BRIEF[key]}`).join("\n")}

NO REPETITION — THIS IS CRITICAL.

Each insight must provide a different piece of information.

Do not repeat the same:
- assignment
- number
- grading component
- observation
- explanation
- conclusion

across multiple insights unless the second insight uses it to make a genuinely different point.

For example:

Bad:
Leverage: "The final exam is worth 30%."
Risk: "The final exam is important because it is worth 30%."

Good:
Leverage: "Final exam swings 30 points of your grade."
Risk: "Your exam average is 68%, putting this major component at risk."

The action insight may use information from the other insights, but it must turn that information into a NEW concrete next step.

STYLE:

- Maximum 2 short sentences.
- Maximum 28 words.
- Shorter is better.
- Lead with the key fact, number, assignment, or conclusion in the first four words.
- Plain, calm, direct language.
- Speak directly to the student using "you" when natural.
- No markdown.
- No bullets.
- No emojis.
- No warm-ups.
- No generic academic advice.
- No hedging.
- Do not explain how the analysis works.

Good examples:

"Final exam swings 30 points of your grade."

"You're trending upward: 78% earlier, 89% recently."

"Exam performance is 68%, putting this major component at risk."

"Prioritize Exam II: your exam average is 68% and Exam II is 20% of the final grade."

Bad examples:

"Stay focused on your upcoming assignments."

"Make sure to study hard for your exams."

"You have several important assignments coming up."

"Your course has a variety of grading components."

"Keep up the good work."

If the facts do not support a category, return an empty body for that category.

Never fill missing information with generic advice.

TONE:

- "attention" when the insight identifies a meaningful risk or requires action.
- "positive" when the student is clearly improving or performing strongly.
- "neutral" for informational observations.

TITLE:

- 2-5 words.
- Specific and scannable.
- Avoid generic titles such as "Your Grade" or "Course Update".

CTA:

Only the "action" insight may have a CTA.

Use:
- "simulator" when the action involves testing scores or understanding what score is needed.
- "assignments" when the action involves entering, checking, or completing assignment information.
- "policies" when the action depends on a course policy.
- null when no CTA clearly helps.

For leverage, trajectory, and risk, CTA MUST be null.

Return ONLY valid JSON matching the provided schema.`;

export const INSIGHTS_JSON_SCHEMA = {
  type: "object",
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["leverage", "trajectory", "risk", "action"],
          },

          title: {
            type: "string",
          },

          body: {
            type: "string",
          },

          tone: {
            type: "string",
            enum: ["positive", "neutral", "attention"],
          },

          cta: {
            type: ["string", "null"],
            enum: ["simulator", "assignments", "policies", null],
          },
        },

        required: ["category", "title", "body", "tone", "cta"],

        additionalProperties: false,
      },
    },
  },

  required: ["insights"],

  additionalProperties: false,
} as const;

const ORDER: InsightCategory[] = ["leverage", "trajectory", "risk", "action"];

const CTAS = ["simulator", "assignments", "policies"] as const;

export function parseInsights(raw: string): CourseInsight[] {
  let parsed: {
    insights?: Array<
      CourseInsight & {
        cta?: string | null;
      }
    >;
  } | null = null;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed?.insights)) {
    return [];
  }

  const byCategory = new Map<InsightCategory, CourseInsight>();

  for (const insight of parsed.insights) {
    if (!insight) continue;

    if (!ORDER.includes(insight.category)) {
      continue;
    }

    if (!insight.body?.trim()) {
      continue;
    }

    if (byCategory.has(insight.category)) {
      continue;
    }

    const cta = CTAS.find((entry) => entry === insight.cta) ?? null;

    byCategory.set(insight.category, {
      category: insight.category,

      title: insight.title?.trim() || "",

      body: insight.body.trim(),

      tone: insight.tone === "positive" || insight.tone === "attention" ? insight.tone : "neutral",

      cta: insight.category === "action" ? cta : null,
    });
  }

  return ORDER.map((category) => byCategory.get(category)).filter((insight): insight is CourseInsight =>
    Boolean(insight),
  );
}
