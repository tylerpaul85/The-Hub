import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { BookOpen, Layers } from "lucide-react";
import { useAgentAuth } from "@/hooks/use-agent-auth";
import { AgentAuthView } from "@/components/agent-auth-view";
import { AgentNav } from "@/components/agent-nav";
import logo from "@/assets/msreg-logo.png";

export const Route = createFileRoute("/playbooks")({
  ssr: false,
  component: PlaybooksLayout,
  head: () => ({
    meta: [
      { title: "Playbook Library — Matt Smith Real Estate Group" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function PlaybooksLayout() {
  const { agent, loading } = useAgentAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-foreground flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <BookOpen className="h-8 w-8 animate-pulse text-gold mx-auto" />
          <p className="text-sm text-muted-foreground">Loading Playbook Library...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <AgentAuthView
        title="MSREG Playbook Library"
        subtitle="Sign in with your @mattsmithrealestategroup.com agent account to access team playbooks, SOPs, and scripts."
        onSuccessRedirectTo={location.pathname || "/playbooks"}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-bg text-foreground flex flex-col antialiased overflow-x-hidden selection:bg-gold/30 selection:text-white">
      {/* Ambient Top Spotlight Halo */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[950px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.14),transparent)] pointer-events-none -z-10" />

      {/* Subtle Brand Emblem Watermark in Background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[650px] h-[420px] sm:h-[650px] pointer-events-none opacity-[0.03] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      {/* Persistent Navigation */}
      <AgentNav activeTool="playbooks" />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        <Outlet />
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border print:hidden mt-auto">
        © Matt Smith Real Estate Group · eXp Realty · Private Agent Portal
      </footer>
    </div>
  );
}
