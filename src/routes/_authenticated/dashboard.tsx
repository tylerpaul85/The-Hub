import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
  DoorOpen,
  Boxes,
  Calculator,
  Store,
  Sparkles,
  Mail,
  CreditCard,
  ShoppingBag,
  Share2,
  Video,
  ShieldAlert,
  ArrowRight,
  Search,
  Bot,
  Target,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Inbox,
  Clock,
  Sparkle,
  ClipboardList,
  CircleAlert,
  BarChart3,
  FlaskConical,
} from "lucide-react";
import { MyRocksWidget } from "@/components/my-rocks-widget";
import { MyTasksWidget } from "@/components/my-tasks-widget";
import { QuoteOfTheDay } from "@/components/quote-of-the-day";
import { ClientCareClosingGifts } from "@/components/client-care-closing-gifts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Launcher Home — MSREG Marketing Hub" }] }),
});

interface ToolCard {
  title: string;
  badge: string;
  description: string;
  to: string;
  icon: any;
  accent?: string;
  adminOnly?: boolean;
}

interface ToolGroup {
  id: string;
  title: string;
  subtitle: string;
  tools: ToolCard[];
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function DashboardToolCard({ tool }: { tool: ToolCard }) {
  const IconComponent = tool.icon;
  return (
    <Link
      to={tool.to}
      className="group relative flex flex-col justify-between p-4.5 sm:p-5 rounded-2xl border border-border/80 bg-surface-1/90 hover:bg-surface-1 hover:border-accent/50 shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.65),0_0_24px_-4px_rgba(196,90,44,0.22)] hover:-translate-y-1 active:translate-y-0 active:scale-[0.985] transition-all duration-300 backdrop-blur-md min-h-[175px] ring-1 ring-inset ring-white/[0.06] cursor-pointer select-none overflow-hidden"
    >
      {/* Top subtle ambient glow highlight */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 group-hover:via-accent/50 to-transparent transition-all duration-300" />

      {/* Upper row: Squircle Icon receptacle + Badge & Action glyph */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="h-11 w-11 rounded-xl bg-surface-2/95 border border-white/[0.08] flex items-center justify-center text-foreground group-hover:text-accent group-hover:bg-accent/10 group-hover:border-accent/30 group-hover:scale-105 transition-all duration-300 shadow-inner shrink-0">
          <IconComponent className="h-5 w-5 stroke-[1.75]" />
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/80 group-hover:text-accent transition-colors px-2.5 py-0.5 rounded-full bg-surface-2/80 border border-border/70 truncate max-w-[130px]">
            {tool.badge}
          </span>
          <div className="h-6 w-6 rounded-full bg-surface-2/60 border border-border/60 flex items-center justify-center text-muted-foreground/60 group-hover:text-accent group-hover:border-accent/40 group-hover:translate-x-0.5 transition-all">
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </div>

      {/* Middle: Content */}
      <div className="space-y-1 pt-3 pb-1 text-left">
        <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground group-hover:text-accent transition-colors leading-snug line-clamp-1">
          {tool.title}
        </h3>
        <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {tool.description}
        </p>
      </div>

      {/* Bottom: Subtle affordance accent bar */}
      <div className="pt-2.5 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground/70">
        <span className="group-hover:text-foreground font-medium transition-colors">
          Open Workspace
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 group-hover:bg-accent transition-colors" />
      </div>
    </Link>
  );
}

function Dashboard() {
  const { user, isAdmin, roles } = useAuth();
  const detail = useContentDetail();

  const isMarketing = isAdmin || roles?.includes("marketing_coordinator");
  const isVideoTeam =
    isAdmin ||
    roles?.includes("marketing_coordinator") ||
    roles?.includes("video_editor") ||
    roles?.includes("videographer");
  const isClientCare = roles?.includes("client_care");
  const isOperationsUser = isMarketing || isVideoTeam || isClientCare || isAdmin;

  // State to toggle Operational widgets (Rocks / Tasks)
  const [showOpsWidgets, setShowOpsWidgets] = useState(isOperationsUser);

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

  const firstName =
    (user?.user_metadata as any)?.first_name ||
    user?.email?.split("@")[0] ||
    "there";

  const openSearch = () => {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  };

  // Tool Groups organized by agent jobs
  const EXPERIMENT_EMAILS = ["tyler.p@mattsmithrealestategroup.com", "tylerpaul85@gmail.com"];
  const canSeeExperiments =
    isAdmin || EXPERIMENT_EMAILS.includes((user?.email ?? "").toLowerCase());

  const toolGroups: ToolGroup[] = [
    {
      id: "market-listing",
      title: "Market a Listing",
      subtitle: "MLS sync, open house kiosks, and listing packages",
      tools: [
        {
          title: "Active Listings",
          badge: "MLS Live",
          description: "Manage MLS-synced properties, flyer kits, and listing marketing packages.",
          to: "/listings",
          icon: Home,
        },
        {
          title: "Open Houses",
          badge: "Lead Kiosk",
          description: "Digital sign-in sheets, iPad kiosks, QR registration, and instant FUB sync.",
          to: "/open-houses",
          icon: DoorOpen,
        },
      ],
    },
    {
      id: "work-with-clients",
      title: "Work With Clients",
      subtitle: "Instant calculators, vendor referrals, and closing gifts",
      tools: [
        {
          title: "Net Proceeds Calculator",
          badge: "Agent Tool",
          description: "Generate clean seller net sheets for listing appointments and contract negotiations.",
          to: "/seller-net-proceeds",
          icon: Calculator,
        },
        {
          title: "Trusted Vendors",
          badge: "Directory",
          description: "Search vetted contractors, home inspectors, painters, stagers, and lenders.",
          to: "/vendors",
          icon: Store,
        },
        {
          title: "Closing Gift Request",
          badge: "Client Care",
          description: "Submit high-touch housewarming gifts and track courier delivery for move-in day.",
          to: "/closing-gift",
          icon: Sparkles,
        },
        ...(isAdmin || isOperationsUser
          ? [
              {
                title: "Agent Net Sheets",
                badge: "Operations",
                description: "View all generated seller net proceeds sheets across all agents with PDF downloads.",
                to: "/admin-net-sheets",
                icon: Calculator,
              },
            ]
          : []),
        ...(isAdmin
          ? [
              {
                title: "FUB AI Assistant",
                badge: "Claude 3.5",
                description: "AI companion connected to Follow Up Boss to draft outreach and review lead velocity.",
                to: "/admin/assistant",
                icon: Bot,
                adminOnly: true,
              },
            ]
          : []),
      ],
    },
    {
      id: "my-brand",
      title: "My Brand",
      subtitle: "Compliant email signatures, logos, and marketing templates",
      tools: [
        {
          title: "Email Signatures",
          badge: "Gmail Sync",
          description: "Generate and deploy your compliant MSREG email signature directly to Google Workspace.",
          to: "/signatures",
          icon: Mail,
        },
        {
          title: "Brand Assets & Toolbox",
          badge: "Canva & Guides",
          description: "Download vector logos, access Canva templates, hex color codes, and print standards.",
          to: "/toolbox",
          icon: CreditCard,
        },
      ],
    },
    {
      id: "perks-events",
      title: "Perks & Events",
      subtitle: "Company swag store, allowances, and annual gatherings",
      tools: [
        {
          title: "Swag Store & Credits",
          badge: "Shopify",
          description: "Check your quarterly swag balance and order branded jackets, caps, and notebooks.",
          to: "/admin/swag-credits",
          icon: ShoppingBag,
        },
        {
          title: "Special Events",
          badge: "RSVP",
          description: "Register for masterminds, community give-backs, and team celebrations.",
          to: "/special-events",
          icon: Sparkle,
        },
      ],
    },
  ];

  // Operations group (for Operations, Client Care, and Admin)
  const operationsGroup: ToolGroup = {
    id: "operations",
    title: "Operations & Client Care",
    subtitle: "Closing gift inventory, tasks, duty schedules, and agent net sheets",
    tools: [
      {
        title: "Closing Gifts & Inventory",
        badge: "Inventory & Requests",
        description: "View all agent gift requests and manage shirt inventory stock together in one place.",
        to: "/inventory",
        icon: Boxes,
      },
      {
        title: "Projects & Tasks",
        badge: "EOS Tasks",
        description: "Track operational deliverables, marketing requests, and team projects.",
        to: "/tasks",
        icon: ClipboardCheck,
      },
      {
        title: "Duty Calendar",
        badge: "Schedule",
        description: "Monthly floor and phone duty schedule, assigned agents, and coverage.",
        to: "/duty-calendar",
        icon: Calendar,
      },
      {
        title: "Agent Net Sheets",
        badge: "All Sheets",
        description: "Search and inspect every seller net sheet generated by agents across the firm.",
        to: "/admin-net-sheets",
        icon: Calculator,
      },
    ],
  };

  // Team workspace group (role-gated)
  const teamGroup: ToolGroup = {
    id: "team-workspace",
    title: "Team Marketing Workspace",
    subtitle: "Production pipelines, publishing schedule, and requests inbox",
    tools: [
      {
        title: "Content Calendar",
        badge: "Social Schedule",
        description: "Plan, review, approve, and sequence social content across Instagram, Facebook, and LinkedIn.",
        to: "/calendar",
        icon: Calendar,
      },
      {
        title: "Video Pipeline",
        badge: "Kanban",
        description: "Track reel production, listing walkthroughs, and agent interviews from shoot to final cut.",
        to: "/videos",
        icon: Video,
      },
      {
        title: "Requests Inbox",
        badge: "Inbound",
        description: "Review incoming agent marketing requests, photo edits, and design requests.",
        to: "/requests",
        icon: Inbox,
      },
    ],
  };

  const quickActions = [
    { label: "Net Sheet", to: "/seller-net-proceeds", icon: Calculator },
    { label: "Open House", to: "/open-houses", icon: DoorOpen },
    { label: "Email Signature", to: "/signatures", icon: Mail },
    { label: "Special Events", to: "/special-events", icon: Sparkles },
    { label: "Swag Store", to: "/admin/swag-credits", icon: ShoppingBag },
    { label: "Brand Assets", to: "/toolbox", icon: CreditCard },
    { label: "Vendor List", to: "/vendors", icon: Store },
    ...(isOperationsUser
      ? [
          { label: "Closing Gifts & Inventory", to: "/inventory", icon: Boxes },
          { label: "Agent Net Sheets", to: "/admin-net-sheets", icon: Calculator },
          { label: "Quarterly Rocks", to: "/eos/rocks", icon: Target },
        ]
      : []),
    ...(canSeeExperiments
      ? [{ label: "Experiments & Lab", to: "/experiments", icon: Sparkles }]
      : []),
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Top Greeting & Search Launcher */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-accent">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-foreground mt-1">
              {getTimeGreeting()}, {firstName}.
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Welcome to the MSREG Marketing Hub. Jump into any tool or press{" "}
              <kbd className="px-1.5 py-0.5 text-xs font-mono rounded bg-surface-2 border border-border text-foreground">
                ⌘K
              </kbd>{" "}
              to search.
            </p>
          </div>
        </div>

        {/* Global Search Bar (Raycast / Linear Trigger) */}
        <button
          type="button"
          onClick={openSearch}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 sm:py-3.5 rounded-xl border border-border bg-surface-1 hover:bg-surface-2/80 hover:border-accent/40 shadow-xs transition-all duration-150 text-left group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Search className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors truncate">
              What are you looking to do today? (e.g., net sheet, signature, open house...)
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface-1 hover:bg-surface-2 hover:border-accent/30 text-foreground transition-all duration-150 shrink-0 shadow-2xs"
            >
              <action.icon className="h-3.5 w-3.5 text-accent shrink-0" />
              <span>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Action Items Notification Strip (If items require revision or approval) */}
      {actionItems.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 shadow-xs transition-all">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <h2 className="text-sm font-semibold text-foreground tracking-tight">
                Needs Your Attention ({actionItems.length})
              </h2>
            </div>
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Action Required
            </span>
          </div>
          <div className="divide-y divide-border/40 border border-border/50 rounded-lg bg-surface-1 overflow-hidden">
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

      {/* Client Care Highlight (if client_care role) */}
      {isClientCare && <ClientCareClosingGifts />}

      {/* Job-Centric Tool Grid */}
      <div className="space-y-8">
        {toolGroups.map((group) => (
          <section key={group.id} className="space-y-3">
            <div className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-2">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
                  {group.title}
                </h2>
                <p className="text-xs text-muted-foreground">{group.subtitle}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {group.tools.map((tool) => (
                <DashboardToolCard key={tool.to} tool={tool} />
              ))}
            </div>
          </section>
        ))}

        {/* Team Marketing Workspace (Role-gated for Team / Marketing / Admin) */}
        {(isMarketing || isVideoTeam || isAdmin) && (
          <section className="space-y-3 pt-2">
            <div className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
                    {teamGroup.title}
                  </h2>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                    Team Only
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{teamGroup.subtitle}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {teamGroup.tools.map((tool) => (
                <DashboardToolCard key={tool.to} tool={tool} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Operational Overview (Rocks & Tasks) - Collapsible Section */}
      <section className="pt-4 border-t border-border/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" />
              Operational Focus & EOS
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quarterly rocks, L10 meetings, assigned deliverables, and accountability.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/eos/rocks"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent/10 hover:bg-accent/20 text-accent border border-accent/25 transition-colors"
            >
              <Target className="h-3.5 w-3.5" />
              <span>View & Add Rocks</span>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOpsWidgets(!showOpsWidgets)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showOpsWidgets ? (
                <>
                  Collapse <ChevronUp className="h-3.5 w-3.5 ml-1" />
                </>
              ) : (
                <>
                  Expand <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* EOS Quick Nav Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Link
            to="/eos/rocks"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface-1 hover:bg-surface-2 text-foreground transition-all shrink-0"
          >
            <Target className="h-3.5 w-3.5 text-accent" />
            <span>Quarterly Rocks</span>
          </Link>
          <Link
            to="/eos/l10"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface-1 hover:bg-surface-2 text-foreground transition-all shrink-0"
          >
            <ClipboardList className="h-3.5 w-3.5 text-accent" />
            <span>L10 Meetings</span>
          </Link>
          <Link
            to="/eos/issues"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface-1 hover:bg-surface-2 text-foreground transition-all shrink-0"
          >
            <CircleAlert className="h-3.5 w-3.5 text-accent" />
            <span>Issues List</span>
          </Link>
          <Link
            to="/eos/scorecard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface-1 hover:bg-surface-2 text-foreground transition-all shrink-0"
          >
            <BarChart3 className="h-3.5 w-3.5 text-accent" />
            <span>Scorecard</span>
          </Link>
        </div>

        {showOpsWidgets && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MyRocksWidget />
              <MyTasksWidget />
            </div>

            {/* Operations Tool Cards */}
            {isOperationsUser && (
              <div className="space-y-3 pt-2">
                <div className="border-b border-border/60 pb-2">
                  <h3 className="text-sm font-semibold text-foreground tracking-tight">
                    {operationsGroup.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">{operationsGroup.subtitle}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {operationsGroup.tools.map((tool) => (
                    <DashboardToolCard key={tool.to} tool={tool} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Lab / Experiments Section (For Eligible Users) */}
      {canSeeExperiments && (
        <section className="pt-4 border-t border-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-amber-500" />
                Experiments & Lab
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Duty calendar, Follow Up Boss agent audit system, and Meta publishing & analytics.
              </p>
            </div>
            <Link
              to="/experiments"
              className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
            >
              Open Lab <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Link
              to="/duty-calendar"
              className="group relative p-4.5 rounded-2xl border border-border/80 bg-surface-1/95 hover:bg-surface-2/90 hover:border-amber-500/40 shadow-2xs hover:shadow-[0_16px_36px_-10px_rgba(0,0,0,0.45),0_0_24px_-6px_rgba(245,158,11,0.2)] hover:-translate-y-1 active:translate-y-0 active:scale-[0.985] transition-all duration-200 ring-1 ring-inset ring-white/[0.04] flex flex-col justify-between select-none"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-surface-2/90 border border-white/[0.08] flex items-center justify-center text-amber-500 group-hover:scale-105 group-hover:bg-amber-500/10 group-hover:border-amber-500/30 transition-all shadow-inner">
                    <Calendar className="h-5 w-5 stroke-[1.75]" />
                  </div>
                  <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-surface-2/70 text-muted-foreground border border-border/60">
                    Schedule
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground group-hover:text-amber-500 transition-colors flex items-center justify-between">
                    <span>Duty Calendar</span>
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-amber-500" />
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                    Monthly floor and phone duty schedule, assigned agents, and shift trading.
                  </p>
                </div>
              </div>
              <div className="h-0.5 w-6 rounded-full bg-border/40 group-hover:w-12 group-hover:bg-amber-500/60 transition-all duration-200 mt-2" />
            </Link>

            <Link
              to="/admin/audit"
              className="group relative p-4.5 rounded-2xl border border-border/80 bg-surface-1/95 hover:bg-surface-2/90 hover:border-amber-500/40 shadow-2xs hover:shadow-[0_16px_36px_-10px_rgba(0,0,0,0.45),0_0_24px_-6px_rgba(245,158,11,0.2)] hover:-translate-y-1 active:translate-y-0 active:scale-[0.985] transition-all duration-200 ring-1 ring-inset ring-white/[0.04] flex flex-col justify-between select-none"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-surface-2/90 border border-white/[0.08] flex items-center justify-center text-amber-500 group-hover:scale-105 group-hover:bg-amber-500/10 group-hover:border-amber-500/30 transition-all shadow-inner">
                    <ShieldAlert className="h-5 w-5 stroke-[1.75]" />
                  </div>
                  <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-surface-2/70 text-muted-foreground border border-border/60">
                    CRM Audit
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground group-hover:text-amber-500 transition-colors flex items-center justify-between">
                    <span>Agent Audit System</span>
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-amber-500" />
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                    Follow Up Boss CRM pipeline quality, lead speed-to-lead, and compliance.
                  </p>
                </div>
              </div>
              <div className="h-0.5 w-6 rounded-full bg-border/40 group-hover:w-12 group-hover:bg-amber-500/60 transition-all duration-200 mt-2" />
            </Link>

            <Link
              to="/meta-social"
              className="group relative p-4.5 rounded-2xl border border-border/80 bg-surface-1/95 hover:bg-surface-2/90 hover:border-amber-500/40 shadow-2xs hover:shadow-[0_16px_36px_-10px_rgba(0,0,0,0.45),0_0_24px_-6px_rgba(245,158,11,0.2)] hover:-translate-y-1 active:translate-y-0 active:scale-[0.985] transition-all duration-200 ring-1 ring-inset ring-white/[0.04] flex flex-col justify-between select-none"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-surface-2/90 border border-white/[0.08] flex items-center justify-center text-amber-500 group-hover:scale-105 group-hover:bg-amber-500/10 group-hover:border-amber-500/30 transition-all shadow-inner">
                    <Share2 className="h-5 w-5 stroke-[1.75]" />
                  </div>
                  <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-surface-2/70 text-muted-foreground border border-border/60">
                    Meta Graph
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground group-hover:text-amber-500 transition-colors flex items-center justify-between">
                    <span>Social &amp; Meta</span>
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-amber-500" />
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                    Direct FB/IG page publishing, comments, and engagement analytics.
                  </p>
                </div>
              </div>
              <div className="h-0.5 w-6 rounded-full bg-border/40 group-hover:w-12 group-hover:bg-amber-500/60 transition-all duration-200 mt-2" />
            </Link>
          </div>
        </section>
      )}

      {/* Team Content Review Section (For Admins and Marketing Coordinators) */}
      {(isAdmin || roles?.includes("marketing_coordinator")) && (
        <section className="pt-4 border-t border-border/60">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* My Action Items */}
            <div className="bg-surface-1 border border-border rounded-xl shadow-xs overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
                <ListTodo className="h-4 w-4 text-accent shrink-0" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pending Review Items
                </h3>
                {actionItems.length > 0 && (
                  <span className="ml-auto text-[11px] font-semibold text-accent tabular-nums bg-accent/10 px-2 py-0.5 rounded-full shrink-0">
                    {actionItems.length}
                  </span>
                )}
              </div>
              <div className="divide-y divide-border/50">
                {isLoading && (
                  <div className="space-y-2.5 p-5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                )}
                {!isLoading && actionItems.length === 0 && (
                  <div className="py-8 px-4 flex flex-col items-center text-center">
                    <ListTodo className="h-5 w-5 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">No pending items requiring review.</p>
                  </div>
                )}
                {!isLoading &&
                  actionItems.map((item) => (
                    <Row key={item.id} item={item} onOpen={() => detail.open(item.id)} />
                  ))}
              </div>
            </div>

            {/* Approved & Ready */}
            <div className="bg-surface-1 border border-border rounded-xl shadow-xs overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Approved & Scheduled Content
                </h3>
                <span className="ml-auto text-[11px] text-muted-foreground tabular-nums bg-surface-2 px-2 py-0.5 rounded-full shrink-0">
                  {approved.length}
                </span>
              </div>
              <div className="divide-y divide-border/50">
                {isLoading && (
                  <div className="space-y-2.5 p-5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                )}
                {!isLoading && approved.length === 0 && (
                  <div className="py-8 px-4 flex flex-col items-center text-center">
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">No approved content currently scheduled.</p>
                  </div>
                )}
                {!isLoading &&
                  approved.map((item) => (
                    <Row key={item.id} item={item} onOpen={() => detail.open(item.id)} />
                  ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ item, onOpen }: { item: ContentItem; onOpen: () => void }) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-surface-2 transition-colors duration-100 min-w-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-2">
          <span className="truncate text-foreground">{item.title}</span>
          <StatusBadge className={cn("shrink-0", STATUS_CLASS[item.status as Status])}>
            {STATUS_LABEL[item.status as Status]}
          </StatusBadge>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span>{format(new Date(item.scheduled_at), "MMM d, yyyy · h:mm a")}</span>
          {(item.platforms || []).map((p) => (
            <span key={p} className="px-1.5 py-px bg-surface-2 rounded text-[11px] shrink-0 border border-border/50">
              {p}
            </span>
          ))}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onOpen} className="shrink-0 text-xs h-7.5">
        Open <ExternalLink className="h-3 w-3 ml-1" />
      </Button>
    </div>
  );
}
