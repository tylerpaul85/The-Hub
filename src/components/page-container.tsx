import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export function PageContainer({
  children,
  className,
  fullWidth = false,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "w-full px-4 sm:px-6 py-5 sm:py-6 transition-colors",
        fullWidth ? "max-w-full" : "max-w-6xl mx-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
