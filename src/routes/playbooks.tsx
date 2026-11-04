import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/playbooks")({
  ssr: false,
  component: () => <Navigate to="/agents" replace />,
});
