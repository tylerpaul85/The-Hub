import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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
    // Supabase parses tokens from the URL hash on load and emits an auth event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords don't match.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Password set. Welcome!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-dvh grid place-items-center p-6 bg-background">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6">
        <h1 className="text-xl font-bold mb-1">Set your password</h1>
        <p className="text-sm text-muted-foreground mb-5">
          {ready ? "Choose a password for your account." : "Verifying invite link…"}
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="pw">New password</Label>
            <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5" required minLength={8} disabled={!ready} />
          </div>
          <div>
            <Label htmlFor="pw2">Confirm password</Label>
            <Input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="mt-1.5" required minLength={8} disabled={!ready} />
          </div>
          <Button type="submit" disabled={!ready || saving}
            className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
            {saving ? "Saving…" : "Set password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
