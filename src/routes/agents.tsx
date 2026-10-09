import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, Loader2, LogIn } from "lucide-react";
import logo from "@/assets/msreg-logo.png";
import { verifyToolboxCode } from "@/lib/toolbox-public.functions";

export const Route = createFileRoute("/agents")({
  ssr: false,
  component: AgentsLayout,
  head: () => ({
    meta: [
      { title: "MSREG Agent Hub" },
      { name: "description", content: "Matt Smith Real Estate Group Agent Hub." },
      { name: "robots", content: "noindex, nofollow, noarchive, nosnippet" },
      { name: "googlebot", content: "noindex, nofollow" },
      { name: "apple-mobile-web-app-title", content: "MSREG Agent Hub" },
      { name: "application-name", content: "MSREG Agent Hub" },
    ],
  }),
});

const UNLOCK_KEY = "msreg-agent-hub-unlocked";
const TOOLBOX_TOKEN_KEY = "msreg-toolbox-token";

function AgentsLayout() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  // Swap PWA manifest + apple title for the duration of any /agents page
  useEffect(() => {
    const linkEl = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const prevHref = linkEl?.getAttribute("href");
    if (linkEl) linkEl.setAttribute("href", "/agents-manifest.webmanifest");

    const appleTitle = document.querySelector(
      'meta[name="apple-mobile-web-app-title"]',
    ) as HTMLMetaElement | null;
    const prevAppleTitle = appleTitle?.getAttribute("content");
    if (appleTitle) appleTitle.setAttribute("content", "MSREG Agent Hub");

    const appName = document.querySelector(
      'meta[name="application-name"]',
    ) as HTMLMetaElement | null;
    const prevAppName = appName?.getAttribute("content");
    if (appName) appName.setAttribute("content", "MSREG Agent Hub");

    return () => {
      if (linkEl && prevHref) linkEl.setAttribute("href", prevHref);
      if (appleTitle && prevAppleTitle) appleTitle.setAttribute("content", prevAppleTitle);
      if (appName && prevAppName) appName.setAttribute("content", prevAppName);
    };
  }, []);

  useEffect(() => {
    try {
      setUnlocked(localStorage.getItem(UNLOCK_KEY) === "1");
    } catch {
      setUnlocked(false);
    }
  }, []);

  if (unlocked === null) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!unlocked) {
    return (
      <Gate
        onUnlock={(token) => {
          try {
            localStorage.setItem(UNLOCK_KEY, "1");
            // Also unlock the toolbox so the agent doesn't re-enter the code there
            localStorage.setItem(TOOLBOX_TOKEN_KEY, token);
          } catch {}
          setUnlocked(true);
        }}
      />
    );
  }

  return <Outlet />;
}

function Gate({ onUnlock }: { onUnlock: (token: string) => void }) {
  const verify = useServerFn(verifyToolboxCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const { token } = await verify({ data: { code: code.trim() } });
      onUnlock(token);
    } catch (err: any) {
      toast.error(
        err?.message?.includes("Incorrect")
          ? "Incorrect access code — please try again"
          : "Could not verify code",
      );
    }
    setBusy(false);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-8 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] overflow-hidden selection:bg-gold/30 selection:text-white">
      {/* Ambient Top Spotlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[800px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.15),transparent)] pointer-events-none -z-10" />

      {/* Brand Emblem Watermark in Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] sm:w-[500px] h-[380px] sm:h-[500px] pointer-events-none opacity-[0.035] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      <div className="absolute top-4 right-4 pt-[max(0.5rem,env(safe-area-inset-top))] z-10">
        <Link
          to="/auth"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-surface-2/70 hover:bg-surface-2 hover:border-gold/50 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all shadow-2xs group backdrop-blur-md"
        >
          <LogIn className="h-3 w-3 text-muted-foreground group-hover:text-gold transition-colors" />
          <span>Internal Login</span>
        </Link>
      </div>

      <div className="w-full max-w-sm p-7 space-y-6 rounded-3xl border border-border/80 bg-card/85 backdrop-blur-md shadow-xl ring-1 ring-inset ring-white/[0.06] text-center relative z-10">
        <div className="flex flex-col items-center text-center gap-3">
          <img src={logo} alt="Matt Smith Real Estate Group" className="h-20 sm:h-22 w-auto drop-shadow-sm" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">MSREG Agent Hub</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Private agent marketing &amp; operations portal
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-gold" /> Enter Team Access Code
            </label>
            <Input
              autoFocus
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••••"
              className="text-center font-mono tracking-widest text-lg h-12 rounded-xl bg-surface-2/90 border-border focus-visible:ring-gold"
              autoComplete="off"
            />
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full h-12 bg-gold text-navy hover:bg-gold/90 font-bold text-sm rounded-xl shadow-md shadow-gold/20 active:scale-[0.985] transition-all"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {busy ? "Verifying..." : "Enter Agent Hub"}
          </Button>
        </form>

        <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-border/60">
          You'll only need to enter this code once on this device.
        </p>
      </div>
    </div>
  );
}
