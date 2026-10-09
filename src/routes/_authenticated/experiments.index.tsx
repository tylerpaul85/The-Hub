import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  Tv,
  FlaskConical,
  Wand2,
  CalendarOff,
  UserCheck,
  Bot,
  Share2,
  CalendarDays,
  ArrowUpRight,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/experiments/")({
  component: ExperimentsIndex,
  head: () => ({ meta: [{ title: "Experiments & Lab — MSREG Hub" }] }),
});

function ExperimentsIndex() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Experiments & Innovations Lab"
        description="Active pilot programs, AI analytics suites, and internal operations prototypes currently in staging."
      />

      {/* Flagship Experiments Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-gold" />
          <h2 className="text-sm uppercase tracking-wider font-bold text-muted-foreground">
            Core Operational Pilots
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Duty Calendar */}
          <Link to="/duty-calendar" className="group">
            <div className="h-full bg-card border border-border/80 rounded-xl p-5 hover:border-gold/60 transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="p-2.5 rounded-xl bg-gold/15 text-gold border border-gold/30">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <Badge className="bg-gold/15 text-gold border-gold/30 text-[10px] font-bold">
                    Schedule Hub
                  </Badge>
                </div>
                <div className="flex items-center gap-1 font-bold text-base text-foreground group-hover:text-gold transition-colors">
                  <span>Duty Calendar</span>
                  <ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                  Monthly floor and phone duty schedule, assigned agents, shift trading, and coverage calendar across all team locations.
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>/duty-calendar</span>
                <span className="text-gold font-medium">Launch →</span>
              </div>
            </div>
          </Link>

          {/* Social & Meta Lab */}
          <Link to="/meta-social" className="group">
            <div className="h-full bg-card border border-border/80 rounded-xl p-5 hover:border-gold/60 transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] font-bold">
                    Meta Graph API
                  </Badge>
                </div>
                <div className="flex items-center gap-1 font-bold text-base text-foreground group-hover:text-gold transition-colors">
                  <span>Social &amp; Meta Publishing</span>
                  <ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                  Meta Graph API integration for publishing content directly to Facebook &amp; Instagram, with real-time page performance analytics.
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>/meta-social</span>
                <span className="text-gold font-medium">Launch →</span>
              </div>
            </div>
          </Link>

          {/* Agent Audit System */}
          <Link to="/admin/audit" className="group">
            <div className="h-full bg-card border border-border/80 rounded-xl p-5 hover:border-gold/60 transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30 text-[10px] font-bold">
                    Claude AI / FUB
                  </Badge>
                </div>
                <div className="flex items-center gap-1 font-bold text-base text-foreground group-hover:text-gold transition-colors">
                  <span>Agent Audit System</span>
                  <ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                  Audit agent lead handling in Follow Up Boss, grade conversation timelines against our rubric, and flag communication gaps.
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>/admin/audit</span>
                <span className="text-gold font-medium">Launch →</span>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Intelligence & Experimental Tools */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-gold" />
          <h2 className="text-sm uppercase tracking-wider font-bold text-muted-foreground">
            Specialized Tooling &amp; Prototypes
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {/* FUB AI Assistant */}
          <Link to="/admin/assistant" className="group">
            <div className="h-full bg-card border border-border/80 rounded-xl p-4 hover:border-gold/50 transition-all shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="p-2 rounded-lg bg-surface-2 text-gold border border-border/60">
                    <Bot className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-sm text-foreground group-hover:text-gold transition-colors">
                    FUB AI Assistant
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Interactive conversational analyst for Follow Up Boss metrics and pipeline health queries.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/50 text-[10px] font-mono text-muted-foreground">
                /admin/assistant
              </div>
            </div>
          </Link>

          {/* My Availability */}
          <Link to="/my-availability" className="group">
            <div className="h-full bg-card border border-border/80 rounded-xl p-4 hover:border-gold/50 transition-all shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="p-2 rounded-lg bg-surface-2 text-muted-foreground border border-border/60">
                    <CalendarOff className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-sm text-foreground group-hover:text-gold transition-colors">
                    Duty Availability
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Agent self-service portal to submit unavailable dates for monthly floor scheduling.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/50 text-[10px] font-mono text-muted-foreground">
                /my-availability
              </div>
            </div>
          </Link>

          {/* Live Stats TV Dashboard */}
          <Link to="/experiments/tv-dashboard" className="group">
            <div className="h-full bg-card border border-border/80 rounded-xl p-4 hover:border-gold/50 transition-all shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="p-2 rounded-lg bg-surface-2 text-gold border border-border/60">
                    <Tv className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-sm text-foreground group-hover:text-gold transition-colors">
                    Office TV Dashboard
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Fullscreen, auto-refreshing live activity monitor for wall displays in the office.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/50 text-[10px] font-mono text-muted-foreground">
                /experiments/tv-dashboard
              </div>
            </div>
          </Link>

          {/* Virtual Staging */}
          <Link to="/experiments/virtual-staging" className="group">
            <div className="h-full bg-card border border-border/80 rounded-xl p-4 hover:border-gold/50 transition-all shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="p-2 rounded-lg bg-surface-2 text-gold border border-border/60">
                    <Wand2 className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-sm text-foreground group-hover:text-gold transition-colors">
                    Virtual Staging
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Generative staging tool to dress vacant interior photos with aesthetic furniture styles.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/50 text-[10px] font-mono text-muted-foreground">
                /experiments/virtual-staging
              </div>
            </div>
          </Link>

          {/* API Diagnostics */}
          <Link to="/experiments/live-stats" className="group">
            <div className="h-full bg-card border border-border/80 rounded-xl p-4 hover:border-gold/50 transition-all shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="p-2 rounded-lg bg-surface-2 text-muted-foreground border border-border/60">
                    <FlaskConical className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-sm text-foreground group-hover:text-gold transition-colors">
                    API Diagnostics
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Direct connectivity probes against external endpoints for connection troubleshooting.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/50 text-[10px] font-mono text-muted-foreground">
                /experiments/live-stats
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
