import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Info,
  Lightbulb,
  RotateCcw,
  Send,
  TriangleAlert,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
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
import { Logo } from "@/components/brand/logo";
import { clampScore, computeGrades, letterFor, simulate, toneFor } from "@/lib/grade-engine";
import { MOCK_CHATS, MOCK_INSIGHTS, MOCK_REPLY, QUICK_ACTIONS } from "@/lib/mock-data";
import type { ChatMessage, Course } from "@/lib/types";
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

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard>
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
                <div key={category.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{category.name}</span>
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

        <div className="space-y-4">
          <SectionCard>
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
                    className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{assignment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(assignment.dueDate)}
                      </p>
                    </div>
                    <DeadlinePill dueDate={assignment.dueDate!} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <SectionHeading title="Course policies" hint="Context only — never used in the math" />
            <ul className="space-y-2">
              {course.policies.slice(0, 3).map((policy) => (
                <li key={policy} className="flex gap-2.5 text-sm text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>{policy}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Assignments -------------------------------- */

export function AssignmentsPanel({ course }: { course: Course }) {
  const [scores, setScores] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "graded" | "ungraded">("all");

  const overrides = useMemo(() => {
    const parsed: Record<string, number | null> = {};
    for (const [id, value] of Object.entries(scores)) {
      parsed[id] = value === "" ? null : clampScore(Number(value));
    }
    return parsed;
  }, [scores]);

  const snapshot = computeGrades(course, overrides);
  const items = snapshot.items.filter((item) =>
    filter === "all" ? true : filter === "graded" ? item.score !== null : item.score === null,
  );

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
                <div key={item.assignment.id} className="flex items-center gap-3 py-3">
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
                      value={
                        scores[item.assignment.id] ??
                        (item.assignment.score === null ? "" : String(item.assignment.score))
                      }
                      onChange={(event) =>
                        setScores({ ...scores, [item.assignment.id]: event.target.value })
                      }
                      className="numeric h-8 w-16 text-right"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
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

export function InsightsPanel({ course }: { course: Course }) {
  const [loading, setLoading] = useState(false);
  const insights = MOCK_INSIGHTS[course.id] ?? [];

  const toneStyles = {
    positive: "border-l-success bg-success-soft/40",
    neutral: "border-l-primary bg-primary-soft/40",
    attention: "border-l-warning bg-warning-soft/40",
  } as const;

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
              onClick={() => {
                setLoading(true);
                window.setTimeout(() => setLoading(false), 1600);
              }}
            >
              Regenerate
            </Button>
          }
        />

        {loading ? (
          <div className="space-y-3 py-2">
            <Shimmer className="text-sm font-medium">Reading your latest grades…</Shimmer>
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <EmptyState
            icon={<Lightbulb className="size-5" />}
            title="No insights yet"
            body="Enter a few scores and CoursePilot will explain where you stand."
          />
        ) : (
          <div className="space-y-2.5">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className={cn("rounded-xl border-l-2 px-4 py-3.5", toneStyles[insight.tone])}
              >
                <MessageResponse className="text-sm leading-relaxed">
                  {insight.body}
                </MessageResponse>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ------------------------------------ Chat ----------------------------------- */

export function ChatPanel({ course }: { course: Course }) {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHATS[course.id] ?? []);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"ready" | "submitted">("ready");

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || status === "submitted") return;

    setMessages((current) => [
      ...current,
      { id: `u-${Date.now()}`, role: "user", content: trimmed },
    ]);
    setInput("");
    setStatus("submitted");

    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        { id: `a-${Date.now()}`, role: "assistant", content: MOCK_REPLY },
      ]);
      setStatus("ready");
    }, 1400);
  };

  return (
    <SectionCard className="flex h-[min(70vh,640px)] flex-col p-0">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        <Logo size={20} withWordmark={false} />
        <div>
          <p className="text-sm font-medium">Course assistant</p>
          <p className="text-xs text-muted-foreground">
            Knows {course.code}'s weights, deadlines, and policies
          </p>
        </div>
      </div>

      <Conversation className="flex-1">
        <ConversationContent className="px-5 py-5">
          {messages.length === 0 ? (
            <EmptyState
              icon={<Logo size={20} withWordmark={false} />}
              title={`Ask anything about ${course.code}`}
              body="Grades, deadlines, policies, or what you need on the final — answers come from your own course data."
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  <MessageResponse>{message.content}</MessageResponse>
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" ? (
            <Shimmer className="text-sm font-medium">Checking your course data…</Shimmer>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border px-5 py-4">
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => send(action)}
              className="focus-ring shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {action}
            </button>
          ))}
        </div>

        <PromptInput
          onSubmit={(_message, event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <PromptInputTextarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={`Ask about ${course.code}…`}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit
              status={status === "submitted" ? "submitted" : undefined}
              disabled={!input.trim() || status === "submitted"}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </SectionCard>
  );
}

export const PANEL_ICONS = { ArrowRight, Send };
