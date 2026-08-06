import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CoursePilot — Your AI academic copilot" },
      {
        name: "description",
        content:
          "Turn any syllabus into a live course workspace: grade tracking, what-if simulation, and an assistant that knows your class.",
      },
      { property: "og:title", content: "CoursePilot — Your AI academic copilot" },
      {
        property: "og:description",
        content: "Every course's grade and next deadline, in one calm workspace.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/dashboard" : "/auth" });
  },
  component: () => null,
});
