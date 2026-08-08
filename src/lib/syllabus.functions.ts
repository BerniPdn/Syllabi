import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { NOT_A_SYLLABUS_MESSAGE, type ExtractedSyllabus, type ExtractionResult } from "@/lib/syllabus-extraction";

const PROMPT = `You are extracting structured data from a university course syllabus PDF.

Rules:
- Extract ONLY information explicitly present in the document. Never guess, infer, or invent.
- Use null (or an empty array) for anything the document does not state.
- Dates must be ISO (YYYY-MM-DD). If a date has no year, use the year implied by the semester; if that is unclear, return null.
- grading_components: array of { "name": string, "weight": number | null } representing percentage weight of final grade.
- assignments: array of { "name": string, "component": string | null, "due_date": string | null, "weight": number | null }.
- important_dates: array of { "label": string, "date": string | null }.
- grade_scale: array of { "letter": string, "min": number | null } ONLY if explicitly stated; otherwise [].
- policies: array of short verbatim statements of course policies.
- Set is_syllabus to false if not a course syllabus, providing a reason string in "reason".

Return strictly a valid JSON object matching this structure:
{
  "is_syllabus": boolean,
  "reason": string | null,
  "course_name": string | null,
  "course_code": string | null,
  "professor": string | null,
  "semester": string | null,
  "description": string | null,
  "grading_components": [{"name": string, "weight": number | null}],
  "grade_scale": [{"letter": string, "min": number | null}],
  "assignments": [{"name": string, "component": string | null, "due_date": string | null, "weight": number | null}],
  "important_dates": [{"label": string, "date": string | null}],
  "policies": [string]
}`;

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function callGemini(bytes: Uint8Array, apiKey: string): Promise<string> {
  const base64Pdf = toBase64(bytes);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              {
                inline_data: {
                  mime_type: "application/pdf",
                  data: base64Pdf,
                },
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[syllabus] Gemini error:", response.status, detail);
    throw new Error(`Error de Gemini (${response.status}): ${detail.slice(0, 150)}`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Gemini devolvió una respuesta vacía.");
  }

  return rawText;
}

export const extractSyllabus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ExtractionResult> => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("Falta la variable GEMINI_API_KEY en el servidor.");

    const supabase = context.supabase;

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, title, file_path, extracted")
      .eq("id", data.courseId)
      .maybeSingle();
    if (courseError) throw new Error(courseError.message);
    if (!course?.file_path) return { ok: false, error: "No se encontró el archivo del programa." };

    if (course.extracted) {
      return { ok: true, data: course.extracted as ExtractedSyllabus };
    }

    const download = await supabase.storage.from("syllabi").download(course.file_path);
    if (download.error || !download.data) {
      return { ok: false, error: "No se pudo descargar el archivo PDF almacenado." };
    }

    const bytes = new Uint8Array(await download.data.arrayBuffer());
    if (bytes.length === 0) {
      return { ok: false, error: "El archivo PDF está vacío." };
    }

    let raw: string;
    try {
      raw = await callGemini(bytes, apiKey);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Error al analizar con Gemini.";
      await supabase.from("courses").update({ status: "failed", extraction_error: message }).eq("id", data.courseId);
      return { ok: false, error: message };
    }

    let parsed: ({ is_syllabus?: boolean; reason?: string | null } & ExtractedSyllabus) | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    if (!parsed) {
      const message = "No se pudo procesar la estructura del documento.";
      await supabase.from("courses").update({ status: "failed", extraction_error: message }).eq("id", data.courseId);
      return { ok: false, error: message };
    }

    if (parsed.is_syllabus === false) {
      const message = parsed.reason ? `${NOT_A_SYLLABUS_MESSAGE} (${parsed.reason})` : NOT_A_SYLLABUS_MESSAGE;
      await supabase.from("courses").update({ status: "failed", extraction_error: message }).eq("id", data.courseId);
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
          grading_components: z.array(z.object({ name: z.string(), weight: z.number().nullable() })),
          grade_scale: z.array(z.object({ letter: z.string(), min: z.number().nullable() })).default([]),
          assignments: z.array(
            z.object({
              name: z.string(),
              component: z.string().nullable(),
              due_date: z.string().nullable(),
              weight: z.number().nullable(),
            }),
          ),
          important_dates: z.array(z.object({ label: z.string(), date: z.string().nullable() })),
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
    const { error } = await context.supabase.from("courses").delete().eq("id", data.courseId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
