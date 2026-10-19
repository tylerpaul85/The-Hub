import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, ChevronLeft, ChevronRight, User, ShieldCheck } from "lucide-react";
import type { AgentPlaybookDetail, AgentPlaybookItem } from "@/lib/playbooks.functions";
import { PlaybookThumbnail } from "@/components/playbooks/playbook-thumbnail";
import { Button } from "@/components/ui/button";

interface CourseSidebarContentsProps {
  currentPlaybook: AgentPlaybookDetail;
  modulePlaybooks: AgentPlaybookItem[];
  allPlaybooks: AgentPlaybookItem[];
}

export function CourseSidebarContents({
  currentPlaybook,
  modulePlaybooks,
  allPlaybooks,
}: CourseSidebarContentsProps) {
  const navigate = useNavigate();

  // Find index in the current module
  const currentModuleIndex = modulePlaybooks.findIndex((p) => p.id === currentPlaybook.id);

  // Find overall index across all playbooks in the course
  const currentGlobalIndex = allPlaybooks.findIndex((p) => p.id === currentPlaybook.id);

  const prevPlaybook = currentGlobalIndex > 0 ? allPlaybooks[currentGlobalIndex - 1] : null;
  const nextPlaybook =
    currentGlobalIndex >= 0 && currentGlobalIndex < allPlaybooks.length - 1
      ? allPlaybooks[currentGlobalIndex + 1]
      : null;

  return (
    <div className="space-y-6">
      {/* Course Contents Card (matching Image 3 right sidebar) */}
      <div className="rounded-3xl border border-border/80 bg-surface-1 overflow-hidden shadow-lg">
        {/* Card Header */}
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Course Contents</h3>
          <span className="text-xs font-semibold text-muted-foreground bg-surface-2 px-2.5 py-0.5 rounded-full border border-border/60">
            {modulePlaybooks.length} {modulePlaybooks.length === 1 ? "Lesson" : "Lessons"}
          </span>
        </div>

        {/* Numbered Lessons List */}
        <div className="divide-y divide-border/40">
          {modulePlaybooks.map((item, idx) => {
            const isCurrent = item.id === currentPlaybook.id;

            return (
              <Link
                key={item.id}
                to="/playbooks/$slug"
                params={{ slug: item.slug }}
                className={`p-3.5 flex items-center gap-3 transition-colors ${
                  isCurrent
                    ? "bg-gold/10 border-l-4 border-gold text-foreground"
                    : "hover:bg-surface-2/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {/* Lesson Number */}
                <span
                  className={`text-xs font-mono font-bold w-4 text-center shrink-0 ${
                    isCurrent ? "text-gold" : "text-muted-foreground"
                  }`}
                >
                  {idx + 1}
                </span>

                {/* Thumbnail */}
                <div className="w-16 shrink-0">
                  <PlaybookThumbnail
                    size="sm"
                    title={item.title}
                    category={item.category}
                    className="w-full"
                  />
                </div>

                {/* Lesson Title & Checkmark */}
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-semibold truncate ${
                      isCurrent ? "text-foreground font-bold" : ""
                    }`}
                  >
                    {item.title}
                  </span>

                  {item.acknowledged && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Previous / Next Lesson Footer Buttons (matching Image 3) */}
        <div className="p-4 bg-surface-2/40 border-t border-border/60 grid grid-cols-2 gap-2.5">
          <Button
            variant="outline"
            size="sm"
            disabled={!prevPlaybook}
            onClick={() => {
              if (prevPlaybook) {
                navigate({ to: "/playbooks/$slug", params: { slug: prevPlaybook.slug } });
              }
            }}
            className="h-9 text-xs rounded-xl border-border bg-surface-1 hover:bg-surface-2 cursor-pointer font-semibold"
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            <span>Previous</span>
          </Button>

          <Button
            size="sm"
            disabled={!nextPlaybook}
            onClick={() => {
              if (nextPlaybook) {
                navigate({ to: "/playbooks/$slug", params: { slug: nextPlaybook.slug } });
              }
            }}
            className="h-9 text-xs rounded-xl bg-gold text-navy hover:bg-gold/90 font-bold shadow-xs cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </div>

      {/* Instructor Box (matching Image 3) */}
      <div className="rounded-3xl border border-border/80 bg-surface-1 p-5 shadow-sm space-y-3.5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border/60">
          <User className="h-4 w-4 text-gold" />
          <span>Instructor</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-gold/30 to-accent/30 border border-gold/40 flex items-center justify-center text-foreground font-black text-sm shrink-0">
            MS
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-foreground truncate">Matt Smith</h4>
              <ShieldCheck className="h-3.5 w-3.5 text-gold shrink-0" />
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Founder &amp; CEO, MSREG
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
