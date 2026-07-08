import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import logo from "@/assets/msreg-logo.png.asset.json";
import { logAuthEvent, checkRateLimit } from "@/lib/audit.functions";
import { ParticleConstellation } from "@/components/particle-constellation";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — Matt Smith Real Estate Group Content Hub" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const logEvent = useServerFn(logAuthEvent);
  const checkLimit = useServerFn(checkRateLimit);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reason") === "timeout") {
        toast.info("Your session expired due to inactivity. Please sign in again.");
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!firstName.trim() || !lastName.trim()) throw new Error("First and last name are required");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { first_name: firstName.trim(), last_name: lastName.trim() },
          },
        });
        if (error) throw error;
        logEvent({ data: { event_type: "auth.signup", email } }).catch(() => {});
        toast.success("Account created. You can sign in.");
        setMode("signin");
      } else {
        // Rate-limit check: 10 attempts / 10 min per IP (and per email).
        const limit = await checkLimit({
          data: { bucket: "login", key: email.toLowerCase(), window_seconds: 600, max: 10 },
        }).catch(() => ({ allowed: true }));
        if (!limit.allowed) {
          logEvent({ data: { event_type: "auth.rate_limited", email } }).catch(() => {});
          throw new Error("Too many sign-in attempts. Please wait 10 minutes and try again.");
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          logEvent({ data: { event_type: "auth.login_failure", email, reason: error.message } }).catch(() => {});
          throw error;
        }
        logEvent({ data: { event_type: "auth.login_success", email } }).catch(() => {});
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 overflow-hidden">
      <ParticleConstellation />
      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo.url} alt="Matt Smith Real Estate Group" className="h-32 w-auto mb-4" />
          <h1 className="text-xl font-semibold tracking-tight text-center">Content Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">Marketing operations dashboard</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="first-name">First name</Label>
                  <Input id="first-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1.5" autoComplete="given-name" />
                </div>
                <div>
                  <Label htmlFor="last-name">Last name</Label>
                  <Input id="last-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1.5" autoComplete="family-name" />
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" autoComplete={mode === "signin" ? "current-password" : "new-password"} />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
              {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          {mode === "signin" && (
            <div className="mt-3 text-center text-sm">
              <button
                type="button"
                onClick={async () => {
                  if (!email) return toast.error("Enter your email above, then click Forgot password.");
                  setBusy(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  setBusy(false);
                  if (error) return toast.error(error.message);
                  toast.success("Password reset email sent. Check your inbox.");
                }}
                className="text-muted-foreground hover:text-gold hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>Need an account? <button onClick={() => setMode("signup")} className="text-gold hover:underline">Sign up</button></>
            ) : (
              <>Already have one? <button onClick={() => setMode("signin")} className="text-gold hover:underline">Sign in</button></>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
