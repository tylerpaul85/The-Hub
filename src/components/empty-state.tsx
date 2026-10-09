import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: any;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTo?: string;
  action?: {
    label: string;
    onClick?: () => void;
    to?: string;
  };
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionTo,
  action,
  children,
}: EmptyStateProps) {
  const finalLabel = action?.label ?? actionLabel;
  const finalOnClick = action?.onClick ?? onAction;
  const finalTo = action?.to ?? actionTo;

  return (
    <div className="py-12 px-4 rounded-xl border border-dashed border-border bg-surface-1/50 flex flex-col items-center justify-center text-center">
      <div className="h-10 w-10 rounded-lg bg-surface-2 flex items-center justify-center text-text-muted mb-3 border border-border/40">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-text-primary tracking-tight">{title}</h3>
      <p className="text-xs text-text-secondary mt-1 max-w-sm leading-relaxed">{description}</p>
      {finalLabel && (
        <div className="mt-4">
          {finalTo ? (
            <Link to={finalTo as any}>
              <Button size="sm" className="text-xs h-8">
                {finalLabel}
              </Button>
            </Link>
          ) : (
            <Button size="sm" onClick={finalOnClick} className="text-xs h-8">
              {finalLabel}
            </Button>
          )}
        </div>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

