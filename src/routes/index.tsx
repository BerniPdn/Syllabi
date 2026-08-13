import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/logo";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Syllabi" },
      {
        name: "description",
        content:
          "Turn any syllabus into a live course workspace: grade tracking, what-if simulation, and an assistant that knows your class.",
      },
      { property: "og:title", content: "Syllabi" },
      {
        property: "og:description",
        content: "Turn any syllabus into a live course workspace: grade tracking, what-if simulation, and an assistant that knows your class.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/dashboard" : "/auth" });
  },
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <Logo size={26} className="animate-pulse" />
    </div>
  ),
  component: () => null,
});
