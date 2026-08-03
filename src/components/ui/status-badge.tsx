import { cn } from "@/lib/utils";

/** Standardised status pill — 11px, pill-shaped, composable via className for color. */
export function StatusBadge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}
