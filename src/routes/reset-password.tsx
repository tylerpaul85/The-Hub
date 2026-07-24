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
  head: () => ({ meta: [{ title: "Set your password — Matt Smith Real Estate Group" }] }),
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 overflow-hidden before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,oklch(0.20_0.08_85_/_0.08),transparent_45%)] after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_bottom_left,oklch(0.18_0.05_260_/_0.2),transparent_60%)]">
      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Matt Smith Real Estate Group" className="h-32 w-auto mb-4" />
          <h1 className="text-xl font-semibold tracking-tight text-center">Content Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">Set your password</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-bold mb-1">Choose a password</h2>
          <p className="text-sm text-muted-foreground mb-5">
            {ready 
              ? "Choose a secure password for your account." 
              : "Verifying recovery session link…"}
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="pw">New password</Label>
              <Input 
                id="pw" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5" 
                required 
                minLength={8} 
                disabled={!ready} 
              />
            </div>
            <div>
              <Label htmlFor="pw2">Confirm password</Label>
              <Input 
                id="pw2" 
                type="password" 
                value={confirm} 
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1.5" 
                required 
                minLength={8} 
                disabled={!ready} 
              />
            </div>
            <Button 
              type="submit" 
              disabled={!ready || saving}
              className="w-full bg-gold text-gold-foreground hover:bg-gold/90 cursor-pointer"
            >
              {saving ? "Saving…" : "Set password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
