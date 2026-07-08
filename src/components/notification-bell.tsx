import { useEffect, useState } from "react";
import { Bell, AtSign } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useContentDetail } from "@/components/content-detail-provider";

type DbNotif = { id: string; type: string; message: string; content_id: string | null; task_id: string | null; video_id: string | null; read: boolean; created_at: string };


export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const detail = useContentDetail();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);


  const { data: dbNotifs = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    // Realtime subscription below pushes updates; keep a long fallback poll only.
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as DbNotif[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notif-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const markAllRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const total = dbNotifs.filter((n) => !n.read).length;

  const handleClick = (n: DbNotif) => {
    if (!n.read) markAllRead.mutate(n.id);
    if (n.task_id) {
      navigate({ to: "/tasks", search: { open: n.task_id } });
      setOpen(false);
    } else if (n.video_id) {
      navigate({ to: "/videos" });
      setOpen(false);
    } else if (n.content_id) {
      detail.open(n.content_id);
      setOpen(false);
    }
  };


  // Newest first
  const combined = [...dbNotifs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative h-9 w-9 rounded-md hover:bg-accent/40 flex items-center justify-center" aria-label="Notifications">
          <Bell className="h-5 w-5 text-foreground" />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] rounded-full px-1 flex items-center justify-center">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[70vh] overflow-y-auto">
        <div className="px-4 py-2.5 border-b border-border text-sm font-semibold">Notifications</div>
        {combined.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</div>
        )}
        {combined.map((n) => {
          const isMention = n.type === "mention";
          return (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                "w-full text-left px-4 py-3 border-b border-border/60 hover:bg-accent/30 flex gap-2.5 items-start transition-colors",
                !n.read && !isMention && "bg-gold/5",
                isMention && "bg-gold/15 border-l-4 border-l-gold hover:bg-gold/20",
              )}
            >
              {isMention ? (
                <AtSign className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
              ) : (
                <span className={cn("mt-1 h-2 w-2 rounded-full flex-shrink-0", !n.read ? "bg-gold" : "bg-muted")} />
              )}
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm", isMention ? "text-gold font-semibold" : "text-foreground")}>
                  {isMention && <span className="mr-1">@mention:</span>}
                  {n.message}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </div>
              </div>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
