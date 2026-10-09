import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface PageHeaderProps {
  category?: string;
  categoryTo?: string;
  title: string;
  description?: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode; // Right-hand actions
  badge?: ReactNode;
}

export function PageHeader({
  category,
  categoryTo,
  title,
  description,
  subtitle,
  actions,
  children,
  badge,
}: PageHeaderProps) {
  const finalDesc = description ?? subtitle;
  const finalActions = actions ?? children;

  return (
    <header className="mb-6 pb-4 border-b border-border/60">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          {category && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">
              {categoryTo ? (
                <Link to={categoryTo as any} className="hover:text-accent transition-colors">
                  {category}
                </Link>
              ) : (
                <span>{category}</span>
              )}
              <ChevronRight className="h-3 w-3 opacity-60" />
            </div>
          )}

          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary">
              {title}
            </h1>
            {badge}
          </div>

          {finalDesc && (
            <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-3xl leading-relaxed">
              {finalDesc}
            </p>
          )}
        </div>

        {finalActions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:self-start sm:mt-1">
            {finalActions}
          </div>
        )}
      </div>
    </header>
  );
}
