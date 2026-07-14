import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isImageUrl } from "@/lib/sanitize-filename";
import { DownloadPhotosButton } from "@/components/download-photos-button";
import logo from "@/assets/msreg-logo.png";
import {
  Search, Download, Copy, ExternalLink, ArrowLeft, X, Image as ImageIcon,
  FileText, Video as VideoIcon, Home, Lock, Loader2, Package, User,
} from "lucide-react";

export const Route = createFileRoute("/agent-toolbox")({
  ssr: false,
  component: PublicToolboxPage,
  head: () => ({
    meta: [
      { title: "Agent Toolbox — Matt Smith Real Estate Group" },
      { name: "robots", content: "noindex, nofollow, noarchive, nosnippet" },
      { name: "googlebot", content: "noindex, nofollow" },
      { name: "description", content: "Private MSREG agent toolbox." },
    ],
  }),
});

const STORAGE_KEY = "msreg-toolbox-token";

const STATUS_LABEL: Record<string, string> = { active: "Active", coming_soon: "Coming Soon", sold: "Sold" };
const STATUS_CLASS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  coming_soon: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  sold: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};
const OH_STATUS_LABEL: Record<string, string> = { upcoming: "Upcoming", past: "Past" };
const OH_STATUS_CLASS: Record<string, string> = {
  upcoming: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  past: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};
function fmtDateTime(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

function PublicToolboxPage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem(STORAGE_KEY);
      if (t) setToken(t);
    } catch {}
  }, []);

  if (!token) return <Gate onUnlock={(t) => { try { localStorage.setItem(STORAGE_KEY, t); } catch {}; setToken(t); }} />;
  return <Toolbox token={token} onLock={() => { try { localStorage.removeItem(STORAGE_KEY); } catch {}; setToken(null); }} />;
}

/* -------- Access gate -------- */

