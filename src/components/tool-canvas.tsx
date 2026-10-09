import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ToolCanvasProps {
  children: ReactNode;
  className?: string;
  label?: string;
  title?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

export function ToolCanvas({
  children,
  className,
  label = "Recipient & Client Preview",
  title,
  badge,
  actions,
}: ToolCanvasProps) {
  const displayLabel = title ?? label;
  const displayBadge = actions ?? badge;

  return (
    <div className="rounded-xl border border-border bg-surface-1 overflow-hidden shadow-sm">
      {displayLabel && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface-2 border-b border-border/80 text-[11px] font-medium text-text-secondary">
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="uppercase tracking-wider font-semibold">{displayLabel}</span>
          </div>
          {displayBadge}
        </div>
      )}
      <div className="p-4 sm:p-6 bg-[#080B11]/50 flex items-center justify-center">
        {/* Fixed white canvas surface: stays exactly as clients/recipients see it */}
        <div
          className={cn(
            "w-full max-w-2xl bg-white text-slate-900 rounded-lg p-6 sm:p-8 shadow-md border border-slate-200/90 font-sans antialiased",
            className,
          )}
          style={{
            colorScheme: "light",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
