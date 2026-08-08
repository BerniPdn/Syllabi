import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CourseInsight } from "@/lib/insights";

export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ facts: z.record(z.string(), z.unknown()) }).parse(input))
  .handler(async ({ data }): Promise<CourseInsight[]> => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    const { callGeminiInsights, parseInsights } = await import("@/lib/insights.server");

    const raw = await callGeminiInsights(data.facts as never, apiKey);
    return parseInsights(raw);
  });
