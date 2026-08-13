import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Loader2,
  Plus,
  Wand2,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import {
  emptyExtraction,
  type ExtractedAssignment,
  type ExtractedSyllabus,
} from "@/lib/syllabus-extraction";
import { INFERRED_WEIGHT_NOTE, inferAssignmentWeights } from "@/lib/assignment-weights";
import { findDuplicateCourses, type DuplicateCandidate } from "@/lib/duplicate-course";
import { scaleForEditing, scaleForSaving, validateScaleOrder } from "@/lib/grade-scale";
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
  // Student-set target grade. `null` = not initialised yet; "" = intentionally
  // empty for a new course (never prefilled with the DB default).
  const [targetInput, setTargetInput] = useState<string | null>(null);
  const [targetTouched, setTargetTouched] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const { user } = Route.useRouteContext();

  // Modales de creación con formulario
  const [activeModal, setActiveModal] = useState<
    "none" | "assignment" | "component" | "cutoff" | "date" | "policy"
  >("none");

  // Estados de formularios
  const [newAssignment, setNewAssignment] = useState({
    name: "",
    component: "",
    due_date: "",
    weight: "",
  });
  const [newComponent, setNewComponent] = useState({ name: "", weight: "" });
  const [newCutoff, setNewCutoff] = useState({ letter: "", min: "" });
  const [newImportantDate, setNewImportantDate] = useState({ label: "", date: "" });
  const [newPolicy, setNewPolicy] = useState("");

  const { data: course, isLoading, isError, refetch } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("courses")
        .select("id, title, status, extracted, extraction_error, target_grade")
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
    if (targetInput !== null || !course) return;
    // Only an already-ready course has a target the student actually chose.
    setTargetInput(
      course.status === "ready" && Number.isFinite(Number(course.target_grade))
        ? String(Number(course.target_grade))
        : "",
    );
  }, [course, targetInput]);

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
        .filter((c, index, all) => c.name.length > 0 && all.findIndex((item) => item.name === c.name) === index),
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

  const targetRaw = (targetInput ?? "").trim();
  const targetValue = targetRaw === "" ? Number.NaN : Number(targetRaw);
  const targetValid = Number.isFinite(targetValue) && targetValue >= 0 && targetValue <= 100;
  const showTargetError = !targetValid && (targetTouched || saveAttempted);

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
    scaleErrors.length > 0 ||
    !targetValid;

    if (isError) {
      return (
        <AppShell user={user}>
          <div className="mx-auto max-w-md space-y-3 px-4 py-16 text-center">
            <h1 className="font-display text-xl font-semibold tracking-tight">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground">
              We couldn't load this course. Check your connection and try again.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={() => refetch()}>
                Try again
              </Button>
              <Button asChild variant="outline">
                <Link to="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </div>
        </AppShell>
      );
    }

  if (!isLoading && !course) {
    return (
      <AppShell user={user}>
        <div className="mx-auto max-w-md space-y-3 px-4 py-16 text-center">
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
      <AppShell user={user}>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const isEditing = course?.status === "ready";

  const patch = (values: Partial<ExtractedSyllabus>) =>
    setDraft((current) => (current ? { ...current, ...values } : current));

  // Función para autobalancear los pesos de una categoría en partes iguales
  const handleAutoBalanceCategory = (componentName: string, categoryWeight: number) => {
    if (!draft || categoryWeight <= 0) return;

    const matchingItems = draft.assignments.filter(
      (a) => a.component?.trim() === componentName,
    );

    const n = matchingItems.length;
    if (n === 0) return;

    // Split into equal tenths, then hand the leftover tenths to the first
    // few items so the total lands exactly on categoryWeight (not 99.9%).
    const baseWeight = Math.floor((categoryWeight / n) * 10) / 10;
    const remainderTenths = Math.round((categoryWeight - baseWeight * n) * 10);

    let remaining = remainderTenths;
    const updatedAssignments = draft.assignments.map((a) => {
      if (a.component?.trim() !== componentName) return a;
      const bump = remaining > 0 ? 0.1 : 0;
      if (remaining > 0) remaining -= 1;
      return { ...a, weight: Math.round((baseWeight + bump) * 10) / 10 };
    });

    patch({ assignments: updatedAssignments });
  };

  // Handlers para agregar desde modales
  const handleAddAssignment = () => {
    if (!newAssignment.name.trim()) return;
    patch({
      assignments: [
        ...draft.assignments,
        {
          name: newAssignment.name.trim(),
          component: newAssignment.component.trim() || null,
          due_date: newAssignment.due_date || null,
          weight: newAssignment.weight ? Number(newAssignment.weight) : null,
        },
      ],
    });
    setNewAssignment({ name: "", component: "", due_date: "", weight: "" });
    setActiveModal("none");
  };

  const handleAddComponent = () => {
    if (!newComponent.name.trim()) return;
    patch({
      grading_components: [
        ...draft.grading_components,
        {
          name: newComponent.name.trim(),
          weight: newComponent.weight ? Number(newComponent.weight) : 0,
        },
      ],
    });
    setNewComponent({ name: "", weight: "" });
    setActiveModal("none");
  };

  const handleAddCutoff = () => {
    if (!newCutoff.letter.trim()) return;
    patch({
      grade_scale: [
        ...draft.grade_scale,
        {
          letter: newCutoff.letter.trim(),
          min: newCutoff.min !== "" ? Number(newCutoff.min) : null,
        },
      ],
    });
    setNewCutoff({ letter: "", min: "" });
    setActiveModal("none");
  };

  const handleAddImportantDate = () => {
    if (!newImportantDate.label.trim()) return;
    patch({
      important_dates: [
        ...draft.important_dates,
        {
          label: newImportantDate.label.trim(),
          date: newImportantDate.date || null,
        },
      ],
    });
    setNewImportantDate({ label: "", date: "" });
    setActiveModal("none");
  };

  const handleAddPolicy = () => {
    if (!newPolicy.trim()) return;
    setPoliciesExpanded(true);
    patch({
      policies: [...draft.policies, newPolicy.trim()],
    });
    setNewPolicy("");
    setActiveModal("none");
  };

  async function handleSave(options?: { skipDuplicateCheck?: boolean }) {
    setSaveAttempted(true);
    if (!draft || blockedFromSaving || !targetValid) return;
    setSaving(true);
    setError(null);

    try {
      if (!isEditing && !options?.skipDuplicateCheck) {
        const matches = await findDuplicateCourses(courseId, draft);
        if (matches.length > 0) {
          setDuplicates(matches);
          setSaving(false);
          return;
        }
      }

      await save({
        data: {
          courseId,
          targetGrade: targetValue,
          extracted: {
            ...draft,
            course_name: draft.course_name?.trim() || null,
            policies: draft.policies.map((policy) => policy.trim()).filter(Boolean),
            grade_scale: scaleForSaving(draft.grade_scale),

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
    <AppShell user={user}>
      <div className="mx-auto max-w-3xl space-y-6 overflow-x-hidden px-3 sm:px-0">
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card px-4 py-5 shadow-sm sm:px-7 sm:py-7">
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
                <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-[15px] sm:leading-6">
                  {isEditing
                    ? "Everything Syllabi found is organized below. Make any changes you need, then save your updates."
                    : "Syllabi turned your syllabus into a ready-to-use course workspace — assignments, grading, dates, and more, all in one place."}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl bg-muted/45 px-3 py-2.5 sm:px-3.5 sm:py-3">
                <ClipboardList className="size-4 shrink-0 text-primary" />
                <div>
                  <p className="numeric text-base font-semibold leading-none sm:text-lg">
                    {draft.assignments.length}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">assignments & exams</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-muted/45 px-3 py-2.5 sm:px-3.5 sm:py-3">
                <Sparkles className="size-4 shrink-0 text-primary" />
                <div>
                  <p className="numeric text-base font-semibold leading-none sm:text-lg">
                    {draft.grading_components.length}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">grading components</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-muted/45 px-3 py-2.5 sm:px-3.5 sm:py-3">
                <CalendarDays className="size-4 shrink-0 text-primary" />
                <div>
                  <p className="numeric text-base font-semibold leading-none sm:text-lg">
                    {draft.important_dates.length}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">important dates</p>
                </div>
              </div>
            </div>

            {!isEditing ? (
              <p className="mt-4 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Take a quick look.</span> Everything
                below is editable before you save.
              </p>
            ) : null}
          </div>
        </div>

        <SectionCard>
          <SectionHeading title="Your course" hint="The basics Syllabi found in your syllabus" />
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

        {/* SECTION: Grade Scale */}
        <SectionCard>
          <SectionHeading
            title="How you'll be graded"
            hint="Letter cutoffs used throughout your workspace"
          />
          <div className="space-y-2">
            {draft.grade_scale.map((step, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 sm:gap-3 sm:px-3.5 sm:py-2.5"
              >
                <Input
                  aria-label="Letter"
                  value={step.letter}
                  onChange={(event) => {
                    const next = [...draft.grade_scale];
                    next[index] = { ...step, letter: event.target.value };
                    patch({ grade_scale: next });
                  }}
                  className="h-8 w-16 shrink-0 sm:w-20"
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
                  className="numeric h-8 w-16 shrink-0 text-right sm:w-20"
                />
                <span className="shrink-0 text-xs text-muted-foreground">%</span>
                <button
                  type="button"
                  aria-label={`Remove ${step.letter}`}
                  onClick={() =>
                    patch({ grade_scale: draft.grade_scale.filter((_, i) => i !== index) })
                  }
                  className="focus-ring shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-destructive"
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
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5 border-dashed"
            onClick={() => setActiveModal("cutoff")}
          >
            <Plus className="size-3.5" />
            Add cutoff
          </Button>
        </SectionCard>

        {/* SECTION: Target grade (student-set) */}
        <SectionCard className={cn(showTargetError && "border-destructive/60")}>
          <SectionHeading
            title="What grade are you aiming for?"
            hint="This is yours to set — Syllabi can't read it off the syllabus. It drives your on-track badge and how much you need on what's left."
          />
          <div className="space-y-2">
            <Label htmlFor="target-grade" className="text-xs text-muted-foreground">
              Target grade <span className="text-destructive">*</span> (required)
            </Label>
            <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 sm:px-3.5 sm:py-2.5">
              <Target className="size-4 shrink-0 text-primary" />
              <Input
                id="target-grade"
                type="number"
                min={0}
                max={100}
                inputMode="decimal"
                placeholder="e.g. 85"
                value={targetInput ?? ""}
                onChange={(event) => {
                  setTargetTouched(true);
                  setTargetInput(event.target.value);
                }}
                onBlur={() => setTargetTouched(true)}
                aria-invalid={showTargetError}
                className="numeric h-8 w-24 text-right"
              />
              <span className="shrink-0 text-xs text-muted-foreground">%</span>
            </div>
            {showTargetError ? (
              <p role="alert" className="text-sm text-destructive">
                Set a target grade to continue — it's required to save this course.
              </p>
            ) : null}
          </div>
        </SectionCard>

        {/* SECTION: Grading Components */}
        <SectionCard>
          <SectionHeading
            title="Your grade, broken down"
            hint="The weighting Syllabi found in your syllabus"
          />
          <div className="space-y-2">
            {draft.grading_components.map((component, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 sm:gap-3 sm:px-3.5 sm:py-2.5"
              >
                <Input
                  value={component.name}
                  aria-label="Component name"
                  onChange={(event) => {
                    const next = [...draft.grading_components];
                    next[index] = { ...component, name: event.target.value };
                    patch({ grading_components: next });
                  }}
                  className="h-8 min-w-0 flex-1"
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
                  className="numeric h-8 w-16 shrink-0 text-right"
                />
                <span className="shrink-0 text-xs text-muted-foreground">%</span>
                <button
                  type="button"
                  aria-label={`Remove ${component.name}`}
                  onClick={() =>
                    patch({
                      grading_components: draft.grading_components.filter((_, i) => i !== index),
                    })
                  }
                  className="focus-ring shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-destructive"
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
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5 border-dashed"
            onClick={() => setActiveModal("component")}
          >
            <Plus className="size-3.5" />
            Add component
          </Button>
        </SectionCard>

        {/* SECTION: Everything that's due */}
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
              const isMismatch =
                !isUnassigned &&
                Math.round(currentTotal * 10) / 10 !== Math.round(expectedTotal * 10) / 10;

              return (
                <div
                  key={group.componentName}
                  className="space-y-3 rounded-2xl border border-border/80 bg-muted/30 p-3.5 sm:p-5"
                >
                  {/* Título arriba + Píldora + Botón Auto-balance con estilo de botón real */}
                  <div className="border-b border-border/50 pb-3">
                    <h3 className="font-display text-base font-bold text-foreground">
                      {group.componentName}
                    </h3>
                    {!isUnassigned && usage && (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold shadow-2xs",
                            isMismatch
                              ? "border border-destructive/30 bg-destructive/10 text-destructive"
                              : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          Allocated: {Math.round(currentTotal * 10) / 10}% / {expectedTotal}%
                        </span>

                        {group.items.length > 0 && expectedTotal > 0 && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              handleAutoBalanceCategory(group.componentName, expectedTotal)
                            }
                            className="h-7 gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 text-[11px] font-bold text-foreground shadow-2xs transition-all hover:bg-accent hover:text-accent-foreground active:scale-95"
                          >
                            <Wand2 className="size-3 text-primary" />
                            <span>Balance</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tarjetas de tareas con Date y Weight en la misma fila */}
                  <div className="space-y-2.5">
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
                            "rounded-xl border bg-card p-3 sm:p-3.5 shadow-2xs transition-all hover:border-border/80",
                            missingComponent ? "border-destructive/60 bg-destructive/5" : "border-border/70",
                          )}
                        >
                          {/* Fila 1: Nombre de la tarea + Botón Eliminar */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-1">
                              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Assignment Name
                              </Label>
                              <Input
                                aria-label="Assignment name"
                                value={assignment.name}
                                onChange={(event) => {
                                  const next = [...draft.assignments];
                                  next[originalIndex] = { ...assignment, name: event.target.value };
                                  patch({ assignments: next });
                                }}
                                className="h-9 font-medium"
                              />
                            </div>
                            <button
                              type="button"
                              aria-label={`Remove ${assignment.name}`}
                              onClick={() =>
                                patch({
                                  assignments: draft.assignments.filter(
                                    (_, i) => i !== originalIndex,
                                  ),
                                })
                              }
                              className="focus-ring mt-5 shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>

                          {/* Fila 2: Componente Selector */}
                          <div className="mt-2.5 space-y-1">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Component
                            </Label>
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
                                className="h-9 w-full"
                                disabled={componentOptions.length === 0}
                              >
                                <SelectValue
                                  placeholder={
                                    componentOptions.length === 0
                                      ? "Add component first"
                                      : "Select component"
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
                          </div>

                          {/* Fila 3: Due Date y Weight SIEMPRE en la misma fila (2 columnas) */}
                          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                            <div className="space-y-1 min-w-0">
                              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Due Date
                              </Label>
                              <div className="relative flex items-center">
                                <Input
                                  type="date"
                                  aria-label="Due date"
                                  value={assignment.due_date ?? ""}
                                  onChange={(event) => {
                                    const next = [...draft.assignments];
                                    next[originalIndex] = {
                                      ...assignment,
                                      due_date: event.target.value || null,
                                    };
                                    patch({ assignments: next });
                                  }}
                                  className="numeric h-9 pr-8 text-xs font-medium [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                />
                                <CalendarDays className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground/70" />
                              </div>
                            </div>

                            <div className="space-y-1 min-w-0">
                              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Weight
                              </Label>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  aria-label="Weight"
                                  placeholder="0"
                                  value={assignment.weight ?? ""}
                                  onChange={(event) => {
                                    const next = [...draft.assignments];
                                    next[originalIndex] = {
                                      ...assignment,
                                      weight:
                                        event.target.value === "" ? null : Number(event.target.value),
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
                                  className="numeric h-9 text-right font-semibold text-xs flex-1 min-w-0"
                                />
                                <span className="shrink-0 text-xs font-bold text-muted-foreground">
                                  %
                                </span>
                              </div>
                            </div>
                          </div>

                          {missingComponent ? (
                            <p
                              role="alert"
                              className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-destructive"
                            >
                              <AlertTriangle className="size-3.5 shrink-0" />
                              Select a grading component for this assignment before saving.
                            </p>
                          ) : isInferred ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {INFERRED_WEIGHT_NOTE}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}

                    {group.items.length === 0 && (
                      <p className="py-2 text-center text-xs font-medium text-muted-foreground italic">
                        No assignments added to this category yet.
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
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5 border-dashed"
            onClick={() => setActiveModal("assignment")}
          >
            <Plus className="size-3.5" />
            Add assignment
          </Button>
        </SectionCard>

        {/* SECTION: Dates worth remembering */}
        <SectionCard>
          <SectionHeading title="Dates worth remembering" hint="Important milestones found in your syllabus" />
          <div className="space-y-2">
            {draft.important_dates.map((item, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <Input
                  aria-label="Date label"
                  value={item.label}
                  onChange={(event) => {
                    const next = [...draft.important_dates];
                    next[index] = { ...item, label: event.target.value };
                    patch({ important_dates: next });
                  }}
                  className="h-8 min-w-[150px] flex-1"
                />
                <div className="relative w-full sm:w-40">
                  <Input
                    type="date"
                    aria-label="Date"
                    value={item.date ?? ""}
                    onChange={(event) => {
                      const next = [...draft.important_dates];
                      next[index] = { ...item, date: event.target.value || null };
                      patch({ important_dates: next });
                    }}
                    className="numeric h-8 pr-8 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <CalendarDays className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${item.label}`}
                  onClick={() =>
                    patch({
                      important_dates: draft.important_dates.filter((_, i) => i !== index),
                    })
                  }
                  className="focus-ring ml-auto shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-destructive sm:ml-0"
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
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5 border-dashed"
            onClick={() => setActiveModal("date")}
          >
            <Plus className="size-3.5" />
            Add date
          </Button>
        </SectionCard>

        {/* SECTION: Course Policies */}
        <SectionCard>
          <SectionHeading title="The fine print" hint="Course policies saved as context" />
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
                        className="min-w-0 flex-1"
                      />
                      <button
                        type="button"
                        aria-label="Remove policy"
                        onClick={() =>
                          patch({ policies: draft.policies.filter((_, i) => i !== index) })
                        }
                        className="focus-ring mt-1 shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-destructive"
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
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5 border-dashed"
            onClick={() => setActiveModal("policy")}
          >
            <Plus className="size-3.5" />
            Add policy
          </Button>
        </SectionCard>

        {/* ERROR / BLOCKED WARNINGS */}
        {blockedFromSaving ? (
          <p role="alert" className="px-1 text-sm font-medium text-destructive">
            {!targetValid
              ? "Set a target grade to continue — it's required to save this course."
              : scaleErrors.length > 0
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
          <p role="alert" className="px-1 text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 pb-6 sm:flex-row sm:justify-end">
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

        {/* ------------------- MODALES DE CREACIÓN ------------------- */}

        {/* 1. Modal: Add Assignment */}
        <Dialog open={activeModal === "assignment"} onOpenChange={(open) => !open && setActiveModal("none")}>
          <DialogContent className="max-w-[92vw] rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add new assignment</DialogTitle>
              <DialogDescription>
                Enter the details for this assignment or exam.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-2">
              <div className="space-y-1">
                <Label htmlFor="new-assignment-name">Assignment Name</Label>
                <Input
                  id="new-assignment-name"
                  placeholder="e.g. Midterm Exam"
                  value={newAssignment.name}
                  onChange={(e) => setNewAssignment({ ...newAssignment, name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-assignment-component">Grading Component</Label>
                <Select
                  value={newAssignment.component}
                  onValueChange={(value) =>
                    setNewAssignment({ ...newAssignment, component: value })
                  }
                >
                  <SelectTrigger id="new-assignment-component" className="w-full">
                    <SelectValue placeholder="Select component" />
                  </SelectTrigger>
                  <SelectContent>
                    {componentOptions.map((comp) => (
                      <SelectItem key={comp.name} value={comp.name}>
                        {comp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="new-assignment-date">Due Date</Label>
                  <Input
                    id="new-assignment-date"
                    type="date"
                    value={newAssignment.due_date}
                    onChange={(e) =>
                      setNewAssignment({ ...newAssignment, due_date: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="new-assignment-weight">Weight (%)</Label>
                  <Input
                    id="new-assignment-weight"
                    type="number"
                    placeholder="e.g. 15"
                    value={newAssignment.weight}
                    onChange={(e) =>
                      setNewAssignment({ ...newAssignment, weight: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
              <Button
                variant="ghost"
                onClick={() => setActiveModal("none")}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddAssignment}
                disabled={!newAssignment.name.trim()}
                className="w-full sm:w-auto"
              >
                Add assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 2. Modal: Add Component */}
        <Dialog open={activeModal === "component"} onOpenChange={(open) => !open && setActiveModal("none")}>
          <DialogContent className="max-w-[92vw] rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add grading component</DialogTitle>
              <DialogDescription>
                Define a category (e.g., Quizzes, Final Exam) and its weight.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-2">
              <div className="space-y-1">
                <Label htmlFor="new-comp-name">Component Name</Label>
                <Input
                  id="new-comp-name"
                  placeholder="e.g. Homeworks"
                  value={newComponent.name}
                  onChange={(e) => setNewComponent({ ...newComponent, name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-comp-weight">Total Weight (%)</Label>
                <Input
                  id="new-comp-weight"
                  type="number"
                  placeholder="e.g. 20"
                  value={newComponent.weight}
                  onChange={(e) => setNewComponent({ ...newComponent, weight: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
              <Button variant="ghost" onClick={() => setActiveModal("none")} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={handleAddComponent} disabled={!newComponent.name.trim()} className="w-full sm:w-auto">
                Add component
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 3. Modal: Add Cutoff */}
        <Dialog open={activeModal === "cutoff"} onOpenChange={(open) => !open && setActiveModal("none")}>
          <DialogContent className="max-w-[92vw] rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add grade cutoff</DialogTitle>
              <DialogDescription>
                Set a letter grade and its minimum required score.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="space-y-1">
                <Label htmlFor="new-cutoff-letter">Letter Grade</Label>
                <Input
                  id="new-cutoff-letter"
                  placeholder="e.g. A-"
                  value={newCutoff.letter}
                  onChange={(e) => setNewCutoff({ ...newCutoff, letter: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-cutoff-min">Minimum Score (%)</Label>
                <Input
                  id="new-cutoff-min"
                  type="number"
                  placeholder="e.g. 90"
                  value={newCutoff.min}
                  onChange={(e) => setNewCutoff({ ...newCutoff, min: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
              <Button variant="ghost" onClick={() => setActiveModal("none")} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={handleAddCutoff} disabled={!newCutoff.letter.trim()} className="w-full sm:w-auto">
                Add cutoff
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 4. Modal: Add Date */}
        <Dialog open={activeModal === "date"} onOpenChange={(open) => !open && setActiveModal("none")}>
          <DialogContent className="max-w-[92vw] rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add important date</DialogTitle>
              <DialogDescription>
                Record key academic events (e.g. Drop deadline, Break).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-2">
              <div className="space-y-1">
                <Label htmlFor="new-date-label">Event Label</Label>
                <Input
                  id="new-date-label"
                  placeholder="e.g. Final Exam Week"
                  value={newImportantDate.label}
                  onChange={(e) => setNewImportantDate({ ...newImportantDate, label: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-date-val">Date</Label>
                <Input
                  id="new-date-val"
                  type="date"
                  value={newImportantDate.date}
                  onChange={(e) => setNewImportantDate({ ...newImportantDate, date: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
              <Button variant="ghost" onClick={() => setActiveModal("none")} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={handleAddImportantDate} disabled={!newImportantDate.label.trim()} className="w-full sm:w-auto">
                Add date
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 5. Modal: Add Policy */}
        <Dialog open={activeModal === "policy"} onOpenChange={(open) => !open && setActiveModal("none")}>
          <DialogContent className="max-w-[92vw] rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add course policy</DialogTitle>
              <DialogDescription>
                Add attendance, late submission, or academic integrity rules.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1 py-2">
              <Label htmlFor="new-policy-text">Policy Details</Label>
              <Textarea
                id="new-policy-text"
                rows={3}
                placeholder="e.g. Late submissions drop 10% per day."
                value={newPolicy}
                onChange={(e) => setNewPolicy(e.target.value)}
              />
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
              <Button variant="ghost" onClick={() => setActiveModal("none")} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={handleAddPolicy} disabled={!newPolicy.trim()} className="w-full sm:w-auto">
                Add policy
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Duplicados */}
        <AlertDialog
          open={duplicates.length > 0}
          onOpenChange={(open) => {
            if (!open) setDuplicates([]);
          }}
        >
          <AlertDialogContent className="max-w-[90vw] rounded-xl sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>This course may already exist.</AlertDialogTitle>
              <AlertDialogDescription>
                You already have {duplicates.length === 1 ? "a course" : "courses"} that looks
                like this one. You can open the existing course instead, or continue and create
                a separate one.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
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
            <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <AlertDialogCancel className="mt-0 w-full sm:w-auto">Cancel</AlertDialogCancel>
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