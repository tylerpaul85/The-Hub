import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { ContentDetailProvider } from "@/components/content-detail-provider";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

const CLIENT_CARE_ALLOWED_PREFIXES = ["/dashboard", "/tasks", "/requests", "/inventory", "/closing-gift", "/my-availability", "/duty-calendar"];

function AuthLayout() {
  const { user, loading, roles } = useAuth();
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

  return (
    <ContentDetailProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </ContentDetailProvider>
  );
}

