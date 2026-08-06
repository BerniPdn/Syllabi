import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { SectionCard } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { SYLLABUS_STAGES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Upload a syllabus — CoursePilot" },
      {
        name: "description",
        content:
          "Drop in a PDF syllabus and CoursePilot extracts grade weights, deadlines, and policies into a live workspace.",
      },
      { property: "og:title", content: "Upload a syllabus — CoursePilot" },
      {
        property: "og:description",
        content: "One PDF in, a complete course workspace out.",
      },
    ],
  }),
  component: UploadScreen,
});

function UploadScreen() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<"idle" | "processing">("idle");
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (phase !== "processing") return;
    if (stage >= SYLLABUS_STAGES.length) {
      const done = window.setTimeout(() => navigate({ to: "/review" }), 700);
      return () => window.clearTimeout(done);
    }
    const timer = window.setTimeout(() => setStage((value) => value + 1), 1100);
    return () => window.clearTimeout(timer);
  }, [phase, stage, navigate]);

  const pick = (picked: File | undefined) => {
    if (!picked) return;
    setFile({ name: picked.name, size: picked.size });
  };

  if (phase === "processing") {
    return <ProcessingScreen stage={stage} fileName={file?.name ?? "syllabus.pdf"} />;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          to="/"
          className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Dashboard
        </Link>

        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Add a course</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Upload the syllabus PDF. CoursePilot pulls out the grading breakdown, deadlines, and
            policies — you confirm everything before it's saved.
          </p>
        </div>

        <SectionCard className="p-0">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              pick(event.dataTransfer.files?.[0]);
            }}
            className={cn(
              "m-3 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors",
              dragging ? "border-primary bg-primary-soft" : "border-border",
            )}
          >
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <UploadCloud className="size-5" />
            </div>
            <p className="mt-4 font-display text-[15px] font-semibold">
              Drop your syllabus here
            </p>
            <p className="mt-1 text-sm text-muted-foreground">PDF up to 20 MB</p>
            <Button
              variant="outline"
              className="mt-5"
              onClick={() => inputRef.current?.click()}
            >
              Choose file
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => pick(event.target.files?.[0] ?? undefined)}
            />
          </div>

          {file ? (
            <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · ready to analyze
                </p>
              </div>
              <button
                type="button"
                aria-label="Remove file"
                onClick={() => setFile(null)}
                className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}
        </SectionCard>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Prefer to type it in? You can edit every field on the next screen.
          </p>
          <Button size="lg" disabled={!file} onClick={() => setPhase("processing")}>
            Analyze syllabus
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function ProcessingScreen({ stage, fileName }: { stage: number; fileName: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-5">
      <div className="w-full max-w-md">
        <div className="card-surface p-7">
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
              style={{ width: `${(stage / SYLLABUS_STAGES.length) * 100}%` }}
            />
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          You'll review and confirm everything before it's saved.
        </p>
      </div>
    </div>
  );
}
