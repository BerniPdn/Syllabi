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
- grade_scale: the letter-grade cutoffs (e.g. A = 93, B+ = 87) ONLY if the syllabus explicitly states them; otherwise return an empty array.
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

export const extractSyllabus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ExtractionResult> => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    const { geminiJson } = await import("@/lib/gemini.server");


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

  // Atomic claim: only succeeds if this row is still "processing". Two tabs
  // racing here will both pass the checks above, but only one UPDATE can
  // win this WHERE clause — Postgres locks the row and re-checks the
  // condition against the committed value, so the loser sees 0 rows back.
  const { data: claimed, error: claimError } = await supabase
    .from("courses")
    .update({ status: "extracting" })
    .eq("id", data.courseId)
    .eq("status", "processing")
    .select("id");
  if (claimError) throw new Error(claimError.message);

  if (!claimed || claimed.length === 0) {
    // Lost the race (or this course isn't in a state that should be
    // (re-)extracted). Report whatever is actually true right now instead
    // of kicking off a second, duplicate extraction.
    const { data: current, error: currentError } = await supabase
      .from("courses")
      .select("status, extracted, extraction_error")
      .eq("id", data.courseId)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);

    if (current?.extracted) {
      return { ok: true, data: current.extracted as ExtractedSyllabus };
    }
    if (current?.status === "failed") {
      return {
        ok: false,
        error: current.extraction_error ?? "We couldn't analyze that syllabus.",
      };
    }
    return {
      ok: false,
      error: "This syllabus is already being analyzed in another tab. Give it a moment and refresh.",
    };
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
      raw = await geminiJson({
        label: "syllabus",
        apiKey,
        schema: EXTRACTION_JSON_SCHEMA,
        parts: [
          { text: PROMPT },
          {
            inline_data: {
              mime_type: "application/pdf",
              data: toBase64(bytes),
            },
          },
        ],
      });

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
      grade_scale: parsed.grade_scale ?? [],
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
          grade_scale: z
            .array(z.object({ letter: z.string(), min: z.number().nullable() }))
            .default([]),
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
