import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ChevronDown, Loader2, Plus, Trash2, Sparkles, CalendarDays, ClipboardList } from "lucide-react";
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
      { title: "Review extracted syllabus" },
      {
        name: "description",
        content:
          "Confirm the course details, grade weights, assignments, and policies Syllabi found in your syllabus.",
      },
      { property: "og:title", content: "Review extracted syllabus" },
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

  const balanced = Math.round(total * 10) / 10 === 100;
  const componentsOverflow = total > 100;

  const componentOptions = useMemo(
    () =>
      (draft?.grading_components ?? [])
        .map((component) => ({
          name: component.name.trim(),
          weight: component.weight ?? 0,
        }))
        .filter((c, index, all) => c.name.length > 0 && all.findIndex(item => item.name === c.name) === index),
    [draft],
  );

  const componentNames = useMemo(
    () => componentOptions.map((c) => c.name),
    [componentOptions],
  );

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
        .filter(([, entry]) => Math.round(entry.used * 10) / 10 > Math.round(entry.limit * 10) / 10)
        .map(([name, entry]) => ({ name, ...entry })),
    [componentUsage],
  );

  const underAllocated = useMemo(
    () =>
      [...componentUsage.entries()]
        .filter(([, entry]) => Math.round(entry.used * 10) / 10 < Math.round(entry.limit * 10) / 10)
        .map(([name, entry]) => ({ name, ...entry })),
    [componentUsage],
  );

  const unassignedCount = useMemo(
    () =>
      (draft?.assignments ?? []).filter((assignment) => {
        const name = assignment.component?.trim();
        return !name || !componentNames.includes(name);
      }).length,
    [draft, componentNames],
  );

  const scaleErrors = useMemo(() => validateScaleOrder(draft?.grade_scale), [draft]);

  const groupedAssignments = useMemo(() => {
    if (!draft) return [];
    
    const groups: {
      componentName: string;
      weight: number | null;
      items: { assignment: ExtractedAssignment; originalIndex: number }[];
    }[] = [];

    for (const comp of componentOptions) {
      groups.push({
        componentName: comp.name,
        weight: comp.weight,
        items: [],
      });
    }

    const unassignedItems: { assignment: ExtractedAssignment; originalIndex: number }[] = [];

    draft.assignments.forEach((assignment, originalIndex) => {
      const compName = assignment.component?.trim();
      const group = groups.find((g) => g.componentName === compName);
      if (group) {
        group.items.push({ assignment, originalIndex });
      } else {
        unassignedItems.push({ assignment, originalIndex });
      }
    });

    if (unassignedItems.length > 0) {
      groups.unshift({
        componentName: "Unassigned",
        weight: null,
        items: unassignedItems,
      });
    }

    return groups.filter((g) => g.items.length > 0 || g.componentName !== "Unassigned");
  }, [draft, componentOptions]);

  const blockedFromSaving =
    componentsOverflow ||
    !balanced ||
    overAllocated.length > 0 ||
    underAllocated.length > 0 ||
    unassignedCount > 0 ||
    scaleErrors.length > 0;

  if (!isLoading && !course) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 space-y-3 py-16 text-center">
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
      <div className="mx-auto max-w-3xl space-y-6 px-3 sm:px-0 overflow-x-hidden">
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card px-4 py-5 sm:px-7 sm:py-7 shadow-sm">
          <div className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-primary/5 blur-2xl" />
          <div className="relative">
            <div className="flex items-start gap-3">
              <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-4xl">
                  {isEditing ? "Your course, ready to edit." : "Your syllabus is now your course."}
                </h1>
                <p className="mt-2 max-w-2xl text-xs sm:text-[15px] leading-5 sm:leading-6 text-muted-foreground">
                  {isEditing
                    ? "Everything CoursePilot found is organized below. Make any changes you need, then save your updates."
                    : "CoursePilot turned your syllabus into a ready-to-use course workspace — assignments, grading, dates, and more, all in one place."}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="flex items-center gap-3 rounded-xl bg-muted/45 px-3 py-2.5 sm:px-3.5 sm:py-3">
                <ClipboardList className="size-4 shrink-0 text-primary" />
                <div>
                  <p className="numeric text-base sm:text-lg font-semibold leading-none">{draft.assignments.length}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">assignments & exams</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-muted/45 px-3 py-2.5 sm:px-3.5 sm:py-3">
                <Sparkles className="size-4 shrink-0 text-primary" />
                <div>
                  <p className="numeric text-base sm:text-lg font-semibold leading-none">{draft.grading_components.length}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">grading components</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-muted/45 px-3 py-2.5 sm:px-3.5 sm:py-3">
                <CalendarDays className="size-4 shrink-0 text-primary" />
                <div>
                  <p className="numeric text-base sm:text-lg font-semibold leading-none">{draft.important_dates.length}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">important dates</p>
                </div>
              </div>
            </div>

            {!isEditing ? (
              <p className="mt-4 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Take a quick look.</span> Everything below is editable before you save.
              </p>
            ) : null}
          </div>
        </div>

        <SectionCard>
          <SectionHeading title="Your course" hint="The basics CoursePilot found in your syllabus" />
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
            title="How you'll be graded"
            hint="Letter cutoffs used throughout your workspace"
          />
          <div className="space-y-2">
            {draft.grade_scale.map((step, index) => (
              <div
                key={index}
                className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border px-3 py-2 sm:px-3.5 sm:py-2.5"
              >
                <Input
                  aria-label="Letter"
                  value={step.letter}
                  onChange={(event) => {
                    const next = [...draft.grade_scale];
                    next[index] = { ...step, letter: event.target.value };
                    patch({ grade_scale: next });
                  }}
                  className="h-8 w-16 sm:w-20 shrink-0"
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
                  className="numeric h-8 w-16 sm:w-20 text-right shrink-0"
                />
                <span className="text-xs text-muted-foreground shrink-0">%</span>
                <button
                  type="button"
                  aria-label={`Remove ${step.letter}`}
                  onClick={() =>
                    patch({ grade_scale: draft.grade_scale.filter((_, i) => i !== index) })
                  }
                  className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-destructive shrink-0"
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
            title="Your grade, broken down"
            hint="The weighting CoursePilot found in your syllabus"
          />
          <div className="space-y-2">
            {draft.grading_components.map((component, index) => (
              <div
                key={index}
                className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border px-3 py-2 sm:px-3.5 sm:py-2.5"
              >
                <Input
                  value={component.name}
                  aria-label="Component name"
                  onChange={(event) => {
                    const next = [...draft.grading_components];
                    next[index] = { ...component, name: event.target.value };
                    patch({ grading_components: next });
                  }}
                  className="h-8 flex-1 min-w-0"
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
                  className="numeric h-8 w-16 text-right shrink-0"
                />
                <span className="text-xs text-muted-foreground shrink-0">%</span>
                <button
                  type="button"
                  aria-label={`Remove ${component.name}`}
                  onClick={() =>
                    patch({
                      grading_components: draft.grading_components.filter((_, i) => i !== index),
                    })
                  }
                  className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-destructive shrink-0"
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

        {/* Sección de Assignments Agrupados por Secciones */}
        <SectionCard>
          <SectionHeading
            title={`Everything that's due (${draft.assignments.length})`}
            hint="Assignments and exams found in your syllabus, categorized by component"
          />

          <div className="space-y-4 sm:space-y-6">
            {groupedAssignments.map((group) => {
              const usage = componentUsage.get(group.componentName);
              const isUnassigned = group.componentName === "Unassigned";
              const currentTotal = usage?.used ?? 0;
              const expectedTotal = group.weight ?? 0;
              const isMismatch = !isUnassigned && Math.round(currentTotal * 10) / 10 !== Math.round(expectedTotal * 10) / 10;

              return (
                <div key={group.componentName} className="rounded-xl border border-border/80 bg-muted/20 p-3 sm:p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <span className="font-semibold text-sm text-foreground">
                      {group.componentName}
                    </span>
                    
                    {!isUnassigned && usage && (
                      <span
                        className={cn(
                          "text-xs font-semibold px-2.5 py-0.5 rounded-full",
                          isMismatch ? "bg-destructive/10 text-destructive" : "bg-success-soft text-success"
                        )}
                      >
                        Allocated: {Math.round(currentTotal * 10) / 10}% / {expectedTotal}%
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {group.items.map(({ assignment, originalIndex }) => {
                      const componentName = assignment.component?.trim() ?? "";
                      const missingComponent =
                        !componentName || !componentNames.includes(componentName);
                      const isInferred =
                        inferredKeys.has(assignmentKey(assignment)) && assignment.weight !== null;

                      return (
                        <div
                          key={originalIndex}
                          className={cn(
                            "rounded-lg border bg-card p-2.5 sm:p-3 shadow-sm",
                            missingComponent ? "border-destructive/60" : "border-border",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Input
                              aria-label="Assignment name"
                              value={assignment.name}
                              onChange={(event) => {
                                const next = [...draft.assignments];
                                next[originalIndex] = { ...assignment, name: event.target.value };
                                patch({ assignments: next });
                              }}
                              className="h-8 flex-1 min-w-0"
                            />
                            <button
                              type="button"
                              aria-label={`Remove ${assignment.name}`}
                              onClick={() =>
                                patch({ assignments: draft.assignments.filter((_, i) => i !== originalIndex) })
                              }
                              className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-destructive shrink-0"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                          
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Select
                              value={assignment.component ?? ""}
                              onValueChange={(value) => {
                                const next = [...draft.assignments];
                                next[originalIndex] = { ...assignment, component: value || null };
                                patch({ assignments: next });
                              }}
                            >
                              <SelectTrigger
                                aria-label="Component"
                                className="h-8 w-full"
                                disabled={componentOptions.length === 0}
                              >
                                <SelectValue
                                  placeholder={
                                    componentOptions.length === 0
                                      ? "Add component first"
                                      : "Component"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {componentOptions.map((comp) => (
                                  <SelectItem key={comp.name} value={comp.name}>
                                    {comp.name}
                                  </SelectItem>
                                ))}
                                {assignment.component &&
                                !componentNames.includes(assignment.component.trim()) ? (
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
                                next[originalIndex] = { ...assignment, due_date: event.target.value || null };
                                patch({ assignments: next });
                              }}
                              className="numeric h-8 w-full"
                            />
                            
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                aria-label="Weight"
                                placeholder="Weight"
                                value={assignment.weight ?? ""}
                                onChange={(event) => {
                                  const next = [...draft.assignments];
                                  next[originalIndex] = {
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
                                className="numeric h-8 text-right flex-1"
                              />
                              <span className="text-xs text-muted-foreground shrink-0">%</span>
                            </div>
                          </div>

                          {missingComponent ? (
                            <p
                              role="alert"
                              className="mt-2 flex items-center gap-1.5 text-xs text-destructive"
                            >
                              <AlertTriangle className="size-3.5 shrink-0" />
                              Select a grading component for this assignment before saving.
                            </p>
                          ) : isInferred ? (
                            <p className="mt-2 text-xs text-muted-foreground">{INFERRED_WEIGHT_NOTE}</p>
                          ) : null}
                        </div>
                      );
                    })}

                    {group.items.length === 0 && (
                      <p className="text-xs text-muted-foreground italic py-1">
                        No assignments added to this section yet.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {draft.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No individual assignments were listed in the syllabus.
              </p>
            ) : null}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="mt-4 gap-1.5"
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
          <SectionHeading title="Dates worth remembering" hint="Important milestones found in your syllabus" />
          <div className="space-y-2">
            {draft.important_dates.map((item, index) => (
              <div key={index} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <Input
                  aria-label="Date label"
                  value={item.label}
                  onChange={(event) => {
                    const next = [...draft.important_dates];
                    next[index] = { ...item, label: event.target.value };
                    patch({ important_dates: next });
                  }}
                  className="h-8 flex-1 min-w-[150px]"
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
                  className="numeric h-8 w-full sm:w-40 shrink-0"
                />
                <button
                  type="button"
                  aria-label={`Remove ${item.label}`}
                  onClick={() =>
                    patch({
                      important_dates: draft.important_dates.filter((_, i) => i !== index),
                    })
                  }
                  className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-destructive shrink-0 ml-auto sm:ml-0"
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
            title="The fine print"
            hint="Course policies saved as context"
          />
          {draft.policies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No policies were stated.</p>
          ) : (
            <Collapsible open={policiesExpanded} onOpenChange={setPoliciesExpanded}>
              <CollapsibleContent asChild>
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
                        className="flex-1 min-w-0"
                      />
                      <button
                        type="button"
                        aria-label="Remove policy"
                        onClick={() =>
                          patch({ policies: draft.policies.filter((_, i) => i !== index) })
                        }
                        className="focus-ring mt-1 rounded-md p-1.5 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
              {draft.policies.length > 3 ? (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="mt-3 gap-1.5">
                    {policiesExpanded ? (
                      <>
                        Show fewer <ChevronDown className="size-3.5 rotate-180" />
                      </>
                    ) : (
                      <>
                        Show all {draft.policies.length} policies{" "}
                        <ChevronDown className="size-3.5" />
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              ) : null}
            </Collapsible>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() => {
              setPoliciesExpanded(true);
              patch({ policies: [...draft.policies, ""] });
            }}
          >
            <Plus className="size-3.5" />
            Add policy
          </Button>
        </SectionCard>

        {blockedFromSaving ? (
          <p role="alert" className="text-sm font-medium text-destructive px-1">
            {scaleErrors.length > 0
              ? "Fix the grading scale order before saving — higher letter grades must have equal or higher percentage cutoffs."
              : !balanced
              ? `Your course components do not add up to 100% (currently ${Math.round(total * 10) / 10}%). Please edit this before saving so your grade calculations work properly.`
              : overAllocated.length > 0
                ? overAllocated
                    .map(
                      (item) =>
                        `Assignments in ${item.name} total ${Math.round(item.used * 10) / 10}%, exceeding its ${item.limit}% weight. Please edit this before saving.`,
                    )
                    .join(" ")
                : underAllocated.length > 0
                  ? underAllocated
                      .map(
                        (item) =>
                          `Assignments in ${item.name} total ${Math.round(item.used * 10) / 10}%, which is less than its ${item.limit}% weight. Please edit this before saving.`,
                      )
                      .join(" ")
                  : `${unassignedCount} assignment${unassignedCount === 1 ? "" : "s"} still ${unassignedCount === 1 ? "needs" : "need"} a grading component. Select a component for each assignment before saving.`}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive px-1">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse sm:flex-row gap-3 pb-6 sm:justify-end">
          <Button variant="ghost" className="w-full sm:w-auto" asChild>
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
            className="w-full sm:w-auto"
            disabled={saving || blockedFromSaving}
            onClick={() => void handleSave()}
          >
            {saving
              ? "Saving…"
              : isEditing
                ? "Save changes"
                : "Looks good — save my course"}
          </Button>
        </div>

        <AlertDialog
          open={duplicates.length > 0}
          onOpenChange={(open) => {
            if (!open) setDuplicates([]);
          }}
        >
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg rounded-xl">
            <AlertDialogHeader>
              <AlertDialogTitle>This course may already exist.</AlertDialogTitle>
              <AlertDialogDescription>
                You already have {duplicates.length === 1 ? "a course" : "courses"} that looks
                like this one. You can open the existing course instead, or continue and create
                a separate one.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
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
                  <Button asChild variant="secondary" size="sm" className="mt-2 w-full sm:w-auto">
                    <Link to="/course/$courseId" params={{ courseId: match.id }}>
                      Use existing course
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
            <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <AlertDialogCancel className="w-full sm:w-auto mt-0">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="w-full sm:w-auto"
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