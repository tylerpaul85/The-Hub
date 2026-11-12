import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar,
  LayoutDashboard,
  Users,
  LogOut,
  Video,
  Inbox,
  Target,
  ClipboardList,
  BarChart3,
  ShieldCheck,
  Ticket,
  ClipboardCheck,
  Boxes,
  Home,
  Mail,
  Calculator,
  Menu,
  Sparkles,
  Store,
  DoorOpen,
  Search,
  Share2,
  ShieldAlert,
  CreditCard,
  ChevronDown,
  Layers,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  ShoppingBag,
  Gift,
  FlaskConical,
  CalendarDays,
  CircleAlert,
  BookOpen,
  Send,
  ExternalLink,
  Radio,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import logo from "@/assets/msreg-logo.png";
import { NotificationBell } from "@/components/notification-bell";
import { QuickHeadlineButton } from "@/components/quick-headline-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const EXPERIMENT_EMAILS = ["tyler.p@mattsmithrealestategroup.com", "tylerpaul85@gmail.com"];

interface NavItem {
  to: string;
  label: string;
  icon: any;
  adminOnly?: boolean;
  marketingOnly?: boolean;
}

interface NavSection {
  title: string;
  code?: string;
  items: NavItem[];
  teamOnly?: boolean;
  adminOnly?: boolean;
  experimentsOnly?: boolean;
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Operations & Tasks",
    code: "01 // OPS",
    items: [
      { to: "/requests", label: "Requests Inbox", icon: Inbox },
      { to: "/tasks", label: "Projects & Tasks", icon: ClipboardCheck },
      { to: "/inventory", label: "Closing Gifts & Inventory", icon: Boxes },
      { to: "/admin/referrals", label: "Outbound Referrals", icon: Send },
      { to: "/admin-net-sheets", label: "Agent Net Sheets", icon: Calculator, adminOnly: true },
      { to: "/duty-calendar", label: "Duty Calendar", icon: CalendarDays },
      { to: "/duty-agents", label: "Duty Agents", icon: Users },
      { to: "/processes", label: "Internal Processes", icon: BookOpen },
    ],
  },
  {
    title: "Marketing & Media",
    code: "02 // MEDIA",
    teamOnly: true,
    items: [
      { to: "/toolbox", label: "Agent Marketing Toolbox", icon: Layers },
      { to: "/signatures", label: "Email Signatures", icon: Mail },
      { to: "/calendar", label: "Content Calendar", icon: Calendar, marketingOnly: true },
      { to: "/videos", label: "Video Pipeline", icon: Video, marketingOnly: true },
      { to: "/listings", label: "Active Listings", icon: Home },
      { to: "/special-events", label: "Special Events", icon: Sparkles },
    ],
  },
  {
    title: "EOS Leadership",
    code: "03 // LEADERSHIP",
    items: [
      { to: "/eos/l10", label: "L10 Meetings", icon: ClipboardList },
      { to: "/eos/rocks", label: "Quarterly Rocks", icon: Target },
      { to: "/eos/issues", label: "Issues List", icon: CircleAlert },
      { to: "/eos/scorecard", label: "Scorecard", icon: BarChart3 },
    ],
  },
  {
    title: "Administration",
    code: "04 // ADMIN",
    adminOnly: true,
    items: [
      { to: "/admin/swag-credits", label: "Swag Store Credits", icon: ShoppingBag },
      { to: "/admin/playbooks", label: "Playbooks Manager", icon: BookOpen },
      { to: "/users", label: "Team & Roles", icon: Users },
      { to: "/audit-log", label: "System Audit Log", icon: ShieldCheck },
    ],
  },
  {
    title: "Lab",
    code: "05 // LAB",
    experimentsOnly: true,
    items: [
      { to: "/experiments", label: "Experiments", icon: FlaskConical },
    ],
  },
];

const CLIENT_CARE_ALLOWED = [
  "/dashboard",
  "/toolbox",
  "/signatures",
  "/special-events",
  "/tasks",
  "/requests",
  "/inventory",
  "/admin/referrals",
  "/my-availability",
  "/duty-calendar",
  "/duty-agents",
];

