import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  EXTRACTION_JSON_SCHEMA,
  NOT_A_SYLLABUS_MESSAGE,
  type ExtractedSyllabus,
  type ExtractionResult,
} from "@/lib/syllabus-extraction";

const PROMPT = `You are extracting structured data from a university course syllabus PDF.

Rules:
- Extract ONLY information explicitly present in the document. Never guess, infer, or invent.
- Use null (or an empty array) for anything the document does not state.
- Dates must be ISO (YYYY-MM-DD). If a date has no year, use the year implied by the semester; if that is unclear, return null.
- grading_components: the graded categories with their percentage weight of the final grade (weight null if not stated).
- assignments: individual assignments, exams, quizzes, projects with their due date and the grading component they belong to (use the exact component name).
- important_dates: other dated milestones (exam periods, breaks, drop deadlines) that are not assignments.
- policies: short verbatim-ish statements of course policies (late work, attendance, academic honesty, curves, extra credit, etc.).
- Set is_syllabus to false when the document is not a course syllabus (e.g. a resume, an invoice, a random article, a homework handout). In that case give a one-sentence reason and leave every other field null/empty.`;

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function streamJson(body: unknown, apiKey: string): Promise<string> {
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
      throw new Error("AI credits are exhausted. Add credits to keep analyzing syllabi.");
    }
    console.error("[syllabus] gateway error", response.status, detail);
    throw new Error("We couldn't analyze that syllabus. Please try again.");
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

export const extractSyllabus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ExtractionResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const supabase = context.supabase;

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, title, file_path, extracted")
      .eq("id", data.courseId)
      .maybeSingle();
    if (courseError) throw new Error(courseError.message);
    if (!course?.file_path) return { ok: false, error: "We couldn't find that syllabus file." };

    if (course.extracted) {
      return { ok: true, data: course.extracted as ExtractedSyllabus };
    }

    const download = await supabase.storage.from("syllabi").download(course.file_path);
    if (download.error || !download.data) {
      return { ok: false, error: "We couldn't open that syllabus file. Try uploading it again." };
    }

    const bytes = new Uint8Array(await download.data.arrayBuffer());
    if (bytes.length === 0) {
      return { ok: false, error: "That PDF appears to be empty. Please upload another file." };
    }

    let raw: string;
    try {
      raw = await streamJson(
        {
          model: "openai/gpt-5.6-sol",
          stream: true,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: PROMPT },
                {
                  type: "input_file",
                  filename: `${course.title ?? "syllabus"}.pdf`,
                  file_data: `data:application/pdf;base64,${toBase64(bytes)}`,
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "syllabus_extraction",
              strict: true,
              schema: EXTRACTION_JSON_SCHEMA,
            },
          },
        },
        apiKey,
      );
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "We couldn't analyze that syllabus.";
      await supabase
        .from("courses")
        .update({ status: "failed", extraction_error: message })
        .eq("id", data.courseId);
      return { ok: false, error: message };
    }

    let parsed:
      | ({ is_syllabus?: boolean; reason?: string | null } & ExtractedSyllabus)
      | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    if (!parsed) {
      const message = "We couldn't read that syllabus. Please try uploading it again.";
      await supabase
        .from("courses")
        .update({ status: "failed", extraction_error: message })
        .eq("id", data.courseId);
      return { ok: false, error: message };
    }

    if (parsed.is_syllabus === false) {
      const message = parsed.reason
        ? `${NOT_A_SYLLABUS_MESSAGE} (${parsed.reason})`
        : NOT_A_SYLLABUS_MESSAGE;
      await supabase
        .from("courses")
        .update({ status: "failed", extraction_error: message })
        .eq("id", data.courseId);
      return { ok: false, error: message };
    }

    const extracted: ExtractedSyllabus = {
      course_name: parsed.course_name ?? null,
      course_code: parsed.course_code ?? null,
      professor: parsed.professor ?? null,
      semester: parsed.semester ?? null,
      description: parsed.description ?? null,
      grading_components: parsed.grading_components ?? [],
      assignments: parsed.assignments ?? [],
      important_dates: parsed.important_dates ?? [],
      policies: parsed.policies ?? [],
    };

    const { error: updateError } = await supabase
      .from("courses")
      .update({
        status: "review",
        extraction_error: null,
        extracted,
        ...(extracted.course_name ? { title: extracted.course_name } : {}),
      })
      .eq("id", data.courseId);
    if (updateError) throw new Error(updateError.message);

    return { ok: true, data: extracted };
  });

export const saveExtractedCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        courseId: z.string().uuid(),
        extracted: z.object({
          course_name: z.string().nullable(),
          course_code: z.string().nullable(),
          professor: z.string().nullable(),
          semester: z.string().nullable(),
          description: z.string().nullable(),
          grading_components: z.array(
            z.object({ name: z.string(), weight: z.number().nullable() }),
          ),
          assignments: z.array(
            z.object({
              name: z.string(),
              component: z.string().nullable(),
              due_date: z.string().nullable(),
              weight: z.number().nullable(),
            }),
          ),
          important_dates: z.array(
            z.object({ label: z.string(), date: z.string().nullable() }),
          ),
          policies: z.array(z.string()),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("courses")
      .update({
        extracted: data.extracted,
        status: "ready",
        extraction_error: null,
        title: data.extracted.course_name?.trim() || "Untitled course",
      })
      .eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("courses")
      .delete()
      .eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
