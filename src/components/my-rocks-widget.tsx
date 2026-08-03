import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Target } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ROCK_STATUS_CLASS, ROCK_STATUS_LABEL, currentQuarter, type Rock } from "@/lib/eos";

const sb = supabase as any;

export function MyRocksWidget() {
  const { user } = useAuth();
  const quarter = currentQuarter();

  const { data: rocks = [], isLoading } = useQuery({
    queryKey: ["my-rocks", user?.id, quarter],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sb
        .from("rocks")
        .select("*")
        .eq("owner", user!.id)
        .eq("quarter", quarter)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Rock[];
    },
  });

  return (
    <section className="bg-card border border-border rounded-lg">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Target className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">My Rocks · {quarter}</h2>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{rocks.length}</span>
      </div>
      <div className="divide-y divide-border/50">
        {isLoading && (
          <div className="space-y-2.5 px-4 py-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        {!isLoading && rocks.length === 0 && (
          <div className="py-10 flex flex-col items-center text-center">
            <Target className="h-5 w-5 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              No rocks assigned this quarter.{" "}
              <Link to="/eos/rocks" className="text-gold hover:underline">
                View all
              </Link>
            </p>
          </div>
        )}
        {!isLoading &&
          rocks.map((r) => (
            <Link
              key={r.id}
              to="/eos/rocks"
              className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-accent/40 transition-colors duration-100"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.title}</div>
                {r.due_date && (
                  <div className="text-xs text-muted-foreground mt-px">Due {r.due_date}</div>
                )}
              </div>
              <StatusBadge className={ROCK_STATUS_CLASS[r.status]}>
                {ROCK_STATUS_LABEL[r.status]}
              </StatusBadge>
            </Link>
          ))}
      </div>
    </section>
  );
}
