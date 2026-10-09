import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn, getGoogleDrivePreviewUrl } from "@/lib/utils";
import { isImageUrl } from "@/lib/sanitize-filename";
import { DownloadPhotosButton } from "@/components/download-photos-button";
import {
  verifyToolboxCode,
  listPublicListings,
  getPublicListing,
  listPublicBrand,
  listPublicEdu,
  getPublicEdu,
  listPublicOpenHouses,
  getPublicOpenHouse,
  listPublicBrandedAgents,
  listPublicAgentBrandedContent,
} from "@/lib/toolbox-public.functions";
import { SpecialEventsAgentView } from "@/components/special-events-agent-view";
import logo from "@/assets/msreg-logo.png";
import {
  Search,
  Download,
  Copy,
  ExternalLink,
  ArrowLeft,
  X,
  Image as ImageIcon,
  FileText,
  Video as VideoIcon,
  Home,
  Lock,
  Loader2,
  Package,
  User,
  QrCode,
  Check,
  Sparkles,
  GraduationCap,
  TrendingUp,
  Users,
  Key,
  Share2,
  MessageSquareQuote,
  FileDown,
  Layers,
} from "lucide-react";

export const Route = createFileRoute("/agent-toolbox")({
  ssr: false,
  component: PublicToolboxPage,
  head: () => ({
    meta: [
      { title: "Agent Toolbox — MSREG Hub" },
      { name: "robots", content: "noindex, nofollow, noarchive, nosnippet" },
      { name: "googlebot", content: "noindex, nofollow" },
      { name: "description", content: "Private MSREG agent toolbox." },
    ],
  }),
});

const STORAGE_KEY = "msreg-toolbox-token";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  coming_soon: "Coming Soon",
  sold: "Sold",
};
const STATUS_CLASS: Record<string, string> = {
  active:
    "bg-emerald-950/40 text-emerald-400 border-emerald-500/20 text-[10px] font-medium tracking-wide px-2 py-0.5",
  coming_soon:
    "bg-amber-950/40 text-amber-400 border-amber-500/20 text-[10px] font-medium tracking-wide px-2 py-0.5",
  sold: "bg-rose-950/40 text-rose-400 border-rose-500/20 text-[10px] font-medium tracking-wide px-2 py-0.5",
};
const OH_STATUS_LABEL: Record<string, string> = { upcoming: "Upcoming", past: "Past" };
const OH_STATUS_CLASS: Record<string, string> = {
  upcoming:
    "bg-emerald-950/40 text-emerald-400 border-emerald-500/20 text-[10px] font-medium tracking-wide px-2 py-0.5",
  past: "bg-zinc-900/60 text-zinc-400 border-zinc-700/30 text-[10px] font-medium tracking-wide px-2 py-0.5",
};
function fmtDateTime(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function PublicToolboxPage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem(STORAGE_KEY);
      if (t) setToken(t);
    } catch {}
  }, []);

  if (!token)
    return (
      <Gate
        onUnlock={(t) => {
          try {
            localStorage.setItem(STORAGE_KEY, t);
          } catch {}
          setToken(t);
        }}
      />
    );
  return (
    <Toolbox
      token={token}
      onLock={() => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
        setToken(null);
      }}
    />
  );
}

/* -------- Access gate -------- */

