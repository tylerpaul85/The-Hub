import { Link, useRouterState } from "@tanstack/react-router";
import { Calendar, LayoutDashboard, Users, LogOut, Video, BookOpen, Inbox, Target, ClipboardList, BarChart3, ShieldCheck, Ticket, Wrench, ClipboardCheck, CircleAlert, FlaskConical, Boxes, Gift, CalendarOff, CalendarDays } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import logo from "@/assets/msreg-logo.png.asset.json";
import { NotificationBell } from "@/components/notification-bell";
import { QuickHeadlineButton } from "@/components/quick-headline-button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { to: "/calendar", label: "Calendar", icon: Calendar, adminOnly: false },
  { to: "/toolbox", label: "Agent Toolbox", icon: Wrench, adminOnly: false },
  { to: "/videos", label: "Video Pipeline", icon: Video, adminOnly: false },
  { to: "/requests", label: "Requests", icon: Inbox, adminOnly: false },
  { to: "/closing-gift", label: "Closing Gift Request", icon: Gift, adminOnly: false },
  { to: "/tasks", label: "Projects & Tasks", icon: ClipboardCheck, adminOnly: false },
  { to: "/processes", label: "Internal Processes", icon: BookOpen, adminOnly: false },
  { to: "/my-availability", label: "My Availability", icon: CalendarOff, adminOnly: false },
] as const;

const EOS_NAV = [
  { to: "/eos/l10", label: "L10 Meetings", icon: ClipboardList, adminOnly: false },
  { to: "/eos/rocks", label: "Rocks", icon: Target, adminOnly: false },
  { to: "/eos/issues", label: "Issues", icon: CircleAlert, adminOnly: false },
  { to: "/eos/scorecard", label: "Scorecard", icon: BarChart3, adminOnly: false },
] as const;

const ADMIN_NAV = [
  { to: "/users", label: "Users", icon: Users, adminOnly: true },
  { to: "/duty-agents", label: "Duty Agents", icon: Users, adminOnly: true },
  { to: "/audit-log", label: "Audit Log", icon: ShieldCheck, adminOnly: true },
] as const;

const CLIENT_CARE_ALLOWED = ["/dashboard", "/tasks", "/requests", "/inventory", "/closing-gift", "/my-availability", "/duty-calendar"];

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin, user, signOut, role, roles } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const EXPERIMENT_EMAILS = ["tyler.p@mattsmithrealestategroup.com", "tylerpaul85@gmail.com"];
  const canSeeExperiments = EXPERIMENT_EMAILS.includes((user?.email ?? "").toLowerCase());
  const isClientCareOnly = roles.length > 0 && roles.every((r) => r === "client_care");
  const filterNav = <T extends { to: string; adminOnly: boolean }>(items: readonly T[]) =>
    items.filter((n) => (!n.adminOnly || isAdmin) && (!isClientCareOnly || CLIENT_CARE_ALLOWED.includes(n.to)));

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-60 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="px-4 py-5 border-b border-sidebar-border flex flex-col items-center gap-2">
          <img src={logo.url} alt="Matt Smith Real Estate Group" className="h-20 w-auto" />
          <div className="text-[10px] uppercase tracking-[0.18em] text-gold/80">Marketing Department</div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filterNav(NAV).map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active ? "bg-gold/15 text-gold" : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          {(isAdmin || roles.includes("client_care")) && (
            <Link
              to="/inventory"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith("/inventory") ? "bg-gold/15 text-gold" : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <Boxes className="h-4 w-4" />
              Closing Gift Inventory
            </Link>
          )}

          {(isAdmin || roles.includes("client_care")) && (
            <Link
              to="/duty-calendar"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith("/duty-calendar") ? "bg-gold/15 text-gold" : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <CalendarDays className="h-4 w-4" />
              Duty Calendar
            </Link>
          )}




          {!isClientCareOnly && (<>
          <div className="pt-4 pb-1 px-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">EOS</div>
          {EOS_NAV.filter((n) => !n.adminOnly || isAdmin).map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active ? "bg-gold/15 text-gold" : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Admin</div>
              {ADMIN_NAV.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      active ? "bg-gold/15 text-gold" : "text-sidebar-foreground hover:bg-sidebar-accent",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}

          {canSeeExperiments && (
            <>
              <div className="pt-4 pb-1 px-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Lab</div>
              <Link
                to="/experiments"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname.startsWith("/experiments") ? "bg-gold/15 text-gold" : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <FlaskConical className="h-4 w-4" />
                Experiments
              </Link>
            </>
          )}
          </>)}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="px-2 text-xs">
            <div className="text-sidebar-foreground truncate">{((user?.user_metadata as any)?.first_name || (user?.user_metadata as any)?.last_name) ? [(user?.user_metadata as any)?.first_name, (user?.user_metadata as any)?.last_name].filter(Boolean).join(" ") : user?.email}</div>
            <div className="text-muted-foreground capitalize">{role ?? "loading..."}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar/60 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="md:hidden flex items-center gap-2">
            <img src={logo.url} alt="MSREG" className="h-8 w-auto" />
            <span className="font-semibold text-sm">Marketing Department</span>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <QuickHeadlineButton />
            <NotificationBell />
            <Button size="sm" variant="ghost" className="md:hidden" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <nav className="md:hidden flex border-b border-border bg-sidebar overflow-x-auto">
          {[...NAV, ...(isClientCareOnly ? [] : EOS_NAV), ...(isAdmin ? ADMIN_NAV : []), ...(canSeeExperiments && !isClientCareOnly ? [{ to: "/experiments", label: "Experiments", icon: FlaskConical, adminOnly: false } as const] : [])].filter((n) => (!n.adminOnly || isAdmin) && (!isClientCareOnly || CLIENT_CARE_ALLOWED.includes(n.to))).map((item) => {
            const active = pathname === item.to;
            return (
              <Link key={item.to} to={item.to} className={cn("flex items-center gap-2 px-4 py-2.5 text-xs whitespace-nowrap", active ? "text-gold border-b-2 border-gold" : "text-muted-foreground")}>
                <item.icon className="h-3.5 w-3.5" />{item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
