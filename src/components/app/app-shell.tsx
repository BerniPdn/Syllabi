import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, LayoutGrid, LogOut, Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useTheme } from "@/components/app/theme";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useCourses } from "@/lib/use-courses";
import type { User } from "@supabase/supabase-js";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function AppShell({ children, user }: { children: ReactNode; user: User | null }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: courses = [], isLoading: coursesLoading } = useCourses();
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const displayName = user?.user_metadata?.["full_name"]?.trim() || user?.email?.split("@")[0] || "Account";
  const initial = displayName.charAt(0).toUpperCase() || "?";

  useTheme();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          
        {/* Left side: hamburger menu + divider + Syllabi logo */}
        <div className="flex items-center gap-3">
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

                {/* Sidebar navigation focused purely on content */}
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
                      Courses
                    </p>
                    <div className="space-y-1">
                      {coursesLoading ? (
                        <>
                          <div className="mx-3 h-7 animate-pulse rounded-md bg-muted" />
                          <div className="mx-3 h-7 animate-pulse rounded-md bg-muted" />
                        </>
                      ) : courses.length === 0 ? (
                        <p className="px-3 py-1 text-xs text-muted-foreground">
                          No courses yet
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
              </SheetContent>
            </Sheet>

            <div className="h-4 w-px bg-border/60" aria-hidden="true" />

            <Link to="/dashboard" className="focus-ring flex items-center rounded-md" aria-label="Syllabi home">
              <Logo />
            </Link>
          </div>

          {/* Right side: user menu with avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="User menu"
                className="focus-ring flex size-8 items-center justify-center rounded-full bg-primary/10 font-display text-xs font-bold text-primary ring-1 ring-primary/20 transition-all hover:bg-primary/20 hover:ring-primary/40 active:scale-95"
              >
                {initial}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50 w-48">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-xs font-semibold leading-none text-foreground">{displayName}</p>
                  <p className="text-[11px] leading-none text-muted-foreground">{user?.email ?? ""}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsSignOutDialogOpen(true)}
                className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut className="mr-2 size-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6">
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Confirmation modal for sign out */}
      <AlertDialog open={isSignOutDialogOpen} onOpenChange={setIsSignOutDialogOpen}>
        <AlertDialogContent className="z-50 max-w-[92vw] rounded-2xl sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of Syllabi?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              You will need to sign back in to access your course grades, deadlines, and workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <AlertDialogCancel className="mt-0 w-full sm:w-auto">Stay signed in</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOut}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
