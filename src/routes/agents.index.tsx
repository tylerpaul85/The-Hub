import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Send, Images, ChevronRight, Share, Plus, Gift, Signpost, Calculator } from "lucide-react";
import logo from "@/assets/msreg-logo.png";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/agents/")({
  component: AgentsHome,
  head: () => ({
    meta: [
      { title: "MSREG Agent Hub" },
      { name: "description", content: "Submit requests and grab marketing materials." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const IOS_TIP_KEY = "msreg-agent-hub-ios-tip-dismissed";

function AgentsHome() {
  const [showIosTip, setShowIosTip] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(IOS_TIP_KEY) === "1") return;
      const ua = window.navigator.userAgent.toLowerCase();
      const isIos = /iphone|ipad|ipod/.test(ua);
      const isStandalone =
        (window.navigator as any).standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches;
      if (isIos && !isStandalone) setShowIosTip(true);
    } catch {}
  }, []);

  const dismissTip = () => {
    try { localStorage.setItem(IOS_TIP_KEY, "1"); } catch {}
    setShowIosTip(false);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-8 sm:mb-12">
          <img src={logo} alt="Matt Smith Real Estate Group" className="h-24 sm:h-28 w-auto mx-auto" />
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 mt-3">Agent Hub</p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-2">Welcome</h1>
          <p className="text-sm text-muted-foreground mt-2">What do you need today?</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <HubCard
            to="/request"
            icon={<Send className="h-8 w-8" />}
            title="Submit a Marketing Request"
            subtitle="Tell us what you need"
          />
          <HubCard
            to="/agent-toolbox"
            icon={<Images className="h-8 w-8" />}
            title="Marketing Materials"
            subtitle="Grab ready-to-post assets for your listings"
          />
          <HubCard
            to="/closing-gift"
            icon={<Gift className="h-8 w-8" />}
            title="Request Closing Gift"
            subtitle="Order shirts for your clients (access code required)"
          />
          <HubCard
            to="/seller-net-proceeds"
            icon={<Calculator className="h-8 w-8" />}
            title="Generate Net Seller Proceeds"
            subtitle="Calculate & save estimated net proceeds sheets for your sellers"
          />
          <HubCard
            href="https://listings.msreginternal.com/"
            icon={<Signpost className="h-8 w-8" />}
            title="Listing Signs"
            subtitle="Check in or check out signs"
          />
        </div>

        {showIosTip && (
          <div className="mt-8 rounded-lg border border-gold/30 bg-card/60 p-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="text-gold mt-0.5"><Plus className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="font-medium">Install on your iPhone</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tap the <Share className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom" /> Share button in Safari, then choose
                  <span className="font-medium"> “Add to Home Screen”</span> to launch the Agent Hub like an app.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={dismissTip} className="text-xs h-7">Got it</Button>
            </div>
          </div>
        )}

        <footer className="mt-12 text-center text-[11px] text-muted-foreground">
          © Matt Smith Real Estate Group
        </footer>
      </div>
    </div>
  );
}

function HubCard({
  to,
  href,
  icon,
  title,
  subtitle,
}: {
  to?: string;
  href?: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  const className = "group relative block rounded-2xl border border-gold/30 bg-card p-6 sm:p-8 min-h-[180px] sm:min-h-[220px] hover:border-gold hover:bg-card/80 active:scale-[0.99] transition-all shadow-lg";

  const content = (
    <div className="flex flex-col h-full">
      <div className="h-14 w-14 rounded-xl bg-gold/15 text-gold flex items-center justify-center mb-4 group-hover:bg-gold group-hover:text-navy transition-colors">
        {icon}
      </div>
      <div className="flex-1">
        <h2 className="text-lg sm:text-xl font-semibold leading-tight">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
      </div>
      <div className="mt-4 flex items-center gap-1 text-xs text-gold font-medium">
        Open <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      to={to as any}
      className={className}
    >
      {content}
    </Link>
  );
}
