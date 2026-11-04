import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/agent-tools")({
  ssr: false,
  component: () => <Navigate to="/agents" replace />,
});
