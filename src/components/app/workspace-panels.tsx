import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Crosshair,
  Info,
  Lightbulb,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";

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
  WeightWarning,
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
import {
  CATEGORY_LABELS,
  CATEGORY_QUESTIONS,
  INSIGHT_CATEGORIES,
  buildInsightFacts,
  hasInsightData,
  insightsSignature,
} from "@/lib/insights";
import type { CourseInsight, InsightCategory } from "@/lib/insights";
import { fetchStoredInsights, saveStoredInsights } from "@/lib/insights-store";
import { generateInsights } from "@/lib/insights.functions";
import type { Course } from "@/lib/types";

import { cn } from "@/lib/utils";

/* ---------------------------------- Overview --------------------------------- */

export function OverviewPanel({ course }: { course: Course }) {
  const snapshot = computeGrades(course);
  const next = course.assignments
    .filter((a) => a.score === null && a.dueDate)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .slice(0, 3);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Métricas Principales (Máximo 2 columnas) */}
      <SectionCard className="border-border/80 shadow-xs p-3.5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Current Grade destacado con ProgressRing al lado */}
          <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-muted/30 p-4 flex-1">
            <div className="flex-1">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Current Grade
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-display text-3xl sm:text-4xl font-extrabold text-foreground">
                  {snapshot.currentGrade?.toFixed(1) ?? "—"}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {snapshot.currentGrade === null ? "Nothing graded yet" : `Scale: ${letterFor(snapshot.currentGrade, course.scale)}`}
              </p>
              {!snapshot.weightsValid ? (
                <WeightWarning totalWeight={snapshot.totalWeight} />
              ) : null}
            </div>
            <div className="shrink-0">
              <ProgressRing value={snapshot.completion} label="graded" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-col sm:w-[220px]">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <GradeStat
                label="Target"
                value={String(course.targetGrade)}
                suffix="%"
                sub={`Scale: ${letterFor(course.targetGrade, course.scale)}`}
              />
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <GradeStat
                label="Needed on Rest"
                value={
                  snapshot.neededOnRemaining === null
                    ? "—"
                    : snapshot.neededOnRemaining <= 0
                      ? "0.0"
                      : snapshot.neededOnRemaining.toFixed(1)
                }
                suffix="%"
                sub={
                  snapshot.neededOnRemaining === null
                    ? "Avg remaining"
                    : snapshot.neededOnRemaining <= 0
                      ? "Target already met"
                      : snapshot.neededOnRemaining > 100
                        ? "Out of reach"
                        : "Avg remaining"
                }
                tone={
                  snapshot.neededOnRemaining !== null && snapshot.neededOnRemaining <= 0
                    ? "positive"
                    : snapshot.neededOnRemaining !== null && snapshot.neededOnRemaining > 100
                      ? "attention"
                      : undefined
                }
              />
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <SectionCard className="min-w-0 border-border/80 shadow-xs p-3.5 sm:p-6">
          <SectionHeading title="Category Breakdown" hint="Weight and performance per category" />
          <div className="mt-3.5 space-y-2.5 sm:space-y-3">
            {course.categories.map((category) => {
              const items = snapshot.items.filter((item) => item.category.id === category.id);
              const graded = items.filter((item) => item.score !== null);
              const average =
                graded.length > 0
                  ? graded.reduce((sum, item) => sum + item.score!, 0) / graded.length
                  : null;

              return (
                <div
                  key={category.id}
                  className="rounded-xl border border-border/60 bg-card p-3 sm:p-3.5 transition-all"
                >
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <span className="font-display font-bold text-foreground truncate">{category.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="numeric text-[11px] sm:text-xs font-medium text-muted-foreground">
                        {category.weight}% weight
                      </span>
                      <GradeBadge
                        score={average === null ? null : Math.round(average * 10) / 10}
                        scale={course.scale}
                        tone={toneFor(average, course.targetGrade)}
                      />
                    </div>
                  </div>
                  <ProgressBar
                    value={graded.length / Math.max(1, items.length)}
                    tone={toneFor(average, course.targetGrade)}
                  />
                  <div className="mt-1.5 flex justify-between text-[11px] font-medium text-muted-foreground">
                    <span>{graded.length} of {items.length} completed</span>
                    <span>{average !== null ? `${average.toFixed(1)}% avg` : "No scores"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <div className="min-w-0 space-y-4 sm:space-y-6">
          <SectionCard className="min-w-0 border-border/80 shadow-xs p-3.5 sm:p-6">
            <SectionHeading title="Next Up" hint="Ungraded work, soonest first" />
            {next.length === 0 ? (
              <p className="py-5 text-center text-xs sm:text-sm text-muted-foreground">
                No upcoming assignments with due dates.
              </p>
            ) : (
              <div className="mt-3.5 space-y-2">
                {next.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 sm:p-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-bold text-foreground">
                        {assignment.name}
                      </p>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                        {formatDate(assignment.dueDate)}
                      </p>
                    </div>
                    <DeadlinePill dueDate={assignment.dueDate!} className="shrink-0 text-[10px] sm:text-xs" />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard className="min-w-0 border-border/80 shadow-xs p-3.5 sm:p-6">
            <SectionHeading title="Course Policies" hint="Extracted from your syllabus" />
            <div className="mt-3.5">
              <CoursePoliciesList policies={course.policies} />
            </div>
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
      <p className="py-3 text-center text-xs sm:text-sm text-muted-foreground">
        No policies extracted.
      </p>
    );
  }

  const hasMore = policies.length > 3;
  const visible = expanded ? policies : policies.slice(0, 3);

  return (
    <div>
      <ul className="space-y-2">
        {visible.map((policy) => (
          <li
            key={policy}
            className="flex gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground"
          >
            <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span className="leading-relaxed">{policy}</span>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2.5 w-full gap-1 text-xs text-muted-foreground h-8"
          onClick={() => setExpanded((prev) => !prev)}
        >
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
      ) : null}
    </div>
  );
}

/* -------------------------------- Grade Tracker -------------------------------- */

export function AssignmentsPanel({
  course,
  onSaveScore,
  onDeleteScore,
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
      else next[assignmentId] = "Enter 0-100.";
      return next;
    });
  };

  const commit = (assignmentId: string, saved: number | null) => {
    const raw = drafts[assignmentId];
    if (raw === undefined) return;
    const trimmed = raw.trim();

    if (!isValidScoreInput(trimmed)) {
      setErrors((prev) => ({ ...prev, [assignmentId]: "Enter 0-100." }));
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
    <div className="space-y-4 sm:space-y-6">
      <SectionCard className="border-border/80 shadow-xs p-3.5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-4">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5 sm:p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Avg</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-display text-xl sm:text-2xl font-extrabold text-foreground">{snapshot.currentGrade?.toFixed(1) ?? "—"}</span>
                <span className="text-xs font-semibold text-muted-foreground">%</span>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5 sm:p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Graded Weight</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-display text-xl sm:text-2xl font-extrabold text-foreground">{snapshot.gradedWeight}</span>
                <span className="text-xs font-semibold text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          <div className="flex w-full sm:w-auto rounded-xl bg-muted/70 p-1 text-xs justify-between">
            {(["all", "graded", "ungraded"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "flex-1 sm:flex-initial rounded-lg px-2.5 py-1.5 font-bold capitalize transition-all text-center text-[11px] sm:text-xs",
                  filter === value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        {!snapshot.weightsValid ? (
          <WeightWarning totalWeight={snapshot.totalWeight} />
        ) : null}
      </SectionCard>

      {course.categories.map((category) => {
        const rows = items.filter((item) => item.category.id === category.id);
        if (rows.length === 0) return null;

        const allCatItems = snapshot.items.filter((item) => item.category.id === category.id);
        const gradedCount = allCatItems.filter((i) => i.score !== null).length;

        return (
          <SectionCard key={category.id} className="border-border/80 shadow-xs p-3.5 sm:p-6">
            {/* Título + weight en la fila superior; tracked count en su propia línea debajo */}
            <div className="border-b border-border/50 pb-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 truncate font-display text-base font-bold text-foreground">{category.name}</h3>
                <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{category.weight}% weight</span>
              </div>
              <p className="mt-1.5 text-xs font-semibold text-muted-foreground">{gradedCount} of {allCatItems.length} tracked</p>
            </div>

            <div className="mt-3 space-y-2.5">
              {rows.map((item) => {
                const isGraded = item.assignment.score !== null;
                const draftVal = drafts[item.assignment.id];
                const currentVal = draftVal ?? (isGraded ? String(item.assignment.score) : "");
                const error = errors[item.assignment.id];

                return (
                  <div
                    key={item.assignment.id}
                    className="rounded-xl border border-border/60 bg-card p-3.5"
                  >
                    {/* Bloque superior: nombre a la izquierda; weight + deadline pill apilados a la derecha, mismo margen que el header de categoría */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold leading-snug text-foreground">
                          {item.assignment.name}
                        </p>
                        {!item.assignment.dueDate ? (
                          <p className="mt-1.5 text-[11px] text-muted-foreground">No due date</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                          {item.effectiveWeight.toFixed(1)}% total
                        </span>
                      </div>
                    </div>

                    {/* Bloque inferior: score, separado por un divisor */}
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
                      <span className="text-xs font-semibold text-muted-foreground">Score</span>
                      <div className="flex items-center gap-1">
                        <Input
                          inputMode="decimal"
                          placeholder="0-100"
                          value={currentVal}
                          onChange={(event) => handleChange(item.assignment.id, event.target.value)}
                          onBlur={() => commit(item.assignment.id, item.assignment.score)}
                          aria-invalid={Boolean(error)}
                          className={cn(
                            "numeric h-10 w-20 text-center font-display text-sm font-extrabold",
                            error
                              ? "border-destructive bg-destructive/5 text-destructive focus-visible:ring-destructive/40"
                              : isGraded
                                ? "border-primary/40 bg-primary/5 text-primary"
                                : "bg-background/80 text-foreground",
                          )}
                        />
                        <span className="text-xs font-bold text-muted-foreground">%</span>
                      </div>
                    </div>

                    {/* Feedback de error: input inválido no entra al cálculo del promedio hasta corregirse */}
                    {error ? (
                      <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-destructive">
                        <TriangleAlert className="size-3 shrink-0" />
                        {error} Not counted in your grade until fixed.
                      </p>
                    ) : null}
                  </div>
                );
              })}
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

  // Determinar la nota por defecto basada en lo que se necesita en el resto de las entregas
  const defaultScore = useMemo(() => {
    if (base.neededOnRemaining === null) return course.targetGrade;
    // Limitamos el valor inicial entre 0 y 100 para los sliders
    return Math.max(0, Math.min(100, Math.round(base.neededOnRemaining)));
  }, [base.neededOnRemaining, course.targetGrade]);

  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(remaining.map((item) => [item.assignment.id, defaultScore])),
  );

  const simulated = simulate(course, values);
  const hitsTarget = simulated.projectedGrade >= course.targetGrade;

  const setAll = (value: number) =>
    setValues(Object.fromEntries(remaining.map((item) => [item.assignment.id, value])));

  if (remaining.length === 0) {
    return (
      <SectionCard className="p-0 border-dashed">
        <EmptyState
          title="Nothing left to simulate"
          body="Every assignment in this course already has a recorded score."
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionCard className="border-border/80 shadow-xs p-3.5 sm:p-6">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Simulated Final Grade
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-bold shadow-2xs shrink-0",
                hitsTarget
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-red-950/20 text-red-700/80 dark:text-red-400/80 border border-red-900/20",
              )}
            >
              {hitsTarget ? <Check className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
              {hitsTarget ? "On track" : "Below target"}
            </span>
          </div>

          {hitsTarget ? (
            <GradeStat
              label=""
              value={simulated.projectedGrade.toFixed(1)}
              suffix="%"
              sub={`Scale: ${letterFor(simulated.projectedGrade, course.scale)}`}
              emphasis
              tone="positive"
            />
          ) : (
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-3xl sm:text-4xl font-extrabold text-red-700/80 dark:text-red-400/80">
                  {simulated.projectedGrade.toFixed(1)}
                </span>
                <span className="text-sm sm:text-base font-semibold text-red-700/60 dark:text-red-400/60">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Scale: <span className="font-semibold text-foreground">{letterFor(simulated.projectedGrade, course.scale)}</span>
              </p>
            </div>
          )}
        </div>

        <div className="mt-3.5 sm:mt-4 flex flex-col sm:flex-row sm:items-center gap-2 border-t border-border/50 pt-3">
          <span className="text-xs font-semibold text-muted-foreground w-full sm:w-auto">Quick set remaining to:</span>
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {[70, 80, 90, 100].map((value) => (
              <Button key={value} variant="outline" size="sm" className="h-7 text-xs font-medium flex-1 sm:flex-none px-2.5" onClick={() => setAll(value)}>
                {value}%
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground px-2"
              onClick={() => setAll(defaultScore)}
            >
              <RotateCcw className="size-3" />
              Reset
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard className="border-border/80 shadow-xs p-3.5 sm:p-6">
        <SectionHeading
          title="What-if Simulation"
          hint="Drag the sliders to project your final course grade in real time"
        />

        <div className="mt-3.5 space-y-2.5">
          {remaining.map((item) => {
            const value = values[item.assignment.id] ?? defaultScore;
            const share = base.impact[item.assignment.id] ?? 0;

            return (
              <div
                key={item.assignment.id}
                className="group rounded-xl border border-border/60 bg-card p-3 sm:p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="truncate text-xs sm:text-sm font-bold text-foreground">
                        {item.assignment.name}
                      </p>
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground uppercase">
                        {item.category.name}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Impact: <span className="font-semibold text-foreground">{Math.round(share * 100)}%</span> of rest
                    </p>
                  </div>

                  <div className="flex shrink-0 items-baseline gap-0.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-0.5 font-display text-sm sm:text-base font-bold text-foreground">
                    <span>{value}</span>
                    <span className="text-[10px] sm:text-xs font-semibold opacity-70">%</span>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <Slider
                    value={[value]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([next]) =>
                      setValues({ ...values, [item.assignment.id]: next ?? value })
                    }
                    className="py-1"
                  />
                  <div className="flex justify-between text-[9px] font-medium text-muted-foreground/60 px-0.5">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

/* ---------------------------------- Insights --------------------------------- */

// Estilos tokenizados al theme: cada categoría tiene su propio ícono y acento
// (leverage = primary, trajectory = neutral/positivo, risk = warning, action = primary sólido)
// para que las cuatro preguntas se distingan de un vistazo sin leer el texto.
const CATEGORY_STYLES: Record<
  InsightCategory,
  { icon: typeof Info; card: string; iconWrap: string; label: string }
> = {
  leverage: {
    icon: Crosshair,
    card: "border-border/60 bg-card",
    iconWrap: "bg-primary/10 text-primary",
    label: "text-primary",
  },
  trajectory: {
    icon: TrendingUp,
    card: "border-border/60 bg-card",
    iconWrap: "bg-muted text-muted-foreground",
    label: "text-muted-foreground",
  },
  risk: {
    icon: ShieldAlert,
    card: "border-warning/30 bg-warning-soft",
    iconWrap: "bg-warning/15 text-warning",
    label: "text-warning",
  },
  action: {
    icon: ArrowRight,
    card: "border-primary/30 bg-primary-soft",
    iconWrap: "bg-primary/15 text-primary",
    label: "text-primary",
  },
};

type WorkspaceTab = "overview" | "assignments" | "simulator" | "insights";

function InsightCard({
  insight,
}: {
  insight: CourseInsight;
  facts: ReturnType<typeof buildInsightFacts>;
}) {
  const style = CATEGORY_STYLES[insight.category];
  const Icon = style.icon;

  return (
    <div
      className={cn(
        "rounded-xl border p-3 sm:p-3.5 shadow-2xs transition-all hover:shadow-xs",
        style.card,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            style.iconWrap,
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[9px] sm:text-[10px] font-bold uppercase tracking-wider",
              style.label,
            )}
          >
            {CATEGORY_LABELS[insight.category]}
          </p>
          {insight.title ? (
            <p className="mt-0.5 text-xs sm:text-sm font-bold text-foreground">{insight.title}</p>
          ) : null}
          <MessageResponse className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {insight.body}
          </MessageResponse>
        </div>
      </div>
    </div>
  );
}

export function InsightsPanel({
  course,
}: {
  course: Course;
  onNavigate?: ((tab: WorkspaceTab) => void) | undefined;
}) {
  const generate = useServerFn(generateInsights);

  const facts = useMemo(() => buildInsightFacts(course), [course]);
  const enabled = hasInsightData(facts);
  const signature = useMemo(() => insightsSignature(facts), [facts]);
  const forceRef = useRef(false);

  const query = useQuery({
    queryKey: ["course-insights", course.id, signature],
    queryFn: async () => {
      const force = forceRef.current;
      forceRef.current = false;
      const stored = await fetchStoredInsights(course.id);

      if (!force && stored && stored.signature === signature && stored.insights.length > 0) {
        return stored.insights;
      }

      try {
        const fresh = await generate({ data: { facts } });
        if (fresh.length > 0) await saveStoredInsights(course.id, signature, fresh);
        return fresh;
      } catch (error) {
        if (stored && stored.insights.length > 0) return stored.insights;
        throw error;
      }
    },
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const insights = query.data ?? [];
  const present = new Set(insights.map((insight) => insight.category));
  const missing = INSIGHT_CATEGORIES.filter((category) => !present.has(category));

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionCard className="border-border/80 shadow-xs p-3.5 sm:p-6">
        <SectionHeading
          title="Course Intelligence"
          hint="A few key Insights"
          action={
            <Button
              variant="outline"
              size="sm"
              disabled={!enabled || query.isFetching}
              onClick={() => {
                forceRef.current = true;
                query.refetch();
              }}
              className="gap-1.5 h-8 text-xs"
            >
              <Sparkles className={cn("size-3.5 text-primary", query.isFetching && "animate-pulse")} />
              Regenerate
            </Button>
          }
        />

        {!enabled ? (
          <EmptyState
            icon={<Lightbulb className="size-5" />}
            title="No insights yet"
            body="Add your grading components or assignments to unlock AI insights."
          />
        ) : query.isPending || query.isFetching ? (
          <div className="space-y-3 py-3">
            <Shimmer className="text-xs font-medium">Analyzing your course data…</Shimmer>
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl bg-muted/60" />
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
            icon={<TriangleAlert className="size-5" />}
            title="Insights aren't available right now"
            body="We have your course data, but couldn't generate insights this time. Try regenerating."
            action={
              <Button
                variant="outline"
                size="sm"
                disabled={query.isFetching}
                onClick={() => {
                  forceRef.current = true;
                  query.refetch();
                }}
              >
                Regenerate
              </Button>
            }
          />
        ) : (
          <div className="mt-3 space-y-2.5">
            {insights.map((insight) => (
              <InsightCard
                key={insight.category}
                insight={insight}
                facts={facts}
              />
            ))}

            {missing.map((category) => {
              const style = CATEGORY_STYLES[category];
              return (
                <div
                  key={category}
                  className="flex items-start gap-3 rounded-xl border border-dashed border-border/70 p-3 sm:p-3.5"
                >
                  <div
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground/70"
                  >
                    <style.icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      {CATEGORY_LABELS[category]}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Needs more graded work to answer “{CATEGORY_QUESTIONS[category]}”
                    </p>
                  </div>
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