import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, LayoutGrid, LogOut } from "lucide-react";
import { LogoLink } from "@/components/brand/logo";
import { useTheme } from "@/components/app/theme";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useCourses } from "@/lib/use-courses";

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Applies the stored/system theme to <html> for the whole app.
  useTheme();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <LogoLink />
          <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">Fall 2026</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 pb-24 pt-6 sm:px-6 lg:pb-12">
        <aside className="hidden w-52 shrink-0 lg:block">
          <nav className="sticky top-20 space-y-6">
            <Link
              to="/dashboard"
              className={cn(
                "focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                pathname === "/dashboard"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <LayoutGrid className="size-4" />
              Dashboard
            </Link>

            <div>
              <p className="mb-2 px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Courses
              </p>
              <div className="space-y-0.5">
                {MOCK_COURSES.map((course) => (
                  <Link
                    key={course.id}
                    to="/course/$courseId"
                    params={{ courseId: course.id }}
                    className={cn(
                      "focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      pathname.startsWith(`/course/${course.id}`)
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <GraduationCap className="size-4 shrink-0 opacity-70" />
                    <span className="truncate">{course.code}</span>
                  </Link>
                ))}
              </div>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/90 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-3 py-2">
          <Link
            to="/dashboard"
            className={cn(
              "focus-ring flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              pathname === "/dashboard"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground",
            )}
          >
            <LayoutGrid className="size-3.5" />
            Dashboard
          </Link>
          {MOCK_COURSES.map((course) => (
            <Link
              key={course.id}
              to="/course/$courseId"
              params={{ courseId: course.id }}
              className={cn(
                "focus-ring shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                pathname.startsWith(`/course/${course.id}`)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground",
              )}
            >
              {course.code}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
