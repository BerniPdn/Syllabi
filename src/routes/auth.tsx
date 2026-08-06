import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, Mail } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { z } from "zod";

function friendlyAuthError(caught: unknown): string {
  const raw = caught instanceof Error ? caught.message : "";
  const message = raw.toLowerCase();
  if (message.includes("already registered") || message.includes("already been registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (message.includes("invalid login credentials")) {
    return "That email and password don't match. Check both and try again.";
  }
  if (message.includes("email not confirmed")) {
    return "Confirm your email first — check your inbox for the link we sent.";
  }
  if (message.includes("invalid") && message.includes("email")) {
    return "Enter a valid email address, like maya@university.edu.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return raw || "Something went wrong. Try again.";
}

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

const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter your email address." })
  .max(255, { message: "Email must be less than 255 characters." })
  .email({ message: "Enter a valid email address, like maya@university.edu." });

const passwordSchema = z
  .string()
  .min(6, { message: "Password must be at least 6 characters." })
  .max(72, { message: "Password must be less than 72 characters." });

function AuthScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const emailValid = emailSchema.safeParse(email).success;
  const passwordValid = passwordSchema.safeParse(password).success;

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

    const parsedEmail = emailSchema.safeParse(email);
    const parsedPassword = passwordSchema.safeParse(password);
    setEmailError(parsedEmail.success ? null : parsedEmail.error.issues[0]!.message);
    setPasswordError(parsedPassword.success ? null : parsedPassword.error.issues[0]!.message);
    if (!parsedEmail.success || !parsedPassword.success) return;

    const cleanEmail = parsedEmail.data.toLowerCase();
    setPending(true);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: parsedPassword.data,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name.trim() },
          },
        });
        if (signUpError) throw signUpError;
        // Supabase returns an obfuscated user with no identities for existing emails.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          setEmailError("An account with this email already exists. Sign in instead.");
          return;
        }
        if (!data.session) setCheckEmail(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: parsedPassword.data,
        });
        if (signInError) throw signInError;
      }
    } catch (caught) {
      setError(friendlyAuthError(caught));
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
                      inputMode="email"
                      required
                      placeholder="maya@university.edu"
                      autoComplete="email"
                      aria-invalid={emailError ? true : undefined}
                      aria-describedby={emailError ? "email-error" : undefined}
                      className={cn(emailError && "border-destructive focus-visible:ring-destructive/30")}
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (emailError) setEmailError(null);
                        if (error) setError(null);
                      }}
                      onBlur={() => {
                        if (!email) return;
                        const parsed = emailSchema.safeParse(email);
                        setEmailError(parsed.success ? null : parsed.error.issues[0]!.message);
                      }}
                    />
                    {emailError ? (
                      <p id="email-error" className="text-xs text-destructive">
                        {emailError}
                      </p>
                    ) : null}
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
                      aria-invalid={passwordError ? true : undefined}
                      aria-describedby={passwordError ? "password-error" : undefined}
                      className={cn(passwordError && "border-destructive focus-visible:ring-destructive/30")}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        if (passwordError) setPasswordError(null);
                        if (error) setError(null);
                      }}
                    />
                    {passwordError ? (
                      <p id="password-error" className="text-xs text-destructive">
                        {passwordError}
                      </p>
                    ) : null}
                  </div>

                  {error ? (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {error}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full gap-2"
                    disabled={pending || !emailValid || !passwordValid}
                  >

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
