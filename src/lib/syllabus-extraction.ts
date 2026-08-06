/**
 * Shared (client-safe) types + schema for AI syllabus extraction.
 */

export type ExtractedComponent = {
  name: string;
  weight: number | null;
};

export type ExtractedAssignment = {
  name: string;
  component: string | null;
  due_date: string | null;
  weight: number | null;
};

export type ExtractedDate = {
  label: string;
  date: string | null;
};

export type ExtractedSyllabus = {
  course_name: string | null;
  course_code: string | null;
  professor: string | null;
  semester: string | null;
  description: string | null;
  grading_components: ExtractedComponent[];
  assignments: ExtractedAssignment[];
  important_dates: ExtractedDate[];
  policies: string[];
};

export type ExtractionResult =
  | { ok: true; data: ExtractedSyllabus }
  | { ok: false; error: string };

export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_syllabus",
    "reason",
    "course_name",
    "course_code",
    "professor",
    "semester",
    "description",
    "grading_components",
    "assignments",
    "important_dates",
    "policies",
  ],
  properties: {
    is_syllabus: { type: "boolean" },
    reason: { type: ["string", "null"] },
    course_name: { type: ["string", "null"] },
    course_code: { type: ["string", "null"] },
    professor: { type: ["string", "null"] },
    semester: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    grading_components: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "weight"],
        properties: {
          name: { type: "string" },
          weight: { type: ["number", "null"] },
        },
      },
    },
    assignments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "component", "due_date", "weight"],
        properties: {
          name: { type: "string" },
          component: { type: ["string", "null"] },
          due_date: { type: ["string", "null"] },
          weight: { type: ["number", "null"] },
        },
      },
    },
    important_dates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "date"],
        properties: {
          label: { type: "string" },
          date: { type: ["string", "null"] },
        },
      },
    },
    policies: { type: "array", items: { type: "string" } },
  },
} as const;

export const NOT_A_SYLLABUS_MESSAGE =
  "This PDF doesn't look like a course syllabus. Upload the syllabus PDF for your course and we'll try again.";

export function emptyExtraction(): ExtractedSyllabus {
  return {
    course_name: null,
    course_code: null,
    professor: null,
    semester: null,
    description: null,
    grading_components: [],
    assignments: [],
    important_dates: [],
    policies: [],
  };
}
