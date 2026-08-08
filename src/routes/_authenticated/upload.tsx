import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { SectionCard } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Upload a syllabus" },
      {
        name: "description",
        content:
          "Drop in a PDF syllabus and Syllabi extracts grade weights, deadlines, and policies into a live workspace.",
      },
      { property: "og:title", content: "Upload a syllabus" },
      {
        property: "og:description",
        content: "One PDF in, a complete course workspace out.",
      },
    ],
  }),
  component: UploadScreen,
});

const MAX_BYTES = 20 * 1024 * 1024;

function UploadScreen() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pick = (picked: File | undefined) => {
    if (!picked) return;
    const isPdf =
      picked.type === "application/pdf" || picked.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("That file isn't a PDF. Please upload the syllabus as a PDF.");
      setFile(null);
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError("That PDF is larger than 20 MB. Try a smaller file.");
      setFile(null);
      return;
    }
    setError(null);
    setFile(picked);
  };

  async function handleUpload() {
    if (!file || !user) return;
    setUploading(true);
    setError(null);
    setProgress(8);

    const tick = window.setInterval(() => {
      setProgress((value) => (value < 88 ? value + Math.max(1, (90 - value) / 8) : value));
    }, 220);

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("syllabi")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;

      const { data, error: insertError } = await supabase
        .from("courses")
        .insert({
          user_id: user.id,
          status: "processing",
          file_path: path,
          title: file.name.replace(/\.pdf$/i, ""),
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      setProgress(100);
      navigate({ to: "/processing/$courseId", params: { courseId: data.id } });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn't upload that syllabus. Please try again.",
      );
      setUploading(false);
      setProgress(0);
    } finally {
      window.clearInterval(tick);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          to="/dashboard"
          className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Dashboard
        </Link>

        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Add a course</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Upload the syllabus PDF. Syllabi pulls out the grading breakdown, deadlines, and
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
              disabled={uploading}
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
            <div className="mx-3 mb-3 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                    {uploading ? `uploading ${Math.round(progress)}%` : "ready to analyze"}
                  </p>
                </div>
                {uploading ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <button
                    type="button"
                    aria-label="Remove file"
                    onClick={() => setFile(null)}
                    className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              {uploading ? (
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </SectionCard>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Prefer to type it in? You can edit every field on the next screen.
          </p>
          <Button size="lg" disabled={!file || uploading} onClick={handleUpload}>
            {uploading ? "Uploading…" : "Analyze syllabus"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
