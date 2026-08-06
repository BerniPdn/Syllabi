import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, FileText, Loader2 } from "lucide-react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SYLLABUS_STAGES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/processing/$courseId")({
  head: () => ({
    meta: [
      { title: "Analyzing your syllabus — CoursePilot" },
      {
        name: "description",
        content:
          "CoursePilot is reading your syllabus to build grade weights, deadlines, and policies for this course.",
      },
      { property: "og:title", content: "Analyzing your syllabus — CoursePilot" },
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
  const [stage, setStage] = useState(0);

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, status, file_path")
        .eq("id", courseId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (stage >= SYLLABUS_STAGES.length - 1) return;
    const timer = window.setTimeout(() => setStage((value) => value + 1), 1400);
    return () => window.clearTimeout(timer);
  }, [stage]);

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
            CoursePilot will analyze your syllabus and extract your course structure.
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

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="flex-1" asChild>
              <Link to="/course/$courseId" params={{ courseId }}>
                Go to course
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="flex-1" asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your syllabus is safely stored. We’ll notify you here once AI analysis is available.
        </p>
      </div>
    </div>
  );
}
