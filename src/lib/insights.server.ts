import type { CourseInsight, InsightCategory, InsightFacts } from "./insights";

const CATEGORY_BRIEF: Record<InsightCategory, string> = {
  overview:
    "Course overview — answer \"How is this course structured?\". Describe the shape of the grade using the grading components and their weights. No recommendations, no upcoming work, no performance talk.",
  policies:
    "Important policies — answer \"What rules from the syllabus should I remember?\". Pick only the 1-3 most impactful policies from `policies` and say why they matter. Never restate the course structure.",
  priorities:
    "Upcoming priorities — answer \"What should I pay attention to next?\". Name the most important upcoming item(s) from `upcoming` with their weight and date. Only upcoming work.",
  performance:
    "Performance analysis — answer \"How am I currently performing?\". Describe patterns across `componentPerformance` and `graded`: strongest/weakest component, consistency or variance. Never mention the current grade number, the grade needed for a target, or assignment weights.",
  recommendation:
    "Personalized recommendation — answer \"What action should I take?\". Exactly one concrete, prioritized action grounded in the structure, the performance, and what remains. This is the ONLY category allowed to recommend.",
};

const SYSTEM_PROMPT = `You are CoursePilot's insight writer for a single university course.

You receive a JSON object of ALREADY-CALCULATED facts. You never calculate, estimate or invent anything: every number, name, weight and date you mention must appear verbatim in the facts.

Write exactly five insights, one per category, in this order: overview, policies, priorities, performance, recommendation.

Category contracts:
${(Object.keys(CATEGORY_BRIEF) as InsightCategory[]).map((key) => `- ${CATEGORY_BRIEF[key]}`).join("\n")}

Hard rules:
- The five insights must be clearly differentiated. Never restate the same idea in two categories, even with different wording.
- 1-2 sentences per insight, max ~45 words. Plain, calm, second person ("you", "your"). No markdown headings, no bullet lists, no emoji.
- If the facts do not support a category (e.g. no policies, no graded work, nothing upcoming), set that insight's "body" to an empty string. Never fill the gap with generic advice.
- tone: "positive" when things are on track, "attention" when something needs action or risk, otherwise "neutral".
- title: 2-4 words, specific to the content of that insight.`;

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
