import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, STATUS_CLASS, type ContentItem, type Status } from "@/lib/content";
import { useAuth } from "@/hooks/use-auth";
import { useContentDetail } from "@/components/content-detail-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CheckCircle2, ListTodo, ExternalLink } from "lucide-react";
import { MyRocksWidget } from "@/components/my-rocks-widget";
import { MyTasksWidget } from "@/components/my-tasks-widget";
import { QuoteOfTheDay } from "@/components/quote-of-the-day";
import { ClientCareClosingGifts } from "@/components/client-care-closing-gifts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — MSREG Marketing Department" }] }),
});

function Dashboard() {
  const { user, isAdmin, roles } = useAuth();
  const detail = useContentDetail();
  const isClientCare = roles?.includes("client_care");

  const { data: items = [] } = useQuery({
    queryKey: ["content-items", "all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("content_items").select("*").order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContentItem[];
    },
  });

  const actionItems = items.filter((i) => {
    if (isAdmin) return i.status === "pending_re_approval" || i.status === "in_review";
    return i.status === "needs_revision" && i.created_by === user?.id;
  });

  const approved = items.filter((i) => i.status === "approved");

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, {((user?.user_metadata as any)?.first_name) || user?.email}.</p>
      </header>

      <div className="mb-6">
        <QuoteOfTheDay />
      </div>

      {isClientCare && (
        <div className="mb-6">
          <ClientCareClosingGifts />
        </div>
      )}


      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <MyRocksWidget />
        <MyTasksWidget />
      </div>

      <section className="bg-card border border-border rounded-xl mb-6">
        <div className="flex items-center gap-2 p-5 border-b border-border">
          <ListTodo className="h-5 w-5 text-gold" />
          <h2 className="font-semibold">My Action Items</h2>
          <span className="ml-auto text-xs text-muted-foreground">{actionItems.length} requiring attention</span>
        </div>
        <div className="divide-y divide-border">
          {actionItems.length === 0 && (
            <div className="p-10 text-center text-muted-foreground text-sm">Nothing needs your attention right now. 🎉</div>
          )}
          {actionItems.map((item) => <Row key={item.id} item={item} onOpen={() => detail.open(item.id)} />)}
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl">
        <div className="flex items-center gap-2 p-5 border-b border-border">
          <CheckCircle2 className="h-5 w-5 text-status-approved" />
          <h2 className="font-semibold">Approved &amp; Ready</h2>
          <span className="ml-auto text-xs text-muted-foreground">{approved.length} upcoming</span>
        </div>
        <div className="divide-y divide-border">
          {approved.length === 0 && (
            <div className="p-10 text-center text-muted-foreground text-sm">No approved content waiting.</div>
          )}
          {approved.map((item) => <Row key={item.id} item={item} onOpen={() => detail.open(item.id)} />)}
        </div>
      </section>
    </div>
  );
}

function Row({ item, onOpen }: { item: ContentItem; onOpen: () => void }) {
  return (
    <div className="p-4 flex items-center gap-4 hover:bg-accent/30">
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate flex items-center gap-2">
          {item.title}
          <span className={cn("text-[10px] px-2 py-0.5 rounded border", STATUS_CLASS[item.status as Status])}>
            {STATUS_LABEL[item.status as Status]}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
          <span>{format(new Date(item.scheduled_at), "MMM d, yyyy · h:mm a")}</span>
          {item.platforms.map((p) => (
            <span key={p} className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{p}</span>
          ))}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onOpen}>
        Open <ExternalLink className="h-3 w-3 ml-1.5" />
      </Button>
    </div>
  );
}
