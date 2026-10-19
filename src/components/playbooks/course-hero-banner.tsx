import { Link } from "@tanstack/react-router";
import { Play, Sparkles, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentPlaybookItem } from "@/lib/playbooks.functions";

interface CourseHeroBannerProps {
  title?: string;
  subtitle?: string;
  playbooks?: AgentPlaybookItem[];
}

export function CourseHeroBanner({
  title = "Listing Agent Certification",
  subtitle = "Master the in-home presentation, objection talk tracks, and transaction milestones.",
  playbooks = [],
}: CourseHeroBannerProps) {
  const completedCount = playbooks.filter((p) => p.acknowledged).length;
  const nextLesson = playbooks.find((p) => !p.acknowledged) || playbooks[0];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/80 shadow-2xl min-h-[220px] sm:min-h-[280px] lg:min-h-[300px] flex items-center justify-center text-center p-6 sm:p-10">
      {/* Background Cinematic Image */}
      <img
        src="/playbooks-banner.jpg"
        alt="Listing Agent Certification Banner"
        className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.38] contrast-125"
      />

      {/* Dark luxury gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-black/40 to-black/60 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(196,90,44,0.18),transparent)] pointer-events-none" />

      {/* Center Certification Stamp Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none select-none">
        <img
          src="/listing-agent-badge.jpg"
          alt=""
          className="w-80 h-80 object-contain filter grayscale invert"
        />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-2xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-1/80 border border-gold/40 text-gold text-xs font-semibold backdrop-blur-md shadow-lg">
          <Award className="h-3.5 w-3.5" />
          <span>MSREG Agent Certification Series</span>
        </div>

        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-md">
          {title}
        </h1>

        <p className="text-xs sm:text-sm text-gray-300 max-w-lg mx-auto leading-relaxed">
          {subtitle}
        </p>

        {nextLesson && (
          <div className="pt-2">
            <Link to="/playbooks/$slug" params={{ slug: nextLesson.slug }}>
              <Button className="h-11 sm:h-12 px-8 rounded-xl bg-gold text-navy hover:bg-gold/90 font-extrabold text-sm shadow-xl shadow-gold/25 transition-all hover:scale-105 cursor-pointer">
                <Play className="h-4 w-4 fill-current mr-2" />
                <span>{completedCount === 0 ? "Start Course" : "Resume Course"}</span>
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
