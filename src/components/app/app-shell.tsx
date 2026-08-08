import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, LayoutGrid, LogOut, Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useTheme } from "@/components/app/theme";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useCourses } from "@/lib/use-courses";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: courses = [], isLoading: coursesLoading } = useCourses();

  useTheme();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // Obtener el título dinámico según la ruta
  const getCurrentTitle = () => {
    if (pathname === "/dashboard" || pathname === "/") return "Dashboard";
    
    // Si la ruta es de un curso (/course/:courseId)
    const activeCourse = courses.find((course) =>
      pathname.startsWith(`/course/${course.id}`)
    );
    if (activeCourse) {
      return activeCourse.code || activeCourse.name;
    }

    return "";
  };

  const currentTitle = getCurrentTitle();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          
          {/* Lado Izquierdo: Menú hamburguesa */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Abrir menú de navegación"
                className="focus-ring inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>

            <SheetContent side="left" className="flex w-72 flex-col p-0">
              <SheetHeader className="border-b border-border/70 p-4 text-left">
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>

              <nav className="flex-1 space-y-6 overflow-y-auto p-4">
                <SheetClose asChild>
                  <Link
                    to="/dashboard"
                    className={cn(
                      "focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      pathname === "/dashboard"
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <LayoutGrid className="size-4" />
                    Dashboard
                  </Link>
                </SheetClose>

                <div>
                  <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Cursos
                  </p>
                  <div className="space-y-1">
                    {coursesLoading ? (
                      <>
                        <div className="mx-3 h-7 animate-pulse rounded-md bg-muted" />
                        <div className="mx-3 h-7 animate-pulse rounded-md bg-muted" />
                      </>
                    ) : courses.length === 0 ? (
                      <p className="px-3 py-1 text-xs text-muted-foreground">
                        No tienes cursos aún
                      </p>
                    ) : (
                      courses.map((course) => (
                        <SheetClose key={course.id} asChild>
                          <Link
                            to="/course/$courseId"
                            params={{ courseId: course.id }}
                            className={cn(
                              "focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                              pathname.startsWith(`/course/${course.id}`)
                                ? "bg-accent font-medium text-accent-foreground"
                                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                            )}
                          >
                            <GraduationCap className="size-4 shrink-0 opacity-70" />
                            <span className="truncate">{course.code || course.name}</span>
                          </Link>
                        </SheetClose>
                      ))
                    )}
                  </div>
                </div>
              </nav>

              <div className="border-t border-border/70 p-4">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Centro: Título de la vista actual */}
          {/* <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="text-sm font-semibold tracking-tight text-foreground truncate max-w-[180px] block text-center">
              {currentTitle}
            </span>
          </div> */}

          {/* Lado Derecho: Sign out */}
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="focus-ring inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="size-3.5" />
            <span>Sign out</span>
          </button>

        </div>
      </header>

      {/* Contenido principal */}
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6">
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
