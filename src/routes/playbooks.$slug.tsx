import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/playbooks/$slug")({
  component: () => <Navigate to="/agents" replace />,
});
