import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { GraduationCap, LayoutGrid, Plus } from "lucide-react";
import { LogoLink } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/app/theme";
import { Button } from "@/components/ui/button";
import { MOCK_COURSES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <LogoLink />
          <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">Fall 2026</span>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/upload">
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">Add course</span>
                <span className="sm:hidden">Add</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 pb-24 pt-6 sm:px-6 lg:pb-12">
        <aside className="hidden w-52 shrink-0 lg:block">
          <nav className="sticky top-20 space-y-6">
            <Link
              to="/"
              className={cn(
                "focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                pathname === "/"
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
    </div>
  );
}
