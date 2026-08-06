import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { BarChart3, LayoutDashboard, Lightbulb, ListChecks, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { GradeBadge } from "@/components/app/primitives";
import {
  AssignmentsPanel,
  ChatPanel,
  InsightsPanel,
  OverviewPanel,
  SimulatorPanel,
} from "@/components/app/workspace-panels";
import { computeGrades, toneFor } from "@/lib/grade-engine";
import { getCourse } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "assignments", label: "Assignments", icon: ListChecks },
  { id: "simulator", label: "Simulator", icon: BarChart3 },
  { id: "insights", label: "Insights", icon: Lightbulb },
  { id: "assistant", label: "Assistant", icon: MessageSquare },
] as const;

type TabId = (typeof TABS)[number]["id"];

export const Route = createFileRoute("/course/$courseId")({
  loader: ({ params }) => {
    const course = getCourse(params.courseId);
    if (!course) throw notFound();
    return { course };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.course.name ?? "Course";
    const code = loaderData?.course.code ?? "";
    return {
      meta: [
        { title: `${code} — ${name} | CoursePilot` },
        {
          name: "description",
          content: `Track grades, simulate outcomes, and ask questions about ${code} ${name} in one workspace.`,
        },
        { property: "og:title", content: `${code} — ${name} | CoursePilot` },
        {
          property: "og:description",
          content: `Your live workspace for ${code}: grades, deadlines, and an AI assistant.`,
        },
      ],
    };
  },
  component: Workspace,
});

function Workspace() {
  const { course } = Route.useLoaderData();
  const [tab, setTab] = useState<TabId>("overview");
  const snapshot = computeGrades(course);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {course.code} · {course.semester}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-[26px]">
              {course.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{course.professor}</p>
          </div>
          <GradeBadge
            score={snapshot.currentGrade}
            scale={course.scale}
            tone={toneFor(snapshot.currentGrade, course.targetGrade)}
            className="px-3 py-1.5 text-sm"
          />
        </div>

        <div className="-mx-4 border-b border-border px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={cn(
                  "focus-ring -mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  tab === id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "overview" ? <OverviewPanel course={course} /> : null}
        {tab === "assignments" ? <AssignmentsPanel course={course} /> : null}
        {tab === "simulator" ? <SimulatorPanel course={course} /> : null}
        {tab === "insights" ? <InsightsPanel course={course} /> : null}
        {tab === "assistant" ? <ChatPanel course={course} /> : null}
      </div>
    </AppShell>
  );
}
