import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: RootIndexRedirect,
  head: () => ({
    meta: [
      { title: "MSREG Hub" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function RootIndexRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash;
      if (hash.includes("type=recovery") || hash.includes("access_token=")) {
        navigate({ to: "/reset-password", hash: hash.substring(1), replace: true });
        return;
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        navigate({ to: "/agents", replace: true });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-gold" />
    </div>
  );
}
