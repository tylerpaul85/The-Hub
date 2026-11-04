import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, STATUS_CLASS, type ContentItem, type Status } from "@/lib/content";
import { useAuth } from "@/hooks/use-auth";
import { useContentDetail } from "@/components/content-detail-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ExternalLink,
  Search,
  Sparkles,
  ShieldCheck,
  Calculator,
  DoorOpen,
  Mail,
  ShoppingBag,
  CreditCard,
  Store,
  Boxes,
  Target,
  ArrowRight,
  Gift,
  Share2,
} from "lucide-react";
import { QuoteOfTheDay } from "@/components/quote-of-the-day";
import { AgentCockpit } from "@/components/dashboard/agent-cockpit";
import { OperationsMissionControl } from "@/components/dashboard/operations-mission-control";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Launcher Home — MSREG Marketing Hub" }] }),
});

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type WorkspaceMode = "agent" | "operations";

function Dashboard() {
  const { user, isAdmin, roles } = useAuth();
  const detail = useContentDetail();

  const isOperationsStaff =
    isAdmin ||
    roles?.includes("marketing_coordinator") ||
    roles?.includes("client_care") ||
    roles?.includes("video_editor") ||
    roles?.includes("videographer");

  // Initialize workspace mode from localStorage, defaulting intelligently based on user role
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("msreg_hub_workspace_mode") as WorkspaceMode | null;
      if (saved === "agent" || saved === "operations") return saved;
    }
    return isOperationsStaff ? "operations" : "agent";
  });

  // Hotkey support: Alt + W toggles between Agent and Operations views seamlessly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "w" || e.key === "W")) {
        e.preventDefault();
        setWorkspaceMode((prev) => {
          const next = prev === "agent" ? "operations" : "agent";
          if (typeof window !== "undefined") {
            localStorage.setItem("msreg_hub_workspace_mode", next);
          }
          toast.info(`Switched to ${next === "agent" ? "Agent Cockpit" : "Operations Command"}`);
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleModeChange = (mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("msreg_hub_workspace_mode", mode);
    }
  };

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

  const quickActions = [
    { label: "Net Sheet", to: "/seller-net-proceeds", icon: Calculator },
    { label: "Open House Kiosk", to: "/open-houses", icon: DoorOpen },
    { label: "Closing Gift", to: "/closing-gift", icon: Gift },
    { label: "Outbound Referral", to: "/referral-form", icon: Share2 },
    { label: "Email Signature", to: "/signatures", icon: Mail },
    { label: "Swag Store", to: "/admin/swag-credits", icon: ShoppingBag },
    { label: "Brand Kit", to: "/toolbox", icon: CreditCard },
    { label: "Vendors", to: "/vendors", icon: Store },
    ...(isOperationsStaff
      ? [
          { label: "Inventory", to: "/inventory", icon: Boxes },
          { label: "Agent Net Sheets", to: "/admin-net-sheets", icon: Calculator },
          { label: "Rocks", to: "/eos/rocks", icon: Target },
        ]
      : []),
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">
      {/* ─── Top Greeting & Adaptive Workspace Switcher ─── */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-accent flex items-center gap-1.5">
              <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
              <span>•</span>
              <span className="text-emerald-400 font-medium">MSREG Internal Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground mt-1">
              {getTimeGreeting()}, {firstName}.
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Select your preferred view below or press{" "}
              <kbd className="px-1.5 py-0.5 text-xs font-mono rounded bg-surface-2 border border-border text-foreground font-semibold">
                ⌘K
              </kbd>{" "}
              for instant tool search.
            </p>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="flex flex-col items-start md:items-end gap-1 shrink-0">
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-surface-1 border border-border/80 shadow-md">
              <button
                type="button"
                onClick={() => handleModeChange("agent")}
                className={cn(
                  "flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer select-none",
                  workspaceMode === "agent"
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Agent Velocity</span>
                <span
                  className={cn(
                    "text-[10px] py-0.5 px-2 rounded-full font-bold",
                    workspaceMode === "agent"
                      ? "bg-black/15 text-slate-950"
                      : "bg-surface-2 text-muted-foreground border border-border/60",
                  )}
                >
                  Deals
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange("operations")}
                className={cn(
                  "flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer select-none",
                  workspaceMode === "operations"
                    ? "bg-accent text-white shadow-md shadow-accent/25 scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Operations Command</span>
                <span
                  className={cn(
                    "text-[10px] py-0.5 px-2 rounded-full font-bold",
                    workspaceMode === "operations"
                      ? "bg-white/20 text-white"
                      : "bg-surface-2 text-muted-foreground border border-border/60",
                  )}
                >
                  Ops
                </span>
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Tip: Press <kbd className="font-mono text-[9px] bg-surface-2 px-1 py-0.5 rounded border border-border">Alt + W</kbd> to toggle views
            </span>
          </div>
        </div>

        {/* Global Search Bar (Linear / Raycast Style Trigger) */}
        <button
          type="button"
          onClick={openSearch}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 sm:py-3.5 rounded-2xl border border-border bg-surface-1 hover:bg-surface-2/80 hover:border-accent/40 shadow-sm transition-all duration-150 text-left group cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Search className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
            <span className="text-xs sm:text-sm text-muted-foreground group-hover:text-foreground transition-colors truncate">
              What do you need to do? (e.g. net sheet, open house, signature, closing gift...)
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="hidden sm:inline-flex text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded-md bg-surface-2 border border-border">
              Quick Search
            </span>
            <kbd className="inline-flex items-center justify-center text-xs font-mono text-muted-foreground px-2 py-0.5 rounded-md bg-surface-2 border border-border font-semibold">
              ⌘K
            </kbd>
          </div>
        </button>

        {/* Quick Action Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-medium text-muted-foreground shrink-0 mr-1 hidden sm:inline">
            Quick links:
          </span>
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-border bg-surface-1 hover:bg-surface-2 hover:border-accent/30 text-foreground transition-all duration-150 shrink-0 shadow-2xs"
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

      {/* ─── Active Workspace Mode Rendering ─── */}
      {workspaceMode === "agent" ? (
        <AgentCockpit />
      ) : (
        <OperationsMissionControl />
      )}
    </div>
  );
}