import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import type { Todo } from "@/lib/eos";

const sb = supabase as any;

export function MyTodosWidget() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: todos = [] } = useQuery({
    queryKey: ["my-todos", user?.id, isAdmin],
    enabled: !!user,
    queryFn: async () => {
      let q = sb.from("todos").select("*").eq("completed", false).order("due_date");
      if (!isAdmin) q = q.eq("owner", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Todo[];
    },
  });

  const toggle = useMutation({
    mutationFn: async (t: Todo) => {
      const { error } = await sb.from("todos").update({ completed: true }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-todos"] }),
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="bg-card border border-border rounded-xl">
      <div className="flex items-center gap-2 p-5 border-b border-border">
        <ListChecks className="h-5 w-5 text-gold" />
        <h2 className="font-semibold">{isAdmin ? "Open To-Dos (Team)" : "My Open To-Dos"}</h2>
        <span className="ml-auto text-xs text-muted-foreground">{todos.length} open</span>
      </div>
      <div className="divide-y divide-border">
        {todos.length === 0 && (
          <div className="p-10 text-center text-muted-foreground text-sm">No open to-dos.</div>
        )}
        {todos.map((t) => {
          const overdue = t.due_date < today;
          const isOwn = t.owner === user?.id;
          return (
            <div key={t.id} className="p-3 flex items-center gap-3">
              <Checkbox
                checked={false}
                disabled={!isOwn && !isAdmin}
                onCheckedChange={() => toggle.mutate(t)}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{t.title}</div>
                <div className={cn("text-xs mt-0.5", overdue ? "text-destructive" : "text-muted-foreground")}>
                  Due {t.due_date}{overdue ? " · overdue" : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
