import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { SectionCard, SectionHeading } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  emptyExtraction,
  type ExtractedSyllabus,
} from "@/lib/syllabus-extraction";
import { saveExtractedCourse } from "@/lib/syllabus.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/review/$courseId")({
  head: () => ({
    meta: [
      { title: "Review extracted syllabus — CoursePilot" },
      {
        name: "description",
        content:
          "Confirm the course details, grade weights, assignments, and policies CoursePilot found in your syllabus.",
      },
      { property: "og:title", content: "Review extracted syllabus — CoursePilot" },
      {
        property: "og:description",
        content: "You confirm every extracted field before the course is saved.",
      },
    ],
  }),
  component: ReviewExtractionScreen,
});

function ReviewExtractionScreen() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const save = useServerFn(saveExtractedCourse);
  const [draft, setDraft] = useState<ExtractedSyllabus | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("courses")
        .select("id, title, status, extracted, extraction_error")
        .eq("id", courseId)
        .maybeSingle();
      if (queryError) throw queryError;
      return data;
    },
  });

  useEffect(() => {
    if (draft || !course) return;
    setDraft({ ...emptyExtraction(), ...((course.extracted ?? {}) as ExtractedSyllabus) });
  }, [course, draft]);

  const total = useMemo(
    () =>
      (draft?.grading_components ?? []).reduce(
        (sum, component) => sum + (component.weight ?? 0),
        0,
      ),
    [draft],
  );
  const balanced = Math.abs(total - 100) < 0.5;

  if (isLoading || !draft) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const patch = (values: Partial<ExtractedSyllabus>) =>
    setDraft((current) => (current ? { ...current, ...values } : current));

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await save({
        data: {
          courseId,
          extracted: {
            ...draft,
            course_name: draft.course_name?.trim() || null,
            policies: draft.policies.map((policy) => policy.trim()).filter(Boolean),
          },
        },
      });
      navigate({ to: "/course/$courseId", params: { courseId } });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "We couldn't save this course. Try again.",
      );
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          to="/dashboard"
          className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Dashboard
        </Link>

        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">
            <Check className="size-3" strokeWidth={3} />
            Syllabus analyzed
          </span>
          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
            Review what we found
          </h1>
          <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">
            Only what your syllabus actually states was extracted — blank fields mean the document
            didn't say. Everything here is editable.
          </p>
        </div>

        <SectionCard>
          <SectionHeading title="Course details" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Course name"
              value={draft.course_name ?? ""}
              onChange={(value) => patch({ course_name: value })}
            />
            <Field
              label="Course code"
              value={draft.course_code ?? ""}
              onChange={(value) => patch({ course_code: value })}
            />
            <Field
              label="Professor"
              value={draft.professor ?? ""}
              onChange={(value) => patch({ professor: value })}
            />
            <Field
              label="Semester"
              value={draft.semester ?? ""}
              onChange={(value) => patch({ semester: value })}
            />
          </div>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="description">Course description</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="Not stated in the syllabus"
              value={draft.description ?? ""}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeading
            title="Grading components"
            hint="These drive every number in your workspace"
            action={
              <span
                className={cn(
                  "numeric rounded-full px-2.5 py-1 text-xs font-semibold",
                  balanced ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
                )}
              >
                {Math.round(total * 10) / 10}%
              </span>
            }
          />
          <div className="space-y-2">
            {draft.grading_components.map((component, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5"
              >
                <Input
                  value={component.name}
                  aria-label="Component name"
                  onChange={(event) => {
                    const next = [...draft.grading_components];
                    next[index] = { ...component, name: event.target.value };
                    patch({ grading_components: next });
                  }}
                  className="h-8 flex-1"
                />
                <Input
                  type="number"
                  aria-label="Weight"
                  value={component.weight ?? ""}
                  onChange={(event) => {
                    const next = [...draft.grading_components];
                    next[index] = {
                      ...component,
                      weight: event.target.value === "" ? null : Number(event.target.value),
                    };
                    patch({ grading_components: next });
                  }}
                  className="numeric h-8 w-16 text-right"
                />
                <span className="text-xs text-muted-foreground">%</span>
                <button
                  type="button"
                  aria-label={`Remove ${component.name}`}
                  onClick={() =>
                    patch({
                      grading_components: draft.grading_components.filter((_, i) => i !== index),
                    })
                  }
                  className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {draft.grading_components.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No grading breakdown was stated in the syllabus. Add the components yourself.
              </p>
            ) : null}
          </div>

          {draft.grading_components.length > 0 && !balanced ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="size-3.5" />
              Weights should add up to 100%. Adjust before saving.
            </p>
          ) : null}

          <Button
            variant="ghost"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() =>
              patch({
                grading_components: [
                  ...draft.grading_components,
                  { name: "New component", weight: 0 },
                ],
              })
            }
          >
            <Plus className="size-3.5" />
            Add component
          </Button>
        </SectionCard>

        <SectionCard>
          <SectionHeading
            title={`Assignments & exams (${draft.assignments.length})`}
            hint="Scores stay empty until you enter them"
          />
          <div className="space-y-2">
            {draft.assignments.map((assignment, index) => (
              <div key={index} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Assignment name"
                    value={assignment.name}
                    onChange={(event) => {
                      const next = [...draft.assignments];
                      next[index] = { ...assignment, name: event.target.value };
                      patch({ assignments: next });
                    }}
                    className="h-8 flex-1"
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${assignment.name}`}
                    onClick={() =>
                      patch({ assignments: draft.assignments.filter((_, i) => i !== index) })
                    }
                    className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <Input
                    aria-label="Component"
                    placeholder="Component"
                    value={assignment.component ?? ""}
                    onChange={(event) => {
                      const next = [...draft.assignments];
                      next[index] = { ...assignment, component: event.target.value || null };
                      patch({ assignments: next });
                    }}
                    className="h-8"
                  />
                  <Input
                    type="date"
                    aria-label="Due date"
                    value={assignment.due_date ?? ""}
                    onChange={(event) => {
                      const next = [...draft.assignments];
                      next[index] = { ...assignment, due_date: event.target.value || null };
                      patch({ assignments: next });
                    }}
                    className="numeric h-8"
                  />
                  <Input
                    type="number"
                    aria-label="Weight"
                    placeholder="Weight %"
                    value={assignment.weight ?? ""}
                    onChange={(event) => {
                      const next = [...draft.assignments];
                      next[index] = {
                        ...assignment,
                        weight: event.target.value === "" ? null : Number(event.target.value),
                      };
                      patch({ assignments: next });
                    }}
                    className="numeric h-8"
                  />
                </div>
              </div>
            ))}
            {draft.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No individual assignments were listed in the syllabus.
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() =>
              patch({
                assignments: [
                  ...draft.assignments,
                  { name: "New assignment", component: null, due_date: null, weight: null },
                ],
              })
            }
          >
            <Plus className="size-3.5" />
            Add assignment
          </Button>
        </SectionCard>

        <SectionCard>
          <SectionHeading title="Important dates" hint="Milestones that aren't graded work" />
          <div className="space-y-2">
            {draft.important_dates.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  aria-label="Date label"
                  value={item.label}
                  onChange={(event) => {
                    const next = [...draft.important_dates];
                    next[index] = { ...item, label: event.target.value };
                    patch({ important_dates: next });
                  }}
                  className="h-8 flex-1"
                />
                <Input
                  type="date"
                  aria-label="Date"
                  value={item.date ?? ""}
                  onChange={(event) => {
                    const next = [...draft.important_dates];
                    next[index] = { ...item, date: event.target.value || null };
                    patch({ important_dates: next });
                  }}
                  className="numeric h-8 w-40"
                />
                <button
                  type="button"
                  aria-label={`Remove ${item.label}`}
                  onClick={() =>
                    patch({
                      important_dates: draft.important_dates.filter((_, i) => i !== index),
                    })
                  }
                  className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {draft.important_dates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other dates were stated.</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() =>
              patch({
                important_dates: [...draft.important_dates, { label: "New date", date: null }],
              })
            }
          >
            <Plus className="size-3.5" />
            Add date
          </Button>
        </SectionCard>

        <SectionCard>
          <SectionHeading
            title="Course policies"
            hint="Stored as context — never used in calculations"
          />
          <div className="space-y-2">
            {draft.policies.map((policy, index) => (
              <div key={index} className="flex items-start gap-2">
                <Textarea
                  aria-label="Policy"
                  rows={2}
                  value={policy}
                  onChange={(event) => {
                    const next = [...draft.policies];
                    next[index] = event.target.value;
                    patch({ policies: next });
                  }}
                  className="flex-1"
                />
                <button
                  type="button"
                  aria-label="Remove policy"
                  onClick={() =>
                    patch({ policies: draft.policies.filter((_, i) => i !== index) })
                  }
                  className="focus-ring mt-1 rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {draft.policies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No policies were stated.</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() => patch({ policies: [...draft.policies, ""] })}
          >
            <Plus className="size-3.5" />
            Add policy
          </Button>
        </SectionCard>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" asChild>
            <Link to="/upload">Start over</Link>
          </Button>
          <Button size="lg" disabled={saving} onClick={handleSave}>
            {saving ? "Saving…" : "Confirm and save course"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder="Not stated in the syllabus"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
