import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CourseInsight } from "@/lib/insights";

export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ facts: z.record(z.string(), z.unknown()) }).parse(input),
  )
  .handler(async ({ data }): Promise<CourseInsight[]> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { buildInsightsRequest, parseInsights, streamGatewayJson } = await import(
      "@/lib/insights.server"
    );

    const raw = await streamGatewayJson(
      buildInsightsRequest(data.facts as never),
      apiKey,
    );
    return parseInsights(raw);
  });
