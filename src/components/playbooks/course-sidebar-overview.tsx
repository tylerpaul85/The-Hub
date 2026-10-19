import { Link } from "@tanstack/react-router";
import { CheckCircle2, Play, User, Award, ShieldCheck, Sparkles, BookOpen } from "lucide-react";
import type { AgentPlaybookItem } from "@/lib/playbooks.functions";
import { Button } from "@/components/ui/button";

interface CourseSidebarOverviewProps {
  playbooks: AgentPlaybookItem[];
  courseTitle?: string;
}

export function CourseSidebarOverview({
  playbooks,
  courseTitle = "Listing Agent Certification",
}: CourseSidebarOverviewProps) {
  const totalCount = playbooks.length;
  const completedCount = playbooks.filter((p) => p.acknowledged).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Find the first uncompleted lesson to resume, or default to the first lesson
  const nextLesson = playbooks.find((p) => !p.acknowledged) || playbooks[0];

  return (
    <div className="space-y-6">
      {/* Course Overview & Progress Card (matching right column in Image 1) */}
      <div className="rounded-3xl border border-border/80 bg-surface-1 overflow-hidden shadow-lg">
        {/* Course Badge Artwork */}
        <div className="relative p-6 sm:p-7 flex flex-col items-center justify-center text-center bg-gradient-to-b from-surface-2/80 to-surface-1 border-b border-border/60">
          <div className="relative w-36 h-36 rounded-2xl overflow-hidden shadow-xl border border-gold/40 group">
            <img
              src="/listing-agent-badge.jpg"
              alt="Listing Agent Certified"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>

          <div className="mt-4 space-y-1">
            <h3 className="text-base font-extrabold text-foreground tracking-tight">
              {courseTitle}
            </h3>
            <p className="text-xs text-muted-foreground">
              Official MSREG Certification Academy
            </p>
          </div>
        </div>

        {/* Progress Tracker Strip */}
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-foreground">
                {completedCount} of {totalCount} Lessons completed
              </span>
              <span className="text-gold font-bold">{progressPercent}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-surface-2 overflow-hidden border border-border/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold/80 to-gold transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Primary Action Button */}
          {nextLesson ? (
            <Link
              to="/playbooks/$slug"
              params={{ slug: nextLesson.slug }}
              className="block w-full"
            >
              <Button className="w-full h-11 rounded-xl bg-gold text-navy hover:bg-gold/90 font-bold text-xs shadow-md shadow-gold/20 flex items-center justify-center gap-2 cursor-pointer">
                <Play className="h-4 w-4 fill-current" />
                <span>
                  {completedCount === 0
                    ? "Start Certification"
                    : progressPercent === 100
                    ? "Review Curriculum"
                    : "Resume Course"}
                </span>
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Instructor Box (matching Image 1) */}
      <div className="rounded-3xl border border-border/80 bg-surface-1 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border/60">
          <User className="h-4 w-4 text-gold" />
          <span>Instructor</span>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-gold/30 to-accent/30 border border-gold/40 flex items-center justify-center text-foreground font-black text-base shadow-sm shrink-0">
            MS
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-foreground">Matt Smith</h4>
              <ShieldCheck className="h-4 w-4 text-gold shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Founder &amp; CEO, Matt Smith Real Estate Group
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed pt-1">
          &ldquo;These playbooks and talk tracks are the battle-tested systems our team uses to close 300+ homes year after year. Master them, eliminate waste, and scale your throughput.&rdquo;
        </p>
      </div>
    </div>
  );
}
