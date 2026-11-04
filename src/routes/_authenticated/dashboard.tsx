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
  ExternalLink,
  Search,
  ShieldCheck,
  Boxes,
  Target,
  Inbox,
  ClipboardCheck,
  Calendar,
  Video,
  Send,
  CalendarDays,
  ShoppingBag,
} from "lucide-react";
import { QuoteOfTheDay } from "@/components/quote-of-the-day";
import { OperationsMissionControl } from "@/components/dashboard/operations-mission-control";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Operations Mission Control — MSREG Hub" }] }),
});

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const { user, isAdmin, roles } = useAuth();
  const detail = useContentDetail();

  const isMarketing =
    isAdmin ||
    roles?.includes("marketing_coordinator") ||
    roles?.includes("video_editor") ||
    roles?.includes("videographer");

  // Content items query for action items alert
  const { data: items = [] } = useQuery({
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

  const firstName =
    (user?.user_metadata as any)?.first_name ||
    user?.email?.split("@")[0] ||
    "there";

  const openSearch = () => {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  };

  const staffQuickActions = [
    { label: "Requests Inbox", to: "/requests", icon: Inbox },
    { label: "Projects & Tasks", to: "/tasks", icon: ClipboardCheck },
    ...(isMarketing
      ? [
          { label: "Content Calendar", to: "/calendar", icon: Calendar, search: () => ({}) },
          { label: "Video Pipeline", to: "/videos", icon: Video },
        ]
      : []),
    { label: "Gifts & Inventory", to: "/inventory", icon: Boxes },
    { label: "Outbound Referrals", to: "/admin/referrals", icon: Send },
    { label: "Duty Schedule", to: "/duty-calendar", icon: CalendarDays },
    { label: "Swag Credits", to: "/admin/swag-credits", icon: ShoppingBag },
    { label: "EOS Rocks", to: "/eos/rocks", icon: Target },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">
      {/* ─── Executive Header & Operations Status ─── */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-accent flex items-center gap-1.5">
              <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
              <span>•</span>
              <span className="text-emerald-400 font-medium">MSREG Internal Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground mt-1">
              {getTimeGreeting()}, {firstName}.
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Internal staff mission control. Review queues, fulfillment, projects, and team schedule.
            </p>
          </div>

          {/* Quick Action Bridge to Agent Hub */}
          <div className="flex items-center gap-2">
            <Link
              to="/agents"
              target="_blank"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/80 bg-surface-1 hover:bg-surface-2 hover:border-gold/50 text-xs font-semibold text-foreground transition-all shadow-xs group"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Open Agent Hub</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-gold transition-colors" />
            </Link>
          </div>
        </div>

        {/* Global Operations Command Search Trigger */}
        <button
          type="button"
          onClick={openSearch}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 sm:py-3.5 rounded-2xl border border-border bg-surface-1 hover:bg-surface-2/80 hover:border-accent/40 shadow-sm transition-all duration-150 text-left group cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Search className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
            <span className="text-xs sm:text-sm text-muted-foreground group-hover:text-foreground transition-colors truncate">
              Search staff operations, requests, tasks, inventory, referrals, schedule...
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="hidden sm:inline-flex text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded-md bg-surface-2 border border-border">
              Operations Search
            </span>
            <kbd className="inline-flex items-center justify-center text-xs font-mono text-muted-foreground px-2 py-0.5 rounded-md bg-surface-2 border border-border font-semibold">
              ⌘K
            </kbd>
          </div>
        </button>

        {/* Staff Operations Quick Deck */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-medium text-muted-foreground shrink-0 mr-1 hidden sm:inline">
            Quick Desk:
          </span>
          {staffQuickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              search={(action as any).search}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-surface-1 hover:bg-surface-2 hover:border-accent/40 text-foreground transition-all duration-150 shrink-0 shadow-2xs"
            >
              <action.icon className="h-3.5 w-3.5 text-accent shrink-0" />
              <span>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Action Items Notification Strip (If items require revision or approval) */}
      {actionItems.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 shadow-xs transition-all">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <h2 className="text-sm font-semibold text-foreground tracking-tight">
                Needs Your Attention ({actionItems.length})
              </h2>
            </div>
            <span className="text-xs font-medium text-amber-500">
              Action Required
            </span>
          </div>
          <div className="divide-y divide-border/40 border border-border/50 rounded-xl bg-surface-1 overflow-hidden">
            {actionItems.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-surface-2 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                    <span className="truncate">{item.title}</span>
                    <StatusBadge className={cn("shrink-0", STATUS_CLASS[item.status as Status])}>
                      {STATUS_LABEL[item.status as Status]}
                    </StatusBadge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Scheduled for {format(new Date(item.scheduled_at), "MMM d, yyyy")}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => detail.open(item.id)}
                  className="shrink-0 text-xs h-8"
                >
                  Review <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quote of the Day */}
      <QuoteOfTheDay />

      {/* ─── Operations Mission Control Core ─── */}
      <OperationsMissionControl />
    </div>
  );
}
