import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

const ALLOWED_EMAILS = [
  "tyler.p@mattsmithrealestategroup.com",
  "tylerpaul85@gmail.com",
];

export const ALLOWED_EXPERIMENT_EMAILS = ALLOWED_EMAILS;

export const Route = createFileRoute("/_authenticated/experiments")({
  component: ExperimentsLayout,
});

function ExperimentsLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  const email = (user?.email ?? "").toLowerCase();
  if (!ALLOWED_EMAILS.includes(email)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
