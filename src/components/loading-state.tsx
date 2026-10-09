import { Skeleton } from "@/components/ui/skeleton";

export function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-14 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function LoadingTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 overflow-hidden divide-y divide-border/60">
      <div className="px-4 py-3 bg-surface-2 flex items-center justify-between">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3.5 flex items-center gap-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/6 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function LoadingState({
  rows = 5,
  type = "table",
}: {
  rows?: number;
  type?: "table" | "grid";
  message?: string;
}) {
  if (type === "grid") return <LoadingGrid count={rows} />;
  return <LoadingTable rows={rows} />;
}

