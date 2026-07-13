import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/listings")({
  component: () => <Outlet />,
  head: () => ({ meta: [{ title: "Listings — MSREG Marketing Hub" }] }),
});
