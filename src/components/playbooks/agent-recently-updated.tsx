import { Link } from "@tanstack/react-router";
import { Clock, BookOpen, CheckCircle2, Sparkles, ChevronRight } from "lucide-react";
import type { AgentPlaybookItem } from "@/lib/playbooks.functions";

interface AgentRecentlyUpdatedProps {
  playbooks: AgentPlaybookItem[];
}

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Updated today";
    if (diffDays === 1) return "Updated yesterday";
    if (diffDays < 7) return `Updated ${diffDays}d ago`;
    if (diffDays < 30) return `Updated ${Math.floor(diffDays / 7)}w ago`;
    return `Updated ${Math.floor(diffDays / 30)}mo ago`;
  } catch {
    return "Recently updated";
  }
}

export function AgentRecentlyUpdated({ playbooks }: AgentRecentlyUpdatedProps) {
  if (!playbooks || playbooks.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center text-gold">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Recently Updated Playbooks
          </h2>
        </div>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          Latest procedures & revisions
        </span>
      </div>

      {/* Touch-Friendly Horizontal Carousel */}
      <div className="relative -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="flex items-stretch gap-3.5 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
          {playbooks.map((pb) => (
            <Link
              key={pb.id}
              to="/playbooks/$slug"
              params={{ slug: pb.slug }}
              className="group min-w-[260px] sm:min-w-[280px] max-w-[320px] shrink-0 snap-start rounded-2xl border border-border/80 bg-surface-1/90 p-4 shadow-sm hover:border-gold/50 hover:bg-surface-2/60 transition-all duration-200 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground border border-border/70">
                    {pb.category}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{pb.read_time_minutes}m</span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-gold transition-colors leading-snug">
                  {pb.title}
                </h3>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {pb.summary}
                </p>
              </div>

              <div className="pt-3 mt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {formatRelativeTime(pb.updated_at)}
                </span>

                {pb.acknowledged ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Read</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground group-hover:text-foreground font-medium">
                    <span>Read</span>
                    <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
