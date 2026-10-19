import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Award,
  Layers,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import type { AgentCourseCard } from "@/lib/playbooks.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AgentCourseCardComponentProps {
  course: AgentCourseCard;
  onSelect: (course: AgentCourseCard) => void;
}

export function AgentCourseCardComponent({
  course,
  onSelect,
}: AgentCourseCardComponentProps) {
  const [imageError, setImageError] = useState(false);

  const isCompleted = course.progress_percent === 100 && course.lessons_count > 0;
  const inProgress = course.progress_percent > 0 && course.progress_percent < 100;

  return (
    <div
      onClick={() => onSelect(course)}
      className="group relative flex flex-col rounded-3xl border border-border/70 bg-surface-1/90 overflow-hidden hover:border-gold/50 hover:shadow-2xl hover:shadow-black/50 transition-all duration-300 cursor-pointer"
    >
      {/* 16:9 Aspect Ratio Cover Image Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-surface-2">
        {!imageError && course.cover_image_url ? (
          <img
            src={course.cover_image_url}
            alt={course.name}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-surface-2 via-surface-1 to-black text-center">
            <BookOpen className="h-10 w-10 text-gold/60 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {course.name}
            </span>
          </div>
        )}

        {/* Ambient Dark Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <Badge
            variant="outline"
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-sm backdrop-blur-md ${
              isCompleted
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                : inProgress
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-surface-1/70 text-gray-200 border-white/20"
            }`}
          >
            {isCompleted ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" /> Completed
              </span>
            ) : inProgress ? (
              <span className="flex items-center gap-1">
                <Clock className="h-2.5 w-2.5 text-amber-300" /> In Progress ({course.progress_percent}%)
              </span>
            ) : (
              <span>Assigned</span>
            )}
          </Badge>

          <span className="text-[10px] font-semibold text-white/80 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
            {course.lessons_count} Lessons
          </span>
        </div>

        {/* Bottom Banner Title Overlay */}
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-base font-extrabold text-white group-hover:text-gold transition-colors leading-snug drop-shadow-md">
            {course.name}
          </h3>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        {/* Description & Modules info */}
        <div className="space-y-2.5">
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {course.description || "Official team standards, daily workflows, scripts, and video modules."}
          </p>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-accent" />
              <span>{course.sections_count} {course.sections_count === 1 ? "Module" : "Modules"}</span>
            </span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-gold" />
              <span>Certification SOP</span>
            </span>
          </div>
        </div>

        {/* Progress Bar & CTA */}
        <div className="space-y-3 pt-3 border-t border-border/60">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                {course.completed_lessons_count} of {course.lessons_count} read
              </span>
              <span className="font-bold text-gold">{course.progress_percent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-surface-2 overflow-hidden border border-border/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold/80 to-gold transition-all duration-500"
                style={{ width: `${course.progress_percent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold text-gold group-hover:underline flex items-center gap-1">
              {course.completed_lessons_count > 0 ? "Continue Reading" : "Open Playbook"}
            </span>
            <div className="h-7 w-7 rounded-full bg-gold/10 text-gold flex items-center justify-center group-hover:bg-gold group-hover:text-navy transition-all duration-300">
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
