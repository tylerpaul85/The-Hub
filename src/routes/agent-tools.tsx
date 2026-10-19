import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calculator,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Building,
  Phone,
  Mail,
} from "lucide-react";
import { useAgentAuth } from "@/hooks/use-agent-auth";
import { AgentAuthView } from "@/components/agent-auth-view";
import { AgentNav } from "@/components/agent-nav";
import { Button } from "@/components/ui/button";
import logo from "@/assets/msreg-logo.png";

export const Route = createFileRoute("/agent-tools")({
  ssr: false,
  component: AgentToolsHomePage,
  head: () => ({
    meta: [
      { title: "Agent Tools — Matt Smith Real Estate Group" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AgentToolsHomePage() {
  const { agent, loading } = useAgentAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-foreground flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Layers className="h-8 w-8 animate-pulse text-accent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading Agent Tools...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <AgentAuthView
        title="MSREG Agent Tools"
        subtitle="Sign in with your @mattsmithrealestategroup.com agent account to access Seller Net Proceeds and the Playbook Library."
        onSuccessRedirectTo="/agent-tools"
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
      <AgentNav activeTool="tools" />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Welcome Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-surface-1 via-surface-1 to-surface-2 p-6 sm:p-8 shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>MSREG Private Agent Suite</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Welcome back, {agent.full_name.split(" ")[0]}!
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Select an agent tool below to run client presentations, compute seller net proceeds, or access team playbooks and operating procedures.
            </p>
          </div>
        </div>

        {/* Primary Agent Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tool Card 1: Seller Net Proceeds */}
          <div className="group relative flex flex-col justify-between rounded-3xl border border-border/80 bg-surface-1 p-6 sm:p-7 shadow-lg transition-all duration-300 hover:border-gold/50 hover:shadow-2xl hover:shadow-gold/5 hover:-translate-y-0.5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold border border-gold/20 shadow-inner group-hover:scale-105 transition-transform">
                  <Calculator className="h-6 w-6" />
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gold/15 text-gold border border-gold/25">
                  Financial Calculator
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground group-hover:text-gold transition-colors">
                  Seller Net Proceeds
                </h2>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Generate accurate 3-scenario seller net sheets in seconds. Calculate title fees, commissions, and mortgage payoffs, and download or print branded PDF presentations for listing appointments.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 bg-surface-2 px-2.5 py-1 rounded-lg border border-border/60">
                  <CheckCircle2 className="h-3 w-3 text-gold" /> 3 Price Scenarios
                </span>
                <span className="inline-flex items-center gap-1 bg-surface-2 px-2.5 py-1 rounded-lg border border-border/60">
                  <CheckCircle2 className="h-3 w-3 text-gold" /> Branded PDF Export
                </span>
                <span className="inline-flex items-center gap-1 bg-surface-2 px-2.5 py-1 rounded-lg border border-border/60">
                  <CheckCircle2 className="h-3 w-3 text-gold" /> Saved Sheet History
                </span>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-border/60">
              <Link to="/seller-net-proceeds" className="block">
                <Button className="w-full h-11 bg-gold text-navy hover:bg-gold/90 font-bold text-xs rounded-xl shadow-md shadow-gold/15 group-hover:shadow-gold/30 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <span>Launch Seller Net Proceeds</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Tool Card 2: Playbooks */}
          <div className="group relative flex flex-col justify-between rounded-3xl border border-border/80 bg-surface-1 p-6 sm:p-7 shadow-lg transition-all duration-300 hover:border-accent/50 hover:shadow-2xl hover:shadow-accent/5 hover:-translate-y-0.5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent border border-accent/20 shadow-inner group-hover:scale-105 transition-transform">
                  <BookOpen className="h-6 w-6" />
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/25">
                  Library &amp; SOPs
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground group-hover:text-accent transition-colors">
                  Playbook Library
                </h2>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Browse proven agent operating systems, objection handling scripts, listing presentation guides, and transaction milestone checklists. Master team standards with comprehensive step-by-step playbooks.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 bg-surface-2 px-2.5 py-1 rounded-lg border border-border/60">
                  <CheckCircle2 className="h-3 w-3 text-accent" /> Standard Operating Procedures
                </span>
                <span className="inline-flex items-center gap-1 bg-surface-2 px-2.5 py-1 rounded-lg border border-border/60">
                  <CheckCircle2 className="h-3 w-3 text-accent" /> Objection Handling Scripts
                </span>
                <span className="inline-flex items-center gap-1 bg-surface-2 px-2.5 py-1 rounded-lg border border-border/60">
                  <CheckCircle2 className="h-3 w-3 text-accent" /> Buyer &amp; Seller Guides
                </span>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-border/60">
              <Link to="/playbooks" className="block">
                <Button className="w-full h-11 bg-accent text-white hover:bg-accent/90 font-bold text-xs rounded-xl shadow-md shadow-accent/15 group-hover:shadow-accent/30 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <span>Explore Playbook Library</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Agent Account Info Card */}
        <div className="rounded-2xl border border-border/70 bg-surface-1/60 p-5 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-surface-2 border border-border flex items-center justify-center text-accent shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Signed in as <span className="text-gold">{agent.full_name}</span> ({agent.email})
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Your saved net sheets and agent profile data remain synchronized with your account.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Link to="/seller-net-proceeds" className="w-full sm:w-auto">
                <Button size="sm" variant="outline" className="text-xs border-border hover:bg-surface-2 w-full sm:w-auto">
                  View Saved Net Sheets
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border print:hidden mt-auto">
        © Matt Smith Real Estate Group · eXp Realty · Private Agent Portal
      </footer>
    </div>
  );
}
