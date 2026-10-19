import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Briefcase,
  Compass,
  GraduationCap,
  Bookmark,
  Layers,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  Calendar,
  User,
  ShieldCheck,
  AlertCircle,
  Tag,
} from "lucide-react";
import type { AgentPlaybookItem } from "@/lib/playbooks.functions";

interface CategorySection {
  name: string;
  description: string;
  count: number;
  playbooks: AgentPlaybookItem[];
}

interface AgentCategoriesViewProps {
  categories: CategorySection[];
  totalPlaybooksCount: number;
}

const CATEGORY_ICON_MAP: Record<string, any> = {
  Listings: Briefcase,
  Buyers: Compass,
  Objections: GraduationCap,
  Operations: Bookmark,
  Scripts: Sparkles,
  Culture: ShieldCheck,
  General: Layers,
};

export function AgentCategoriesView({ categories, totalPlaybooksCount }: AgentCategoriesViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredCategories = useMemo(() => {
    if (selectedCategory === "all") return categories;
    return categories.filter((c) => c.name.toLowerCase() === selectedCategory.toLowerCase());
  }, [categories, selectedCategory]);

  return (
    <div className="space-y-8">
      {/* Category Pills Quick Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={`shrink-0 h-9 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            selectedCategory === "all"
              ? "bg-gold text-navy shadow-md shadow-gold/20 font-bold"
              : "bg-surface-1 border border-border/70 text-muted-foreground hover:text-foreground hover:bg-surface-2"
          }`}
        >
          All Modules ({totalPlaybooksCount})
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
          const Icon = CATEGORY_ICON_MAP[cat.name] || Layers;

          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => setSelectedCategory(cat.name)}
              className={`shrink-0 h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isSelected
                  ? "bg-gold text-navy shadow-md shadow-gold/20 font-bold"
                  : "bg-surface-1 border border-border/70 text-muted-foreground hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{cat.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-navy/20" : "bg-surface-2"}`}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Category Sections */}
      <div className="space-y-10">
        {filteredCategories.map((cat) => {
          const Icon = CATEGORY_ICON_MAP[cat.name] || Layers;

          return (
            <section key={cat.name} className="space-y-4">
              {/* Category Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                      <span>{cat.name}</span>
                      <span className="text-xs font-bold text-muted-foreground bg-surface-2 px-2 py-0.5 rounded-full border border-border/60">
                        {cat.count} {cat.count === 1 ? "Playbook" : "Playbooks"}
                      </span>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cat.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Playbook Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cat.playbooks.map((pb) => {
                  return (
                    <Link
                      key={pb.id}
                      to="/playbooks/$slug"
                      params={{ slug: pb.slug }}
                      className="group relative rounded-2xl border border-border/80 bg-surface-1 p-5 shadow-xs transition-all duration-200 hover:border-gold/50 hover:bg-surface-2/40 hover:-translate-y-0.5 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Badges row */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground border border-border/70">
                            {pb.category}
                          </span>

                          <div className="flex items-center gap-2">
                            {pb.acknowledged && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Acknowledged</span>
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{pb.read_time_minutes} min read</span>
                            </span>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-bold text-foreground group-hover:text-gold transition-colors leading-snug">
                          {pb.title}
                        </h3>

                        {/* Summary */}
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          {pb.summary}
                        </p>

                        {/* Tags */}
                        {pb.tags && pb.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {pb.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] text-muted-foreground/80 bg-surface-2/80 px-2 py-0.5 rounded-md border border-border/50"
                              >
                                #{tag}
                              </span>
                            ))}
                            {pb.tags.length > 3 && (
                              <span className="text-[10px] text-muted-foreground/60 px-1 py-0.5">
                                +{pb.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Footer Row */}
                      <div className="pt-4 mt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 truncate">
                          <User className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{pb.owner}</span>
                        </div>

                        <span className="text-gold font-bold text-xs inline-flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>Read Playbook</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
