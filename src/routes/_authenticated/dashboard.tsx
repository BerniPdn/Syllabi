import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import {
  DeadlinePill,
  EmptyState,
  GradeBadge,
  ProgressBar,
  SectionCard,
  formatDate,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useCourses, coursesQueryKey } from "@/lib/use-courses";
import { deleteCourse } from "@/lib/delete-course";
import { computeGrades, daysUntil, toneFor } from "@/lib/grade-engine";
import type { Course } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Syllabi" },
      {
        name: "description",
        content:
          "See every course's current grade, projected grade, and next deadline in one calm dashboard.",
      },
      { property: "og:title", content: "Dashboard — Syllabi" },
      {
        property: "og:description",
        content: "Every course's grade and next deadline, in one place.",
      },
    ],
  }),
  component: Dashboard,
});

function DashboardCard({ course }: { course: Course }) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteCourse(course.id),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["course-workspace", course.id] });
      queryClient.removeQueries({ queryKey: ["course-grades", course.id] });
      await queryClient.invalidateQueries({ queryKey: coursesQueryKey });
      toast.success("Course deleted.");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : "Could not delete this course."
      );
    },
  });

  const snapshot = computeGrades(course);
  const tone = toneFor(snapshot.currentGrade, course.targetGrade);
  const next = course.assignments
    .filter((a) => a.score === null && a.dueDate)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .at(0);

  return (
    <>
      <div className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
        <div>
          {/* Header del curso */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-primary">
                {course.code}
              </span>
              <h3 className="mt-0.5 truncate font-display text-base font-bold text-foreground transition-colors group-hover:text-primary">
                <Link
                  to="/course/$courseId"
                  params={{ courseId: course.id }}
                  className="after:absolute after:inset-0"
                >
                  {course.name}
                </Link>
              </h3>
              <p className="truncate text-xs text-muted-foreground">
                {course.professor || "No instructor specified"}
              </p>
            </div>

            {/* Menú de 3 puntos */}
            <div className="relative z-10 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Course options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem asChild>
                    <Link
                      to="/review/$courseId"
                      params={{ courseId: course.id }}
                    >
                      <Pencil className="mr-2 size-4" />
                      Edit course
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDeleteDialogOpen(true);
                    }}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete course
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Promedio y Escala */}
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Current Grade
              </p>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="font-display text-3xl font-extrabold tracking-tight text-foreground">
                  {snapshot.currentGrade?.toFixed(1) ?? "—"}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                  %
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Target:{" "}
                <span className="font-semibold text-foreground">
                  {course.targetGrade}%
                </span>
              </p>
            </div>

            <div className="origin-bottom-right transform scale-105">
              <GradeBadge
                score={snapshot.currentGrade}
                scale={course.scale}
                tone={tone}
              />
            </div>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-5 space-y-2">
          <ProgressBar value={snapshot.completion} tone={tone} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-medium">
              <CheckCircle2 className="size-3 text-primary" />
              {Math.round(snapshot.completion * 100)}% graded
            </span>
            {next ? (
              <span className="truncate pl-2 font-medium text-foreground/80">
                Next: {formatDate(next.dueDate)}
              </span>
            ) : (
              <span>All caught up</span>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {course.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the course and everything tied to it:
              its assignments, saved grades, and extracted syllabus data. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep course</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Delete course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Dashboard() {
  const { user } = Route.useRouteContext();
  const { data: courses = [], isLoading } = useCourses();

  const firstName =
    (
      ((user?.user_metadata?.["full_name"] as string | undefined) ??
        user?.email ??
        "there").split(/[\s@]/)[0] ?? "there"
    );

  const upcoming = courses
    .flatMap((course) =>
      course.assignments
        .filter((a) => a.score === null && a.dueDate)
        .map((a) => ({ course, assignment: a, days: daysUntil(a.dueDate!) }))
    )
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  return (
    <AppShell>
      <div className="max-w-full space-y-6 overflow-hidden pb-8">
        {/* Header con tipografía distintiva tipo editorial */}
        <div className="pt-2">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Welcome back,{" "}
            <span className="text-primary">
              {firstName}
            </span>
          </h1>
          <p className="mt-1 text-xs font-medium text-muted-foreground/80 sm:text-sm">
            All your academic priorities, in one space.
          </p>
        </div>

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="size-7 animate-spin text-primary" />
          </div>
        ) : courses.length === 0 ? (
          <SectionCard className="border-dashed p-0">
            <EmptyState
              icon={<Sparkles className="size-6 text-primary" />}
              title="Add your first course"
              body="Syllabi reads your syllabus PDF and builds a live workspace — grade weights, deadlines, and policies included."
              action={
                <Button asChild size="lg" className="mt-2">
                  <Link to="/upload">
                    <FileText className="mr-2 size-4" />
                    Upload Syllabus
                  </Link>
                </Button>
              }
            />
          </SectionCard>
        ) : (
          <div className="space-y-8">
            {/* SECCIÓN PRINCIPAL: CURSOS */}
            <div className="border-t border-border/40 pt-4">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Current Focus
                </h2>
                <span className="text-xs font-medium text-muted-foreground">
                  {courses.length} active
                </span>
              </div>

              {/* GRID DE CURSOS */}
              <div className="grid gap-4 sm:grid-cols-2">
                {courses.map((course) => (
                  <DashboardCard key={course.id} course={course} />
                ))}

                {/* Botón para añadir curso dentro del grid */}
                <Link
                  to="/upload"
                  className="group flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/70 bg-card/20 p-6 text-center transition-all hover:border-primary/50 hover:bg-card/60 active:scale-[0.99]"
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
                    <Plus className="size-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                      Add another course
                    </span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Upload a PDF syllabus
                    </p>
                  </div>
                </Link>
              </div>
            </div>

            {/* UPCOMING DEADLINES */}
            {upcoming.length > 0 && (
              <div className="min-w-0 border-t border-border/40 pt-4">
                <h2 className="mb-3 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Upcoming Deadlines
                </h2>

                <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:px-0">
                  {upcoming.map(({ course, assignment }) => (
                    <div
                      key={assignment.id}
                      className="group flex w-[220px] shrink-0 snap-start flex-col justify-between rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-all active:scale-[0.98]"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {course.code}
                          </span>
                          <DeadlinePill dueDate={assignment.dueDate!} />
                        </div>
                        <p className="mt-2.5 line-clamp-2 text-xs font-semibold leading-snug text-foreground">
                          {assignment.name}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarClock className="size-3 text-muted-foreground/70" />
                          {formatDate(assignment.dueDate)}
                        </span>
                        {assignment.weight ? (
                          <span className="font-medium text-foreground">
                            {assignment.weight}%
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
