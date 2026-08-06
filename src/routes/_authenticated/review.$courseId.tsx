import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { SectionCard, SectionHeading } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  emptyExtraction,
  type ExtractedAssignment,
  type ExtractedSyllabus,
} from "@/lib/syllabus-extraction";
import { INFERRED_WEIGHT_NOTE, inferAssignmentWeights } from "@/lib/assignment-weights";
import { findDuplicateCourses, type DuplicateCandidate } from "@/lib/duplicate-course";
import { scaleForEditing, validateScaleOrder } from "@/lib/grade-scale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { saveExtractedCourse } from "@/lib/syllabus.functions";
import { coursesQueryKey } from "@/lib/use-courses";
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
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ExtractedSyllabus | null>(null);
  const [inferredKeys, setInferredKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [policiesExpanded, setPoliciesExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);


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

  const missingExtraction = !isLoading && !!course && !course.extracted;

  useEffect(() => {
    if (draft || !course || !course.extracted) return;
    const stored = course.extracted as ExtractedSyllabus;
    const base = {
      ...emptyExtraction(),
      ...stored,
      grade_scale: scaleForEditing(stored.grade_scale),
    };
    const { assignments, inferredIndexes } = inferAssignmentWeights(
      base.grading_components,
      base.assignments,
    );
    setDraft({ ...base, assignments });
    setInferredKeys(new Set(inferredIndexes.map((index) => assignmentKey(assignments[index]!))));
  }, [course, draft]);


  // No extraction stored yet: the processing screen owns running/retrying it.
  useEffect(() => {
    if (!missingExtraction) return;
    navigate({ to: "/processing/$courseId", params: { courseId }, replace: true });
  }, [courseId, missingExtraction, navigate]);

  const total = useMemo(
    () =>
      (draft?.grading_components ?? []).reduce(
        (sum, component) => sum + (component.weight ?? 0),
        0,
      ),
    [draft],
  );
  const balanced = Math.abs(total - 100) < 0.5;
  const componentsOverflow = total > 100.5;

  const componentOptions = useMemo(
    () =>
      (draft?.grading_components ?? [])
        .map((component) => component.name.trim())
        .filter((name, index, all) => name.length > 0 && all.indexOf(name) === index),
    [draft],
  );

  // Assignments reference their grading component by name (extraction data model).
  const componentUsage = useMemo(() => {
    const usage = new Map<string, { used: number; limit: number }>();
    for (const component of draft?.grading_components ?? []) {
      const name = component.name.trim();
      if (!name) continue;
      usage.set(name, { used: 0, limit: component.weight ?? 0 });
    }
    for (const assignment of draft?.assignments ?? []) {
      const name = assignment.component?.trim();
      if (!name) continue;
      const entry = usage.get(name);
      if (!entry) continue;
      entry.used += assignment.weight ?? 0;
    }
    return usage;
  }, [draft]);

  const overAllocated = useMemo(
    () =>
      [...componentUsage.entries()]
        .filter(([, entry]) => entry.used > entry.limit + 0.5)
        .map(([name, entry]) => ({ name, ...entry })),
    [componentUsage],
  );

  // Every assignment must belong to exactly one of the course's components.
  const unassignedCount = useMemo(
    () =>
      (draft?.assignments ?? []).filter((assignment) => {
        const name = assignment.component?.trim();
        return !name || !componentOptions.includes(name);
      }).length,
    [draft, componentOptions],
  );

  const scaleErrors = useMemo(() => validateScaleOrder(draft?.grade_scale), [draft]);

  const blockedFromSaving =
    componentsOverflow ||
    overAllocated.length > 0 ||
    unassignedCount > 0 ||
    scaleErrors.length > 0;




  if (!isLoading && !course) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md space-y-3 py-16 text-center">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            We couldn't find that course
          </h1>
          <p className="text-sm text-muted-foreground">
            It may have been deleted, or the link is out of date.
          </p>
          <Button asChild variant="secondary">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (isLoading || !draft) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }


  const isEditing = course?.status === "ready";

  const patch = (values: Partial<ExtractedSyllabus>) =>
    setDraft((current) => (current ? { ...current, ...values } : current));

  async function handleSave(options?: { skipDuplicateCheck?: boolean }) {
    if (!draft || blockedFromSaving) return;
    setSaving(true);
    setError(null);

    if (!isEditing && !options?.skipDuplicateCheck) {
      const matches = await findDuplicateCourses(courseId, draft);
      if (matches.length > 0) {
        setDuplicates(matches);
        setSaving(false);
        return;
      }
    }

    try {
      await save({
        data: {
          courseId,
          extracted: {
            ...draft,
            course_name: draft.course_name?.trim() || null,
            policies: draft.policies.map((policy) => policy.trim()).filter(Boolean),
            grade_scale: draft.grade_scale
              .filter((step) => step.letter.trim() && step.min !== null)
              .map((step) => ({ letter: step.letter.trim(), min: step.min })),
          },
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["course-workspace", courseId] });
      await queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      queryClient.invalidateQueries({ queryKey: coursesQueryKey });
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
            {isEditing ? "Course saved" : "Syllabus analyzed"}
          </span>
          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
            {isEditing ? "Edit course details" : "Review what we found"}
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
            title="Grading scale"
            hint="Letter cutoffs used for every grade shown in your workspace"
          />
          <div className="space-y-2">
            {draft.grade_scale.map((step, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5"
              >
                <Input
                  aria-label="Letter"
                  value={step.letter}
                  onChange={(event) => {
                    const next = [...draft.grade_scale];
                    next[index] = { ...step, letter: event.target.value };
                    patch({ grade_scale: next });
                  }}
                  className="h-8 w-20"
                />
                <span className="flex-1 text-xs text-muted-foreground">at least</span>
                <Input
                  type="number"
                  aria-label="Minimum score"
                  value={step.min ?? ""}
                  onChange={(event) => {
                    const next = [...draft.grade_scale];
                    next[index] = {
                      ...step,
                      min: event.target.value === "" ? null : Number(event.target.value),
                    };
                    patch({ grade_scale: next });
                  }}
                  className="numeric h-8 w-20 text-right"
                />
                <span className="text-xs text-muted-foreground">%</span>
                <button
                  type="button"
                  aria-label={`Remove ${step.letter}`}
                  onClick={() =>
                    patch({ grade_scale: draft.grade_scale.filter((_, i) => i !== index) })
                  }
                  className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {draft.grade_scale.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No cutoffs left — the default scale will be used.
              </p>
            ) : null}
            {scaleErrors.length > 0 ? (
              <div role="alert" className="space-y-1 pt-1">
                {scaleErrors.map((message) => (
                  <p key={message} className="text-sm text-destructive">
                    {message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() =>
              patch({ grade_scale: [...draft.grade_scale, { letter: "", min: null }] })
            }
          >
            <Plus className="size-3.5" />
            Add cutoff
          </Button>
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

          {componentsOverflow ? (
            <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="size-3.5" />
              Grading components add up to {Math.round(total * 10) / 10}% — they can never exceed
              100%. Remove {Math.round((total - 100) * 10) / 10}% before saving.
            </p>
          ) : draft.grading_components.length > 0 && !balanced ? (
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
            {draft.assignments.map((assignment, index) => {
              const componentName = assignment.component?.trim() ?? "";
              const missingComponent =
                !componentName || !componentOptions.includes(componentName);
              const isInferred =
                inferredKeys.has(assignmentKey(assignment)) && assignment.weight !== null;
              return (
              <div
                key={index}
                className={cn(
                  "rounded-xl border p-3",
                  missingComponent ? "border-destructive/60" : "border-border",
                )}
              >

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
                  <Select
                    value={assignment.component ?? ""}
                    onValueChange={(value) => {
                      const next = [...draft.assignments];
                      next[index] = { ...assignment, component: value || null };
                      patch({ assignments: next });
                    }}
                  >
                    <SelectTrigger
                      aria-label="Component"
                      className="h-8"
                      disabled={componentOptions.length === 0}
                    >
                      <SelectValue
                        placeholder={
                          componentOptions.length === 0
                            ? "Add a grading component first"
                            : "Component"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {componentOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                      {assignment.component &&
                      !componentOptions.includes(assignment.component.trim()) ? (
                        <SelectItem value={assignment.component}>
                          {assignment.component}
                        </SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>

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
                      const key = assignmentKey(assignment);
                      setInferredKeys((current) => {
                        if (!current.has(key)) return current;
                        const updated = new Set(current);
                        updated.delete(key);
                        return updated;
                      });
                      patch({ assignments: next });
                    }}
                    className="numeric h-8"
                  />
                </div>
                {missingComponent ? (
                  <p
                    role="alert"
                    className="mt-2 flex items-center gap-1.5 text-xs text-destructive"
                  >
                    <AlertTriangle className="size-3.5" />
                    Select a grading component for this assignment before saving.
                  </p>
                ) : isInferred ? (
                  <p className="mt-2 text-xs text-muted-foreground">{INFERRED_WEIGHT_NOTE}</p>
                ) : null}
              </div>
              );
            })}

            {draft.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No individual assignments were listed in the syllabus.
              </p>
            ) : null}
          </div>

          {componentUsage.size > 0 ? (
            <div className="mt-3 space-y-1.5">
              {[...componentUsage.entries()].map(([name, entry]) => {
                const remaining = Math.round((entry.limit - entry.used) * 10) / 10;
                const over = remaining < -0.05;
                return (
                  <p
                    key={name}
                    role={over ? "alert" : undefined}
                    className={cn(
                      "flex items-center gap-1.5 text-xs",
                      over ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {over ? <AlertTriangle className="size-3.5" /> : null}
                    {over
                      ? `${name}: assignments add up to ${Math.round(entry.used * 10) / 10}% but the component is only worth ${entry.limit}%. Remove ${Math.abs(remaining)}%.`
                      : `${name}: ${remaining}% of ${entry.limit}% still available.`}
                  </p>
                );
              })}
            </div>
          ) : null}

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

        {blockedFromSaving ? (
          <p role="alert" className="text-sm text-destructive">
            {scaleErrors.length > 0
              ? "Fix the grading scale order before saving — higher letter grades must have equal or higher percentage cutoffs."
              : componentsOverflow
              ? `Grading components add up to ${Math.round(total * 10) / 10}%. Bring the total to 100% or less to save.`
              : overAllocated.length > 0
                ? overAllocated
                    .map(
                      (item) =>
                        `These assignments exceed the ${item.name} component by ${Math.round((item.used - item.limit) * 10) / 10}%. Reduce the weights before saving.`,
                    )
                    .join(" ")
                : `${unassignedCount} assignment${unassignedCount === 1 ? "" : "s"} still ${unassignedCount === 1 ? "needs" : "need"} a grading component. Every assignment must belong to one.`}
          </p>
        ) : null}


        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" asChild>
            {isEditing ? (
              <Link to="/course/$courseId" params={{ courseId }}>
                Cancel
              </Link>
            ) : (
              <Link to="/upload">Start over</Link>
            )}
          </Button>
          <Button
            size="lg"
            disabled={saving || blockedFromSaving}
            onClick={() => void handleSave()}
          >

            {saving
              ? "Saving…"
              : isEditing
                ? "Save changes"
                : "Confirm and save course"}
          </Button>
        </div>

        <AlertDialog
          open={duplicates.length > 0}
          onOpenChange={(open) => {
            if (!open) setDuplicates([]);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>This course may already exist.</AlertDialogTitle>
              <AlertDialogDescription>
                You already have {duplicates.length === 1 ? "a course" : "courses"} that looks
                like this one. You can open the existing course instead, or continue and create
                a separate one.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="space-y-2">
              {duplicates.map((match) => (
                <li key={match.id} className="rounded-lg border border-border/70 p-3">
                  <p className="text-sm font-medium">{match.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[match.code, match.professor, match.semester].filter(Boolean).join(" · ") ||
                      "No extra details"}
                  </p>
                  {match.reason ? (
                    <p className="mt-1 text-xs text-muted-foreground">Matches on {match.reason}</p>
                  ) : null}
                  <Button asChild variant="secondary" size="sm" className="mt-2">
                    <Link to="/course/$courseId" params={{ courseId: match.id }}>
                      Use existing course
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setDuplicates([]);
                  void handleSave({ skipDuplicateCheck: true });
                }}
              >
                Create anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

    </AppShell>
  );
}

/** Identity for tracking which weights we inferred, stable across reorders. */
function assignmentKey(assignment: ExtractedAssignment) {
  return `${assignment.component?.trim() ?? ""}::${assignment.name.trim()}`;
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
