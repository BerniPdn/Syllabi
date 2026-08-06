import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, Mail } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — CoursePilot" },
      {
        name: "description",
        content:
          "Sign in to CoursePilot to track grades, simulate outcomes, and ask your courses anything.",
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
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/dashboard", replace: true });
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) setCheckEmail(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

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

          {checkEmail ? (
            <div className="mt-8 lg:mt-0">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Mail className="size-5" />
              </span>
              <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">
                Check your email
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
                Open it to activate your account, then sign in.
              </p>
              <Button
                variant="outline"
                className="mt-6 w-full"
                onClick={() => {
                  setCheckEmail(false);
                  setMode("signin");
                }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
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
                <form className="space-y-3.5" onSubmit={handleSubmit}>
                  {mode === "signup" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="Maya Chen"
                        autoComplete="name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </div>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder="maya@university.edu"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>

                  {error ? (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {error}
                    </p>
                  ) : null}

                  <Button type="submit" size="lg" className="w-full gap-2" disabled={pending}>
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        {mode === "signup" ? "Create account" : "Sign in"}
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                  {mode === "signup" ? "Already have an account?" : "New to CoursePilot?"}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode(mode === "signup" ? "signin" : "signup");
                    }}
                    className={cn("focus-ring rounded font-medium text-primary hover:underline")}
                  >
                    {mode === "signup" ? "Sign in" : "Create one"}
                  </button>
                </p>

                {mode === "signup" ? (
                  <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-muted-foreground">
                    <Mail className="size-3" />
                    We'll email you a confirmation link.
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
