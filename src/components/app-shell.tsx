import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Calendar,
  LayoutDashboard,
  Users,
  LogOut,
  Video,
  BookOpen,
  Inbox,
  Target,
  ClipboardList,
  BarChart3,
  ShieldCheck,
  Ticket,
  Wrench,
  ClipboardCheck,
  CircleAlert,
  FlaskConical,
  Boxes,
  CalendarDays,
  Home,
  Bot,
  Mail,
  Calculator,
  Menu,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import logo from "@/assets/msreg-logo.png";
import { NotificationBell } from "@/components/notification-bell";
import { QuickHeadlineButton } from "@/components/quick-headline-button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { to: "/calendar", label: "Calendar", icon: Calendar, adminOnly: false },
  { to: "/listings", label: "Listings", icon: Home, adminOnly: false },
  { to: "/toolbox", label: "Agent Toolbox", icon: Wrench, adminOnly: false },
  { to: "/videos", label: "Video Pipeline", icon: Video, adminOnly: false },
  { to: "/requests", label: "Requests", icon: Inbox, adminOnly: false },
  { to: "/tasks", label: "Projects & Tasks", icon: ClipboardCheck, adminOnly: false },
  { to: "/processes", label: "Internal Processes", icon: BookOpen, adminOnly: false },
] as const;

const EOS_NAV = [
  { to: "/eos/l10", label: "L10 Meetings", icon: ClipboardList, adminOnly: false },
  { to: "/eos/rocks", label: "Rocks", icon: Target, adminOnly: false },
  { to: "/eos/issues", label: "Issues", icon: CircleAlert, adminOnly: false },
  { to: "/eos/scorecard", label: "Scorecard", icon: BarChart3, adminOnly: false },
] as const;

const CLIENT_CARE_NAV = [
  { to: "/inventory", label: "Closing Gift Inventory", icon: Boxes },
  { to: "/duty-calendar", label: "Duty Calendar", icon: CalendarDays },
  { to: "/duty-agents", label: "Duty Agents", icon: Users },
] as const;

const ADMIN_NAV = [
  { to: "/users", label: "Users", icon: Users, adminOnly: true },
  { to: "/signatures", label: "Email Signatures", icon: Mail, adminOnly: true },
  { to: "/admin-net-sheets", label: "Agent Net Sheets", icon: Calculator, adminOnly: true },
  { to: "/admin/swag-credits", label: "Swag Credits", icon: Ticket, adminOnly: false },
  { to: "/audit-log", label: "Audit Log", icon: ShieldCheck, adminOnly: true },
  { to: "/admin/assistant", label: "AI Assistant", icon: Bot, adminOnly: true },
] as const;

const CLIENT_CARE_ALLOWED = [
  "/dashboard",
  "/tasks",
  "/requests",
  "/inventory",
  "/closing-gift",
  "/my-availability",
  "/duty-calendar",
  "/duty-agents",
];

/** Derive a human-readable page title from the current path */
function getPageTitle(pathname: string): string {
  const map: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/calendar": "Calendar",
    "/listings": "Listings",
    "/toolbox": "Agent Toolbox",
    "/videos": "Video Pipeline",
    "/requests": "Requests",
    "/tasks": "Projects & Tasks",
    "/processes": "Internal Processes",
    "/eos/l10": "L10 Meetings",
    "/eos/rocks": "Rocks",
    "/eos/issues": "Issues",
    "/eos/scorecard": "Scorecard",
    "/inventory": "Closing Gift Inventory",
    "/duty-calendar": "Duty Calendar",
    "/duty-agents": "Duty Agents",
    "/users": "Users",
    "/signatures": "Email Signatures",
    "/admin-net-sheets": "Agent Net Sheets",
    "/admin/swag-credits": "Swag Credits",
    "/audit-log": "Audit Log",
    "/admin/assistant": "AI Assistant",
    "/experiments": "Experiments",
    "/archive": "Archive",
    "/my-availability": "My Availability",
  };
  if (map[pathname]) return map[pathname];
  const prefix = Object.keys(map).find((k) => pathname.startsWith(k + "/"));
  if (prefix) return map[prefix];
  return "";
}

/* ─── Shared style tokens ─────────────────────────────────────────── */
const navLinkClass =
  "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors duration-100";
const navLinkActive =
  "bg-gold/10 text-gold border-l-2 border-gold -ml-[2px] pl-2 rounded-r-md rounded-l-none";
const navLinkInactive =
  "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white";
const sectionLabel =
  "pt-4 pb-1 px-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60";

