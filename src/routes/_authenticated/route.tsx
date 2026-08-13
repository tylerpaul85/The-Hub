import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { ContentDetailProvider } from "@/components/content-detail-provider";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

const CLIENT_CARE_ALLOWED_PREFIXES = [
  "/dashboard",
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

  // User signed in but hasn't been approved by an admin yet.
  // Show a holding screen rather than the full app.
  if (isPendingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">Account pending approval</h1>
          <p className="text-sm text-muted-foreground">
            Your account has been created. An admin will review and activate it shortly.
            You'll be able to sign in once approved.
          </p>
          <p className="text-xs text-muted-foreground">Signed in as {user.email}</p>
          <button
            onClick={signOut}
            className="mt-2 text-sm text-gold hover:underline"
          >
            Sign out
          </button>
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
