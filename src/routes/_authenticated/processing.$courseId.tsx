import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, FileText, Loader2 } from "lucide-react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
const SYLLABUS_STAGES: string[] = [
  "Reading your syllabus",
  "Extracting course details",
  "Mapping grading components",
  "Finding assignments and dates",
  "Preparing your workspace",
];
import { extractSyllabus } from "@/lib/syllabus.functions";
import { discardDraftCourse } from "@/lib/discard-course";
import { coursesQueryKey } from "@/lib/use-courses";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/processing/$courseId")({
  head: () => ({
    meta: [
      { title: "Analyzing your syllabus" },
      {
        name: "description",
        content:
          "Syllabi is reading your syllabus to build grade weights, deadlines, and policies for this course.",
      },
      { property: "og:title", content: "Analyzing your syllabus" },
      {
        property: "og:description",
        content: "Your course workspace is being prepared.",
      },
    ],
  }),
  component: ProcessingRoute,
});

function ProcessingRoute() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const runExtraction = useServerFn(extractSyllabus);
  const started = useRef(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [cleanupError, setCleanupError] = useState<string | null>(null);

  const { data: course, isLoading, isError, refetch } = useQuery({queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("courses")
        .select("id, title, status, file_path, extracted, extraction_error")
        .eq("id", courseId)
        .maybeSingle();
      if (queryError) throw queryError;
      return data;
    },
    // While an extraction is already running (e.g. this page was refreshed
    // mid-flight), watch the row instead of starting a second extraction.
    refetchInterval: (query) => {
      const row = query.state.data;
      if (!row) return false;
      if (row.extracted || row.extraction_error) return false;
      return row.status === "extracting" ? 2000 : false;
    },
  });

  // A course that can't reach `ready` must not survive in the database.
  const failFlow = useCallback(
    async (message: string) => {
      setError(message);
      try {
        await discardDraftCourse(courseId);
        queryClient.invalidateQueries({ queryKey: coursesQueryKey });
      } catch (cause) {
        console.error("[processing] failed to discard course", cause);
        setCleanupError(
          "We couldn't fully clean up this upload. Refresh and try again — nothing was added to your workspace.",
        );
      }
    },
    [courseId, queryClient],
  );

  useEffect(() => {
    if (isLoading || isError || !course) return;

    if (course.extracted) {
      navigate({ to: "/review/$courseId", params: { courseId }, replace: true });
      return;
    }
    if (course.extraction_error) {
      void failFlow(course.extraction_error);
      return;
    }
    // Another mount (or another tab) already claimed this row. Never start a
    // second extraction — the polling query above will pick up the result, and
    // deleting the row here would destroy the in-flight extraction.
    if (course.status === "extracting") return;
    if (started.current) return;
    started.current = true;


    const goToReview = async () => {
      // Refresh the shared course cache so the review screen sees the stored
      // extraction instead of the stale pre-extraction row (which bounced it
      // back here and replayed this screen).
      await queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      navigate({ to: "/review/$courseId", params: { courseId }, replace: true });
    };

    void runExtraction({ data: { courseId } })
      .then(async (result) => {
        if (result.ok) {
          await goToReview();
        } else {
          await failFlow(result.error);
        }
      })
      .catch(async (cause: unknown) => {
        await failFlow(
          cause instanceof Error
            ? cause.message
            : "We couldn't analyze that syllabus. Please try again.",
        );
      });
  }, [course, courseId, failFlow, isLoading, isError, navigate, queryClient, runExtraction]);

  useEffect(() => {
    if (error) return;
    if (stage >= SYLLABUS_STAGES.length - 1) return;
    const timer = window.setTimeout(() => setStage((value) => value + 1), 2200);
    return () => window.clearTimeout(timer);
  }, [stage, error]);

  async function uploadAnother() {
    setDiscarding(true);
    setCleanupError(null);
    try {
      // Idempotent: the failure path may already have removed this row.
      await discardDraftCourse(courseId);
      queryClient.invalidateQueries({ queryKey: coursesQueryKey });
    } catch (cause) {
      console.error("[processing] failed to discard course", cause);
      setCleanupError(
        cause instanceof Error
          ? `We couldn't remove the previous upload: ${cause.message}`
          : "We couldn't remove the previous upload. Please try again.",
      );
      setDiscarding(false);
      return;
    }
    navigate({ to: "/upload", replace: true });
  }


  const fileName = course?.title ? `${course.title}.pdf` : "syllabus.pdf";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero px-5">
        <div className="w-full max-w-md">
          <div className="card-surface p-7 text-center">
            <Loader2 className="mx-auto size-6 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Loading course status…</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero px-5">
        <div className="w-full max-w-md">
          <div className="card-surface p-7 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-warning-soft text-warning">
              <AlertTriangle className="size-6" />
            </div>
            <h1 className="mt-4 font-display text-lg font-semibold tracking-tight">
              Couldn't load this course
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Check your connection and try again.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="flex-1" onClick={() => refetch()}>
                Try again
              </Button>
              <Button size="lg" variant="outline" className="flex-1" asChild>
                <Link to="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading && !isError && !course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero px-5">
        <div className="w-full max-w-md">
          <div className="card-surface p-7 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-warning-soft text-warning">
              <AlertTriangle className="size-6" />
            </div>
            <h1 className="mt-4 font-display text-lg font-semibold tracking-tight">
              We couldn't find that course
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              It may have been deleted, or the link is out of date.
            </p>
            <div className="mt-6">
              <Button size="lg" className="w-full" asChild>
                <Link to="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero px-5">
        <div className="w-full max-w-md">
          <div className="card-surface p-7 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-warning-soft text-warning">
              <AlertTriangle className="size-6" />
            </div>
            <h1 className="mt-4 font-display text-lg font-semibold tracking-tight">
              We need a course syllabus
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{error}</p>
            {cleanupError ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {cleanupError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="flex-1" disabled={discarding} onClick={uploadAnother}>
                {discarding ? "Preparing…" : "Upload another PDF"}
              </Button>
              <Button size="lg" variant="outline" className="flex-1" asChild>
                <Link to="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Nothing was saved to your workspace — Syllabi never creates a course from an
            incomplete syllabus.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-5">
      <div className="w-full max-w-md">
        <div className="card-surface p-7 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <FileText className="size-6" />
          </div>
          <h1 className="mt-4 font-display text-lg font-semibold tracking-tight">
            Your syllabus has been uploaded successfully.
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Syllabi is analyzing your syllabus and extracting your course structure.
          </p>
        </div>

        <div className="card-surface mt-4 p-7">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{fileName}</p>
              <p className="text-xs text-muted-foreground">Analyzing your syllabus</p>
            </div>
          </div>

          <ol className="mt-7 space-y-3.5">
            {SYLLABUS_STAGES.map((label, index) => {
              const state = index < stage ? "done" : index === stage ? "active" : "waiting";
              return (
                <li key={label} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      state === "done" && "border-success bg-success text-success-foreground",
                      state === "active" && "border-primary text-primary",
                      state === "waiting" && "border-border text-transparent",
                    )}
                  >
                    {state === "done" ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : state === "active" ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-border" />
                    )}
                  </span>
                  {state === "active" ? (
                    <Shimmer className="text-sm font-medium">{label}</Shimmer>
                  ) : (
                    <span
                      className={cn(
                        "text-sm",
                        state === "done" ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-7 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700"
              style={{ width: `${((stage + 1) / SYLLABUS_STAGES.length) * 100}%` }}
            />
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          This usually takes under a minute. You'll review and confirm everything we find.
        </p>
      </div>
    </div>
  );
}
