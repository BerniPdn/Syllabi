import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, CalendarClock, FileText, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import {
  DeadlinePill,
  EmptyState,
  GradeBadge,
  ProgressBar,
  SectionCard,
  SectionHeading,
  formatDate,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { computeGrades, daysUntil, toneFor } from "@/lib/grade-engine";
import { MOCK_COURSES } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CoursePilot" },
      {
        name: "description",
        content:
          "See every course's current grade, projected grade, and next deadline in one calm dashboard.",
      },
      { property: "og:title", content: "Dashboard — CoursePilot" },
      {
        property: "og:description",
        content: "Every course's grade and next deadline, in one place.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const [showEmpty, setShowEmpty] = useState(false);
  const courses = showEmpty ? [] : MOCK_COURSES;

  const firstName =
    ((user?.user_metadata?.["full_name"] as string | undefined) ?? user?.email ?? "there")
      .split(/[\s@]/)[0] ?? "there";

  const upcoming = courses
    .flatMap((course) =>
      course.assignments
        .filter((a) => a.score === null && a.dueDate)
        .map((a) => ({ course, assignment: a, days: daysUntil(a.dueDate!) })),
    )
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {courses.length === 0
                ? "Let's set up your first course."
                : `${courses.length} active courses · ${upcoming.length} deadlines ahead`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmpty((value) => !value)}
              className="focus-ring rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {showEmpty ? "Show sample data" : "Preview empty state"}
            </button>
            <Button asChild size="sm">
              <Link to="/upload">
                <FileText className="size-4" />
                Add course
              </Link>
            </Button>
          </div>
        </div>

        {courses.length === 0 ? (
          <SectionCard className="p-0">
            <EmptyState
              icon={<Sparkles className="size-5" />}
              title="Add your first course"
              body="CoursePilot reads your syllabus and builds a live workspace — grade weights, deadlines, and policies included. It takes about a minute."
              action={
                <Button asChild size="lg">
                  <Link to="/upload">
                    <FileText className="size-4" />
                    Add first course
                  </Link>
                </Button>
              }
            />
          </SectionCard>
        ) : (

          <>
            <SectionCard>
              <SectionHeading
                title="Upcoming across all courses"
                hint="Sorted by how soon they're due"
              />
              <div className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1">
                {upcoming.map(({ course, assignment }) => (
                  <div
                    key={assignment.id}
                    className="w-[220px] shrink-0 snap-start rounded-xl border border-border bg-card p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {course.code}
                      </span>
                      <DeadlinePill dueDate={assignment.dueDate!} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug">
                      {assignment.name}
                    </p>
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="size-3" />
                      {formatDate(assignment.dueDate)}
                    </p>
                  </div>
                ))}
              </div>

            </SectionCard>

            <div className="grid gap-4 sm:grid-cols-2">
              {courses.map((course) => {
                const snapshot = computeGrades(course);
                const tone = toneFor(snapshot.currentGrade, course.targetGrade);
                const next = course.assignments
                  .filter((a) => a.score === null && a.dueDate)
                  .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
                  .at(0);

                return (
                  <Link
                    key={course.id}
                    to="/course/$courseId"
                    params={{ courseId: course.id }}
                    className="focus-ring card-surface group p-5 transition-all hover:-translate-y-0.5 hover:shadow-elevated"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {course.code}
                        </p>
                        <h3 className="mt-1 truncate font-display text-[15px] font-semibold">
                          {course.name}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {course.professor}
                        </p>
                      </div>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="numeric font-display text-3xl font-semibold">
                          {snapshot.currentGrade?.toFixed(1) ?? "—"}
                          <span className="ml-0.5 text-base opacity-40">%</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Projected {snapshot.projectedGrade.toFixed(1)}% · target{" "}
                          {course.targetGrade}%
                        </p>
                      </div>
                      <GradeBadge score={snapshot.currentGrade} scale={course.scale} tone={tone} />
                    </div>

                    <div className="mt-4 space-y-2">
                      <ProgressBar value={snapshot.completion} tone={tone} />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{Math.round(snapshot.completion * 100)}% graded</span>
                        {next ? (
                          <span className="truncate pl-2">
                            Next: {formatDate(next.dueDate)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })}

              <Link
                to="/upload"
                className="focus-ring flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                <FileText className="size-5" />
                <span className="text-sm font-medium">Add another course</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
