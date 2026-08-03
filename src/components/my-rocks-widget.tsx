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
    <section className="bg-card border border-border rounded-xl shadow-sm shadow-black/5">
      <div className="flex items-center gap-2 p-5 border-b border-border">
        <Target className="h-5 w-5 text-gold" />
        <h2 className="text-base font-semibold leading-tight">My Rocks · {quarter}</h2>
        <span className="ml-auto text-xs text-muted-foreground">{rocks.length} this quarter</span>
      </div>
      <div className="divide-y divide-border">
        {isLoading && (
          <div className="space-y-3 p-5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        {!isLoading && rocks.length === 0 && (
          <div className="p-10 text-center text-muted-foreground text-sm">
            No rocks assigned to you this quarter.{" "}
            <Link to="/eos/rocks" className="text-gold underline">
              View all rocks
            </Link>
          </div>
        )}
        {!isLoading &&
          rocks.map((r) => (
            <Link
              key={r.id}
              to="/eos/rocks"
              className="p-4 flex items-center gap-3 hover:bg-accent/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.title}</div>
                {r.due_date && (
                  <div className="text-xs text-muted-foreground mt-0.5">Due {r.due_date}</div>
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
