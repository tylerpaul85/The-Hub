import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/msreg-logo.png";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Set your password — MSREG Hub" }] }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // 1. Handle the case where the recovery token is already in the URL hash on page load.
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.substring(1));
      const type = params.get("type");
      const accessToken = params.get("access_token");
      const errorDesc = params.get("error_description");

      if (errorDesc) {
        toast.error(decodeURIComponent(errorDesc.replace(/\+/g, " ")));
      }

      if (type === "recovery" || accessToken) {
        setReady(true);
      }
    }

    // 2. Use supabase.auth.onAuthStateChange and check for the PASSWORD_RECOVERY event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      } else if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        // Fallback: If a session is established on initial load of hash redirect, also set to ready
        setReady(true);
      }
    });

    // 3. Fallback: check if we already have an active session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      return toast.error("Password must be at least 8 characters.");
    }
    if (password !== confirm) {
      return toast.error("Passwords don't match.");
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    await supabase.auth.signOut();
    setSaving(false);

    toast.success("Password reset successful. Please sign in with your new password.");
    navigate({ to: "/auth" });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 py-8 overflow-hidden selection:bg-gold/30 selection:text-white">
      {/* Ambient Top Spotlight Halo */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[650px] sm:w-[850px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.16),transparent)] pointer-events-none -z-10" />

      {/* Subtle Brand Emblem Watermark in Background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] sm:w-[550px] h-[380px] sm:h-[550px] pointer-events-none opacity-[0.035] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <img src={logo} alt="Matt Smith Real Estate Group" className="h-20 w-auto mb-1 drop-shadow-sm" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Set New Password</h1>
          <p className="text-xs text-muted-foreground">Matt Smith Real Estate Group Hub</p>
        </div>

        <div className="bg-surface-1/95 border border-border/80 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.06] space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-foreground">Choose your new password</h2>
            <p className="text-xs text-muted-foreground">
              {ready
                ? "Enter your new account password below (min 8 characters)."
                : "Verifying secure recovery link…"}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw" className="text-xs font-semibold text-foreground">New Password</Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 text-xs sm:text-sm bg-surface-2 border-border/80 rounded-xl focus-visible:ring-gold"
                required
                minLength={8}
                disabled={!ready}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw2" className="text-xs font-semibold text-foreground">Confirm New Password</Label>
              <Input
                id="pw2"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="h-10 text-xs sm:text-sm bg-surface-2 border-border/80 rounded-xl focus-visible:ring-gold"
                required
                minLength={8}
                disabled={!ready}
              />
            </div>
            <Button
              type="submit"
              disabled={!ready || saving}
              className="w-full bg-gold text-navy hover:bg-gold/90 font-bold text-xs sm:text-sm h-10 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              {saving ? "Saving…" : "Set Password & Proceed"}
            </Button>
          </form>
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="text-xs text-muted-foreground hover:text-gold transition-colors"
          >
            ← Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
