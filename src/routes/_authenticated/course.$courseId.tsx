import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  BarChart3,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Loader2,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { EmptyState, GradeBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AssignmentsPanel,
  InsightsPanel,
  OverviewPanel,
  SimulatorPanel,
} from "@/components/app/workspace-panels";
import { supabase } from "@/integrations/supabase/client";
import { courseFromRow } from "@/lib/course-mapping";
import { deleteCourse } from "@/lib/delete-course";
import { computeGrades, toneFor } from "@/lib/grade-engine";
import { deleteGrade, fetchGrades, saveGrade } from "@/lib/grades";
import { coursesQueryKey } from "@/lib/use-courses";


import { cn } from "@/lib/utils";


const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "assignments", label: "Assignments", icon: ListChecks },
  { id: "simulator", label: "Simulator", icon: BarChart3 },
  { id: "insights", label: "Insights", icon: Lightbulb },
] as const;

type TabId = (typeof TABS)[number]["id"];

export const Route = createFileRoute("/_authenticated/course/$courseId")({
  head: () => ({
    meta: [
      { title: "Course workspace — CoursePilot" },
      {
        name: "description",
        content:
          "Track grades, simulate outcomes, and ask questions about your course in one workspace.",
      },
      { property: "og:title", content: "Course workspace — CoursePilot" },
      {
        property: "og:description",
        content: "Your live workspace: grades, deadlines, and an AI assistant.",
      },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const { courseId } = Route.useParams();
  const [tab, setTab] = useState<TabId>("overview");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const deleteMutation = useMutation({
    mutationFn: () => deleteCourse(courseId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["course-workspace", courseId] });
      queryClient.removeQueries({ queryKey: ["course-grades", courseId] });
      await queryClient.invalidateQueries({ queryKey: coursesQueryKey });
      toast.success("Course deleted.");
      navigate({ to: "/dashboard" });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not delete this course.");
    },
  });


  const { data: baseCourse, isLoading } = useQuery({
    queryKey: ["course-workspace", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, extracted")
        .eq("id", courseId)
        .maybeSingle();
      if (error) throw error;
      return data ? courseFromRow(data) : null;
    },
  });

  const { data: grades } = useQuery({
    queryKey: ["course-grades", courseId],
    queryFn: () => fetchGrades(courseId),
  });

  const { data: syllabusPath } = useQuery({
    queryKey: ["course-syllabus-path", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("file_path")
        .eq("id", courseId)
        .maybeSingle();
      if (error) throw error;
      return data?.file_path ?? null;
    },
  });

  const [openingSyllabus, setOpeningSyllabus] = useState(false);

  const openSyllabus = async () => {
    if (!syllabusPath) return;
    setOpeningSyllabus(true);
    try {
      const { data, error } = await supabase.storage
        .from("syllabi")
        .createSignedUrl(syllabusPath, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("No signed URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("We couldn't open that syllabus. Please try again.");
    } finally {
      setOpeningSyllabus(false);
    }
  };

  const gradeMutation = useMutation({
    mutationFn: async (input: { assignmentId: string; score: number | null }) => {
      if (input.score === null) await deleteGrade(courseId, input.assignmentId);
      else await saveGrade(courseId, input.assignmentId, input.score);
      return input.assignmentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-grades", courseId] });
      queryClient.invalidateQueries({ queryKey: coursesQueryKey });
    },

    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not save that grade.");
    },
  });

  const course = useMemo(() => {
    if (!baseCourse) return null;
    if (!grades) return baseCourse;
    return {
      ...baseCourse,
      assignments: baseCourse.assignments.map((assignment) => ({
        ...assignment,
        score: grades[assignment.id] ?? null,
      })),
    };
  }, [baseCourse, grades]);


  if (isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!course) {
    return (
      <AppShell>
        <EmptyState
          title="Course not found"
          body="This course no longer exists, or it belongs to another account."
          action={
            <Button asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const snapshot = computeGrades(course);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {[course.code, course.semester].filter(Boolean).join(" · ")}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-[26px]">
              {course.name}
            </h1>
            {course.professor ? (
              <p className="mt-1 text-sm text-muted-foreground">{course.professor}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {syllabusPath ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={openSyllabus}
                disabled={openingSyllabus}
                className="text-muted-foreground hover:text-foreground"
              >
                {openingSyllabus ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileText className="size-4" />
                )}
                View syllabus
              </Button>
            ) : null}
            <Button asChild variant="secondary" size="sm">
              <Link to="/review/$courseId" params={{ courseId }}>
                Edit course
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {course.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the course and everything tied to it: its
                    assignments, saved grades, the extracted syllabus data, and the uploaded
                    syllabus file. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep course</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete course
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <GradeBadge
            score={snapshot.currentGrade}
            scale={course.scale}
            tone={toneFor(snapshot.currentGrade, course.targetGrade)}
            className="px-3 py-1.5 text-sm"
            />
          </div>
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
        {tab === "assignments" ? (
          <AssignmentsPanel
            course={course}
            savingKey={gradeMutation.isPending ? gradeMutation.variables?.assignmentId : null}
            onSaveScore={(assignmentId, score) => gradeMutation.mutate({ assignmentId, score })}
            onDeleteScore={(assignmentId) =>
              gradeMutation.mutate({ assignmentId, score: null })
            }
          />
        ) : null}

        {tab === "simulator" ? <SimulatorPanel course={course} /> : null}
        {tab === "insights" ? <InsightsPanel course={course} /> : null}
      </div>
    </AppShell>
  );
}
