import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Clock,
  BookOpen,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { AgentPlaybookItem } from "@/lib/playbooks.functions";
import { PlaybookThumbnail } from "@/components/playbooks/playbook-thumbnail";

interface ModuleCategory {
  name: string;
  description: string;
  count: number;
  playbooks: AgentPlaybookItem[];
}

interface CourseAccordionListProps {
  categories: ModuleCategory[];
}

export function CourseAccordionList({ categories }: CourseAccordionListProps) {
  // By default, keep the first module open, or allow toggling
  const [openModules, setOpenModules] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (categories.length > 0) {
      initial[categories[0].name] = true;
    }
    return initial;
  });

  const toggleModule = (categoryName: string) => {
    setOpenModules((prev) => ({
      ...prev,
      [categoryName]: !prev[categoryName],
    }));
  };

  return (
    <div className="space-y-3.5">
      {categories.map((cat, moduleIndex) => {
        const isOpen = Boolean(openModules[cat.name]);
        const completedCount = cat.playbooks.filter((p) => p.acknowledged).length;
        const isAllCompleted = completedCount > 0 && completedCount === cat.playbooks.length;

        return (
          <div
            key={cat.name}
            className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
              isOpen
                ? "border-border/90 bg-surface-1 shadow-md"
                : "border-border/70 bg-surface-1/80 hover:border-border hover:bg-surface-1"
            }`}
          >
            {/* Accordion Row Header */}
            <button
              type="button"
              onClick={() => toggleModule(cat.name)}
              className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer select-none group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    isAllCompleted
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "bg-surface-2 text-muted-foreground border border-border/80 group-hover:text-foreground group-hover:border-gold/40"
                  }`}
                >
                  {isAllCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span>{moduleIndex + 1}</span>
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-foreground group-hover:text-gold transition-colors truncate">
                    {cat.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span>
                      {cat.count} {cat.count === 1 ? "Lesson" : "Lessons"}
                    </span>
                    {completedCount > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-400 font-medium">
                          {completedCount} completed
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-transform duration-200 ${
                    isOpen ? "rotate-90 text-gold" : ""
                  }`}
                >
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>
            </button>

            {/* Expanded Lessons List (matching Image 2) */}
            {isOpen && (
              <div className="border-t border-border/60 divide-y divide-border/40 bg-surface-2/30">
                {cat.playbooks.map((pb, lessonIndex) => {
                  return (
                    <Link
                      key={pb.id}
                      to="/playbooks/$slug"
                      params={{ slug: pb.slug }}
                      className="group/lesson p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4 transition-all hover:bg-surface-2/80 hover:border-gold/30"
                    >
                      {/* Left: 16:9 Thumbnail Image */}
                      <div className="w-full sm:w-44 lg:w-48 shrink-0">
                        <PlaybookThumbnail
                          title={pb.title}
                          category={pb.category}
                          className="w-full group-hover/lesson:border-gold/50 group-hover/lesson:shadow-md transition-all"
                        />
                      </div>

                      {/* Right: Lesson Info */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm sm:text-base font-bold text-foreground group-hover/lesson:text-gold transition-colors">
                            {pb.title}
                          </h4>

                          {pb.acknowledged && (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Completed</span>
                            </span>
                          )}
                        </div>

                        {/* Rich Excerpt matching the screenshot */}
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          {pb.summary}
                        </p>

                        {/* Metadata row */}
                        <div className="pt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{pb.read_time_minutes} min read</span>
                            </span>
                            <span>•</span>
                            <span>By {pb.owner}</span>
                          </div>

                          <span className="text-xs font-bold text-gold inline-flex items-center gap-1 opacity-0 group-hover/lesson:opacity-100 transition-opacity">
                            <span>Start Lesson</span>
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
