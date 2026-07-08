import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/eos/l10")({
  component: () => <Outlet />,
});
