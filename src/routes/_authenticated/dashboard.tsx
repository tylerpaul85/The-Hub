import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, STATUS_CLASS, type ContentItem, type Status } from "@/lib/content";
import { useAuth } from "@/hooks/use-auth";
import { useContentDetail } from "@/components/content-detail-provider";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  CheckCircle2,
  ListTodo,
  ExternalLink,
  Calendar,
  Home,
  Inbox,
  ArrowRight,
} from "lucide-react";
import { MyRocksWidget } from "@/components/my-rocks-widget";
import { MyTasksWidget } from "@/components/my-tasks-widget";
import { QuoteOfTheDay } from "@/components/quote-of-the-day";
import { ClientCareClosingGifts } from "@/components/client-care-closing-gifts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — MSREG Hub" }] }),
});

function Dashboard() {
  const { user, isAdmin, roles } = useAuth();
  const detail = useContentDetail();
  const isClientCare = roles?.includes("client_care");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["content-items", "all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_items")
        .select("*")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContentItem[];
    },
  });

  const actionItems = items.filter((i) => {
    if (isAdmin) return i.status === "pending_re_approval" || i.status === "in_review";
    return i.status === "needs_revision" && i.created_by === user?.id;
  });

  const approved = items.filter((i) => i.status === "approved");

  // Detect if user is brand new (no items in any widget context)
  const isEmpty = !isLoading && actionItems.length === 0 && approved.length === 0;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      <header className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back, {(user?.user_metadata as any)?.first_name || user?.email}.
        </p>
      </header>

      <QuoteOfTheDay />

      {isClientCare && <ClientCareClosingGifts />}

      <div className="grid lg:grid-cols-2 gap-6">
        <MyRocksWidget />
        <MyTasksWidget />
      </div>

      {/* Onboarding card — shown when user has no action items or approved content */}
      {isEmpty && (
        <section className="rounded-xl border border-gold/20 bg-card/60 p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-1">Get started</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Here's what you can do in The Hub.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <Link
              to="/calendar"
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-gold/40 hover:bg-accent/30 transition-colors"
            >
              <Calendar className="h-5 w-5 text-gold shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">Calendar</div>
                <div className="text-xs text-muted-foreground">View content schedule</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
            </Link>
            <Link
              to="/listings"
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-gold/40 hover:bg-accent/30 transition-colors"
            >
              <Home className="h-5 w-5 text-gold shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">Listings</div>
                <div className="text-xs text-muted-foreground">Manage properties</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
            </Link>
            <Link
              to="/requests"
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-gold/40 hover:bg-accent/30 transition-colors"
            >
              <Inbox className="h-5 w-5 text-gold shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">Requests</div>
                <div className="text-xs text-muted-foreground">View marketing requests</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
            </Link>
          </div>
        </section>
      )}

      <section
        className={cn(
          "bg-card border rounded-xl shadow-sm",
          actionItems.length > 0 ? "border-gold/20 shadow-md shadow-black/10" : "border-border",
        )}
      >
        <div className="flex items-center gap-2 p-5 border-b border-border">
          <ListTodo className="h-5 w-5 text-gold" />
          <h2 className="text-base font-semibold leading-tight">My Action Items</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {actionItems.length} requiring attention
          </span>
        </div>
        <div className="divide-y divide-border">
          {actionItems.length === 0 && (
            <div className="p-10 text-center text-muted-foreground text-sm">
              Nothing needs your attention right now.
            </div>
          )}
          {actionItems.map((item) => (
            <Row key={item.id} item={item} onOpen={() => detail.open(item.id)} />
          ))}
        </div>
      </section>

      <section className="bg-card border border-border/70 rounded-xl shadow-sm shadow-black/5">
        <div className="flex items-center gap-2 p-5 border-b border-border">
          <CheckCircle2 className="h-5 w-5 text-status-approved" />
          <h2 className="text-base font-semibold leading-tight">Approved &amp; Ready</h2>
          <span className="ml-auto text-xs text-muted-foreground">{approved.length} upcoming</span>
        </div>
        <div className="divide-y divide-border">
          {approved.length === 0 && (
            <div className="p-10 text-center text-muted-foreground text-sm">
              No approved content waiting.
            </div>
          )}
          {approved.map((item) => (
            <Row key={item.id} item={item} onOpen={() => detail.open(item.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ item, onOpen }: { item: ContentItem; onOpen: () => void }) {
  return (
    <div className="p-4 flex items-center gap-4 hover:bg-accent/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-2">
          {item.title}
          <StatusBadge className={STATUS_CLASS[item.status as Status]}>
            {STATUS_LABEL[item.status as Status]}
          </StatusBadge>
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
          <span>{format(new Date(item.scheduled_at), "MMM d, yyyy · h:mm a")}</span>
          {item.platforms.map((p) => (
            <span key={p} className="px-1.5 py-0.5 bg-muted rounded text-[11px]">
              {p}
            </span>
          ))}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onOpen}>
        Open <ExternalLink className="h-3 w-3 ml-1.5" />
      </Button>
    </div>
  );
}
