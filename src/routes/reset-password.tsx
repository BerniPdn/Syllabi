import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Mail } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

function friendlyResetError(caught: unknown): string {
  const raw = caught instanceof Error ? caught.message : "";
  const message = raw.toLowerCase();
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return raw || "Something went wrong. Try again.";
}

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

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password" },
      {
        name: "description",
        content: "Reset your Syllabi password to get back to your courses.",
      },
      { property: "og:title", content: "Reset password" },
      { property: "og:description", content: "Reset your Syllabi password." },
    ],
  }),
  component: ResetPasswordScreen,
});

function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"request" | "recovery" | "sent">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("type") === "recovery") {
      setMode("recovery");
    }
  }, []);

  async function handleRequest(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldError(null);

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]!.message);
      return;
    }

    setPending(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setMode("sent");
    } catch (caught) {
      setError(friendlyResetError(caught));
    } finally {
      setPending(false);
    }
  }

  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldError(null);

    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) {
      setFieldError(parsedPassword.error.issues[0]!.message);
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("Passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      navigate({ to: "/dashboard", replace: true });
    } catch (caught) {
      setError(friendlyResetError(caught));
    } finally {
      setPending(false);
    }
  }

  const emailValid = emailSchema.safeParse(email).success;
  const passwordsValid =
    passwordSchema.safeParse(password).success &&
    passwordSchema.safeParse(confirmPassword).success &&
    password === confirmPassword;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-hero p-12 lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-primary/10 blur-3xl" />
        <Logo size={30} />
        <div className="relative max-w-md">
          <h1 className="font-display text-[34px] font-semibold leading-[1.15] tracking-tight">
            Back to your <span className="text-gradient-primary">syllabus</span>
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Reset your password and pick up where you left off.
          </p>
        </div>
        <p className="relative text-xs text-muted-foreground">
          Grades are computed by Syllabi, never estimated by AI.
        </p>
      </div>

      <div className="flex items-center justify-center px-5 py-14 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Logo size={30} />
          </div>

          <Link
            to="/auth"
            className="mt-8 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary lg:mt-0"
          >
            <ArrowLeft className="size-3" />
            Back to sign in
          </Link>

          {mode === "sent" ? (
            <div className="mt-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Mail className="size-5" />
              </span>
              <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">Check your email</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                We sent a password reset link to{" "}
                <span className="font-medium text-foreground">{email}</span>. Open it to choose a new password.
              </p>
              <Button
                variant="outline"
                className="mt-6 w-full"
                onClick={() => {
                  setMode("request");
                  setEmail("");
                }}
              >
                Send again
              </Button>
            </div>
          ) : mode === "recovery" ? (
            <>
              <div className="mt-6">
                <h2 className="font-display text-2xl font-semibold tracking-tight">Choose a new password</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">Enter a new password for your account.</p>
              </div>
              <form className="mt-7 space-y-3.5" onSubmit={handleReset}>
                <div className="space-y-1.5">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (fieldError) setFieldError(null);
                      if (error) setError(null);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      if (fieldError) setFieldError(null);
                      if (error) setError(null);
                    }}
                  />
                  {fieldError ? (
                    <p className="text-xs text-destructive">{fieldError}</p>
                  ) : null}
                </div>
                {error ? (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
                ) : null}
                <Button type="submit" size="lg" className="w-full gap-2" disabled={pending || !passwordsValid}>
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Reset password
                      <Check className="size-4" />
                    </>
                  )}
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="mt-6">
                <h2 className="font-display text-2xl font-semibold tracking-tight">Reset your password</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>
              <form className="mt-7 space-y-3.5" onSubmit={handleRequest}>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    required
                    placeholder="maya@university.edu"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (fieldError) setFieldError(null);
                      if (error) setError(null);
                    }}
                  />
                  {fieldError ? <p className="text-xs text-destructive">{fieldError}</p> : null}
                </div>
                {error ? (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
                ) : null}
                <Button type="submit" size="lg" className="w-full gap-2" disabled={pending || !emailValid}>
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Send reset link
                      <Mail className="size-4" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
