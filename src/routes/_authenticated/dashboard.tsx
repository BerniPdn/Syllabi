import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
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
import { sweepAbandonedCourses } from "@/lib/discard-course";
import { computeGrades, daysUntil } from "@/lib/grade-engine";
import type { Course } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard" },
      {
        name: "description",
        content:
          "See every course's current grade, projected grade, and next deadline in one calm dashboard.",
      },
      { property: "og:title", content: "Dashboard" },
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
  const next = course.assignments
    .filter((a) => a.score === null && a.dueDate)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .at(0);

  return (
    <>
      <div className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
        <Link
          to="/course/$courseId"
          params={{ courseId: course.id }}
          className="absolute inset-0 z-0 rounded-2xl focus:outline-hidden"
          aria-label={`Go to ${course.name}`}
        />

        <div className="relative z-10 pointer-events-none">
          {/* Header del curso */}
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <span className="inline-block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-primary">
                {course.code}
              </span>
              <h3 className="mt-0.5 truncate font-display text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                {course.name}
              </h3>
              <p className="truncate text-xs text-muted-foreground">
                {course.professor || "No instructor specified"}
              </p>
            </div>

            {/* Menú de 3 puntos optimizado */}
            <div className="shrink-0 pointer-events-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg border border-border/50 bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground touch-manipulation transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Course options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 z-50">
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
                      e.preventDefault();
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

          {/* Promedio + Píldora destacada de la nota a la derecha */}
          <div className="mt-4 sm:mt-5 flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Current Grade
              </p>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  {snapshot.currentGrade?.toFixed(1) ?? "—"}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
                  %
                </span>
              </div>
              <p className="mt-0.5 text-[10px] sm:text-[11px] text-muted-foreground">
                Target:{" "}
                <span className="font-semibold text-foreground">
                  {course.targetGrade}%
                </span>
              </p>
            </div>

            <div className="shrink-0">
              <GradeBadge
                score={snapshot.currentGrade}
                scale={course.scale}
                tone="neutral"
                className="flex size-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 font-display text-lg font-bold text-primary shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="relative z-10 pointer-events-none mt-4 sm:mt-5 space-y-1.5 sm:space-y-2">
          <ProgressBar value={snapshot.completion} tone="neutral" />
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-medium">
              <CheckCircle2 className="size-3 text-primary shrink-0" />
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

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="max-w-[92vw] sm:max-w-lg rounded-2xl z-50">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {course.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              This permanently removes the course and everything tied to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto mt-0">Keep course</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
  const { data: courses = [], isPending, isError, refetch } = useCourses();
  const queryClient = useQueryClient();

  // Safety net: remove upload rows abandoned in a previous session so they
  // never linger in the database (a course only exists once it reaches ready).
  useEffect(() => {
    void sweepAbandonedCourses()
      .then(() => queryClient.invalidateQueries({ queryKey: coursesQueryKey }))
      .catch((cause: unknown) => console.error("[dashboard] sweep failed", cause));
  }, [queryClient]);


  const isDataLoading = isPending;
  const upcoming = courses
    .flatMap((course) =>
      course.assignments
        .filter((a) => a.score === null && a.dueDate)
        .map((a) => ({ course, assignment: a, days: daysUntil(a.dueDate!) }))
    )
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

    const { user } = Route.useRouteContext();

  return (
    <AppShell user={user}>
      <div className="w-full max-w-full space-y-5 sm:space-y-6 pb-8">
      {isDataLoading ? (
          <div className="flex min-h-[30vh] sm:min-h-[40vh] items-center justify-center">
            <Loader2 className="size-7 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <SectionCard className="border-dashed p-4 sm:p-6">
            <EmptyState
              icon={<AlertTriangle className="size-6 text-destructive" />}
              title="Couldn't load your courses"
              body="Something went wrong loading your dashboard. Check your connection and try again."
              action={
                <Button size="lg" className="mt-2 w-full sm:w-auto" onClick={() => refetch()}>
                  Try again
                </Button>
              }
            />
          </SectionCard>
        ) : courses.length === 0 ? (
          <SectionCard className="border-dashed p-4 sm:p-6">
            <EmptyState
              icon={<Sparkles className="size-6 text-primary" />}
              title="Add your first course"
              body="Syllabi reads your syllabus PDF and builds a live workspace — grade weights, deadlines, and policies included."
              action={
                <Button asChild size="lg" className="mt-2 w-full sm:w-auto">
                  <Link to="/upload">
                    <FileText className="mr-2 size-4" />
                    Upload Syllabus
                  </Link>
                </Button>
              }
            />
          </SectionCard>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* SECCIÓN PRINCIPAL: CURSOS */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg sm:text-2xl font-bold tracking-tight text-foreground">
                  Current Courses
                </h2>
                <span className="text-xs font-medium text-muted-foreground">
                  {courses.length} active
                </span>
              </div>

              {/* GRID DE CURSOS */}
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                {courses.map((course) => (
                  <DashboardCard key={course.id} course={course} />
                ))}

                {/* Botón para añadir curso adaptado */}
                <Link
                  to="/upload"
                  className="group flex min-h-[120px] sm:min-h-[180px] flex-row sm:flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/70 bg-card/20 p-4 sm:p-6 text-left sm:text-center transition-all hover:border-primary/50 hover:bg-card/60 active:scale-[0.99]"
                >
                  <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
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
              <div className="min-w-0 border-t border-border/40 pt-3 sm:pt-4">
                <h2 className="mb-3 font-display text-lg sm:text-2xl font-bold tracking-tight text-foreground">
                  Upcoming Deadlines
                </h2>

                {/* Carrusel alineado */}
                <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pt-1">
                  {upcoming.map(({ course, assignment }) => (
                    <div
                      key={`${course.id}:${assignment.id}`}
                      className="group flex w-[220px] shrink-0 snap-start flex-col justify-between rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-all active:scale-[0.98]"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate max-w-[90px]">
                            {course.code}
                          </span>
                          <DeadlinePill dueDate={assignment.dueDate!} />
                        </div>
                        <p className="mt-2.5 line-clamp-2 text-xs font-semibold leading-snug text-foreground">
                          {assignment.name}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <CalendarClock className="size-3 text-muted-foreground/70 shrink-0" />
                          {formatDate(assignment.dueDate)}
                        </span>
                        {assignment.weight ? (
                          <span className="font-medium text-foreground shrink-0 pl-1">
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