import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Info,
  Lightbulb,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  DeadlinePill,
  EmptyState,
  GradeBadge,
  GradeStat,
  ProgressBar,
  ProgressRing,
  SectionCard,
  SectionHeading,
  formatDate,
} from "@/components/app/primitives";
import {
  clampScore,
  computeGrades,
  isValidScoreInput,
  letterFor,
  simulate,
  toneFor,
} from "@/lib/grade-engine";
import { CATEGORY_LABELS, buildInsightFacts, hasInsightData } from "@/lib/insights";
import { generateInsights } from "@/lib/insights.functions";
import type { Course } from "@/lib/types";
import { cn } from "@/lib/utils";


/* ---------------------------------- Overview --------------------------------- */

export function OverviewPanel({ course }: { course: Course }) {
  const snapshot = computeGrades(course);
  const tone = toneFor(snapshot.currentGrade, course.targetGrade);
  const next = course.assignments
    .filter((a) => a.score === null && a.dueDate)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="grid flex-1 grid-cols-2 gap-6 sm:grid-cols-4">
            <GradeStat
              label="Current"
              value={snapshot.currentGrade?.toFixed(1) ?? "—"}
              suffix="%"
              sub={
                snapshot.currentGrade === null
                  ? "Nothing graded yet"
                  : letterFor(snapshot.currentGrade, course.scale)
              }
              emphasis
              tone={tone}
            />
            <GradeStat
              label="Projected"
              value={snapshot.projectedGrade.toFixed(1)}
              suffix="%"
              sub="If you hold this pace"
            />
            <GradeStat
              label="Target"
              value={String(course.targetGrade)}
              suffix="%"
              sub={letterFor(course.targetGrade, course.scale)}
            />
            <GradeStat
              label="Needed on rest"
              value={snapshot.neededOnRemaining?.toFixed(1) ?? "—"}
              suffix="%"
              sub={
                snapshot.neededOnRemaining !== null && snapshot.neededOnRemaining > 100
                  ? "Above 100 — target out of reach"
                  : "Average across ungraded work"
              }
              tone={
                snapshot.neededOnRemaining !== null && snapshot.neededOnRemaining > 100
                  ? "attention"
                  : undefined
              }
            />
          </div>
          <ProgressRing value={snapshot.completion} label="graded" />
        </div>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard className="min-w-0">
          <SectionHeading title="Category breakdown" hint="Weight and performance per category" />
          <div className="space-y-3.5">
            {course.categories.map((category) => {
              const items = snapshot.items.filter((item) => item.category.id === category.id);
              const graded = items.filter((item) => item.score !== null);
              const average =
                graded.length > 0
                  ? graded.reduce((sum, item) => sum + item.score!, 0) / graded.length
                  : null;

              return (
                <div key={category.id} className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="min-w-0 truncate font-medium">{category.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="numeric text-xs text-muted-foreground">
                        {category.weight}% of grade
                      </span>
                      <GradeBadge
                        score={average === null ? null : Math.round(average * 10) / 10}
                        scale={course.scale}
                        tone={toneFor(average, course.targetGrade)}
                      />
                    </span>
                  </div>
                  <ProgressBar
                    value={graded.length / Math.max(1, items.length)}
                    tone={toneFor(average, course.targetGrade)}
                  />
                </div>
              );
            })}
          </div>
        </SectionCard>

        <div className="min-w-0 space-y-4">
          <SectionCard className="min-w-0">
            <SectionHeading title="Next up" hint="Ungraded work, soonest first" />
            {next.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Nothing left with a due date. Nice.
              </p>
            ) : (
              <div className="space-y-2.5">
                {next.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex flex-col gap-2 rounded-xl border border-border px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{assignment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(assignment.dueDate)}
                      </p>
                    </div>
                    <DeadlinePill
                      dueDate={assignment.dueDate!}
                      className="self-start sm:shrink-0"
                    />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard className="min-w-0">
            <SectionHeading title="Course policies" hint="Context only — never used in the math" />
            <CoursePoliciesList policies={course.policies} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Policies ---------------------------------- */

function CoursePoliciesList({ policies }: { policies: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (policies.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No policies were extracted from this syllabus.
      </p>
    );
  }

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleContent asChild>
        <ul className="space-y-2">
          {policies.map((policy) => (
            <li key={policy} className="flex gap-2.5 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>{policy}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
      {policies.length > 3 ? (
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="mt-2 gap-1.5">
            {expanded ? (
              <>
                Show fewer <ChevronDown className="size-3.5 rotate-180" />
              </>
            ) : (
              <>
                Show all {policies.length} policies <ChevronDown className="size-3.5" />
              </>
            )}
          </Button>
        </CollapsibleTrigger>
      ) : null}
    </Collapsible>
  );
}

/* -------------------------------- Assignments -------------------------------- */

export function AssignmentsPanel({
  course,
  onSaveScore,
  onDeleteScore,
  savingKey,
}: {
  course: Course;
  onSaveScore?: (assignmentId: string, score: number) => void;
  onDeleteScore?: (assignmentId: string) => void;
  savingKey?: string | null;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "graded" | "ungraded">("all");

  const overrides = useMemo(() => {
    const parsed: Record<string, number | null> = {};
    for (const [id, value] of Object.entries(drafts)) {
      if (!isValidScoreInput(value)) continue;
      parsed[id] = value.trim() === "" ? null : clampScore(Number(value.replace(",", ".")));
    }
    return parsed;
  }, [drafts]);

  const snapshot = computeGrades(course, overrides);
  const items = snapshot.items.filter((item) =>
    filter === "all" ? true : filter === "graded" ? item.score !== null : item.score === null,
  );

  const handleChange = (assignmentId: string, raw: string) => {
    setDrafts((prev) => ({ ...prev, [assignmentId]: raw }));
    setErrors((prev) => {
      const next = { ...prev };
      if (isValidScoreInput(raw)) delete next[assignmentId];
      else next[assignmentId] = "Enter a number between 0 and 100.";
      return next;
    });
  };

  const commit = (assignmentId: string, saved: number | null) => {
    const raw = drafts[assignmentId];
    if (raw === undefined) return;
    const trimmed = raw.trim();

    if (!isValidScoreInput(trimmed)) {
      setErrors((prev) => ({ ...prev, [assignmentId]: "Enter a number between 0 and 100." }));
      return;
    }

    if (trimmed === "") {
      if (saved !== null) onDeleteScore?.(assignmentId);
    } else {
      const value = clampScore(Number(trimmed.replace(",", ".")));
      if (value !== saved) onSaveScore?.(assignmentId, value);
    }

    setErrors((prev) => {
      const next = { ...prev };
      delete next[assignmentId];
      return next;
    });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[assignmentId];
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <SectionCard className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <GradeStat
            label="Current"
            value={snapshot.currentGrade?.toFixed(1) ?? "—"}
            suffix="%"
            tone={toneFor(snapshot.currentGrade, course.targetGrade)}
          />
          <GradeStat label="Graded weight" value={`${snapshot.gradedWeight}`} suffix="%" />
        </div>
        <div className="flex rounded-lg bg-muted p-0.5 text-xs">
          {(["all", "graded", "ungraded"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "focus-ring rounded-[6px] px-2.5 py-1.5 font-medium capitalize transition-colors",
                filter === value
                  ? "bg-card text-foreground shadow-subtle"
                  : "text-muted-foreground",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </SectionCard>

      {course.categories.map((category) => {
        const rows = items.filter((item) => item.category.id === category.id);
        if (rows.length === 0) return null;

        return (
          <SectionCard key={category.id}>
            <SectionHeading
              title={category.name}
              hint={`${category.weight}% of the final grade`}
            />
            <div className="divide-y divide-border">
              {rows.map((item) => (
                <div key={item.assignment.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.assignment.name}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(item.assignment.dueDate)}</span>
                        <span className="numeric">
                          {item.effectiveWeight.toFixed(1)}% of grade
                        </span>
                      </p>
                    </div>
                    {item.assignment.dueDate && item.score === null ? (
                      <DeadlinePill dueDate={item.assignment.dueDate} />
                    ) : null}
                    <div className="flex items-center gap-1.5">
                      <Input
                        inputMode="decimal"
                        placeholder="—"
                        aria-label={`Score for ${item.assignment.name}`}
                        aria-invalid={errors[item.assignment.id] ? true : undefined}
                        value={
                          drafts[item.assignment.id] ??
                          (item.assignment.score === null ? "" : String(item.assignment.score))
                        }
                        onChange={(event) => handleChange(item.assignment.id, event.target.value)}
                        onBlur={() => commit(item.assignment.id, item.assignment.score)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                        className={cn(
                          "numeric h-8 w-16 text-right",
                          errors[item.assignment.id] && "border-destructive",
                        )}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                      {item.assignment.score !== null && onDeleteScore ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          aria-label={`Delete grade for ${item.assignment.name}`}
                          disabled={savingKey === item.assignment.id}
                          onClick={() => {
                            setDrafts((prev) => {
                              const next = { ...prev };
                              delete next[item.assignment.id];
                              return next;
                            });
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next[item.assignment.id];
                              return next;
                            });
                            onDeleteScore(item.assignment.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {errors[item.assignment.id] ? (
                    <p role="alert" className="mt-1.5 text-right text-xs text-destructive">
                      {errors[item.assignment.id]}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </SectionCard>
        );
      })}
    </div>
  );

}

/* --------------------------------- Simulator --------------------------------- */

export function SimulatorPanel({ course }: { course: Course }) {
  const base = computeGrades(course);
  const remaining = base.remaining;

  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(remaining.map((item) => [item.assignment.id, course.targetGrade])),
  );

  const simulated = simulate(course, values);
  const delta = simulated.projectedGrade - base.projectedGrade;
  const hitsTarget = simulated.projectedGrade >= course.targetGrade;

  const setAll = (value: number) =>
    setValues(Object.fromEntries(remaining.map((item) => [item.assignment.id, value])));

  if (remaining.length === 0) {
    return (
      <SectionCard className="p-0">
        <EmptyState
          title="Nothing left to simulate"
          body="Every assignment in this course already has a score."
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            <GradeStat
              label="Simulated final"
              value={simulated.projectedGrade.toFixed(1)}
              suffix="%"
              sub={letterFor(simulated.projectedGrade, course.scale)}
              emphasis
              tone={hitsTarget ? "positive" : "attention"}
            />
            <GradeStat
              label="Change"
              value={`${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`}
              sub="vs. holding current pace"
            />
            <GradeStat
              label="Target"
              value={String(course.targetGrade)}
              suffix="%"
              sub={hitsTarget ? "Reached" : "Not yet reached"}
            />
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              hitsTarget ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
            )}
          >
            {hitsTarget ? <Check className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
            {hitsTarget ? "On track for your target" : "Below your target"}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Set all remaining to</span>
          {[70, 80, 90, 100].map((value) => (
            <Button key={value} variant="outline" size="sm" onClick={() => setAll(value)}>
              {value}%
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setAll(course.targetGrade)}
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading
          title="Remaining work"
          hint="Drag a score to see how it moves your final grade"
        />
        <div className="space-y-5">
          {remaining.map((item) => {
            const value = values[item.assignment.id] ?? course.targetGrade;
            const share = base.impact[item.assignment.id] ?? 0;

            return (
              <div key={item.assignment.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.assignment.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.category.name} ·{" "}
                      <span className="numeric">{Math.round(share * 100)}%</span> of what's left
                    </p>
                  </div>
                  <span className="numeric shrink-0 font-display text-sm font-semibold">
                    {value}%
                  </span>
                </div>
                <Slider
                  value={[value]}
                  min={0}
                  max={100}
                  step={1}
                  aria-label={`Simulated score for ${item.assignment.name}`}
                  onValueChange={([next]) =>
                    setValues({ ...values, [item.assignment.id]: next ?? value })
                  }
                  className="mt-3"
                />
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

/* ---------------------------------- Insights --------------------------------- */

/**
 * One consistent card system. Colour communicates meaning only:
 * info = neutral structure/facts, attention = risk or a rule to respect,
 * action = the single thing to do next.
 */
const INSIGHT_STYLES = {
  info: {
    card: "border-border bg-card",
    accent: "bg-muted-foreground/30",
    label: "text-muted-foreground",
  },
  attention: {
    card: "border-warning/30 bg-warning-soft/30",
    accent: "bg-warning",
    label: "text-warning",
  },
  action: {
    card: "border-primary/30 bg-primary-soft/30",
    accent: "bg-primary",
    label: "text-primary",
  },
} as const;

type InsightStyle = keyof typeof INSIGHT_STYLES;

function styleFor(insight: { category: string; tone: string }): InsightStyle {
  if (insight.category === "recommendation") return "action";
  if (insight.category === "policies") return "attention";
  return insight.tone === "attention" ? "attention" : "info";
}

export function InsightsPanel({ course }: { course: Course }) {
  const generate = useServerFn(generateInsights);

  const facts = useMemo(() => buildInsightFacts(course), [course]);
  const enabled = hasInsightData(facts);
  const signature = useMemo(() => insightsSignature(facts), [facts]);

  const query = useQuery({
    queryKey: ["course-insights", course.id, signature],
    queryFn: () => generate({ data: { facts } }),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const insights = query.data ?? [];


  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionHeading
          title="AI insights"
          hint="Written from your numbers — the math is always CoursePilot's"
          action={
            <Button
              variant="outline"
              size="sm"
              disabled={!enabled || query.isFetching}
              onClick={() => query.refetch()}
            >
              Regenerate
            </Button>
          }
        />

        {!enabled ? (
          <EmptyState
            icon={<Lightbulb className="size-5" />}
            title="No insights yet"
            body="Add your grading components, assignments, or a few scores and CoursePilot will explain where you stand."
          />
        ) : query.isPending || query.isFetching ? (
          <div className="space-y-3 py-2">
            <Shimmer className="text-sm font-medium">Reading your latest course data…</Shimmer>
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : query.isError ? (
          <EmptyState
            icon={<TriangleAlert className="size-5" />}
            title="Insights unavailable"
            body={
              query.error instanceof Error
                ? query.error.message
                : "We couldn't generate insights right now. Please try again."
            }
          />
        ) : insights.length === 0 ? (
          <EmptyState
            icon={<Lightbulb className="size-5" />}
            title="Not enough data yet"
            body="Enter a few scores or confirm your grading components and insights will appear here."
          />
        ) : (
          <div className="space-y-2">
            {insights.map((insight) => {
              const style = INSIGHT_STYLES[styleFor(insight)];
              return (
                <div
                  key={insight.category}
                  className={cn(
                    "relative overflow-hidden rounded-xl border px-4 py-3",
                    style.card,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("absolute inset-y-0 left-0 w-[3px]", style.accent)}
                  />
                  <p
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-[0.09em]",
                      style.label,
                    )}
                  >
                    {CATEGORY_LABELS[insight.category]}
                  </p>
                  {insight.title ? (
                    <p className="mt-1.5 text-[15px] font-semibold leading-snug tracking-tight">
                      {insight.title}
                    </p>
                  ) : null}
                  <MessageResponse className="mt-0.5 text-sm leading-snug text-muted-foreground">
                    {insight.body}
                  </MessageResponse>
                </div>
              );
            })}
          </div>
        )}

      </SectionCard>
    </div>
  );
}

export const PANEL_ICONS = { ArrowRight };

