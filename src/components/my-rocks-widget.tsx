import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROCK_STATUS_CLASS, ROCK_STATUS_LABEL, currentQuarter, type Rock } from "@/lib/eos";

const sb = supabase as any;

export function MyRocksWidget() {
  const { user } = useAuth();
  const quarter = currentQuarter();

  const { data: rocks = [] } = useQuery({
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
    <section className="bg-card border border-border rounded-xl">
      <div className="flex items-center gap-2 p-5 border-b border-border">
        <Target className="h-5 w-5 text-gold" />
        <h2 className="font-semibold">My Rocks · {quarter}</h2>
        <span className="ml-auto text-xs text-muted-foreground">{rocks.length} this quarter</span>
      </div>
      <div className="divide-y divide-border">
        {rocks.length === 0 && (
          <div className="p-10 text-center text-muted-foreground text-sm">
            No rocks assigned to you this quarter.{" "}
            <Link to="/eos/rocks" className="text-gold underline">View all rocks</Link>
          </div>
        )}
        {rocks.map((r) => (
          <Link key={r.id} to="/eos/rocks" className="p-4 flex items-center gap-3 hover:bg-accent/30">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{r.title}</div>
              {r.due_date && (
                <div className="text-xs text-muted-foreground mt-0.5">Due {r.due_date}</div>
              )}
            </div>
            <span className={cn("text-[10px] px-2 py-0.5 rounded border whitespace-nowrap", ROCK_STATUS_CLASS[r.status])}>
              {ROCK_STATUS_LABEL[r.status]}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
