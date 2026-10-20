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

        // Auto-sync into agent tools / seller proceeds session
        try {
          const { syncAgentSessionFn } = await import("@/lib/agent-auth.functions");
          const fullName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(" ");
          const res = await syncAgentSessionFn({
            data: {
              email: user.email,
              fullName: fullName || undefined,
            },
          });
          if (res?.token) {
            localStorage.setItem("seller_session", res.token);
          }
        } catch (e) {
          console.warn("[auth/callback] auto-sync agent session error:", e);
        }

        // Check if the new account is pending admin approval for the staff backend
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("pending_approval")
          .eq("id", user.id)
          .single();

        if (profile?.pending_approval) {
          // If they are awaiting internal staff approval for marketing, take them directly to Agent Tools!
          toast.success(
            "Signed in! You have instant access to Seller Net Proceeds & Playbooks.",
            { duration: 6000 },
          );
          navigate({ to: "/agent-tools", replace: true });
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
