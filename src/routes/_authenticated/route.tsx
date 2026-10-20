import { createFileRoute, Outlet, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Clock, Calculator, BookOpen, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { ContentDetailProvider } from "@/components/content-detail-provider";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

const CLIENT_CARE_ALLOWED_PREFIXES = [
  "/dashboard",
  "/special-events",
  "/tasks",
  "/requests",
  "/inventory",
  "/closing-gift",
  "/my-availability",
  "/duty-calendar",
];

function AuthLayout() {
  const { user, loading, roles, isPendingApproval, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isClientCareOnly = roles.length > 0 && roles.every((r) => r === "client_care");

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash;
      if (hash.includes("type=recovery") || hash.includes("access_token=")) {
        navigate({ to: "/reset-password", hash: hash.substring(1), replace: true });
        return;
      }
    }

    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (loading || !user) return;
    if (!isClientCareOnly) return;
    const allowed = CLIENT_CARE_ALLOWED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    );
    if (!allowed) navigate({ to: "/dashboard", replace: true });
  }, [pathname, isClientCareOnly, loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading...
      </div>
    );
  }

  // User signed in but hasn't been approved by an admin yet for backend hub access.
  // Show clear message and provide direct access to Agent Tools.
  if (isPendingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        <div className="max-w-lg w-full bg-surface-1 border border-border/80 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl backdrop-blur-md">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 mx-auto border border-amber-500/20">
            <Clock className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Staff Backend Access Pending
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Your account is registered for the <strong className="text-foreground">Internal Marketing &amp; Operations Hub</strong>. An administrator must approve your role before you can access backend marketing tools.
            </p>
          </div>

          {/* Callout specifically for Agents */}
          <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 sm:p-5 text-left space-y-3">
            <div className="flex items-center gap-2 text-gold font-semibold text-sm">
              <Sparkles className="h-4 w-4" />
              <span>Looking for Agent Tools or Net Proceeds?</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real estate agents <strong className="text-foreground">do not need admin approval</strong> to use the Seller Net Proceeds calculator or Playbooks. You have full instant access right now:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <Link
                to="/seller-net-proceeds"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gold text-navy font-semibold text-xs hover:bg-gold/90 transition-all shadow-sm"
              >
                <Calculator className="h-3.5 w-3.5" />
                <span>Seller Net Proceeds</span>
              </Link>
              <Link
                to="/playbooks"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 border border-border text-foreground font-semibold text-xs hover:bg-surface-2/80 transition-all"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Playbook Library</span>
              </Link>
            </div>
            <div className="text-center pt-1">
              <Link
                to="/agent-tools"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-gold transition-colors"
              >
                <span>View all Agent Tools</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/60">
            <span>Signed in as <span className="font-mono text-foreground">{user.email}</span></span>
            <button
              onClick={signOut}
              className="text-gold hover:underline font-medium cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ContentDetailProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </ContentDetailProvider>
  );
}
