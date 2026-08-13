import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
  head: () => ({ meta: [{ title: "Signing in — MSREG Hub" }] }),
});

/**
 * Handles the OAuth redirect back from Google via Supabase.
 * Supabase uses PKCE by default — it appends a `code` param to this URL
 * that must be exchanged for a session via exchangeCodeForSession().
 */
function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "error">("processing");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function handleCallback() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const errorParam = params.get("error");
        const errorDescription = params.get("error_description");

        // OAuth provider returned an error (e.g. user cancelled, wrong account)
        if (errorParam) {
          throw new Error(errorDescription ?? errorParam);
        }

        if (!code) {
          // No code — may be a direct navigation to this route. Redirect home.
          navigate({ to: "/auth", replace: true });
          return;
        }

        // Exchange the code for a session (PKCE flow)
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;

        const user = data.session?.user;
        if (!user) throw new Error("No user returned after sign-in.");

        // Double-check email domain client-side (belt-and-suspenders;
        // the DB trigger is the authoritative server-side check)
        const domain = user.email?.split("@")[1]?.toLowerCase();
        if (domain !== "mattsmithrealestategroup.com") {
          await supabase.auth.signOut();
          throw new Error(
            "Sign-in is restricted to @mattsmithrealestategroup.com accounts.",
          );
        }

        // Check if the new account is pending admin approval
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("pending_approval")
          .eq("id", user.id)
          .single();

        if (profile?.pending_approval) {
          // Let them through to a pending screen — the route layout will
          // show the pending message and block app access.
          navigate({ to: "/dashboard", replace: true });
          toast.info(
            "Your account has been created and is awaiting admin approval.",
            { duration: 8000 },
          );
          return;
        }

        navigate({ to: "/dashboard", replace: true });
      } catch (err: any) {
        console.error("[auth/callback]", err);
        setErrorMsg(err.message ?? "Sign-in failed.");
        setStatus("error");
      }
    }

    handleCallback();
  }, [navigate]);

  if (status === "error") {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-semibold text-destructive">Sign-in failed</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <a
            href="/auth"
            className="inline-block mt-4 text-sm text-gold hover:underline"
          >
            ← Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground text-sm">
        <svg
          className="animate-spin h-6 w-6 text-gold"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Completing sign-in…
      </div>
    </div>
  );
}