function NavLinks({
  pathname,
  isAdmin,
  isClientCareOnly,
  canSeeExperiments,
  roles,
  onNavigate,
}: {
  pathname: string;
  isAdmin: boolean;
  isClientCareOnly: boolean;
  canSeeExperiments: boolean;
  roles: string[];
  onNavigate?: () => void;
}) {
  const filterNav = <T extends { to: string; adminOnly: boolean }>(items: readonly T[]) =>
    items.filter(
      (n) => (!n.adminOnly || isAdmin) && (!isClientCareOnly || CLIENT_CARE_ALLOWED.includes(n.to)),
    );

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <>
      {filterNav(NAV).map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={cn(navLinkClass, isActive(item.to) ? navLinkActive : navLinkInactive)}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </Link>
      ))}

      {/* EOS Section */}
      {!isClientCareOnly && (
        <>
          <div className={sectionLabel}>EOS Systems</div>
          {EOS_NAV.filter((n) => !n.adminOnly || isAdmin).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(navLinkClass, isActive(item.to) ? navLinkActive : navLinkInactive)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </>
      )}

      {/* Client Care Section */}
      {(isAdmin || roles.includes("client_care")) && (
        <>
          <div className={sectionLabel}>Client Care</div>
          {CLIENT_CARE_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(navLinkClass, isActive(item.to) ? navLinkActive : navLinkInactive)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </>
      )}

      {/* Admin Section */}
      {(isAdmin || roles.includes("marketing_coordinator")) && (
        <>
          <div className={sectionLabel}>Admin Tools</div>
          {ADMIN_NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(navLinkClass, isActive(item.to) ? navLinkActive : navLinkInactive)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </>
      )}

      {/* Lab/Experiments Section */}
      {canSeeExperiments && (
        <>
          <div className={sectionLabel}>Lab</div>
          <Link
            to="/experiments"
            onClick={onNavigate}
            className={cn(
              navLinkClass,
              pathname.startsWith("/experiments") ? navLinkActive : navLinkInactive,
            )}
          >
            <FlaskConical className="h-4 w-4 shrink-0" />
            Experiments
          </Link>
        </>
      )}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin, user, signOut, role, roles } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const EXPERIMENT_EMAILS = ["tyler.p@mattsmithrealestategroup.com", "tylerpaul85@gmail.com"];
  const canSeeExperiments = EXPERIMENT_EMAILS.includes((user?.email ?? "").toLowerCase());
  const isClientCareOnly = roles.length > 0 && roles.every((r) => r === "client_care");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const pageTitle = getPageTitle(pathname);

  const userName =
    (user?.user_metadata as any)?.first_name || (user?.user_metadata as any)?.last_name
      ? [
          (user?.user_metadata as any)?.first_name,
          (user?.user_metadata as any)?.last_name,
        ]
          .filter(Boolean)
          .join(" ")
      : user?.email;

  return (
    <div className="min-h-screen flex bg-background">
      {/* ─── Desktop Sidebar ───────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="px-4 py-4 border-b border-sidebar-border flex items-center gap-2.5">
          <img src={logo} alt="Matt Smith Real Estate Group" className="h-9 w-auto shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white truncate">
              MSREG
            </p>
            <p className="text-[10px] uppercase tracking-widest text-gold/70 font-medium mt-px truncate">
              The Hub
            </p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          <NavLinks
            pathname={pathname}
            isAdmin={isAdmin}
            isClientCareOnly={isClientCareOnly}
            canSeeExperiments={canSeeExperiments}
            roles={roles as string[]}
          />
        </nav>

        <div className="px-3 py-2.5 border-t border-sidebar-border">
          <div className="px-1.5 py-1 text-xs">
            <div className="text-white/90 font-medium truncate text-[13px]">{userName}</div>
            <div className="text-muted-foreground text-[11px] tracking-widest uppercase mt-px">
              {role ?? "loading..."}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white mt-1"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 mr-1.5" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* ─── Header ──────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-4 h-12 border-b border-border bg-sidebar/60 pt-[max(0px,env(safe-area-inset-top))]">
          {/* Mobile: hamburger + logo */}
          <div className="md:hidden flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <img src={logo} alt="MSREG" className="h-7 w-auto" />
          </div>

          {/* Desktop: page title */}
          <div className="hidden md:block">
            {pageTitle && (
              <h2 className="text-[13px] font-medium text-foreground/80 tracking-tight">{pageTitle}</h2>
            )}
          </div>

          <div className="flex items-center gap-1">
            <QuickHeadlineButton />
            <NotificationBell />
            <Button size="icon" variant="ghost" className="md:hidden h-8 w-8" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* ─── Mobile Nav Drawer ───────────────────────────────────── */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-72 bg-sidebar p-0 border-sidebar-border">
            <SheetHeader className="px-4 py-4 border-b border-sidebar-border">
              <div className="flex items-center gap-2.5">
                <img
                  src={logo}
                  alt="Matt Smith Real Estate Group"
                  className="h-9 w-auto shrink-0"
                />
                <div className="min-w-0">
                  <SheetTitle className="text-[11px] font-semibold uppercase tracking-widest text-white truncate text-left">
                    MSREG
                  </SheetTitle>
                  <p className="text-[10px] uppercase tracking-widest text-gold/70 font-medium mt-px truncate">
                    The Hub
                  </p>
                </div>
              </div>
            </SheetHeader>

            <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto max-h-[calc(100vh-160px)]">
              <NavLinks
                pathname={pathname}
                isAdmin={isAdmin}
                isClientCareOnly={isClientCareOnly}
                canSeeExperiments={canSeeExperiments}
                roles={roles as string[]}
                onNavigate={() => setMobileNavOpen(false)}
              />
            </nav>

            <div className="px-3 py-2.5 border-t border-sidebar-border">
              <div className="px-1.5 py-1 text-xs">
                <div className="text-white/90 font-medium truncate text-[13px]">{userName}</div>
                <div className="text-muted-foreground text-[11px] tracking-widest uppercase mt-px">
                  {role ?? "loading..."}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white mt-1"
                onClick={() => {
                  setMobileNavOpen(false);
                  signOut();
                }}
              >
                <LogOut className="h-4 w-4 mr-1.5" /> Sign out
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
