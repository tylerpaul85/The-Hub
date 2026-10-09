import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ArrowLeft, Lock } from "lucide-react";
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
    <div className="relative min-h-screen flex items-center justify-center bg-background text-foreground px-4 py-8 overflow-hidden selection:bg-gold/30 selection:text-white">
      {/* Ambient Top Spotlight Halo */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.16),transparent)] pointer-events-none -z-10" />

      {/* Subtle Brand Emblem Watermark in Background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[600px] h-[420px] sm:h-[600px] pointer-events-none opacity-[0.035] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/agents"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-surface-2/70 hover:bg-surface-2 hover:border-gold/50 text-xs text-muted-foreground hover:text-foreground transition-all shadow-2xs backdrop-blur-md"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Agent Hub
          </Link>
        </div>

        <div className="flex flex-col items-center text-center space-y-2">
          <img src={logo} alt="Matt Smith Real Estate Group" className="h-20 w-auto drop-shadow-sm" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Staff &amp; Internal Login</h1>
            <p className="text-xs text-muted-foreground mt-1">Marketing Hub Operations &amp; Management</p>
          </div>
        </div>

        <div className="bg-surface-1/90 border border-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]">
          {mode === "forgot" ? (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-xs font-medium text-foreground">Email Address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground focus-visible:ring-gold"
                  autoComplete="email"
                  placeholder="name@mattsmithrealestategroup.com"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full h-11 rounded-xl bg-gold text-navy hover:bg-gold/90 font-bold shadow-md shadow-gold/20"
              >
                {busy ? "Sending Link…" : "Send Password Recovery Link"}
              </Button>
              <div className="mt-4 text-center text-xs">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-gold hover:underline cursor-pointer font-medium"
                >
                  ← Back to sign in
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
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border/80 bg-surface-2/70 hover:bg-surface-2 hover:border-gold/50 transition-all text-xs sm:text-sm font-semibold text-foreground disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-2xs select-none active:scale-[0.985]"
              >
                {googleBusy ? (
                  <svg
                    className="animate-spin h-4 w-4 text-muted-foreground"
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
                ) : (
                  <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                {googleBusy ? "Redirecting to Google…" : "Continue with Google Workspace"}
              </button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-surface-1 px-3 text-muted-foreground uppercase tracking-widest text-[10px]">or email login</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="first-name" className="text-xs font-medium text-foreground">First name</Label>
                      <Input
                        id="first-name"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground focus-visible:ring-gold"
                        autoComplete="given-name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="last-name" className="text-xs font-medium text-foreground">Last name</Label>
                      <Input
                        id="last-name"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground focus-visible:ring-gold"
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-foreground">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground focus-visible:ring-gold"
                    autoComplete="email"
                    placeholder="name@mattsmithrealestate.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium text-foreground">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground focus-visible:ring-gold"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full h-11 rounded-xl bg-gold text-navy hover:bg-gold/90 font-bold shadow-md shadow-gold/20"
                >
                  {busy ? "Please wait…" : mode === "signin" ? "Sign In to Marketing Hub" : "Create Account"}
                </Button>
              </form>

              {mode === "signin" && (
                <div className="mt-3.5 text-center text-xs">
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-muted-foreground hover:text-gold hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              <div className="mt-4 text-center text-xs text-muted-foreground pt-3 border-t border-border/60">
                {mode === "signin" ? (
                  <>
                    Need an internal account?{" "}
                    <button onClick={() => setMode("signup")} className="text-gold font-medium hover:underline cursor-pointer">
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button onClick={() => setMode("signin")} className="text-gold font-medium hover:underline cursor-pointer">
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <Link
            to="/privacy-policy"
            className="hover:text-gold transition-colors"
          >
            Privacy Policy
          </Link>
          <span>•</span>
          <Link
            to="/data-deletion"
            className="hover:text-gold transition-colors"
          >
            Data Deletion
          </Link>
        </div>
      </div>
    </div>
  );
}
