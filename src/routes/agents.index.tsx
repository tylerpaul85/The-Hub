import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LogIn,
  Search,
  ArrowUpRight,
  ChevronRight,
  Share,
  Plus,
  Calculator,
  DoorOpen,
  Gift,
  Share2,
  ShoppingBag,
  Store,
  LogOut,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import logo from "@/assets/msreg-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useAgentAuth } from "@/hooks/use-agent-auth";
import { cn } from "@/lib/utils";
import { DEFAULT_HUB_CARDS, type HubCardDefinition } from "@/lib/hub-cards.config";
import { getPublicHubCardSettings } from "@/lib/hub-card-order.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/agents/")({
  component: AgentsHome,
  head: () => ({
    meta: [
      { title: "MSREG Agent Hub — Matt Smith Real Estate Group" },
      {
        name: "description",
        content:
          "Submit requests, manage open houses, view upcoming events, grab marketing materials, order swag, and access trusted local vendors.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const IOS_TIP_KEY = "msreg-agent-hub-ios-tip-dismissed";


function AgentsHome() {
  const { user } = useAuth();
  const { agent, signOutAgent } = useAgentAuth();
  const [showIosTip, setShowIosTip] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | "listings" | "clients" | "requests">("all");
  const [copiedCode, setCopiedCode] = useState(false);

  const userOrAgentEmail = user?.email || agent?.email;

  const { data: swagCredit } = useQuery({
    queryKey: ["agents-home-swag-credit", userOrAgentEmail],
    enabled: !!userOrAgentEmail,
    queryFn: async () => {
      const email = (userOrAgentEmail || "").toLowerCase().trim();
      const { data, error } = await (supabase as any)
        .from("shopify_swag_credits")
        .select("id, agent_name, recipient_email, balance, amount, gift_card_code, status")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error || !data) return null;
      const matched = data.find(
        (c: any) => (c.recipient_email || "").toLowerCase().trim() === email,
      );
      return matched || null;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["agent-hub-card-settings"],
    queryFn: () => getPublicHubCardSettings(),
    staleTime: 30_000,
  });

  const orderedCards = useMemo(() => {
    const rawOrder =
      settings?.order && settings.order.length > 0
        ? settings.order
        : DEFAULT_HUB_CARDS.map((c) => c.id);
    const hiddenSet = new Set(settings?.hiddenIds || []);
    const badgeMap = settings?.badgeOverrides || {};

    const cardMap = new Map<string, HubCardDefinition>();
    for (const card of DEFAULT_HUB_CARDS) {
      cardMap.set(card.id, card);
    }

    const result: Array<HubCardDefinition & { badge: string }> = [];

    // Process items in specified custom order
    for (const id of rawOrder) {
      if (hiddenSet.has(id)) continue;
      const card = cardMap.get(id);
      if (card) {
        result.push({
          ...card,
          badge: badgeMap[id]?.trim() || card.defaultBadge,
        });
        cardMap.delete(id);
      }
    }

    // Include any new default cards not explicitly saved yet
    for (const [id, card] of cardMap.entries()) {
      if (!hiddenSet.has(id)) {
        result.push({
          ...card,
          badge: badgeMap[id]?.trim() || card.defaultBadge,
        });
      }
    }

    return result;
  }, [settings]);

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
    try {
      localStorage.setItem(IOS_TIP_KEY, "1");
    } catch {}
    setShowIosTip(false);
  };

  const filteredItems = useMemo(() => {
    return orderedCards.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchSub = item.subtitle.toLowerCase().includes(q);
        const matchBadge = item.badge.toLowerCase().includes(q);
        if (!matchTitle && !matchSub && !matchBadge) return false;
      }
      return true;
    });
  }, [orderedCards, search, category]);

  const firstName =
    agent?.full_name?.split(" ")[0] ||
    (user?.user_metadata as any)?.first_name ||
    user?.email?.split("@")[0] ||
    "Agent";

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-gold/30 selection:text-white px-4 py-6 sm:py-10 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Ambient Top Spotlight Halo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.14),transparent)] pointer-events-none -z-10" />

      {/* Subtle Brand Emblem Watermark in Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[650px] h-[420px] sm:h-[650px] pointer-events-none opacity-[0.035] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      <div className="max-w-4xl mx-auto relative z-10 space-y-6 sm:space-y-8">
        {/* Top Floating Bar: Welcome Pill & Internal Portal Launcher */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border/80 bg-surface-2/70 backdrop-blur-md shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-foreground tracking-tight">
              Welcome, {firstName}!
            </span>
          </div>

          <div className="flex items-center gap-2">
            {agent && (
              <button
                type="button"
                onClick={() => {
                  signOutAgent();
                  toast.success("Signed out of agent session");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-surface-2/60 hover:bg-surface-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all shadow-2xs cursor-pointer"
                title={`Sign out (${agent.full_name})`}
              >
                <LogOut className="h-3 w-3 text-muted-foreground" />
                <span>Sign Out ({agent.full_name.split(" ")[0]})</span>
              </button>
            )}
            <Link
              to={user ? "/dashboard" : "/auth"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-surface-2/60 hover:bg-surface-2 hover:border-gold/50 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all shadow-2xs group"
            >
              <LogIn className="h-3 w-3 text-muted-foreground group-hover:text-gold transition-colors" />
              <span>{user ? "Internal Dashboard" : "Staff Login"}</span>
            </Link>
          </div>
        </div>

        {/* Central Brand Lockup */}
        <header className="text-center space-y-3 pt-2">
          <img
            src={logo}
            alt="Matt Smith Real Estate Group"
            className="h-20 sm:h-24 w-auto mx-auto drop-shadow-sm"
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Matt Smith Real Estate Group
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Choose a tool to get started
            </p>
          </div>
        </header>

        {/* ─── Personal Swag Pass Banner (If Agent Has Active Swag Credit) ─── */}
        {swagCredit && Number(swagCredit.balance) > 0 && (
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-surface-1 to-surface-2 p-4 text-xs shadow-md max-w-2xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="font-bold text-foreground text-sm flex items-center gap-2">
                  <span>You have ${Number(swagCredit.balance).toFixed(2)} in Swag Store Credit!</span>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <span>Code:</span>
                  <code className="font-mono font-bold text-amber-400 bg-surface-2 px-1.5 py-0.5 rounded border border-border">
                    {swagCredit.gift_card_code}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(swagCredit.gift_card_code);
                      setCopiedCode(true);
                      toast.success("Swag code copied!");
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="text-amber-400 hover:underline inline-flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    {copiedCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedCode ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>
            </div>

            <a
              href="http://www.msregswag.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-all shrink-0 cursor-pointer"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Shop Swag Store</span>
            </a>
          </div>
        )}

        {/* ─── High-Speed Deal Launcher Bar (5 Core 1-Tap Agent Actions) ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-w-3xl mx-auto">
          <Link
            to="/seller-net-proceeds"
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-surface-1/90 hover:bg-surface-2 hover:border-gold/50 text-xs font-semibold text-foreground transition-all shadow-xs group"
          >
            <div className="p-1 rounded-lg bg-gold/10 text-gold group-hover:scale-105 transition-transform">
              <Calculator className="h-3.5 w-3.5" />
            </div>
            <span className="truncate">Net Sheet</span>
          </Link>

          <Link
            to="/open-house-management"
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-surface-1/90 hover:bg-surface-2 hover:border-blue-500/50 text-xs font-semibold text-foreground transition-all shadow-xs group"
          >
            <div className="p-1 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-105 transition-transform">
              <DoorOpen className="h-3.5 w-3.5" />
            </div>
            <span className="truncate">Open Houses</span>
          </Link>

          <Link
            to="/closing-gift"
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-surface-1/90 hover:bg-surface-2 hover:border-emerald-500/50 text-xs font-semibold text-foreground transition-all shadow-xs group"
          >
            <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
              <Gift className="h-3.5 w-3.5" />
            </div>
            <span className="truncate">Closing Gift</span>
          </Link>

          <Link
            to="/referral-form"
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-surface-1/90 hover:bg-surface-2 hover:border-purple-500/50 text-xs font-semibold text-foreground transition-all shadow-xs group"
          >
            <div className="p-1 rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-105 transition-transform">
              <Share2 className="h-3.5 w-3.5" />
            </div>
            <span className="truncate">Referral Sheet</span>
          </Link>

          <Link
            to="/vendor-guide"
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-surface-1/90 hover:bg-surface-2 hover:border-amber-500/50 text-xs font-semibold text-foreground transition-all shadow-xs group"
          >
            <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
              <Store className="h-3.5 w-3.5" />
            </div>
            <span className="truncate">Vendor List</span>
          </Link>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="space-y-3 max-w-2xl mx-auto">
          {/* Live Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search tools, guides, calculators…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-10 text-xs sm:text-sm bg-surface-2/80 border-border/80 rounded-xl focus-visible:ring-gold shadow-2xs backdrop-blur-xs placeholder:text-muted-foreground/70"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              onClick={() => setCategory("all")}
              className={cn(
                "px-3 py-1 rounded-full font-medium transition-all text-xs whitespace-nowrap",
                category === "all"
                  ? "bg-gold text-navy font-bold shadow-2xs"
                  : "bg-surface-2/60 text-muted-foreground hover:text-foreground hover:bg-surface-2 border border-border/60",
              )}
            >
              All Tools ({orderedCards.length})
            </button>

            <button
              onClick={() => setCategory("clients")}
              className={cn(
                "px-3 py-1 rounded-full font-medium transition-all text-xs whitespace-nowrap",
                category === "clients"
                  ? "bg-gold text-navy font-bold shadow-2xs"
                  : "bg-surface-2/60 text-muted-foreground hover:text-foreground hover:bg-surface-2 border border-border/60",
              )}
            >
              Client Care &amp; Net Proceeds
            </button>
            <button
              onClick={() => setCategory("listings")}
              className={cn(
                "px-3 py-1 rounded-full font-medium transition-all text-xs whitespace-nowrap",
                category === "listings"
                  ? "bg-gold text-navy font-bold shadow-2xs"
                  : "bg-surface-2/60 text-muted-foreground hover:text-foreground hover:bg-surface-2 border border-border/60",
              )}
            >
              Listings &amp; Open Houses
            </button>
            <button
              onClick={() => setCategory("requests")}
              className={cn(
                "px-3 py-1 rounded-full font-medium transition-all text-xs whitespace-nowrap",
                category === "requests"
                  ? "bg-gold text-navy font-bold shadow-2xs"
                  : "bg-surface-2/60 text-muted-foreground hover:text-foreground hover:bg-surface-2 border border-border/60",
              )}
            >
              Requests &amp; Team Gear
            </button>
          </div>
        </div>

        {/* Tactile Card Grid: 2 columns on mobile, 3 columns on tablet/desktop */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4.5 pt-1">
          {filteredItems.map((item) => (
            <TactileHubCard key={item.id} item={item} />
          ))}
          {filteredItems.length === 0 && (
            <div className="col-span-2 md:col-span-3 py-12 text-center text-muted-foreground space-y-2 bg-card/40 border border-border/60 rounded-2xl">
              <Search className="h-6 w-6 mx-auto opacity-40" />
              <p className="text-sm font-medium">No tools found for "{search}"</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                }}
                className="text-xs h-8"
              >
                Reset filters
              </Button>
            </div>
          )}
        </div>

        {/* PWA iOS Install Tip */}
        {showIosTip && (
          <div className="rounded-2xl border border-gold/30 bg-card/70 backdrop-blur-md p-4 text-xs shadow-md">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-gold/15 text-gold shrink-0">
                <Plus className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="font-semibold text-foreground text-sm">
                  Install on your Home Screen
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Tap the <Share className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom text-gold" />{" "}
                  Share icon in Safari, then choose{" "}
                  <strong className="text-foreground font-semibold">“Add to Home Screen”</strong> to
                  launch MSREG Agent Hub like a native app.
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={dismissTip}
                className="text-xs h-8 shrink-0 hover:bg-gold/10 hover:text-gold"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="pt-6 pb-2 text-center text-[11px] text-muted-foreground space-y-2 border-t border-border/40">
          <div className="flex items-center justify-center gap-3">
            <Link
              to={user ? "/dashboard" : "/auth"}
              className="hover:text-gold transition-colors font-medium"
            >
              Admin &amp; Operations Portal
            </Link>
            <span>·</span>
            <Link to="/privacy-policy" className="hover:text-gold transition-colors">
              Privacy Policy
            </Link>
          </div>
          <div>© Matt Smith Real Estate Group · All Rights Reserved</div>
        </footer>
      </div>
    </div>
  );
}

function TactileHubCard({ item }: { item: HubCardDefinition & { badge?: string } }) {
  const IconComponent = item.icon;
  const isExternal = Boolean(item.href);
  const badgeText = item.badge || item.defaultBadge;

  const cardContent = (
    <div className="group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl sm:rounded-[22px] border border-border/80 bg-surface-1/90 hover:bg-surface-1 hover:border-gold/50 shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.65),0_0_24px_-4px_rgba(196,90,44,0.22)] hover:-translate-y-1 active:translate-y-0 active:scale-[0.985] transition-all duration-300 backdrop-blur-md min-h-[175px] sm:min-h-[195px] ring-1 ring-inset ring-white/[0.06] cursor-pointer select-none overflow-hidden">
      {/* Top subtle ambient glow highlight */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 group-hover:via-gold/50 to-transparent transition-all duration-300" />

      {/* Upper row: Squircle Icon receptacle + Badge & Action glyph */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-surface-2/95 border border-white/[0.08] flex items-center justify-center text-foreground group-hover:text-gold group-hover:bg-gold/10 group-hover:border-gold/30 group-hover:scale-105 transition-all duration-300 shadow-inner shrink-0">
          <IconComponent className="h-5 w-5 sm:h-6 sm:w-6 stroke-[1.75]" />
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/80 group-hover:text-gold transition-colors px-2.5 py-0.5 rounded-full bg-surface-2/80 border border-border/70 truncate max-w-[130px]">
            {badgeText}
          </span>
          {isExternal ? (
            <div className="h-6 w-6 rounded-full bg-surface-2/60 border border-border/60 flex items-center justify-center text-muted-foreground group-hover:text-gold group-hover:border-gold/40 transition-colors">
              <ArrowUpRight className="h-3 w-3" />
            </div>
          ) : (
            <div className="h-6 w-6 rounded-full bg-surface-2/60 border border-border/60 flex items-center justify-center text-muted-foreground/60 group-hover:text-gold group-hover:border-gold/40 group-hover:translate-x-0.5 transition-all">
              <ChevronRight className="h-3 w-3" />
            </div>
          )}
        </div>
      </div>

      {/* Middle: Content */}
      <div className="space-y-1 pt-3 pb-1 text-left">
        <h2 className="text-sm sm:text-base font-bold tracking-tight text-foreground group-hover:text-gold transition-colors leading-snug line-clamp-1">
          {item.title}
        </h2>
        <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {item.subtitle}
        </p>
      </div>

      {/* Bottom: Subtle affordance accent bar */}
      <div className="pt-2.5 border-t border-border/40 flex items-center justify-between text-[10px] sm:text-[11px] text-muted-foreground/70">
        <span className="group-hover:text-foreground font-medium transition-colors">
          {item.actionLabel || "Launch Tool"}
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 group-hover:bg-gold transition-colors" />
      </div>
    </div>
  );

  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus:outline-hidden"
      >
        {cardContent}
      </a>
    );
  }

  return (
    <Link to={item.to as any} className="block focus:outline-hidden">
      {cardContent}
    </Link>
  );
}
