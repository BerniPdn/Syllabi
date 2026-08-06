import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Mail } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CoursePilot" },
      {
        name: "description",
        content: "Sign in to CoursePilot to track grades, simulate outcomes, and ask your courses anything.",
      },
      { property: "og:title", content: "Sign in — CoursePilot" },
      { property: "og:description", content: "Your AI academic copilot for every course." },
    ],
  }),
  component: AuthScreen,
});

const HIGHLIGHTS = [
  "Upload a syllabus, get a live course workspace",
  "Always know your current and projected grade",
  "Simulate what any score does to your final grade",
  "Ask questions about your own course, not the internet",
];

function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-hero p-12 lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-primary/10 blur-3xl" />
        <Logo size={30} />
        <div className="relative max-w-md">
          <h1 className="font-display text-[34px] font-semibold leading-[1.15] tracking-tight">
            Every syllabus becomes a{" "}
            <span className="text-gradient-primary">living workspace.</span>
          </h1>
          <ul className="mt-8 space-y-3.5">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">
          Grades are computed by CoursePilot, never estimated by AI.
        </p>
      </div>

      <div className="flex items-center justify-center px-5 py-14 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Logo size={30} />
          </div>

          <div className="mt-8 lg:mt-0">
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "signup"
                ? "Start with one syllabus. Add the rest whenever."
                : "Sign in to pick up where you left off."}
            </p>
          </div>

          <div className="mt-7 space-y-4">
            <Button variant="outline" className="w-full justify-center gap-2.5" size="lg">
              <GoogleMark />
              Continue with Google
            </Button>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                or
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form
              className="space-y-3.5"
              onSubmit={(event) => event.preventDefault()}
            >
              {mode === "signup" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" placeholder="Maya Chen" autoComplete="name" />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="maya@university.edu" autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" />
              </div>

              <Button asChild size="lg" className="w-full gap-2">
                <Link to="/upload">
                  {mode === "signup" ? "Create account" : "Sign in"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "signup" ? "Already have an account?" : "New to CoursePilot?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                className={cn("focus-ring rounded font-medium text-primary hover:underline")}
              >
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>

            <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-muted-foreground">
              <Mail className="size-3" />
              We'll email you a confirmation link.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.2h6.6c-.1 1.1-.8 2.8-2.4 3.9l-.1.1 3.5 2.7.2.1c2.2-2 3.7-5 3.7-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.8-2.9l-3.7-2.9c-1 .7-2.3 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5l-.2.1-3.5 2.7-.1.2C3.4 21.3 7.4 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.4c-.2-.7-.4-1.5-.4-2.4 0-.8.1-1.6.4-2.4V9.5L1.7 6.8l-.1.1A11.9 11.9 0 0 0 .3 12c0 1.9.5 3.7 1.3 5.2l3.7-2.8Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c2.2 0 3.7.9 4.6 1.7l3.3-3.2C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.6 6.6l3.7 2.9c.9-2.9 3.6-4.8 6.7-4.8Z"
      />
    </svg>
  );
}
