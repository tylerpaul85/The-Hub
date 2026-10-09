import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  items: NavItem[];
  teamOnly?: boolean;
  adminOnly?: boolean;
  experimentsOnly?: boolean;
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Market a Listing",
    items: [
      { to: "/listings", label: "Active Listings", icon: Home },
      { to: "/open-houses", label: "Open Houses", icon: DoorOpen },
    ],
  },
  {
    title: "Work With Clients",
    items: [
      { to: "/seller-net-proceeds", label: "Net Proceeds Calculator", icon: Calculator },
      { to: "/vendors", label: "Trusted Vendors", icon: Store },
      { to: "/closing-gift", label: "Closing Gift Request", icon: Gift },
    ],
  },
  {
    title: "My Brand",
    items: [
      { to: "/signatures", label: "Email Signatures", icon: Mail },
      { to: "/toolbox", label: "Brand Assets & Toolbox", icon: CreditCard },
    ],
  },
  {
    title: "Perks & Events",
    items: [
      { to: "/admin/swag-credits", label: "Swag Store & Credits", icon: ShoppingBag },
      { to: "/special-events", label: "Special Events", icon: Sparkles },
    ],
  },
  {
    title: "Team Workspace",
    teamOnly: true,
    items: [
      { to: "/calendar", label: "Content Calendar", icon: Calendar, marketingOnly: true },
      { to: "/videos", label: "Video Pipeline", icon: Video, marketingOnly: true },
      { to: "/requests", label: "Requests Inbox", icon: Inbox },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/tasks", label: "Projects & Tasks", icon: ClipboardCheck },
      { to: "/inventory", label: "Closing Gifts & Inventory", icon: Boxes },
      { to: "/admin-net-sheets", label: "Agent Net Sheets", icon: Calculator, adminOnly: true },
      { to: "/duty-calendar", label: "Duty Calendar", icon: CalendarDays },
      { to: "/duty-agents", label: "Duty Agents", icon: Users },
      { to: "/processes", label: "Internal Processes", icon: BookOpen },
    ],
  },
  {
    title: "EOS",
    items: [
      { to: "/eos/l10", label: "L10 Meetings", icon: ClipboardList },
      { to: "/eos/rocks", label: "Rocks", icon: Target },
      { to: "/eos/issues", label: "Issues", icon: CircleAlert },
      { to: "/eos/scorecard", label: "Scorecard", icon: BarChart3 },
    ],
  },
  {
    title: "Lab",
    experimentsOnly: true,
    items: [
      { to: "/experiments", label: "Experiments", icon: FlaskConical },
    ],
  },
  {
    title: "Admin",
    adminOnly: true,
    items: [
      { to: "/users", label: "Team & Roles", icon: Users },
      { to: "/audit-log", label: "System Audit Log", icon: ShieldCheck },
    ],
  },
];

const CLIENT_CARE_ALLOWED = [
  "/dashboard",
  "/special-events",
  "/tasks",
  "/requests",
  "/inventory",
  "/closing-gift",
  "/my-availability",
  "/duty-calendar",
  "/duty-agents",
];

function getPageTitle(pathname: string): string {
  const map: Record<string, string> = {
    "/dashboard": "Home Launcher",
    "/calendar": "Content Calendar",
    "/meta-social": "Social & Analytics",
    "/open-houses": "Open Houses Hub",
    "/special-events": "Special Events",
    "/listings": "Active Listings",
    "/toolbox": "Brand Assets & Toolbox",
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
    "/duty-calendar": "Duty Calendar",
    "/duty-agents": "Duty Agents",
    "/users": "Team Member Directory",
    "/signatures": "Email Signatures",
    "/admin-net-sheets": "Agent Net Sheets",
    "/admin/swag-credits": "Swag Store Credits",
    "/audit-log": "Audit Log",
    "/admin/assistant": "FUB AI Assistant",
    "/admin/audit": "Agent Audit System",
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
          sidebarCollapsed ? "w-16" : "w-60",
        )}
      >
        {/* Header / Brand */}
        <div className="h-14 px-3.5 border-b border-border flex items-center justify-between gap-2 shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0 group outline-none">
            <img src={logo} alt="MSREG" className="h-8 w-auto shrink-0 transition-transform group-hover:scale-105" />
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-text-primary truncate">
                  MSREG
                </p>
                <p className="text-[10px] uppercase tracking-wider text-accent font-semibold -mt-0.5 truncate">
                  The Hub
                </p>
              </div>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-7 w-7 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded-md hidden lg:flex"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        {/* Home / Launcher Link */}
        <div className="px-2 pt-3 pb-1">
          <Link
            to="/dashboard"
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors",
              isActive("/dashboard")
                ? "bg-accent/12 text-accent font-semibold"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-2",
            )}
            title={sidebarCollapsed ? "Home Launcher" : undefined}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Home Launcher</span>}
          </Link>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-2 py-1 space-y-4 overflow-y-auto no-scrollbar">
          {visibleSections.map((section) => (
            <div key={section.title} className="space-y-0.5">
              {!sidebarCollapsed && (
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted/70">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to as any}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                    isActive(item.to)
                      ? "bg-accent/12 text-accent font-semibold"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-2",
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-2 border-t border-border shrink-0 bg-surface-1">
          <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md", !sidebarCollapsed && "bg-surface-2/60")}>
            <div className="h-7 w-7 rounded-full bg-accent/15 text-accent flex items-center justify-center font-semibold text-xs shrink-0">
              {(userName?.[0] ?? "U").toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-text-primary truncate">{userName}</div>
                <div className="text-[10px] text-text-muted capitalize truncate">{role ?? "Agent"}</div>
              </div>
            )}
            {!sidebarCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="h-7 w-7 text-text-muted hover:text-status-danger hover:bg-surface-2 rounded-md shrink-0"
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
                className="w-full h-8 px-3 rounded-lg border border-border bg-surface-2/60 hover:bg-surface-2 hover:border-border-subtle flex items-center justify-between text-xs text-text-muted transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-text-muted" />
                  <span>Search tools & listings...</span>
                </span>
                <kbd className="inline-flex items-center gap-0.5 rounded border border-border bg-surface-1 px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
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
              <Home className="h-4 w-4" />
              <span>Home</span>
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
              className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-text-muted hover:text-text-primary"
            >
              <Layers className="h-4 w-4" />
              <span>All Tools</span>
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
                    MSREG Hub
                  </SheetTitle>
                  <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mt-px truncate">
                    Navigation
                  </p>
                </div>
              </div>
            </SheetHeader>

            <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
              <Link
                to="/dashboard"
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive("/dashboard") ? "bg-accent/12 text-accent font-semibold" : "text-text-secondary hover:bg-surface-2",
                )}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span>Home Launcher</span>
              </Link>

              {visibleSections.map((section) => (
                <div key={section.title} className="space-y-0.5">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    {section.title}
                  </div>
                  {section.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to as any}
                      onClick={() => setMobileNavOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive(item.to)
                          ? "bg-accent/12 text-accent font-semibold"
                          : "text-text-secondary hover:bg-surface-2",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </nav>

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
