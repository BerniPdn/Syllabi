import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CourseInsight } from "@/lib/insights";

export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ courseId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<CourseInsight[]> => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    const { INSIGHTS_JSON_SCHEMA, INSIGHTS_SYSTEM_PROMPT, parseInsights } = await import(
      "@/lib/insights.server"
    );
    const { geminiJson } = await import("@/lib/gemini.server");
    const { buildFactsFromDatabase } = await import("@/lib/insights-facts.server");

    // Facts are recomputed from the database (never taken from the client) so
    // insight text can't contradict the workspace's own numbers.
    const facts = await buildFactsFromDatabase(context.supabase, data.courseId);
    if (!facts) return [];

    const raw = await geminiJson({
      label: "insights",
      apiKey,
      systemInstruction: INSIGHTS_SYSTEM_PROMPT,
      schema: INSIGHTS_JSON_SCHEMA,
      parts: [{ text: `Course facts (source of truth):\n${JSON.stringify(facts)}` }],
    });
    return parseInsights(raw);
  });
