import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/referrals")({
  ssr: false,
  component: ReferralsRedirect,
});

function ReferralsRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/referral-form", replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-gold" />
    </div>
  );
}
