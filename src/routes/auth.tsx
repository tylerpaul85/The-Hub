import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import logo from "@/assets/msreg-logo.png";
import { logAuthEvent, checkRateLimit } from "@/lib/audit.functions";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — MSREG Hub" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
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
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash;
      if (hash.includes("type=recovery") || hash.includes("access_token=")) {
        navigate({ to: "/reset-password", hash: hash.substring(1), replace: true });
        return;
      }
    }

    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            // Suggest Google to restrict picker to MSREG workspace accounts.
            // NOTE: this is a UX hint only — domain is hard-blocked server-side.
            hd: "mattsmithrealestategroup.com",
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
      // Browser will redirect to Google — no further action needed here.
    } catch (err: any) {
      toast.error(err.message ?? "Google sign-in failed");
      setGoogleBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!firstName.trim() || !lastName.trim())
          throw new Error("First and last name are required");
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
          logEvent({
            data: { event_type: "auth.login_failure", email, reason: error.message },
          }).catch(() => {});
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

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://www.msreginternal.com/reset-password",
      });
      if (error) throw error;
      toast.success("Password reset email sent. Check your inbox.");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send password reset email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 overflow-hidden before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,oklch(0.20_0.08_85_/_0.08),transparent_45%)] after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_bottom_left,oklch(0.18_0.05_260_/_0.2),transparent_60%)]">
      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Matt Smith Real Estate Group" className="h-20 w-auto mb-4" />
          <h1 className="text-xl font-semibold tracking-tight text-center">The Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">Marketing & operations dashboard</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          {mode === "forgot" ? (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5"
                  autoComplete="email"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
              >
                {busy ? "Please wait..." : "Send recovery link"}
              </Button>
              <div className="mt-4 text-center text-sm">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-gold hover:underline cursor-pointer"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* ── Google OAuth button (sign-in & sign-up) ── */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleBusy || busy}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {googleBusy ? (
                  <svg className="animate-spin h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                {googleBusy ? "Redirecting…" : "Continue with Google"}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="first-name">First name</Label>
                      <Input
                        id="first-name"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="mt-1.5"
                        autoComplete="given-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="last-name">Last name</Label>
                      <Input
                        id="last-name"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="mt-1.5"
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1.5"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
                >
                  {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>
              {mode === "signin" && (
                <div className="mt-3 text-center text-sm">
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-muted-foreground hover:text-gold hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              <div className="mt-4 text-center text-sm text-muted-foreground">
                {mode === "signin" ? (
                  <>
                    Need an account?{" "}
                    <button onClick={() => setMode("signup")} className="text-gold hover:underline">
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have one?{" "}
                    <button onClick={() => setMode("signin")} className="text-gold hover:underline">
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
