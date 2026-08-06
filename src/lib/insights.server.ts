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

const SYSTEM_PROMPT = `You are CoursePilot's insight writer for a single university course.

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


export function buildInsightsRequest(facts: InsightFacts) {
  return {
    model: "openai/gpt-5.6-sol",
    stream: true,
    input: [
      { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Course facts (source of truth):\n${JSON.stringify(facts)}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "course_insights",
        strict: true,
        schema: {
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
                    enum: [
                      "overview",
                      "policies",
                      "priorities",
                      "performance",
                      "recommendation",
                    ],
                  },
                  title: { type: "string" },
                  body: { type: "string" },
                  tone: { type: "string", enum: ["positive", "neutral", "attention"] },
                },
              },
            },
          },
        },
      },
    },
  };
}

/** Streams the gateway response and returns the accumulated JSON text. */
export async function streamGatewayJson(body: unknown, apiKey: string): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new Error("Our AI is busy right now. Please try again in a moment.");
    }
    if (response.status === 402) {
      throw new Error("AI credits are exhausted. Add credits to keep generating insights.");
    }
    console.error("[insights] gateway error", response.status, detail);
    throw new Error("We couldn't generate insights right now. Please try again.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          text += event.delta;
        } else if (event.type === "response.completed" && event.response?.output_text) {
          if (!text) text = event.response.output_text;
        }
      } catch {
        // ignore keep-alive / non-JSON frames
      }
    }
  }

  return text;
}

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
