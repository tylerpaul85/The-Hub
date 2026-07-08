import { useEffect, useState } from "react";
import { Share, Plus, X } from "lucide-react";

const STORAGE_KEY = "msreg-ios-install-dismissed-v1";

function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  // iPadOS 13+ reports as Mac
  const iPadOS = navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1;
  return iOS || iPadOS;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isAgentSurface() {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname;
  return p.startsWith("/agents") || p === "/request" || p.startsWith("/request/") || p === "/agent-toolbox" || p.startsWith("/agent-toolbox/");
}

export function IosInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (isAgentSurface()) return; // Agent Hub has its own install tip + manifest
      if (localStorage.getItem(STORAGE_KEY)) return;
      if (!isIos() || isStandalone()) return;
      const t = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(t);
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] rounded-xl border border-gold/40 bg-card/95 backdrop-blur-md shadow-2xl p-4 text-sm text-foreground animate-in slide-in-from-bottom-4">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-6">
        <div className="font-semibold text-gold mb-1">Install Content Hub</div>
        <p className="text-muted-foreground leading-snug">
          Tap <Share className="inline h-4 w-4 mx-0.5 align-text-bottom" /> in Safari, then{" "}
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Plus className="h-3.5 w-3.5" /> Add to Home Screen
          </span>{" "}
          to launch like an app.
        </p>
        <button
          onClick={dismiss}
          className="mt-3 text-xs uppercase tracking-wider text-gold hover:text-gold/80"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
