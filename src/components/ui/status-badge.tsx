import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface StatusBadgeProps {
  className?: string;
  children: ReactNode;
}

/**
 * Reusable status badge with consistent sizing across the app.
 * Replaces the ad-hoc `text-[10px] px-2 py-0.5 rounded border` pattern.
 */
export function StatusBadge({ className, children }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}
