import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, STATUS_CLASS, type ContentItem, type Status } from "@/lib/content";
import { useAuth } from "@/hooks/use-auth";
import { useContentDetail } from "@/components/content-detail-provider";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
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

  const isEmpty = !isLoading && actionItems.length === 0 && approved.length === 0;

  return (
    <div className="px-6 py-5 max-w-5xl mx-auto space-y-5">
      <header className="mb-8">
        <h1 className="text-4xl font-serif font-medium tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {(user?.user_metadata as any)?.first_name || user?.email}.
        </p>
      </header>

      <QuoteOfTheDay />

      {isClientCare && <ClientCareClosingGifts />}

      <div className="grid lg:grid-cols-2 gap-4">
        <MyRocksWidget />
        <MyTasksWidget />
      </div>

      {/* Onboarding — shown when user has no action items or approved content */}
      {isEmpty && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-1">Get started</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Here's what you can do in The Hub.
          </p>
          <div className="grid sm:grid-cols-3 gap-2">
            {[
              { to: "/calendar" as const, icon: Calendar, label: "Calendar", desc: "View content schedule" },
              { to: "/listings" as const, icon: Home, label: "Listings", desc: "Manage properties" },
              { to: "/requests" as const, icon: Inbox, label: "Requests", desc: "View marketing requests" },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-md border border-border hover:bg-accent/40 transition-colors duration-100"
              >
                <link.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{link.label}</div>
                  <div className="text-xs text-muted-foreground">{link.desc}</div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Action Items */}
      {(isAdmin || roles?.includes("marketing_coordinator")) && (
        <div className="grid lg:grid-cols-2 gap-4 mt-6">
          <section className="bg-card border border-border rounded-lg shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">My Action Items</h2>
              {actionItems.length > 0 && (
                <span className="ml-auto text-[11px] font-semibold text-gold tabular-nums bg-gold/10 px-2 py-0.5 rounded-full">
                  {actionItems.length}
                </span>
              )}
            </div>
            <div className="divide-y divide-border/50">
              {isLoading && (
                <div className="space-y-2.5 px-5 py-5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              )}
              {!isLoading && actionItems.length === 0 && (
                <div className="py-10 flex flex-col items-center text-center">
                  <ListTodo className="h-5 w-5 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p>
                </div>
              )}
              {!isLoading && actionItems.map((item) => (
                <Row key={item.id} item={item} onOpen={() => detail.open(item.id)} />
              ))}
            </div>
          </section>

          {/* Approved & Ready */}
          <section className="bg-card border border-border rounded-lg shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Approved & Ready</h2>
              <span className="ml-auto text-[11px] text-muted-foreground tabular-nums bg-muted px-2 py-0.5 rounded-full">
                {approved.length}
              </span>
            </div>
            <div className="divide-y divide-border/50">
              {isLoading && (
                <div className="space-y-2.5 px-5 py-5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              )}
              {!isLoading && approved.length === 0 && (
                <div className="py-10 flex flex-col items-center text-center">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No approved content waiting.</p>
                </div>
              )}
              {!isLoading && approved.map((item) => (
                <Row key={item.id} item={item} onOpen={() => detail.open(item.id)} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Row({ item, onOpen }: { item: ContentItem; onOpen: () => void }) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-accent/40 transition-colors duration-100">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-2">
          {item.title}
          <StatusBadge className={STATUS_CLASS[item.status as Status]}>
            {STATUS_LABEL[item.status as Status]}
          </StatusBadge>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span>{format(new Date(item.scheduled_at), "MMM d, yyyy · h:mm a")}</span>
          {item.platforms.map((p) => (
            <span key={p} className="px-1.5 py-px bg-muted rounded text-[11px]">
              {p}
            </span>
          ))}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onOpen}>
        Open <ExternalLink className="h-3 w-3 ml-1" />
      </Button>
    </div>
  );
}
