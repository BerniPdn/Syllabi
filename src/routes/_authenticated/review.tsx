import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { SectionCard, SectionHeading, formatDate } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { MOCK_COURSES } from "@/lib/mock-data";
import { letterFor } from "@/lib/grade-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({
    meta: [
      { title: "Review extracted course — CoursePilot" },
      {
        name: "description",
        content:
          "Confirm the grade weights, assignments, and policies CoursePilot found in your syllabus before saving the course.",
      },
      { property: "og:title", content: "Review extracted course — CoursePilot" },
      {
        property: "og:description",
        content: "You confirm every extracted field before the course is saved.",
      },
    ],
  }),
  component: ReviewScreen,
});

const source = MOCK_COURSES[0]!;

function ReviewScreen() {
  const [categories, setCategories] = useState(source.categories);
  const [target, setTarget] = useState(source.targetGrade);
  const [policies, setPolicies] = useState(source.policies);

  const total = categories.reduce((sum, category) => sum + category.weight, 0);
  const balanced = Math.abs(total - 100) < 0.5;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          to="/upload"
          className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Upload
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">
              <Check className="size-3" strokeWidth={3} />
              Syllabus analyzed
            </span>
            <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
              Review what we found
            </h1>
            <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">
              Everything below is editable. CoursePilot only does the math on values you confirm.
            </p>
          </div>
        </div>

        <SectionCard>
          <SectionHeading title="Course details" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Course name" defaultValue={source.name} />
            <Field label="Course code" defaultValue={source.code} />
            <Field label="Professor" defaultValue={source.professor} />
            <Field label="Semester" defaultValue={source.semester} />
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeading
            title="Grade weights"
            hint="These drive every number in your workspace"
            action={
              <span
                className={cn(
                  "numeric rounded-full px-2.5 py-1 text-xs font-semibold",
                  balanced ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
                )}
              >
                {total}%
              </span>
            }
          />

          <div className="space-y-2">
            {categories.map((category, index) => (
              <div
                key={category.id}
                className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3"
              >
                <span className="flex-1 truncate text-sm font-medium">{category.name}</span>
                <Input
                  type="number"
                  value={category.weight}
                  onChange={(event) => {
                    const next = [...categories];
                    next[index] = { ...category, weight: Number(event.target.value) };
                    setCategories(next);
                  }}
                  className="numeric h-8 w-16 text-right"
                />
                <span className="text-xs text-muted-foreground">%</span>
                <button
                  type="button"
                  aria-label={`Remove ${category.name}`}
                  onClick={() => setCategories(categories.filter((c) => c.id !== category.id))}
                  className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>

          {!balanced ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="size-3.5" />
              Weights should add up to 100%. Adjust before saving.
            </p>
          ) : null}

          <Button
            variant="ghost"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() =>
              setCategories([
                ...categories,
                { id: `new-${categories.length}`, name: "New category", weight: 0 },
              ])
            }
          >
            <Plus className="size-3.5" />
            Add category
          </Button>
        </SectionCard>

        <SectionCard>
          <SectionHeading
            title={`Assignments found (${source.assignments.length})`}
            hint="Scores stay empty until you enter them"
          />
          <div className="divide-y divide-border">
            {source.assignments.map((assignment) => {
              const category = categories.find((c) => c.id === assignment.categoryId);
              return (
                <div key={assignment.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{assignment.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {category?.name ?? "Uncategorized"} · {formatDate(assignment.dueDate)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Edit ${assignment.name}`}
                    className="focus-ring rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeading title="Your target grade" hint="Used for pace and what-you-need math" />
          <div className="flex items-baseline gap-2">
            <span className="numeric font-display text-3xl font-semibold">{target}%</span>
            <span className="text-sm text-muted-foreground">
              = {letterFor(target, source.scale)}
            </span>
          </div>
          <Slider
            value={[target]}
            min={60}
            max={100}
            step={1}
            onValueChange={([value]) => setTarget(value ?? target)}
            className="mt-5"
          />
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>60%</span>
            <span>100%</span>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeading
            title="Policies captured"
            hint="Stored as context for the assistant — never used in calculations"
          />
          <ul className="space-y-2">
            {policies.map((policy, index) => (
              <li
                key={policy}
                className="flex items-start gap-2.5 rounded-xl border border-border px-3.5 py-2.5 text-sm"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="flex-1">{policy}</span>
                <button
                  type="button"
                  aria-label="Remove policy"
                  onClick={() => setPolicies(policies.filter((_, i) => i !== index))}
                  className="focus-ring rounded-md p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" asChild>
            <Link to="/upload">Start over</Link>
          </Button>
          <Button size="lg" asChild disabled={!balanced}>
            <Link to="/course/$courseId" params={{ courseId: source.id }}>
              Save course
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} defaultValue={defaultValue} />
    </div>
  );
}
