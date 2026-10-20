import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAgentAuth, isValidAgentEmail } from "@/hooks/use-agent-auth";
import logo from "@/assets/msreg-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface AgentAuthViewProps {
  title?: string;
  subtitle?: string;
  onSuccessRedirectTo?: string;
}

export function AgentAuthView({
  title = "MSREG Agent Tools",
  subtitle = "Sign in with your @mattsmithrealestategroup.com agent account to access Seller Net Proceeds, Playbooks, and tools.",
  onSuccessRedirectTo = "/agent-tools",
}: AgentAuthViewProps) {
  const { signInAgent, signUpAgent, signInWithGoogle, resetAgentPassword } = useAgentAuth();
  const navigate = useNavigate();
  const [authTab, setAuthTab] = useState<"signin" | "signup" | "reset">("signin");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Sign in state
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Sign up state
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPhone, setSignUpPhone] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  // Reset state
  const [resetEmail, setResetEmail] = useState("");

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    try {
      await signInWithGoogle(window.location.href);
    } catch (err: any) {
      toast.error(err.message || "Failed to sign in with Google");
      setGoogleBusy(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAgentEmail(signInEmail)) {
      toast.error("Please enter a valid @mattsmithrealestategroup.com email");
      return;
    }
    setBusy(true);
    try {
      await signInAgent(signInEmail, signInPassword);
      toast.success("Welcome back!");
      navigate({ to: onSuccessRedirectTo, replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to sign in");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAgentEmail(signUpEmail)) {
      toast.error("Must use @mattsmithrealestategroup.com email");
      return;
    }
    if (signUpPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await signUpAgent(signUpEmail, signUpPassword, signUpName, signUpPhone);
      toast.success("Account created! You are now signed in.");
      navigate({ to: onSuccessRedirectTo, replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to create account");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAgentEmail(resetEmail)) {
      toast.error("Must use @mattsmithrealestategroup.com email");
      return;
    }
    setBusy(true);
    try {
      await resetAgentPassword(resetEmail);
      toast.success("Password reset instructions sent to your email!");
      setAuthTab("signin");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-bg flex flex-col justify-center items-center px-4 py-8 overflow-hidden selection:bg-gold/30 selection:text-white">
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

      <div className="absolute top-4 left-4 pt-[max(0.5rem,env(safe-area-inset-top))] z-10">
        <Link
          to="/agents"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-surface-2/70 hover:bg-surface-2 hover:border-gold/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-all shadow-2xs group backdrop-blur-md"
        >
          <ArrowLeft className="h-3 w-3 text-muted-foreground group-hover:text-gold transition-colors" />
          <span>Back to Agent Hub</span>
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center space-y-2.5">
          <img src={logo} alt="MSREG" className="h-16 w-auto mx-auto drop-shadow-sm" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold shadow-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Instant Agent Access • No Approval Required</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {subtitle}
          </p>
        </div>

        <div className="bg-surface-1/95 border border-border/80 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.06] space-y-5">
          {authTab === "reset" ? (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="reset-email" className="text-xs text-muted-foreground">
                  Your MSREG Email
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="name@mattsmithrealestategroup.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="bg-surface-2 border-border"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-accent text-white hover:bg-accent/90 text-xs h-10"
              >
                {busy ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAuthTab("signin")}
                className="w-full text-xs text-muted-foreground"
              >
                Back to Sign In
              </Button>
            </form>
          ) : (
            <>
              {/* Primary: Google Workspace OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleBusy || busy}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-surface-2/90 hover:bg-surface-2 hover:border-gold/50 text-foreground font-semibold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {googleBusy ? (
                  <svg
                    className="h-4 w-4 animate-spin text-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
                <span>{googleBusy ? "Connecting to Google..." : "Continue with Google Workspace"}</span>
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-surface-1 px-3 text-muted-foreground uppercase tracking-widest text-[10px]">or email login</span>
                </div>
              </div>

              <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as any)}>
                <TabsList className="grid grid-cols-2 bg-surface-2 p-1 mb-4">
                  <TabsTrigger value="signin" className="text-xs">
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="text-xs">
                    Create Account
                  </TabsTrigger>
                </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="signin-email" className="text-xs text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="name@mattsmithrealestategroup.com"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      className="bg-surface-2 border-border"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-pass" className="text-xs text-muted-foreground">
                        Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => setAuthTab("reset")}
                        className="text-[11px] text-accent hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="signin-pass"
                      type="password"
                      placeholder="••••••••"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      className="bg-surface-2 border-border"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full bg-accent text-white hover:bg-accent/90 text-xs h-10 font-semibold shadow-xs"
                  >
                    {busy ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-3.5">
                  <div className="space-y-1">
                    <Label htmlFor="signup-name" className="text-xs text-muted-foreground">
                      Full Name
                    </Label>
                    <Input
                      id="signup-name"
                      placeholder="Jane Smith"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      className="bg-surface-2 border-border"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-phone" className="text-xs text-muted-foreground">
                      Cell Phone (Optional)
                    </Label>
                    <Input
                      id="signup-phone"
                      placeholder="(573) 555-0199"
                      value={signUpPhone}
                      onChange={(e) => setSignUpPhone(e.target.value)}
                      className="bg-surface-2 border-border"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-email" className="text-xs text-muted-foreground">
                      MSREG Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="name@mattsmithrealestategroup.com"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      className="bg-surface-2 border-border"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-pass" className="text-xs text-muted-foreground">
                      Create Password
                    </Label>
                    <Input
                      id="signup-pass"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      className="bg-surface-2 border-border"
                      minLength={6}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full bg-accent text-white hover:bg-accent/90 text-xs h-10 font-semibold shadow-xs mt-2"
                  >
                    {busy ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
