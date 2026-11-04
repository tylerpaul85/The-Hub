import { createFileRoute, Navigate } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().optional(),
  course: z.string().optional(),
});

export const Route = createFileRoute("/playbooks/")({
  validateSearch: searchSchema,
  component: () => <Navigate to="/agents" replace />,
});
