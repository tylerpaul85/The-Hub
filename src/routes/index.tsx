import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LogIn, Users } from "lucide-react";
import logo from "@/assets/msreg-logo.png";

export const Route = createFileRoute("/")({
  ssr: false,
  component: RootSplash,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function RootSplash() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-md text-center">
        <img src={logo} alt="Matt Smith Real Estate Group" className="h-24 w-auto mx-auto mb-4" />
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80">Matt Smith Real Estate Group</p>
        <h1 className="text-2xl font-semibold mt-2">Welcome</h1>
        <p className="text-sm text-muted-foreground mt-2">Where would you like to go?</p>

        <div className="grid grid-cols-1 gap-3 mt-8">
          <Link
            to="/agents"
            className="group flex items-center gap-4 rounded-xl border border-gold/30 bg-card p-5 text-left hover:border-gold hover:bg-card/80 transition-all"
          >
            <div className="h-11 w-11 rounded-lg bg-gold/15 text-gold flex items-center justify-center group-hover:bg-gold group-hover:text-navy transition-colors">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Agent Hub</div>
              <div className="text-xs text-muted-foreground mt-0.5">Requests & marketing materials</div>
            </div>
          </Link>

          <Link
            to="/auth"
            className="group flex items-center gap-4 rounded-xl border border-border bg-card/60 p-5 text-left hover:border-foreground/30 hover:bg-card/80 transition-all"
          >
            <div className="h-11 w-11 rounded-lg bg-muted text-muted-foreground flex items-center justify-center group-hover:text-foreground transition-colors">
              <LogIn className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Team sign in</div>
              <div className="text-xs text-muted-foreground mt-0.5">Internal Content Hub</div>
            </div>
          </Link>
        </div>

        <footer className="mt-10 text-[11px] text-muted-foreground">
          © Matt Smith Real Estate Group
        </footer>
      </div>
    </div>
  );
}