function getPageTitle(pathname: string): string {
  const map: Record<string, string> = {
    "/dashboard": "Operations Console",
    "/calendar": "Content Calendar",
    "/meta-social": "Social & Analytics",
    "/open-houses": "Open Houses Hub",
    "/special-events": "Special Events",
    "/listings": "Active Listings",
    "/toolbox": "Agent Marketing Toolbox",
    "/videos": "Video Pipeline Kanban",
    "/requests": "Requests Inbox",
    "/tasks": "Projects & Tasks",
    "/processes": "Internal Processes",
    "/eos/l10": "L10 Meetings",
    "/eos/rocks": "Quarterly Rocks",
    "/eos/issues": "EOS Issues",
    "/eos/scorecard": "EOS Scorecard",
    "/inventory": "Closing Gifts & Inventory",
    "/closing-gift": "Closing Gift Request",
    "/referral-form": "Outbound Referral Sheet",
    "/referrals": "Outbound Referral Sheet",
    "/admin/referrals": "Outbound Referrals Desk",
    "/duty-calendar": "Duty Calendar",
    "/duty-agents": "Duty Agents",
    "/users": "Team Member Directory",
    "/signatures": "Email Signatures",
    "/admin-net-sheets": "Agent Net Sheets",
    "/admin/swag-credits": "Swag Store Credits",
    "/audit-log": "Audit Log",
    "/admin/assistant": "FUB AI Assistant",
    "/admin/audit": "Agent Audit System",
    "/admin/playbooks": "Playbooks Manager",
    "/experiments": "Experiments & Lab",
    "/seller-net-proceeds": "Seller Net Proceeds Calculator",
    "/vendors": "Trusted Vendor Guide",
  };
  if (map[pathname]) return map[pathname];
  const prefix = Object.keys(map).find((k) => pathname.startsWith(k + "/"));
  if (prefix) return map[prefix];
  return "";
}

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin, user, signOut, role, roles } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isMarketing = isAdmin || roles.includes("marketing_coordinator");
  const isVideoTeam =
    isAdmin ||
    roles.includes("marketing_coordinator") ||
    roles.includes("video_editor") ||
    roles.includes("videographer");
  const isClientCareOnly = roles.length > 0 && roles.every((r) => r === "client_care");
  const canSeeExperiments =
    isAdmin || EXPERIMENT_EMAILS.includes((user?.email ?? "").toLowerCase());

  // Live Operations Pulse Counters for Navigation Badges
  const { data: pendingMarketingCount = 0 } = useQuery({
    queryKey: ["shell-pending-marketing-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("marketing_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count ?? 0;
    },
    staleTime: 1000 * 30,
  });

  const { data: pendingGiftsCount = 0 } = useQuery({
    queryKey: ["shell-pending-gifts-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("closing_gift_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count ?? 0;
    },
    staleTime: 1000 * 30,
  });

  const getBadgeForPath = (to: string) => {
    if (to === "/requests" && pendingMarketingCount > 0) {
      return {
        label: `${pendingMarketingCount}`,
        className: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
      };
    }
    if (to === "/inventory" && pendingGiftsCount > 0) {
      return {
        label: `${pendingGiftsCount}`,
        className: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
      };
    }
    return null;
  };

  // Global Cmd+K shortcut listener and custom event trigger
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    const onCustomOpen = () => setCommandPaletteOpen(true);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-palette", onCustomOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-palette", onCustomOpen);
    };
  }, []);

  const pageTitle = getPageTitle(pathname);

  const userName =
    (user?.user_metadata as any)?.first_name || (user?.user_metadata as any)?.last_name
      ? [(user?.user_metadata as any)?.first_name, (user?.user_metadata as any)?.last_name]
          .filter(Boolean)
          .join(" ")
      : user?.email;

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  const filterNavSection = (section: NavSection) => {
    if (section.adminOnly && !isAdmin) return null;
    if (section.teamOnly && !isMarketing && !isVideoTeam && !isAdmin) return null;
    if (section.experimentsOnly && !canSeeExperiments) return null;

    const items = section.items.filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      if (item.marketingOnly && !isMarketing && !isVideoTeam && !isAdmin) return false;
      if (isClientCareOnly && !CLIENT_CARE_ALLOWED.includes(item.to)) return false;
      return true;
    });

    if (items.length === 0) return null;
    return { ...section, items };
  };

  const visibleSections = NAV_SECTIONS.map(filterNavSection).filter(Boolean) as NavSection[];

  return (
    <div className="h-screen h-[100dvh] flex bg-bg w-full max-w-full overflow-hidden text-text-primary antialiased font-sans">
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

      {/* ─── Desktop Sidebar ───────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-surface-1 border-r border-border transition-all duration-200 ease-out select-none",
          sidebarCollapsed ? "w-16" : "w-64",
        )}
      >
        {/* Header / Brand */}
        <div className="h-15 px-3.5 border-b border-border/80 flex items-center justify-between gap-2 shrink-0 bg-surface-1">
          <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0 group outline-none">
            <div className="h-8.5 w-8.5 rounded-xl bg-surface-2 border border-border/80 flex items-center justify-center shrink-0 p-1">
              <img src={logo} alt="MSREG" className="h-full w-auto object-contain transition-transform group-hover:scale-105" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-bold tracking-tight text-foreground font-sans">MSREG</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/25 text-[9px] font-mono font-semibold text-emerald-400">
                    <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                </div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono truncate">
                  Operations Console
                </p>
              </div>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-lg hidden lg:flex"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        {/* Operations Console Link */}
        <div className="px-2 pt-3 pb-1">
          <Link
            to="/dashboard"
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 relative group",
              isActive("/dashboard")
                ? "bg-accent/12 text-accent border border-accent/25 shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2/70 border border-transparent",
            )}
            title={sidebarCollapsed ? "Operations Console" : undefined}
          >
            <Radio className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-105", isActive("/dashboard") ? "text-accent animate-pulse" : "text-muted-foreground")} />
            {!sidebarCollapsed && <span>Operations Console</span>}
            {isActive("/dashboard") && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-accent rounded-r-full" />
            )}
          </Link>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-2 py-1 space-y-4 overflow-y-auto no-scrollbar">
          {visibleSections.map((section) => (
            <div key={section.title} className="space-y-0.5">
              {!sidebarCollapsed && (
                <div className="px-3 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-muted-foreground/60 flex items-center justify-between">
                  <span>{section.code || section.title}</span>
                </div>
              )}
              {section.items.map((item) => {
                const badge = getBadgeForPath(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to as any}
                    className={cn(
                      "group flex items-center justify-between px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all duration-150 relative",
                      isActive(item.to)
                        ? "bg-surface-2 text-foreground font-semibold border border-border shadow-2xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-2/50 border border-transparent",
                    )}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive(item.to) ? "text-accent" : "text-muted-foreground group-hover:text-foreground")} />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!sidebarCollapsed && badge && (
                      <span className={cn("px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold", badge.className)}>
                        {badge.label}
                      </span>
                    )}
                    {isActive(item.to) && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3.5 bg-accent rounded-r-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Quick Bridge to Agent Hub */}
        <div className="p-2 border-t border-border/80 shrink-0 bg-surface-1">
          <Link
            to="/agents"
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded-xl bg-surface-2/70 hover:bg-surface-2 border border-border text-xs font-semibold text-foreground transition-all group shadow-2xs",
              sidebarCollapsed && "justify-center px-1.5",
            )}
            title="Open Public Agent Hub"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">Agent Suite</div>
                  <div className="text-[10px] text-muted-foreground truncate font-mono">External Portal</div>
                </div>
              )}
            </div>
            {!sidebarCollapsed && (
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
            )}
          </Link>
        </div>

        {/* User Footer */}
        <div className="p-2 border-t border-border/80 shrink-0 bg-surface-1">
          <div className={cn("flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-surface-2/50 border border-border/50", sidebarCollapsed && "justify-center px-1 border-none bg-transparent")}>
            <div className="h-7.5 w-7.5 rounded-xl bg-accent/15 border border-accent/25 text-accent flex items-center justify-center font-bold text-xs shrink-0 font-mono">
              {(userName?.[0] ?? "U").toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-foreground truncate">{userName}</div>
                <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider truncate">
                  {role ? role.replace(/_/g, " ") : "Operations"}
                </div>
              </div>
            )}
            {!sidebarCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="h-7 w-7 text-muted-foreground hover:text-status-danger hover:bg-surface-2 rounded-lg shrink-0"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Main Content Canvas ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 w-full max-w-full h-full overflow-hidden bg-bg">
        {/* Top Header */}
        <header className="sticky top-0 z-30 shrink-0 w-full border-b border-border bg-surface-1/80 backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
          <div className="flex items-center justify-between px-3 sm:px-6 h-13 w-full gap-3">
            {/* Left: Mobile hamburger or Desktop Page Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden h-9 w-9 text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="md:hidden flex items-center gap-2">
                <img src={logo} alt="MSREG" className="h-6 w-auto" />
                <span className="text-xs font-bold uppercase tracking-wider text-accent">The Hub</span>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <span className="text-xs font-medium text-text-muted">The Hub</span>
                <ChevronRight className="h-3 w-3 text-text-muted/60" />
                <span className="text-xs font-semibold text-text-primary">{pageTitle || "Overview"}</span>
              </div>
            </div>

            {/* Middle: Fast Search Launcher Button */}
            <div className="flex-1 max-w-md mx-auto hidden sm:block">
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="w-full h-8.5 px-3 rounded-xl border border-border bg-surface-2/60 hover:bg-surface-2 hover:border-accent/40 flex items-center justify-between text-xs text-muted-foreground transition-all duration-150 cursor-pointer shadow-2xs group"
              >
                <span className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
                  <span className="group-hover:text-foreground transition-colors">Search staff operations, requests & schedule...</span>
                </span>
                <kbd className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface-1 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground font-semibold">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* Right: Actions & Theme Toggle */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="sm:hidden h-9 w-9 rounded-md flex items-center justify-center text-text-secondary hover:bg-surface-2"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
              <QuickHeadlineButton />
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* ─── Mobile Bottom Tab Bar ───────────────────────────────── */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-1/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom,0px)]">
          <div className="grid grid-cols-4 h-14">
            <Link
              to="/dashboard"
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                isActive("/dashboard") ? "text-accent font-semibold" : "text-text-muted hover:text-text-primary",
              )}
            >
              <Radio className="h-4 w-4" />
              <span>Console</span>
            </Link>

            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-text-muted hover:text-text-primary"
            >
              <Search className="h-4 w-4" />
              <span>Search</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-text-muted hover:text-text-primary relative"
            >
              <Layers className="h-4 w-4" />
              <span>Operations</span>
              {(pendingMarketingCount > 0 || pendingGiftsCount > 0) && (
                <span className="absolute top-2 right-6 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={signOut}
              className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-text-muted hover:text-status-danger"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* ─── Mobile Drawer ───────────────────────────────────────── */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-72 bg-surface-1 p-0 border-border flex flex-col h-full text-text-primary">
            <SheetHeader className="px-4 py-4 border-b border-border pt-[max(1rem,calc(env(safe-area-inset-top,0px)+0.75rem))]">
              <div className="flex items-center gap-2.5">
                <img src={logo} alt="Matt Smith Real Estate Group" className="h-8 w-auto shrink-0" />
                <div className="min-w-0 text-left">
                  <SheetTitle className="text-xs font-bold uppercase tracking-widest text-text-primary truncate">
                    MSREG Operations
                  </SheetTitle>
                  <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mt-px truncate">
                    Staff Navigation
                  </p>
                </div>
              </div>
            </SheetHeader>

            <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
              <Link
                to="/dashboard"
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                  isActive("/dashboard") ? "bg-accent/12 text-accent font-semibold" : "text-text-secondary hover:bg-surface-2",
                )}
              >
                <Radio className="h-4 w-4 shrink-0" />
                <span>Operations Console</span>
              </Link>

              {visibleSections.map((section) => (
                <div key={section.title} className="space-y-0.5">
                  <div className="px-3 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                    {section.code || section.title}
                  </div>
                  {section.items.map((item) => {
                    const badge = getBadgeForPath(item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to as any}
                        onClick={() => setMobileNavOpen(false)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                          isActive(item.to)
                            ? "bg-surface-2 text-foreground font-semibold"
                            : "text-text-secondary hover:bg-surface-2/60",
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {badge && (
                          <span className={cn("px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold", badge.className)}>
                            {badge.label}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Quick Bridge to Agent Hub */}
            <div className="p-3 border-t border-border">
              <Link
                to="/agents"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-2/70 border border-border/80 text-xs font-semibold text-text-secondary hover:text-text-primary transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>View Public Agent Hub</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-accent" />
              </Link>
            </div>

            <div className="p-3 border-t border-border bg-surface-2/40 pb-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.75rem))]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-text-primary">{userName}</div>
                  <div className="text-[10px] text-text-muted capitalize">{role ?? "Agent"}</div>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Main Route Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto pb-16 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
