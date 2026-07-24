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
    <div className="min-h-screen bg-background text-foreground flex flex-col md:grid md:grid-cols-12 relative overflow-hidden before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_70%_20%,oklch(0.20_0.08_85_/_0.06),transparent_50%)]">
      {/* Branded Left Panel */}
      <div className="md:col-span-7 flex flex-col justify-between p-8 sm:p-12 md:p-20 border-b md:border-b-0 md:border-r border-border bg-sidebar/35 relative z-10">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Matt Smith Real Estate Group Logo" className="h-16 w-auto" />
          <div className="h-8 w-px bg-border hidden sm:block" />
          <div className="hidden sm:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">Matt Smith</p>
            <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Real Estate Group</p>
          </div>
        </div>

        <div className="my-12 md:my-auto max-w-lg space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] font-semibold text-gold/90">Marketing & Operations Portal</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight leading-tight text-white">
            The tools to guide <br />
            <span className="font-semibold text-gold">your clients home.</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Welcome to the internal digital workspace. Access listing materials, campaign pipelines, and estimated net proceeds tools to deliver unmatched real estate service.
          </p>
        </div>

        <div className="text-[11px] text-muted-foreground/60 tracking-wider">
          © {new Date().getFullYear()} Matt Smith Real Estate Group. All rights reserved.
        </div>
      </div>

      {/* Interactive Right Menu Panel */}
      <div className="md:col-span-5 flex flex-col justify-center p-8 sm:p-12 md:p-16 relative z-10">
        <div className="max-w-md w-full mx-auto space-y-8">
          <div>
            <h2 className="text-xl font-medium tracking-tight text-white">Choose Your Destination</h2>
            <p className="text-xs text-muted-foreground mt-1">Select a portal below to sign in or access materials.</p>
          </div>

          <div className="space-y-4">
            <Link
              to="/agents"
              className="group flex items-start gap-4 rounded-lg border border-border bg-card/40 p-6 text-left hover:border-gold/50 hover:bg-card/75 transition-all duration-300 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <div className="h-10 w-10 rounded-md bg-gold/10 text-gold flex items-center justify-center shrink-0 group-hover:bg-gold group-hover:text-navy transition-colors duration-300">
                <Users className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white flex items-center gap-1.5 group-hover:text-gold transition-colors duration-200">
                  Agent Hub
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold font-normal">Public Access</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Submit marketing requests, pull listing graphics, templates, and closing gift inventory.
                </div>
              </div>
            </Link>

            <Link
              to="/auth"
              className="group flex items-start gap-4 rounded-lg border border-border bg-card/15 p-6 text-left hover:border-white/30 hover:bg-card/40 transition-all duration-300 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <div className="h-10 w-10 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0 group-hover:bg-white group-hover:text-background transition-colors duration-300">
                <LogIn className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white flex items-center gap-1.5 group-hover:text-white transition-colors duration-200">
                  Team Sign In
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">Internal</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Access the administrative L10 dashboard, project track logs, sign out availability, and listings database.
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
