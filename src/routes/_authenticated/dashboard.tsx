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
  Boxes,
  Target,
  Inbox,
  ClipboardCheck,
  Calendar,
  Video,
  Send,
  CalendarDays,
  ShoppingBag,
  ArrowRight,
  PhoneCall,
  MapPin,
  Building2,
  Clock,
  Radio,
} from "lucide-react";
import { OperationsMissionControl } from "@/components/dashboard/operations-mission-control";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Operations Console — Matt Smith Real Estate Group" }] }),
});

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const { user, isAdmin, role, roles } = useAuth();
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

  // Pending Marketing Requests Counter
  const { data: pendingRequestsCount = 0 } = useQuery({
    queryKey: ["ops-pending-requests-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("marketing_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count || 0;
    },
  });

  // Today's Duty Shift Briefing
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const { data: todayDuty = [] } = useQuery({
    queryKey: ["today-duty-briefing", currentYear, currentMonth, currentDay],
    queryFn: async () => {
      const { data: assignments, error: aErr } = await (supabase as any)
        .from("duty_calendar")
        .select("duty_day, office, assigned_agent_id")
        .eq("year", currentYear)
        .eq("month", currentMonth)
        .eq("duty_day", currentDay);
      if (aErr || !assignments || assignments.length === 0) return [];

      const agentIds = assignments.map((a: any) => a.assigned_agent_id).filter(Boolean);
      if (agentIds.length === 0) return [];

      const { data: agents } = await (supabase as any)
        .from("duty_calendar_agents")
        .select("id, name, office")
        .in("id", agentIds);

      const agentMap = new Map((agents ?? []).map((ag: any) => [ag.id, ag]));

      return assignments.map((asgn: any) => ({
        office: asgn.office,
        agentName: agentMap.get(asgn.assigned_agent_id)?.name || "Assigned Agent",
      }));
    },
    staleTime: 1000 * 60 * 5,
  });

  const firstName =
    (user?.user_metadata as any)?.first_name ||
    user?.email?.split("@")[0] ||
    "there";

  const openSearch = () => {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  };

  const staffQuickActions = [
    {
      label: "Requests Inbox",
      to: "/requests",
      icon: Inbox,
      badge: pendingRequestsCount > 0 ? `${pendingRequestsCount}` : undefined,
    },
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
      {/* ─── Architectural Command Station Header ─── */}
      <div className="space-y-4">
        {/* Operator Station Stamp Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/80 pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-mono font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                OPERATOR ONLINE
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/80">
                STATION // MSREG OPERATIONS
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {format(new Date(), "EEEE, MMM d, yyyy")}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-normal tracking-tight text-foreground leading-[1.1]">
              {getTimeGreeting()},{" "}
              <span className="italic font-normal text-accent">{firstName}</span>.
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-sans max-w-2xl leading-relaxed">
              Matt Smith Real Estate Group operations mission control. Triage incoming agent requests, monitor phone duty coverage, expedite client closing gifts, and review transaction desk health.
            </p>
          </div>

          {/* Quick Bridge to Agent Hub */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/agents"
              target="_blank"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/80 bg-surface-1 hover:bg-surface-2 hover:border-gold/50 text-xs font-semibold text-foreground transition-all shadow-xs group"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>View Public Agent Hub</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-gold transition-colors" />
            </Link>
          </div>
        </div>

        {/* ─── Today's Operational Field & Duty Roster ─── */}
        <div className="rounded-2xl border border-border/80 bg-surface-1/90 p-4 sm:p-5 shadow-xs relative overflow-hidden ring-1 ring-inset ring-white/[0.04]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-accent animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-accent font-mono">
                  Today's Field &amp; Duty Roster
                </span>
                <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-surface-2 border border-border/60">
                  Day {currentDay} of {format(today, "MMMM")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Assigned floor agents for inbound prospect calls and walk-in buyer coverage:
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {todayDuty.length > 0 ? (
                todayDuty.map((d: any, idx: number) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2/80 border border-border text-xs font-medium"
                  >
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground capitalize">{d.office}:</span>
                    <span className="font-bold text-foreground">{d.agentName}</span>
                  </div>
                ))
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2/60 border border-border/60 text-xs text-muted-foreground font-mono">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span>No duty shifts logged for today</span>
                </div>
              )}

              <Link
                to="/duty-calendar"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-xs font-semibold text-foreground hover:text-accent transition-colors ml-auto sm:ml-0"
              >
                <span>Full Duty Roster</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Global Operations Command Search Trigger */}
        <button
          type="button"
          onClick={openSearch}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 sm:py-3.5 rounded-2xl border border-border bg-surface-1 hover:bg-surface-2/80 hover:border-accent/40 shadow-sm transition-all duration-150 text-left group cursor-pointer ring-1 ring-inset ring-white/[0.04]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Search className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
            <span className="text-xs sm:text-sm text-muted-foreground group-hover:text-foreground transition-colors truncate">
              Search staff operations, incoming requests, inventory, referrals, schedule...
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="hidden sm:inline-flex text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded-md bg-surface-2 border border-border">
              Operations Console
            </span>
            <kbd className="inline-flex items-center justify-center text-xs font-mono text-muted-foreground px-2 py-0.5 rounded-md bg-surface-2 border border-border font-semibold">
              ⌘K
            </kbd>
          </div>
        </button>

        {/* Staff Operations Quick Deck */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-medium text-muted-foreground shrink-0 mr-1 hidden sm:inline">
            Direct Desks:
          </span>
          {staffQuickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              search={(action as any).search}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-surface-1 hover:bg-surface-2 hover:border-accent/40 text-foreground transition-all duration-150 shrink-0 shadow-2xs group"
            >
              <action.icon className="h-3.5 w-3.5 text-accent shrink-0 group-hover:scale-105 transition-transform" />
              <span>{action.label}</span>
              {action.badge && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold font-mono">
                  {action.badge}
                </span>
              )}
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
            <span className="text-xs font-medium text-amber-500 font-mono uppercase tracking-wider">
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

      {/* ─── Operations Mission Control Core ─── */}
      <OperationsMissionControl />
    </div>
  );
}
