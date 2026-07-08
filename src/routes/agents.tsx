import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";
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

    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
    const prevAppleTitle = appleTitle?.getAttribute("content");
    if (appleTitle) appleTitle.setAttribute("content", "MSREG Agent Hub");

    const appName = document.querySelector('meta[name="application-name"]') as HTMLMetaElement | null;
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
        err?.message?.includes("Incorrect") ? "Incorrect access code — please try again" : "Could not verify code",
      );
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <Card className="w-full max-w-sm p-6 space-y-5 border-gold/20">
        <div className="flex flex-col items-center text-center gap-3">
          <img src={logo} alt="Matt Smith Real Estate Group" className="h-24 w-auto" />
          <div>
            <h1 className="text-lg font-semibold">Agent Hub</h1>
            <p className="text-[11px] uppercase tracking-[0.18em] text-gold/80 mt-1">
              Matt Smith Real Estate Group
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Access code
          </label>
          <Input
            autoFocus
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter access code"
            className="text-center text-base h-11"
            autoComplete="off"
          />
          <Button type="submit" disabled={busy} className="w-full h-11 bg-gold text-navy hover:bg-gold/90 font-semibold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enter Agent Hub"}
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground text-center">
          You'll only enter this code once on this device.
        </p>
      </Card>
    </div>
  );
}