function Gate({ onUnlock }: { onUnlock: (token: string) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      if (code.trim().toUpperCase() === "MSREG2026") {
        onUnlock("valid-token");
      } else {
        throw new Error("Incorrect access code");
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not verify code");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <Card className="w-full max-w-sm p-6 space-y-5">
        <div className="flex flex-col items-center text-center gap-3">
          <img src={logo} alt="MSREG" className="h-20 w-auto" />
          <div>
            <h1 className="text-lg font-semibold">Agent Toolbox</h1>
            <p className="text-xs text-muted-foreground mt-1">Matt Smith Real Estate Group</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Team access code
          </label>
          <Input
            autoFocus
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code"
            className="text-center text-base"
          />
          <Button type="submit" disabled={busy} className="w-full bg-gold text-navy hover:bg-gold/90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground text-center">
          Ask the marketing team for the access code. You'll only enter it once on this device.
        </p>
      </Card>
    </div>
  );
}

/* -------- Main toolbox -------- */

function Toolbox({ token, onLock }: { token: string; onLock: () => void }) {
  const [tab, setTab] = useState("listings");
  const [openListing, setOpenListing] = useState<string | null>(null);
  const [openOpenHouse, setOpenOpenHouse] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-sidebar/95 backdrop-blur border-b border-border pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img src={logo} alt="MSREG" className="h-9 w-auto shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">Agent Toolbox</div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-gold/80 truncate">Matt Smith Real Estate Group</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <AgentHubHomeLink />
            <Button variant="ghost" size="sm" onClick={onLock} className="text-xs">Lock</Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {openListing ? (
          <ListingView token={token} id={openListing} onBack={() => setOpenListing(null)} />
        ) : openOpenHouse ? (
          <OpenHouseView token={token} id={openOpenHouse} onBack={() => setOpenOpenHouse(null)} />
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="w-full h-11 grid grid-cols-5">
              <TabsTrigger value="listings" className="text-xs sm:text-sm">Listings</TabsTrigger>
              <TabsTrigger value="open_houses" className="text-xs sm:text-sm">Open Houses</TabsTrigger>
              <TabsTrigger value="brand" className="text-xs sm:text-sm">Branding</TabsTrigger>
              <TabsTrigger value="edu" className="text-xs sm:text-sm">Education</TabsTrigger>
              <TabsTrigger value="branded" className="text-xs sm:text-sm">Agent Branded</TabsTrigger>
            </TabsList>
            <TabsContent value="listings" className="mt-4">
              <ListingsList token={token} onOpen={setOpenListing} />
            </TabsContent>
            <TabsContent value="open_houses" className="mt-4">
              <OpenHousesList token={token} onOpen={setOpenOpenHouse} />
            </TabsContent>
            <TabsContent value="brand" className="mt-4">
              <BrandList token={token} />
            </TabsContent>
            <TabsContent value="edu" className="mt-4">
              <EduList token={token} />
            </TabsContent>
            <TabsContent value="branded" className="mt-4">
              <BrandedAgentSection token={token} />
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
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-listings"],
    queryFn: async () => {
      const { data: listings, error } = await supabase
        .from("toolbox_listings")
        .select("id,address,agent_name,status,description,created_at")
        .in("status", ["active", "coming_soon"])
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (listings ?? []).map((l: any) => l.id);
      let thumbs: Record<string, string> = {};
      if (ids.length) {
        const { data: assets, error: aErr } = await supabase
          .from("toolbox_assets")
          .select("listing_id,thumbnail_url,file_url,asset_type,created_at")
          .in("listing_id", ids)
          .order("created_at", { ascending: true });
        if (aErr) throw aErr;

        for (const a of (assets ?? []) as any[]) {
          if (thumbs[a.listing_id]) continue;
          const candidate = a.asset_type === "video" ? a.thumbnail_url : a.thumbnail_url || a.file_url;
          if (candidate) thumbs[a.listing_id] = candidate;
        }
      }
      return { listings: (listings ?? []).map((l: any) => ({ ...l, thumbnail: thumbs[l.id] ?? null })) };
    },
  });

  const filtered = useMemo(() => {
    const items = (data?.listings ?? []) as any[];
    if (!q.trim()) return items;
    const s = q.toLowerCase();
    return items.filter((l) => l.address?.toLowerCase().includes(s) || (l.agent_name ?? "").toLowerCase().includes(s));
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((l) => (
            <button
              key={l.id}
              onClick={() => onOpen(l.id)}
              className="text-left rounded-lg overflow-hidden border border-border bg-card hover:border-gold/60 active:scale-[0.99] transition"
            >
              <div className="aspect-video bg-muted relative">
                {l.thumbnail ? (
                  <img src={l.thumbnail} alt={l.address} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Home className="h-8 w-8" />
                  </div>
                )}
                <Badge className={cn("absolute top-2 left-2 border", STATUS_CLASS[l.status])}>
                  {STATUS_LABEL[l.status] ?? l.status}
                </Badge>
              </div>
              <div className="p-3">
                <div className="font-medium text-sm truncate">{l.address}</div>
                <div className="text-xs text-muted-foreground truncate">{l.agent_name || "—"}</div>
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
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-listing", id],
    queryFn: async () => {
      const [{ data: listing }, { data: assets }, { data: captions }] = await Promise.all([
        supabase.from("toolbox_listings").select("id,address,agent_name,status,description").eq("id", id).maybeSingle(),
        supabase.from("toolbox_assets").select("*").eq("listing_id", id).order("created_at", { ascending: true }),
        supabase.from("toolbox_captions").select("id,caption_text,created_at").eq("listing_id", id).order("created_at", { ascending: true }),
      ]);
      if (!listing) throw new Error("Not found");
      return { listing, assets: assets ?? [], captions: captions ?? [] };
    },
  });

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading…</div>;
  if (!data) return <div className="text-center text-muted-foreground py-10">Not found.</div>;

  const { listing, assets, captions } = data as any;
  const photos = assets.filter((a: any) => a.asset_type === "photo");
  const videos = assets.filter((a: any) => a.asset_type === "video");
  const graphics = assets.filter((a: any) => a.asset_type === "graphic");
  const allImages = assets.filter(
    (a: any) => a.asset_type !== "video" && isImageUrl(a.file_url),
  );

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
              <Badge className={cn("border", STATUS_CLASS[listing.status])}>{STATUS_LABEL[listing.status] ?? listing.status}</Badge>
            </div>
          </div>
          {allImages.length > 0 && (
            <DownloadPhotosButton photos={allImages} address={listing.address} />
          )}
        </div>
        {listing.description && <p className="text-sm text-muted-foreground mt-2">{listing.description}</p>}
      </div>


      {photos.length > 0 && <PhotoGallery photos={photos} address={listing.address} />}

      {videos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gold flex items-center gap-2"><VideoIcon className="h-4 w-4" /> Videos</h2>
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
          <h2 className="text-sm font-semibold text-gold flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Pre-made Graphics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {graphics.map((g: any) => (
              <div key={g.id} className="rounded-lg overflow-hidden border border-border bg-card">
                <div className="aspect-square bg-muted">
                  <img src={g.thumbnail_url || g.file_url} alt={g.name ?? ""} className="w-full h-full object-cover" />
                </div>
                <div className="p-2 space-y-1">
                  {g.name && <div className="text-[11px] text-muted-foreground truncate">{g.name}</div>}
                  <DownloadButton url={g.file_url} filename={`${slug(listing.address)}-${slug(g.name ?? "graphic")}.jpg`} small />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {captions.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gold flex items-center gap-2"><FileText className="h-4 w-4" /> Ready-to-use Captions</h2>
          <div className="space-y-2">
            {captions.map((c: any) => (
              <CaptionCard key={c.id} text={c.caption_text} />
            ))}
          </div>
        </section>
      )}

      {photos.length === 0 && videos.length === 0 && graphics.length === 0 && captions.length === 0 && (
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
          <ImageIcon className="h-4 w-4" /> Photos <span className="text-muted-foreground font-normal">· {photos.length}</span>
        </h2>
        <Button onClick={downloadAll} disabled={zipping} size="sm" className="bg-gold text-navy hover:bg-gold/90 h-9">
          {zipping ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Zipping…</> : <><Package className="h-4 w-4 mr-1" />Download all</>}
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((p, idx) => (
          <div key={p.id} className="rounded-lg overflow-hidden border border-border bg-card">
            <button onClick={() => setLightbox(idx)} className="block w-full aspect-square bg-muted">
              <img src={p.thumbnail_url || p.file_url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
            <div className="p-1.5">
              <DownloadButton url={p.file_url} filename={`${slug(address)}-${String(idx + 1).padStart(2, "0")}.jpg`} small />
            </div>
          </div>
        ))}
      </div>

      {lightbox !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={photos[lightbox].file_url} alt="" className="max-w-full max-h-[80vh] object-contain" />
          <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="secondary" onClick={() => setLightbox((i) => (i! > 0 ? i! - 1 : photos.length - 1))}>Prev</Button>
            <DownloadButton url={photos[lightbox].file_url} filename={`${slug(address)}-${String(lightbox + 1).padStart(2, "0")}.jpg`} />
            <Button size="sm" variant="secondary" onClick={() => setLightbox((i) => (i! < photos.length - 1 ? i! + 1 : 0))}>Next</Button>
            <Button size="sm" variant="ghost" onClick={() => setLightbox(null)}>Close</Button>
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

function DownloadButton({ url, filename, small }: { url: string; filename: string; small?: boolean }) {
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
    <Button onClick={onClick} disabled={busy} size="sm" variant="secondary" className={cn("w-full", small ? "h-8 text-xs" : "h-10")}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Download className="h-3.5 w-3.5 mr-1" /> Download</>}
    </Button>
  );
}

/* -------- Branding -------- */

function BrandList({ token }: { token: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-brand"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("toolbox_brand_assets")
        .select("id,name,category,file_url,file_size,created_at")
        .order("category", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { items: rows ?? [] };
    },
  });
  const items = (data?.items ?? []) as any[];
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const i of items) (g[i.category] ??= []).push(i);
    return g;
  }, [items]);

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading…</div>;
  if (items.length === 0) return <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">No branding assets yet.</Card>;

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([cat, list]) => (
        <section key={cat} className="space-y-2">
          <h3 className="text-sm font-semibold text-gold">{cat} <span className="text-muted-foreground font-normal">· {list.length}</span></h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {list.map((i) => {
              const isImg = isImageUrl(i.file_url);
              return (
                <div key={i.id} className="rounded-lg overflow-hidden border border-border bg-card">
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    {isImg ? (
                      <img src={i.file_url} alt={i.name} className="w-full h-full object-contain p-2" />
                    ) : (
                      <FileText className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="text-xs font-medium truncate">{i.name}</div>
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

/* -------- Education -------- */

function EduList({ token }: { token: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-edu"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("toolbox_educational")
        .select("id,title,category,file_url,drive_url,caption,file_size,created_at")
        .order("category", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { items: rows ?? [] };
    },
  });
  const items = (data?.items ?? []) as any[];
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const i of items) (g[i.category] ??= []).push(i);
    return g;
  }, [items]);

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading…</div>;
  if (items.length === 0) return <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">No educational content yet.</Card>;

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([cat, list]) => (
        <section key={cat} className="space-y-2">
          <h3 className="text-sm font-semibold text-gold">{cat} <span className="text-muted-foreground font-normal">· {list.length}</span></h3>
          <div className="space-y-2">
            {list.map((i) => {
              const isImg = isImageUrl(i.file_url);
              return (
                <Card key={i.id} className="overflow-hidden">
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    {isImg ? (
                      <img src={i.file_url} alt={i.title} className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="font-medium text-sm">{i.title}</div>
                    {i.caption && (
                      <>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">{i.caption}</div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full h-9"
                          onClick={async () => { await navigator.clipboard.writeText(i.caption); toast.success("Caption copied"); }}
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
        </section>
      ))}
    </div>
  );
}

/* -------- utils -------- */

function slug(s: string) {
  return (s || "asset").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

function AgentHubHomeLink() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(localStorage.getItem("msreg-agent-hub-unlocked") === "1"); } catch {}
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
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-open-houses"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("toolbox_open_houses")
        .select("id,address,agent_name,status,open_house_at,description,created_at")
        .in("status", ["upcoming", "past"])
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (rows ?? []).map((o: any) => o.id);
      let thumbs: Record<string, string> = {};
      if (ids.length) {
        const { data: assets, error: aErr } = await supabase
          .from("toolbox_open_house_assets")
          .select("open_house_id,thumbnail_url,file_url,asset_type,created_at,category")
          .in("open_house_id", ids)
          .order("created_at", { ascending: true });
        if (aErr) throw aErr;

        // Group assets by open_house_id
        const assetsByOH: Record<string, any[]> = {};
        for (const a of (assets ?? []) as any[]) {
          (assetsByOH[a.open_house_id] ||= []).push(a);
        }

        for (const [ohId, ohAssets] of Object.entries(assetsByOH)) {
          // Prioritize categories: Branded Photos and Copy first, then other media, fallback to QR code
          const preferredCategories = [
            "Branded Photos and Copy",
            "Flyer",
            "Coloring Page",
            "Other",
            "Agent QR Code"
          ];
          
          let bestCandidate = null;
          for (const cat of preferredCategories) {
            const match = ohAssets.find(a => a.category === cat && (a.asset_type === "video" ? a.thumbnail_url : a.thumbnail_url || a.file_url));
            if (match) {
              bestCandidate = match.asset_type === "video" ? match.thumbnail_url : match.thumbnail_url || match.file_url;
              break;
            }
          }

          if (!bestCandidate && ohAssets.length) {
            const fallback = ohAssets.find(a => a.asset_type === "video" ? a.thumbnail_url : a.thumbnail_url || a.file_url);
            if (fallback) {
              bestCandidate = fallback.asset_type === "video" ? fallback.thumbnail_url : fallback.thumbnail_url || fallback.file_url;
            }
          }

          if (bestCandidate) {
            thumbs[ohId] = bestCandidate;
          }
        }
      }
      return { openHouses: (rows ?? []).map((o: any) => ({ ...o, thumbnail: thumbs[o.id] ?? null })) };
    },
  });

  const filtered = useMemo(() => {
    const items = (data?.openHouses ?? []) as any[];
    if (!q.trim()) return items;
    const s = q.toLowerCase();
    return items.filter((l) => l.address?.toLowerCase().includes(s) || (l.agent_name ?? "").toLowerCase().includes(s));
  }, [data, q]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by address or agent" className="pl-9 h-11 text-base" />
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
              className="text-left rounded-lg overflow-hidden border border-border bg-card hover:border-gold/60 active:scale-[0.99] transition"
            >
              <div className="aspect-video bg-muted relative">
                {l.thumbnail ? (
                  <img src={l.thumbnail} alt={l.address} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Home className="h-8 w-8" /></div>
                )}
                <Badge className={cn("absolute top-2 left-2 border", OH_STATUS_CLASS[l.status])}>
                  {OH_STATUS_LABEL[l.status] ?? l.status}
                </Badge>
              </div>
              <div className="p-3">
                <div className="font-medium text-sm truncate">{l.address}</div>
                <div className="text-xs text-muted-foreground truncate">{l.agent_name || "—"}</div>
                {l.open_house_at && <div className="text-xs text-gold mt-0.5">{fmtDateTime(l.open_house_at)}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const OH_CATEGORIES = ["Agent QR Code", "Branded Photos and Copy", "Coloring Page", "Flyer", "Other"] as const;

function OpenHouseView({ token, id, onBack }: { token: string; id: string; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-open-house", id],
    queryFn: async () => {
      const [{ data: openHouse }, { data: assets }, { data: captions }] = await Promise.all([
        supabase.from("toolbox_open_houses").select("id,address,agent_name,status,open_house_at,description").eq("id", id).maybeSingle(),
        supabase.from("toolbox_open_house_assets").select("*").eq("open_house_id", id).order("created_at", { ascending: true }),
        supabase.from("toolbox_open_house_captions").select("id,caption_text,created_at").eq("open_house_id", id).order("created_at", { ascending: true }),
      ]);
      if (!openHouse) throw new Error("Not found");
      return { openHouse, assets: assets ?? [], captions: captions ?? [] };
    },
  });
  const [detailItem, setDetailItem] = useState<any | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDetailItem(null); };
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
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gold hover:underline">
        <ArrowLeft className="h-4 w-4" /> All open houses
      </button>

      <div>
        <h1 className="text-xl font-semibold">{openHouse.address}</h1>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
          {openHouse.agent_name && <span>{openHouse.agent_name}</span>}
          <Badge className={cn("border", OH_STATUS_CLASS[openHouse.status])}>{OH_STATUS_LABEL[openHouse.status] ?? openHouse.status}</Badge>
          {openHouse.open_house_at && <span className="text-gold">{fmtDateTime(openHouse.open_house_at)}</span>}
        </div>
        {openHouse.description && <p className="text-sm text-muted-foreground mt-2">{openHouse.description}</p>}
        {(() => {
          const ohPhotos = assets.filter((a: any) => isImageUrl(a.file_url));
          return ohPhotos.length > 0 ? (
            <div className="mt-3">
              <DownloadPhotosButton photos={ohPhotos} address={openHouse.address} />
            </div>
          ) : null;
        })()}
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
                    <div key={a.id} className="rounded-lg overflow-hidden border border-border bg-card">
                      <button
                        onClick={() => setDetailItem({ ...a, _category: cat })}
                        className="block w-full aspect-square bg-muted relative"
                      >
                        {isImg ? (
                          <img src={a.thumbnail_url || a.file_url} alt={a.name ?? ""} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1 p-2">
                            <FileText className="h-10 w-10" />
                            <span className="text-[10px] truncate w-full text-center">{a.name ?? "File"}</span>
                          </div>
                        )}
                      </button>
                      {a.file_url && (
                        <div className="p-1.5">
                          <DownloadButton url={a.file_url} filename={a.name || `${slug(cat)}-${a.id}`} small />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {caps.length > 0 && (
              <div className="space-y-2">
                {caps.map((c) => <CaptionCard key={c.id} text={c.caption_text} />)}
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
              <h2 className="text-base font-semibold truncate">{detailItem.name || detailItem._category}</h2>
              <Badge className="bg-navy/80 border border-gold/30 text-gold mt-1">{detailItem._category}</Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDetailItem(null)} className="shrink-0">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center gap-4">
            {isImageUrl(detailItem.file_url) ? (
              <img src={detailItem.file_url} alt={detailItem.name ?? ""} className="max-w-full max-h-[75vh] object-contain rounded-lg" />
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <FileText className="h-20 w-20 text-gold" />
                <p className="text-muted-foreground text-sm">{detailItem.name ?? "File"}</p>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-white/10 bg-card shrink-0">
            {detailItem.file_url && (
              <DownloadButton url={detailItem.file_url} filename={detailItem.name || `${slug(detailItem._category)}-${detailItem.id}`} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}


/* -------- Agent Branded (agent-facing) -------- */

const BRANDED_TYPES = ["Testimonial", "Listing Presentation", "Buyer Presentation", "Headshot", "Education", "Social Post", "Other"];

function BrandedAgentSection({ token }: { token: string }) {
  const [agentId, setAgentId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-branded-agents"],
    queryFn: async () => {
      const [agentsRes, contentRes] = await Promise.all([
        supabase.from("toolbox_agents").select("id,name,headshot_url,identifier,active").eq("active", true).order("name", { ascending: true }),
        supabase.from("toolbox_agent_content").select("agent_id"),
      ]);
      const agents = agentsRes.data ?? [];
      const content = contentRes.data ?? [];
      const withContentIds = new Set(content.map((c: any) => c.agent_id));
      const activeWithContent = agents.filter((a: any) => withContentIds.has(a.id));
      return { agents: activeWithContent };
    },
  });
  const agents = (data?.agents ?? []) as any[];

  if (agentId) {
    const a = agents.find((x) => x.id === agentId);
    return <BrandedContentView token={token} agentId={agentId} agentName={a?.name ?? ""} onBack={() => setAgentId(null)} />;
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
      <p className="text-sm text-muted-foreground">Choose an agent to view their branded content.</p>
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
  token, agentId, agentName, onBack,
}: { token: string; agentId: string; agentName: string; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["public-toolbox-agent-content", agentId],
    queryFn: async () => {
      const [{ data: agent }, { data: items }] = await Promise.all([
        supabase.from("toolbox_agents").select("id,name,headshot_url,identifier").eq("id", agentId).maybeSingle(),
        supabase.from("toolbox_agent_content").select("*").eq("agent_id", agentId).order("created_at", { ascending: false }),
      ]);
      if (!agent) throw new Error("Agent not found");
      return { agent, items: items ?? [] };
    },
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
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gold hover:underline">
        <ArrowLeft className="h-4 w-4" /> All agents
      </button>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-16 w-16 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center border border-border">
            {agentData?.headshot_url ? (
              <img src={agentData.headshot_url} alt={agentName} className="w-full h-full object-cover" />
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
          <DownloadButton url={agentData.headshot_url} filename={`${agentData?.name || agentName} headshot`} small />
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
              className={cn("text-xs px-3 py-1.5 rounded-full border", filter === "all" ? "border-gold text-gold bg-gold/10" : "border-border text-muted-foreground")}
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
                  className={cn("text-xs px-3 py-1.5 rounded-full border", filter === t ? "border-gold text-gold bg-gold/10" : "border-border text-muted-foreground")}
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
                        {i.drive_url ? <VideoIcon className="h-10 w-10" /> : <FileText className="h-10 w-10" />}
                      </div>
                    )}
                    <Badge className="absolute top-2 left-2 bg-navy/80 border border-gold/30 text-gold pointer-events-none">{i.content_type}</Badge>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="font-medium text-sm">{i.title}</div>
                    {i.caption && (
                      <>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">{i.caption}</div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full h-9"
                          onClick={async () => { await navigator.clipboard.writeText(i.caption); toast.success("Caption copied"); }}
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
              <Badge className="bg-navy/80 border border-gold/30 text-gold mt-1">{detailItem.content_type}</Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDetailItem(null)} className="shrink-0">
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
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailItem.caption}</p>
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