function Gate({ onUnlock }: { onUnlock: (token: string) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const verifyCode = useServerFn(verifyToolboxCode);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const result = await verifyCode({ data: { code: code.trim() } });
      onUnlock(result.token);
    } catch (err: any) {
      toast.error(err?.message || "Could not verify code");
    }
    setBusy(false);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground flex items-center justify-center px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] overflow-hidden selection:bg-gold/30 selection:text-white">
      {/* Ambient Top Spotlight Halo */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.16),transparent)] pointer-events-none -z-10" />

      {/* Brand Emblem Watermark in Background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[600px] h-[420px] sm:h-[600px] pointer-events-none opacity-[0.035] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      <div className="w-full max-w-sm p-7 sm:p-8 space-y-6 rounded-3xl border border-border/80 bg-surface-1/90 backdrop-blur-md shadow-2xl ring-1 ring-inset ring-white/[0.05] relative z-10 text-center">
        <div className="flex flex-col items-center text-center gap-3">
          <img src={logo} alt="MSREG" className="h-20 w-auto drop-shadow-sm" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Agent Toolbox</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Private listing collateral &amp; brand assets
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-gold" /> Team access code
            </label>
            <Input
              autoFocus
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••••"
              className="text-center font-mono tracking-widest text-lg h-12 rounded-xl bg-surface-2/90 border-border/80 focus-visible:ring-gold"
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-gold text-navy hover:bg-gold/90 font-bold h-12 rounded-xl shadow-md shadow-gold/20 active:scale-[0.985] transition-all cursor-pointer"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {busy ? "Verifying..." : "Unlock Toolbox"}
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-border/60">
          Ask the marketing team for the access code. You'll only enter it once on this device.
        </p>
      </div>
    </div>
  );
}

/* -------- Main toolbox -------- */

function Toolbox({ token, onLock }: { token: string; onLock: () => void }) {
  const [tab, setTab] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("tab");
      if (p === "events" || p === "special-events") return "events";
      if (p && ["listings", "open_houses", "events", "brand", "edu", "branded"].includes(p)) return p;
    }
    return "listings";
  });
  const [openListing, setOpenListing] = useState<string | null>(null);
  const [openOpenHouse, setOpenOpenHouse] = useState<string | null>(null);
  const [openEdu, setOpenEdu] = useState<string | null>(null);

  // Synchronize tab changes to URL search query for easy sharing and bookmarking
  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", newTab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden selection:bg-gold/30 selection:text-white">
      {/* Ambient Top Spotlight Halo */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[950px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.14),transparent)] pointer-events-none -z-10" />

      {/* Subtle Brand Emblem Watermark in Background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[650px] h-[420px] sm:h-[650px] pointer-events-none opacity-[0.03] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      <header className="sticky top-0 z-30 bg-surface-1/90 backdrop-blur-md border-b border-border pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img src={logo} alt="MSREG" className="h-9 w-auto shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">Agent Toolbox</div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-gold/80 truncate">
                Matt Smith Real Estate Group
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <AgentHubHomeLink />
            <Button variant="ghost" size="sm" onClick={onLock} className="text-xs">
              Lock
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {openListing ? (
          <ListingView token={token} id={openListing} onBack={() => setOpenListing(null)} />
        ) : openOpenHouse ? (
          <OpenHouseView token={token} id={openOpenHouse} onBack={() => setOpenOpenHouse(null)} />
        ) : openEdu ? (
          <EducationDetailView token={token} id={openEdu} onBack={() => setOpenEdu(null)} />
        ) : (
          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="w-full h-auto p-1 grid grid-cols-3 sm:grid-cols-6 gap-1 bg-muted/60">
              <TabsTrigger value="listings" className="text-xs sm:text-sm py-2">
                Listings
              </TabsTrigger>
              <TabsTrigger value="open_houses" className="text-xs sm:text-sm py-2">
                Open Houses
              </TabsTrigger>
              <TabsTrigger
                value="events"
                className="text-xs sm:text-sm py-2 data-[state=active]:text-gold font-semibold"
              >
                Special Events
              </TabsTrigger>
              <TabsTrigger value="brand" className="text-xs sm:text-sm py-2">
                Branding
              </TabsTrigger>
              <TabsTrigger value="edu" className="text-xs sm:text-sm py-2">
                Education
              </TabsTrigger>
              <TabsTrigger value="branded" className="text-xs sm:text-sm py-2">
                Agent Branded
              </TabsTrigger>
            </TabsList>
            <TabsContent value="listings" className="mt-4">
              <ListingsList token={token} onOpen={setOpenListing} />
            </TabsContent>
            <TabsContent value="open_houses" className="mt-4">
              <OpenHousesList token={token} onOpen={setOpenOpenHouse} />
            </TabsContent>
            <TabsContent value="events" className="mt-4">
              <SpecialEventsAgentView token={token} />
            </TabsContent>
            <TabsContent value="brand" className="mt-4">
              <BrandList token={token} />
            </TabsContent>
            <TabsContent value="edu" className="mt-4">
              <EduList token={token} onOpen={setOpenEdu} />
            </TabsContent>
            <TabsContent value="branded" className="mt-4">
              <AgentBrandedContentList token={token} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

/* -------- Listings -------- */

function ListingsList({ token, onOpen }: { token: string; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const fetchListings = useServerFn(listPublicListings);
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-listings", token],
    queryFn: () => fetchListings({ data: { token } }),
  });

  const filtered = useMemo(() => {
    const items = (data?.listings ?? []) as any[];
    if (!q.trim()) return items;
    const s = q.toLowerCase();
    return items.filter(
      (l) => l.address?.toLowerCase().includes(s) || (l.agent_name ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by address or agent"
          className="pl-9 h-11 text-base"
        />
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground text-sm py-10">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
          {q ? "No listings match your search." : "No listings available yet."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((l) => (
            <button
              key={l.id}
              onClick={() => onOpen(l.id)}
              className="group text-left rounded-2xl overflow-hidden border border-border/80 bg-surface-1/95 hover:bg-surface-1 hover:border-gold/50 active:scale-[0.985] transition-all duration-300 shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.65),0_0_24px_-4px_rgba(196,90,44,0.22)] hover:-translate-y-1 ring-1 ring-inset ring-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold relative"
            >
              {/* Top subtle ambient glow highlight */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 group-hover:via-gold/50 to-transparent transition-all duration-300 z-10" />

              <div className="aspect-video bg-surface-2 relative overflow-hidden">
                {l.thumbnail ? (
                  <img
                    src={l.thumbnail}
                    alt={l.address}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = "none";
                      const fallback = target.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className="w-full h-full flex flex-col items-center justify-center p-4 text-center group-hover:scale-105 transition-transform duration-500 bg-gradient-to-br from-surface-2 via-surface-2/80 to-surface-1 relative"
                  style={{ display: l.thumbnail ? "none" : "flex" }}
                >
                  <div className="h-11 w-11 rounded-2xl bg-gold/10 border border-gold/25 flex items-center justify-center mb-1.5 text-gold shadow-inner">
                    <Home className="h-5 w-5 stroke-[1.75]" />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground/85 tracking-wide uppercase">
                    MSREG Listing
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 mt-0.5">
                    Marketing Assets Ready
                  </span>
                </div>
                <Badge
                  className={cn(
                    "absolute top-3 left-3 border text-[10px] shadow-2xs font-semibold backdrop-blur-md z-10 px-2.5 py-0.5 rounded-full",
                    STATUS_CLASS[l.status],
                  )}
                >
                  {STATUS_LABEL[l.status] ?? l.status}
                </Badge>
              </div>
              <div className="p-4 sm:p-4.5 space-y-1">
                <div className="font-bold text-sm sm:text-base text-foreground group-hover:text-gold transition-colors duration-200 truncate">
                  {l.address}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                  <span className="truncate">{l.agent_name || "Unassigned"}</span>
                  <span className="text-[10px] text-muted-foreground/60 group-hover:text-gold transition-colors font-medium">
                    View Assets →
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------- Listing detail -------- */

function ListingView({ token, id, onBack }: { token: string; id: string; onBack: () => void }) {
  const fetchListing = useServerFn(getPublicListing);
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-listing", id, token],
    queryFn: () => fetchListing({ data: { token, id } }),
  });

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading…</div>;
  if (!data) return <div className="text-center text-muted-foreground py-10">Not found.</div>;

  const { listing, assets, captions } = data as any;
  const photos = assets.filter((a: any) => a.asset_type === "photo");
  const videos = assets.filter((a: any) => a.asset_type === "video");
  const graphics = assets.filter((a: any) => a.asset_type === "graphic");
  const allImages = assets.filter((a: any) => a.asset_type !== "video" && (isImageUrl(a.file_url) || isImageUrl(a.thumbnail_url) || isImageUrl(a.drive_url)));

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gold hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> All listings
      </button>

      <div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">{listing.address}</h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {listing.agent_name && <span>{listing.agent_name}</span>}
              <Badge className={cn("border", STATUS_CLASS[listing.status])}>
                {STATUS_LABEL[listing.status] ?? listing.status}
              </Badge>
            </div>
          </div>
          {allImages.length > 0 && (
            <DownloadPhotosButton photos={allImages} address={listing.address} />
          )}
        </div>
        {listing.description && (
          <p className="text-sm text-muted-foreground mt-2">{listing.description}</p>
        )}
      </div>

      {photos.length > 0 && <PhotoGallery photos={photos} address={listing.address} />}

      {videos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gold flex items-center gap-2">
            <VideoIcon className="h-4 w-4" /> Videos
          </h2>
          <div className="space-y-2">
            {videos.map((v: any) => (
              <a
                key={v.id}
                href={v.drive_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3 hover:border-gold/60 active:scale-[0.99] transition"
              >
                <span className="flex items-center gap-2 text-sm truncate">
                  <ExternalLink className="h-4 w-4 text-gold shrink-0" />
                  <span className="truncate">Open video on Drive</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {graphics.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gold flex items-center gap-2">
            <ImageIcon className="h-4 w-4" /> Pre-made Graphics
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {graphics.map((g: any) => (
              <div key={g.id} className="rounded-lg overflow-hidden border border-border bg-card">
                <div className="aspect-square bg-muted">
                  <img
                    src={g.thumbnail_url || g.file_url}
                    alt={g.name ?? ""}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-2 space-y-1">
                  {g.name && (
                    <div className="text-[11px] text-muted-foreground truncate">{g.name}</div>
                  )}
                  <DownloadButton
                    url={g.file_url}
                    filename={`${slug(listing.address)}-${slug(g.name ?? "graphic")}.jpg`}
                    small
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {captions.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gold flex items-center gap-2">
            <FileText className="h-4 w-4" /> Ready-to-use Captions
          </h2>
          <div className="space-y-2">
            {captions.map((c: any) => (
              <CaptionCard key={c.id} text={c.caption_text} />
            ))}
          </div>
        </section>
      )}

      {photos.length === 0 &&
        videos.length === 0 &&
        graphics.length === 0 &&
        captions.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
            Marketing hasn't uploaded assets for this listing yet.
          </Card>
        )}
    </div>
  );
}

function PhotoGallery({ photos, address }: { photos: any[]; address: string }) {
  const [zipping, setZipping] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const downloadAll = async () => {
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let i = 1;
      for (const p of photos) {
        try {
          const res = await fetch(p.file_url);
          const blob = await res.blob();
          const ext = (p.file_url.match(/\.(jpe?g|png|webp|gif)/i)?.[1] || "jpg").toLowerCase();
          zip.file(`${String(i).padStart(2, "0")}.${ext}`, blob);
          i++;
        } catch {}
      }
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug(address)}-photos.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success(`Downloaded ${photos.length} photos`);
    } catch (e: any) {
      toast.error("Download failed");
    }
    setZipping(false);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gold flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> Photos{" "}
          <span className="text-muted-foreground font-normal">· {photos.length}</span>
        </h2>
        <Button
          onClick={downloadAll}
          disabled={zipping}
          size="sm"
          className="bg-gold text-navy hover:bg-gold/90 h-9"
        >
          {zipping ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Zipping…
            </>
          ) : (
            <>
              <Package className="h-4 w-4 mr-1" />
              Download all
            </>
          )}
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((p, idx) => (
          <div key={p.id} className="rounded-lg overflow-hidden border border-border bg-card">
            <button
              onClick={() => setLightbox(idx)}
              className="block w-full aspect-square bg-muted"
            >
              <img
                src={getGoogleDrivePreviewUrl(p.thumbnail_url || p.file_url || p.drive_url) || ""}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
            <div className="p-1.5">
              <DownloadButton
                url={p.file_url}
                filename={`${slug(address)}-${String(idx + 1).padStart(2, "0")}.jpg`}
                small
              />
            </div>
          </div>
        ))}
      </div>

      {lightbox !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={getGoogleDrivePreviewUrl(photos[lightbox].file_url || photos[lightbox].drive_url || photos[lightbox].thumbnail_url) || ""}
            alt=""
            className="max-w-full max-h-[80vh] object-contain"
          />
          <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setLightbox((i) => (i! > 0 ? i! - 1 : photos.length - 1))}
            >
              Prev
            </Button>
            <DownloadButton
              url={photos[lightbox].file_url}
              filename={`${slug(address)}-${String(lightbox + 1).padStart(2, "0")}.jpg`}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setLightbox((i) => (i! < photos.length - 1 ? i! + 1 : 0))}
            >
              Next
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLightbox(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function CaptionCard({ text }: { text: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Caption copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="text-sm whitespace-pre-wrap">{text}</div>
      <Button onClick={copy} size="sm" className="w-full bg-gold text-navy hover:bg-gold/90 h-10">
        <Copy className="h-4 w-4 mr-1" /> Copy caption
      </Button>
    </div>
  );
}

function DownloadButton({
  url,
  filename,
  small,
}: {
  url: string;
  filename: string;
  small?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = obj;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(obj), 3000);
    } catch {
      window.open(url, "_blank");
    }
    setBusy(false);
  };
  return (
    <Button
      onClick={onClick}
      disabled={busy}
      size="sm"
      variant="secondary"
      className={cn("w-full", small ? "h-8 text-xs" : "h-10")}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <>
          <Download className="h-3.5 w-3.5 mr-1" /> Download
        </>
      )}
    </Button>
  );
}

/* -------- Branding -------- */

function BrandList({ token }: { token: string }) {
  const fetchBrand = useServerFn(listPublicBrand);
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-brand", token],
    queryFn: () => fetchBrand({ data: { token } }),
  });
  const items = (data?.items ?? []) as any[];
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const i of items) (g[i.category] ??= []).push(i);
    return g;
  }, [items]);

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading…</div>;
  if (items.length === 0)
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
        No branding assets yet.
      </Card>
    );

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([cat, list]) => (
        <section key={cat} className="space-y-2">
          <h3 className="text-sm font-semibold text-gold">
            {cat} <span className="text-muted-foreground font-normal">· {list.length}</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {list.map((i) => {
              const isImg = isImageUrl(i.file_url);
              return (
                <div key={i.id} className="group relative rounded-2xl overflow-hidden border border-border/80 bg-surface-1/95 hover:bg-surface-1 hover:border-gold/50 shadow-sm hover:shadow-[0_16px_36px_-10px_rgba(0,0,0,0.5),0_0_20px_-4px_rgba(196,90,44,0.2)] hover:-translate-y-1 transition-all duration-300 ring-1 ring-inset ring-white/[0.06]">
                  {/* Top sheen line */}
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 group-hover:via-gold/50 to-transparent transition-all duration-300 z-10" />

                  <div className="aspect-square bg-surface-2/60 flex items-center justify-center p-3">
                    {isImg ? (
                      <img
                        src={i.file_url}
                        alt={i.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <FileText className="h-10 w-10 text-muted-foreground stroke-[1.5]" />
                    )}
                  </div>
                  <div className="p-3 space-y-2 border-t border-border/50 bg-surface-1/80">
                    <div className="text-xs font-semibold text-foreground truncate">{i.name}</div>
                    <DownloadButton url={i.file_url} filename={i.name || "asset"} small />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/* -------- Education Category Styles & Helpers -------- */

const EDU_CATEGORY_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: any }
> = {
  "Seller Education": {
    label: "Seller Education",
    badgeClass: "bg-amber-950/60 text-amber-300 border-amber-500/30",
    icon: Key,
  },
  "Buyer Education": {
    label: "Buyer Education",
    badgeClass: "bg-emerald-950/60 text-emerald-300 border-emerald-500/30",
    icon: Users,
  },
  "Market Education": {
    label: "Market Education",
    badgeClass: "bg-sky-950/60 text-sky-300 border-sky-500/30",
    icon: TrendingUp,
  },
  "Marketing Update": {
    label: "Market Education",
    badgeClass: "bg-sky-950/60 text-sky-300 border-sky-500/30",
    icon: TrendingUp,
  },
  Other: {
    label: "General Education",
    badgeClass: "bg-zinc-900/70 text-zinc-300 border-zinc-700/40",
    icon: Sparkles,
  },
};

function getEduCategoryMeta(cat: string) {
  return (
    EDU_CATEGORY_CONFIG[cat] ?? {
      label: cat || "Education",
      badgeClass: "bg-zinc-900/70 text-zinc-300 border-zinc-700/40",
      icon: GraduationCap,
    }
  );
}

const EDU_FILTER_TABS = [
  { id: "all", label: "All Topics" },
  { id: "Seller Education", label: "Seller Education" },
  { id: "Buyer Education", label: "Buyer Education" },
  { id: "Market Education", label: "Market Education" },
  { id: "Other", label: "General & Other" },
];

/* -------- Education Grid & Filters -------- */

function EduList({ token, onOpen }: { token: string; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");
  const fetchEdu = useServerFn(listPublicEdu);
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-edu", token],
    queryFn: () => fetchEdu({ data: { token } }),
  });
  const items = (data?.items ?? []) as any[];

  // Compute category counts
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: items.length };
    for (const i of items) {
      const cat = i.category === "Marketing Update" ? "Market Education" : i.category;
      map[cat] = (map[cat] || 0) + 1;
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const itemCat = i.category === "Marketing Update" ? "Market Education" : i.category;
      if (selectedCat !== "all" && itemCat !== selectedCat) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        const matchTitle = (i.title || "").toLowerCase().includes(s);
        const matchCaption = (i.caption || "").toLowerCase().includes(s);
        const matchCat = (i.category || "").toLowerCase().includes(s);
        if (!matchTitle && !matchCaption && !matchCat) return false;
      }
      return true;
    });
  }, [items, selectedCat, q]);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search educational topics, captions, or keywords..."
          className="pl-9 pr-9 h-11 text-base rounded-xl bg-surface-2/70 border-border/80 focus-visible:ring-gold"
        />
        {q ? (
          <button
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 -mx-1 px-1 scrollbar-none">
        {EDU_FILTER_TABS.map((tab) => {
          const active = selectedCat === tab.id;
          const count = counts[tab.id] ?? 0;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedCat(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border cursor-pointer active:scale-95",
                active
                  ? "bg-gold text-navy border-gold shadow-sm shadow-gold/25"
                  : "bg-surface-2/80 text-muted-foreground hover:text-foreground hover:bg-surface-2 border-border/80",
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                  active
                    ? "bg-navy/20 text-navy"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid of Cards */}
      {isLoading ? (
        <div className="text-center text-muted-foreground text-sm py-16 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
          <span>Loading educational content…</span>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground border-dashed rounded-2xl bg-surface-1/50 space-y-3">
          <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="font-medium text-foreground">No educational topics match your search.</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {q
              ? `No matches for "${q}". Try clearing the search or switching categories.`
              : "No items available in this category yet."}
          </p>
          {(q || selectedCat !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQ("");
                setSelectedCat("all");
              }}
              className="mt-2 text-xs cursor-pointer"
            >
              Clear filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((item) => {
            const meta = getEduCategoryMeta(item.category);
            const CategoryIcon = meta.icon;
            const isImg = item.file_url && isImageUrl(item.file_url);

            return (
              <button
                key={item.id}
                onClick={() => onOpen(item.id)}
                className="group text-left rounded-2xl overflow-hidden border border-border/80 bg-surface-1/95 hover:bg-surface-1 hover:border-gold/50 active:scale-[0.985] transition-all duration-300 shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.65),0_0_24px_-4px_rgba(196,90,44,0.22)] hover:-translate-y-1 ring-1 ring-inset ring-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold relative flex flex-col cursor-pointer"
              >
                {/* Top subtle ambient glow highlight */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 group-hover:via-gold/50 to-transparent transition-all duration-300 z-10" />

                {/* Media Preview Area */}
                <div className="aspect-video bg-surface-2 relative overflow-hidden flex items-center justify-center shrink-0">
                  {isImg ? (
                    <img
                      src={item.file_url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const fallback = target.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                  ) : null}

                  {/* Fallback branded banner if no image or image fails */}
                  <div
                    className="w-full h-full flex flex-col items-center justify-center p-4 text-center group-hover:scale-105 transition-transform duration-500 bg-gradient-to-br from-surface-2 via-surface-2/80 to-surface-1 relative"
                    style={{ display: isImg ? "none" : "flex" }}
                  >
                    <div className="h-12 w-12 rounded-2xl bg-gold/10 border border-gold/25 flex items-center justify-center mb-2 text-gold shadow-inner">
                      <CategoryIcon className="h-6 w-6 stroke-[1.75]" />
                    </div>
                    <span className="text-[11px] font-semibold text-foreground/80 tracking-wide uppercase">
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Social Marketing Kit
                    </span>
                  </div>

                  {/* Category Pill Badge on top-left */}
                  <Badge
                    className={cn(
                      "absolute top-3 left-3 border text-[10px] shadow-2xs font-semibold backdrop-blur-md z-10 px-2.5 py-0.5 rounded-full flex items-center gap-1",
                      meta.badgeClass,
                    )}
                  >
                    <CategoryIcon className="h-3 w-3" />
                    <span>{meta.label}</span>
                  </Badge>

                  {/* Asset indicator chip on top-right */}
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-2 py-0.5 text-[9px] font-semibold text-white/90 z-10 flex items-center gap-1 shadow-sm">
                    {isImg ? <ImageIcon className="h-2.5 w-2.5 text-gold" /> : null}
                    {item.caption ? <FileText className="h-2.5 w-2.5 text-gold" /> : null}
                    {item.drive_url ? <VideoIcon className="h-2.5 w-2.5 text-gold" /> : null}
                    <span>Marketing Kit</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-4.5 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="font-bold text-sm sm:text-base text-foreground group-hover:text-gold transition-colors duration-200 line-clamp-1 leading-snug">
                      {item.title}
                    </div>
                    {item.caption ? (
                      <p className="text-xs text-muted-foreground/85 line-clamp-2 leading-relaxed">
                        {item.caption}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic">
                        Social media graphic kit ready for download.
                      </p>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                      {item.caption ? (
                        <span className="flex items-center gap-1">
                          <MessageSquareQuote className="h-3 w-3 text-gold/80" />
                          <span>Caption Included</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <ImageIcon className="h-3 w-3 text-gold/80" />
                          <span>Graphic Only</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-gold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      View Marketing Kit →
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------- Education Detail View -------- */

function EducationDetailView({
  token,
  id,
  onBack,
}: {
  token: string;
  id: string;
  onBack: () => void;
}) {
  const fetchEduItem = useServerFn(getPublicEdu);
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-edu-item", id, token],
    queryFn: () => fetchEduItem({ data: { token, id } }),
  });
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="text-center text-muted-foreground py-20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
        <span className="text-sm">Loading marketing kit…</span>
      </div>
    );
  }

  const item = data?.item;
  if (!item) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">Educational topic not found.</p>
        <Button variant="outline" onClick={onBack} className="cursor-pointer">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Education
        </Button>
      </div>
    );
  }

  const meta = getEduCategoryMeta(item.category);
  const CategoryIcon = meta.icon;
  const isImg = item.file_url && isImageUrl(item.file_url);
  const wordCount = item.caption ? item.caption.trim().split(/\s+/).length : 0;

  const handleCopyCaption = async () => {
    if (!item.caption) return;
    try {
      await navigator.clipboard.writeText(item.caption);
      setCopied(true);
      toast.success("Caption copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <button
        onClick={onBack}
        className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gold hover:text-gold/80 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        <span>All Education Topics</span>
      </button>

      {/* Header Info Banner */}
      <div className="rounded-3xl border border-border/80 bg-surface-1/95 p-5 sm:p-7 relative overflow-hidden ring-1 ring-inset ring-white/[0.06] shadow-xl">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                className={cn(
                  "border text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs",
                  meta.badgeClass,
                )}
              >
                <CategoryIcon className="h-3 w-3" />
                <span>{meta.label}</span>
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                Social Content Kit
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              {item.title}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
              High-impact social media graphic, ready-to-publish copywriting caption, and agent marketing collateral.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {item.caption ? (
              <Button
                onClick={handleCopyCaption}
                className={cn(
                  "font-bold text-xs h-10 px-4 rounded-xl transition-all shadow-md cursor-pointer",
                  copied
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-gold text-navy hover:bg-gold/90 shadow-gold/20",
                )}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1.5" /> Copied Caption!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1.5" /> Copy Caption
                  </>
                )}
              </Button>
            ) : null}
            {item.file_url ? (
              <div className="w-auto">
                <DownloadButton
                  url={item.file_url}
                  filename={slug(item.title) + ".jpg"}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main Content Grid: Visual Graphic on Left, Ready Caption on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual Asset Preview */}
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-2xl border border-border/80 bg-surface-1/95 p-4 sm:p-5 space-y-4 ring-1 ring-inset ring-white/[0.06] shadow-lg">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-gold" />
                <span className="font-bold text-sm text-foreground">Social Media Graphic</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {item.file_size ? `${Math.round(item.file_size / 1024)} KB` : "High-Res"}
              </Badge>
            </div>

            {/* Media Image Frame */}
            <div className="rounded-xl overflow-hidden border border-border/60 bg-surface-2/60 relative group shadow-inner">
              {isImg ? (
                <div className="relative aspect-square sm:aspect-[4/3] flex items-center justify-center p-2 bg-black/20">
                  <img
                    src={item.file_url}
                    alt={item.title}
                    className="max-h-full max-w-full object-contain rounded-lg drop-shadow-md group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
              ) : (
                <div className="aspect-[4/3] flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <CategoryIcon className="h-12 w-12 text-gold/70" />
                  <span className="text-sm font-semibold text-foreground">{item.title}</span>
                  <span className="text-xs text-muted-foreground">Drive Document / Asset Link</span>
                </div>
              )}
            </div>

            {/* Graphic Actions */}
            <div className="space-y-2.5 pt-1">
              {item.file_url ? (
                <DownloadButton
                  url={item.file_url}
                  filename={slug(item.title) + ".jpg"}
                />
              ) : null}

              {item.drive_url ? (
                <a
                  href={item.drive_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-surface-2 text-foreground text-xs sm:text-sm font-semibold hover:bg-surface-2/80 border border-border/80 transition-all cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4 text-gold" /> Open Google Drive File
                </a>
              ) : null}
            </div>

            {/* Platform optimization notice */}
            <div className="rounded-xl bg-surface-2/50 border border-border/40 p-3 text-[11px] text-muted-foreground leading-relaxed flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold shrink-0" />
              <span>Optimized square &amp; portrait format ready for Instagram feeds, Facebook posts, and LinkedIn updates.</span>
            </div>
          </div>
        </div>

        {/* Right Column: Social Media Caption Copywriting */}
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-2xl border border-border/80 bg-surface-1/95 p-4 sm:p-5 space-y-4 ring-1 ring-inset ring-white/[0.06] shadow-lg">
            <div className="flex items-center justify-between border-b border-border/50 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gold" />
                <span className="font-bold text-sm text-foreground">Ready-to-Post Caption</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {wordCount} words · ~{Math.max(1, Math.round(wordCount / 160))} min read
                </span>
                {item.caption ? (
                  <Button
                    size="sm"
                    onClick={handleCopyCaption}
                    variant={copied ? "default" : "secondary"}
                    className={cn(
                      "h-8 px-2.5 text-xs font-semibold cursor-pointer",
                      copied ? "bg-emerald-600 text-white" : "",
                    )}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 mr-1" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Full Formatted Caption Box */}
            {item.caption ? (
              <div className="space-y-3">
                <div className="bg-surface-2/70 border border-border/60 rounded-xl p-4 sm:p-5 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed select-text font-sans shadow-inner max-h-[520px] overflow-y-auto custom-scrollbar">
                  {item.caption}
                </div>

                <Button
                  onClick={handleCopyCaption}
                  className={cn(
                    "w-full h-11 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer",
                    copied
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-gold text-navy hover:bg-gold/90 shadow-gold/20",
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" /> Caption Copied to Clipboard!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" /> Copy Full Caption to Clipboard
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground border border-dashed rounded-xl">
                No written caption attached for this topic. Use the graphic directly or summarize with your own market perspective!
              </div>
            )}

            {/* Agent Best Practices Callout */}
            <div className="rounded-xl bg-gold/5 border border-gold/20 p-3.5 space-y-1.5 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground flex items-center gap-1.5 text-[11px] text-gold">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Agent Pro-Tip for Higher Engagement</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Add a personalized closing call-to-action with your cell phone or DM invite before publishing (e.g. <em>"Call or text me directly at [Your Phone] to talk through your neighborhood strategy!"</em>).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------- utils -------- */

function slug(s: string) {
  return (s || "asset")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function AgentHubHomeLink() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem("msreg-agent-hub-unlocked") === "1");
    } catch {}
  }, []);
  if (!show) return null;
  return (
    <Link to="/agents" className="text-xs text-gold hover:underline px-2 py-1">
      ← Hub
    </Link>
  );
}

/* -------- Open Houses (agent-facing) -------- */

function OpenHousesList({ token, onOpen }: { token: string; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const fetchOpenHouses = useServerFn(listPublicOpenHouses);
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-open-houses", token],
    queryFn: () => fetchOpenHouses({ data: { token } }),
  });

  const filtered = useMemo(() => {
    const items = (data?.openHouses ?? []) as any[];
    if (!q.trim()) return items;
    const s = q.toLowerCase();
    return items.filter(
      (l) => l.address?.toLowerCase().includes(s) || (l.agent_name ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by address or agent"
          className="pl-9 h-11 text-base"
        />
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground text-sm py-10">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
          {q ? "No open houses match your search." : "No open houses available yet."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((l) => (
            <button
              key={l.id}
              onClick={() => onOpen(l.id)}
              className="group text-left rounded-2xl overflow-hidden border border-border/80 bg-surface-1/95 hover:bg-surface-1 hover:border-gold/50 active:scale-[0.985] transition-all duration-300 shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.65),0_0_24px_-4px_rgba(196,90,44,0.22)] hover:-translate-y-1 ring-1 ring-inset ring-white/[0.06] relative"
            >
              {/* Top sheen line */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 group-hover:via-gold/50 to-transparent transition-all duration-300 z-10" />

              <div className="aspect-video bg-surface-2 relative overflow-hidden">
                {l.thumbnail ? (
                  <img
                    src={l.thumbnail}
                    alt={l.address}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 bg-gradient-to-br from-surface-2 to-surface-1">
                    <Home className="h-8 w-8 stroke-[1.5]" />
                  </div>
                )}
                <Badge className={cn("absolute top-3 left-3 border text-[10px] shadow-2xs font-semibold backdrop-blur-md z-10 px-2.5 py-0.5 rounded-full", OH_STATUS_CLASS[l.status])}>
                  {OH_STATUS_LABEL[l.status] ?? l.status}
                </Badge>
              </div>
              <div className="p-4 sm:p-4.5 space-y-1">
                <div className="font-bold text-sm sm:text-base text-foreground group-hover:text-gold transition-colors duration-200 truncate">
                  {l.address}
                </div>
                <div className="text-xs text-muted-foreground truncate">{l.agent_name || "Unassigned"}</div>
                {l.open_house_at && (
                  <div className="text-xs text-gold font-medium mt-1 flex items-center gap-1">
                    <span className="truncate">{fmtDateTime(l.open_house_at)}</span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const OH_CATEGORIES = [
  "Agent QR Code",
  "Branded Photos and Copy",
  "Coloring Page",
  "Flyer",
  "Other",
] as const;

function OpenHouseView({ token, id, onBack }: { token: string; id: string; onBack: () => void }) {
  const fetchOpenHouse = useServerFn(getPublicOpenHouse);
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-open-house", id, token],
    queryFn: () => fetchOpenHouse({ data: { token, id } }),
  });
  const [detailItem, setDetailItem] = useState<any | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading…</div>;
  if (!data) return <div className="text-center text-muted-foreground py-10">Not found.</div>;

  const { openHouse, assets, captions } = data as any;
  const assetsByCat: Record<string, any[]> = {};
  for (const a of assets) {
    const cat = a.category || "Other";
    (assetsByCat[cat] ||= []).push(a);
  }
  const captionsByCat: Record<string, any[]> = {};
  for (const c of captions) {
    const cat = c.category || "Branded Photos and Copy";
    (captionsByCat[cat] ||= []).push(c);
  }

  const hasAny =
    OH_CATEGORIES.some((c) => (assetsByCat[c]?.length || 0) > 0) ||
    OH_CATEGORIES.some((c) => (captionsByCat[c]?.length || 0) > 0);

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gold hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> All open houses
      </button>

      <div>
        <h1 className="text-xl font-semibold">{openHouse.address}</h1>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
          {openHouse.agent_name && <span>{openHouse.agent_name}</span>}
          <Badge className={cn("border", OH_STATUS_CLASS[openHouse.status])}>
            {OH_STATUS_LABEL[openHouse.status] ?? openHouse.status}
          </Badge>
          {openHouse.open_house_at && (
            <span className="text-gold">{fmtDateTime(openHouse.open_house_at)}</span>
          )}
        </div>
        {openHouse.description && (
          <p className="text-sm text-muted-foreground mt-2">{openHouse.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button
            asChild
            size="sm"
            className="bg-gold text-navy hover:bg-gold/90 font-semibold text-xs h-8"
          >
            <a href={`/open-house-signin/${openHouse.id}`} target="_blank" rel="noreferrer">
              <QrCode className="h-3.5 w-3.5 mr-1.5" /> Visitor Sign-In Page
            </a>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="text-xs h-8"
          >
            <a href={`/open-houses?id=${openHouse.id}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Management Hub
            </a>
          </Button>
          {(() => {
            const ohPhotos = assets.filter((a: any) => isImageUrl(a.file_url));
            return ohPhotos.length > 0 ? (
              <DownloadPhotosButton photos={ohPhotos} address={openHouse.address} />
            ) : null;
          })()}
        </div>
      </div>

      {OH_CATEGORIES.map((cat) => {
        const items = assetsByCat[cat] || [];
        const caps = captionsByCat[cat] || [];
        if (!items.length && !caps.length) return null;
        return (
          <section key={cat} className="space-y-2">
            <h2 className="text-sm font-semibold text-gold flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> {cat}
              <span className="text-muted-foreground font-normal">· {items.length}</span>
            </h2>
            {items.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {items.map((a) => {
                  const isImg = isImageUrl(a.file_url);
                  return (
                    <div
                      key={a.id}
                      className="rounded-lg overflow-hidden border border-border bg-card"
                    >
                      <button
                        onClick={() => setDetailItem({ ...a, _category: cat })}
                        className="block w-full aspect-square bg-muted relative"
                      >
                        {isImg ? (
                          <img
                            src={a.thumbnail_url || a.file_url}
                            alt={a.name ?? ""}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1 p-2">
                            <FileText className="h-10 w-10" />
                            <span className="text-[10px] truncate w-full text-center">
                              {a.name ?? "File"}
                            </span>
                          </div>
                        )}
                      </button>
                      {a.file_url && (
                        <div className="p-1.5">
                          <DownloadButton
                            url={a.file_url}
                            filename={a.name || `${slug(cat)}-${a.id}`}
                            small
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {caps.length > 0 && (
              <div className="space-y-2">
                {caps.map((c) => (
                  <CaptionCard key={c.id} text={c.caption_text} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {!hasAny && (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
          Marketing hasn't uploaded assets for this open house yet.
        </Card>
      )}

      {detailItem && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
          <div className="flex items-center justify-between gap-3 p-4 border-b border-white/10 shrink-0">
            <div className="min-w-0">
              <h2 className="text-base font-semibold truncate">
                {detailItem.name || detailItem._category}
              </h2>
              <Badge className="bg-navy/80 border border-gold/30 text-gold mt-1">
                {detailItem._category}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDetailItem(null)}
              className="shrink-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center gap-4">
            {isImageUrl(detailItem.file_url) ? (
              <img
                src={detailItem.file_url}
                alt={detailItem.name ?? ""}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <FileText className="h-20 w-20 text-gold" />
                <p className="text-muted-foreground text-sm">{detailItem.name ?? "File"}</p>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-white/10 bg-card shrink-0">
            {detailItem.file_url && (
              <DownloadButton
                url={detailItem.file_url}
                filename={detailItem.name || `${slug(detailItem._category)}-${detailItem.id}`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------- Agent Branded (agent-facing) -------- */

const BRANDED_TYPES = [
  "Testimonial",
  "Listing Presentation",
  "Buyer Presentation",
  "Headshot",
  "Education",
  "Social Post",
  "Other",
];

function AgentBrandedContentList({ token }: { token: string }) {
  const [agentId, setAgentId] = useState<string | null>(null);
  const fetchAgents = useServerFn(listPublicBrandedAgents);
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-branded-agents", token],
    queryFn: () => fetchAgents({ data: { token } }),
  });
  const agents = (data?.agents ?? []) as any[];

  if (agentId) {
    const a = agents.find((x) => x.id === agentId);
    return (
      <BrandedContentView
        token={token}
        agentId={agentId}
        agentName={a?.name ?? ""}
        onBack={() => setAgentId(null)}
      />
    );
  }

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading…</div>;
  if (agents.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
        No branded content available yet.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose an agent to view their branded content.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => setAgentId(a.id)}
            className="text-left rounded-lg overflow-hidden border border-border bg-card hover:border-gold/60 active:scale-[0.99] transition p-4 flex flex-col items-center gap-2"
          >
            <div className="h-16 w-16 rounded-full bg-muted overflow-hidden flex items-center justify-center">
              {a.headshot_url ? (
                <img src={a.headshot_url} alt={a.name} className="w-full h-full object-cover" />
              ) : (
                <User className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="font-medium text-sm text-center">{a.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function BrandedContentView({
  token,
  agentId,
  agentName,
  onBack,
}: {
  token: string;
  agentId: string;
  agentName: string;
  onBack: () => void;
}) {
  const fetchContent = useServerFn(listPublicAgentBrandedContent);
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-agent-content", agentId, token],
    queryFn: () => fetchContent({ data: { token, agentId } }),
  });
  const [filter, setFilter] = useState<string>("all");
  const [detailItem, setDetailItem] = useState<any | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = (data?.items ?? []) as any[];
  const filtered = filter === "all" ? items : items.filter((i) => i.content_type === filter);
  const agentData = data?.agent as any;

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gold hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> All agents
      </button>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-16 w-16 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center border border-border">
            {agentData?.headshot_url ? (
              <img
                src={agentData.headshot_url}
                alt={agentName}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold truncate">{agentData?.name ?? agentName}</h1>
            <p className="text-xs text-muted-foreground">Branded content</p>
          </div>
        </div>
        {agentData?.headshot_url && (
          <DownloadButton
            url={agentData.headshot_url}
            filename={`${agentData?.name || agentName} headshot`}
            small
          />
        )}
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-10">Loading…</div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
          No branded content for this agent yet.
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border",
                filter === "all"
                  ? "border-gold text-gold bg-gold/10"
                  : "border-border text-muted-foreground",
              )}
            >
              All · {items.length}
            </button>
            {BRANDED_TYPES.map((t) => {
              const n = items.filter((i) => i.content_type === t).length;
              if (!n) return null;
              return (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border",
                    filter === t
                      ? "border-gold text-gold bg-gold/10"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {t} · {n}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((i) => {
              const isImg = isImageUrl(i.file_url);
              return (
                <Card key={i.id} className="overflow-hidden">
                  <div
                    className="aspect-video bg-muted flex items-center justify-center relative cursor-pointer"
                    onClick={() => setDetailItem(i)}
                  >
                    {isImg ? (
                      <img src={i.file_url} alt={i.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        {i.drive_url ? (
                          <VideoIcon className="h-10 w-10" />
                        ) : (
                          <FileText className="h-10 w-10" />
                        )}
                      </div>
                    )}
                    <Badge className="absolute top-2 left-2 bg-navy/80 border border-gold/30 text-gold pointer-events-none">
                      {i.content_type}
                    </Badge>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="font-medium text-sm">{i.title}</div>
                    {i.caption && (
                      <>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {i.caption}
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full h-9"
                          onClick={async () => {
                            await navigator.clipboard.writeText(i.caption);
                            toast.success("Caption copied");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copy caption
                        </Button>
                      </>
                    )}
                    {i.file_url && <DownloadButton url={i.file_url} filename={i.title || "file"} />}
                    {i.drive_url && (
                      <a
                        href={i.drive_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1 w-full h-10 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open on Drive
                      </a>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {detailItem && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
          <div className="flex items-center justify-between gap-3 p-4 border-b border-white/10 shrink-0">
            <div className="min-w-0">
              <h2 className="text-base font-semibold truncate">{detailItem.title}</h2>
              <Badge className="bg-navy/80 border border-gold/30 text-gold mt-1">
                {detailItem.content_type}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDetailItem(null)}
              className="shrink-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center gap-4">
            {isImageUrl(detailItem.file_url) ? (
              <img
                src={detailItem.file_url}
                alt={detailItem.title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            ) : detailItem.drive_url ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <VideoIcon className="h-20 w-20 text-gold" />
                <p className="text-muted-foreground text-sm">This item is hosted on Google Drive</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <FileText className="h-20 w-20 text-gold" />
                <p className="text-muted-foreground text-sm">{detailItem.title}</p>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-white/10 bg-card space-y-3 shrink-0">
            {detailItem.caption && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {detailItem.caption}
              </p>
            )}
            {detailItem.file_url && (
              <DownloadButton url={detailItem.file_url} filename={detailItem.title || "file"} />
            )}
            {detailItem.drive_url && (
              <a
                href={detailItem.drive_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1 w-full h-10 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open on Drive
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
