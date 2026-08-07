import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, CalendarClock, FileText, Loader2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import {
  DeadlinePill,
  EmptyState,
  GradeBadge,
  PageHeader,
  ProgressBar,
  SectionCard,
  SectionHeading,
  formatDate,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useCourses } from "@/lib/use-courses";
import { computeGrades, daysUntil, toneFor } from "@/lib/grade-engine";


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
  const { data: courses = [], isLoading } = useCourses();



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
      <div className="space-y-10">
        <PageHeader
          eyebrow="Dashboard"
          title={`Welcome back, ${firstName}`}
          subtitle={
            courses.length === 0
              ? "Let's set up your first course."
              : `${courses.length} active ${courses.length === 1 ? "course" : "courses"} · ${upcoming.length} ${upcoming.length === 1 ? "deadline" : "deadlines"} ahead`
          }
          actions={
            <Button asChild>
              <Link to="/upload">
                <FileText className="size-4" />
                Add course
              </Link>
            </Button>
          }
        />

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : courses.length === 0 ? (
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
            {upcoming.length > 0 ? (
              <section className="border-t border-border pt-6">
                <SectionHeading
                  title="Upcoming across all courses"
                  hint="Sorted by how soon they're due"
                />
                <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
                  {upcoming.map(({ course, assignment }) => (
                    <div
                      key={assignment.id}
                      className="w-[224px] shrink-0 snap-start rounded-xl border border-border bg-card px-4 py-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {course.code}
                        </span>
                        <DeadlinePill dueDate={assignment.dueDate!} />
                      </div>
                      <p className="mt-2.5 line-clamp-2 text-sm font-medium leading-snug">
                        {assignment.name}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClock className="size-3.5" />
                        {formatDate(assignment.dueDate)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="border-t border-border pt-6">
              <SectionHeading title="Your courses" hint="Current standing at a glance" />
              <div className="grid gap-5 sm:grid-cols-2">
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
                      className="focus-ring card-surface group p-6 transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            {course.code}
                          </p>
                          <h3 className="mt-1.5 truncate font-display text-base font-semibold tracking-tight">
                            {course.name}
                          </h3>
                          {course.professor ? (
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {course.professor}
                            </p>
                          ) : null}
                        </div>
                        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                      </div>

                      <div className="mt-6 flex items-end justify-between gap-4">
                        <div>
                          <p className="numeric font-display text-[34px] font-semibold leading-none tracking-tight">
                            {snapshot.currentGrade?.toFixed(1) ?? "—"}
                            <span className="ml-0.5 text-lg font-medium opacity-40">%</span>
                          </p>
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Current grade
                          </p>
                        </div>
                        <GradeBadge
                          score={snapshot.currentGrade}
                          scale={course.scale}
                          tone={tone}
                          className="mb-1"
                        />
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground">
                        Projected {snapshot.projectedGrade.toFixed(1)}% · target{" "}
                        {course.targetGrade}%
                      </p>

                      <div className="mt-6 space-y-2 border-t border-border pt-4">
                        <ProgressBar value={snapshot.completion} tone={tone} />
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span className="numeric shrink-0">
                            {Math.round(snapshot.completion * 100)}% graded

                          </span>
                          {next ? (
                            <span className="truncate">
                              Next: {next.name} · {formatDate(next.dueDate)}
                            </span>
                          ) : (
                            <span>Nothing due</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}

                <Link
                  to="/upload"
                  className="focus-ring flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:bg-primary-soft/30 hover:text-primary"
                >
                  <FileText className="size-5" />
                  <span className="text-sm font-medium">Add another course</span>
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
