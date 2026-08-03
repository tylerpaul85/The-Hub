import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

const sb = supabase as any;

type Item = {
  kind: "task" | "todo";
  id: string;
  title: string;
  due_date: string | null;
  status?: string;
  recurring?: boolean;
};

export function MyTasksWidget() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["my-tasks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sb
        .from("tasks")
        .select("id,title,due_date,status")
        .eq("owner", user!.id)
        .neq("status", "complete")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: todos = [], isLoading: loadingTodos } = useQuery({
    queryKey: ["my-todos-widget", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sb
        .from("todos")
        .select("id,title,due_date,completed")
        .eq("owner", user!.id)
        .eq("completed", false)
        .order("due_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const isLoading = loadingTasks || loadingTodos;

  const toggleTodo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("todos").update({ completed: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-todos-widget"] }),
  });

  const items: Item[] = [
    ...tasks.map((t: any) => ({
      kind: "task" as const,
      id: t.id,
      title: t.title,
      due_date: t.due_date,
      status: t.status,
    })),
    ...todos.map((t: any) => ({
      kind: "todo" as const,
      id: t.id,
      title: t.title,
      due_date: t.due_date,
    })),
  ].sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="bg-card border border-border rounded-lg">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">My Tasks</h2>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      <div className="divide-y divide-border/50">
        {isLoading && (
          <div className="space-y-2.5 px-4 py-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="py-10 flex flex-col items-center text-center">
            <ClipboardCheck className="h-5 w-5 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No open tasks.</p>
          </div>
        )}
        {!isLoading &&
          items.map((t) => {
            const overdue = t.due_date && t.due_date < today;
            if (t.kind === "todo") {
              return (
                <div key={`todo-${t.id}`} className="px-4 py-2.5 flex items-center gap-2.5">
                  <Checkbox checked={false} onCheckedChange={() => toggleTodo.mutate(t.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{t.title}</div>
                    <div
                      className={cn(
                        "text-xs mt-px",
                        overdue ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {t.due_date
                        ? `Due ${t.due_date}${overdue ? " · overdue" : ""}`
                        : "No due date"}{" "}
                      · L10 to-do
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <Link
                key={`task-${t.id}`}
                to="/tasks"
                search={{ open: t.id } as any}
                className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-accent/40 transition-colors duration-100"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{t.title}</div>
                  <div
                    className={cn(
                      "text-xs mt-px",
                      overdue ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {t.due_date
                      ? `Due ${t.due_date}${overdue ? " · overdue" : ""}`
                      : "No due date"}{" "}
                    · {(t.status ?? "").replace("_", " ")}
                  </div>
                </div>
              </Link>
            );
          })}
      </div>
    </section>
  );
}
