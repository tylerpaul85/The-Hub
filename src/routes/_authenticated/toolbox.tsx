import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cloneListingAssetsToOpenHouse } from "@/lib/open-houses.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn, getGoogleDrivePreviewUrl } from "@/lib/utils";
import {
  Plus,
  Upload,
  Trash2,
  Copy,
  Link as LinkIcon,
  Image as ImageIcon,
  FileText,
  Video as VideoIcon,
  Home,
  X,
  Loader2,
  ExternalLink,
  Users,
  AlertTriangle,
  Pencil,
  Archive,
  ArchiveRestore,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  Sparkles,
  LayoutGrid,
  BarChart3,
  TrendingUp,
  FileSpreadsheet,
  Calendar,
  Wand2,
} from "lucide-react";
import { extractMarketStatsFromPdf } from "@/lib/mls-pdf-parser";
import { QrCode } from "@/components/qr-code";
import { publicUrl } from "@/lib/public-url";
import { makeStorageKey } from "@/lib/sanitize-filename";
import { DownloadPhotosButton } from "@/components/download-photos-button";
import { DEFAULT_HUB_CARDS, type HubCardDefinition } from "@/lib/hub-cards.config";
import {
  getPublicHubCardSettings,
  saveHubCardSettings,
} from "@/lib/hub-card-order.functions";
import {
  getPublicMarketStatsReports,
  saveMarketStatsReport,
  deleteMarketStatsReport,
  type MarketStatsReport,
  type MarketSocialGraphic,
} from "@/lib/market-stats.functions";

export const Route = createFileRoute("/_authenticated/toolbox")({


  component: ToolboxPage,
  head: () => ({ meta: [{ title: "Agent Toolbox Manager — MSREG Hub" }] }),
});

const sb = supabase as any;
const BUCKET = "toolbox";

type Listing = {
  id: string;
  address: string;
  agent_name: string | null;
  status: string;
  description: string | null;
  created_at: string;
  archived?: boolean;
};
type Asset = {
  id: string;
  listing_id: string;
  asset_type: string;
  file_url: string | null;
  drive_url: string | null;
  thumbnail_url: string | null;
  name: string | null;
  created_at: string;
};
type Caption = { id: string; listing_id: string; caption_text: string; created_at: string };
type BrandAsset = {
  id: string;
  name: string;
  category: string;
  file_url: string;
  file_size: number | null;
  created_at: string;
};
type EduItem = {
  id: string;
  title: string;
  category: string;
  file_url: string | null;
  drive_url: string | null;
  caption: string | null;
  file_size: number | null;
  created_at: string;
};

const STATUS_OPTS = ["active", "coming_soon", "sold"] as const;
const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  coming_soon: "Coming Soon",
  sold: "Sold",
};
const STATUS_CLASS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  coming_soon: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  sold: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const BRAND_CATS = ["Logos", "Headshots", "Email Signatures", "Business Card Files", "Templates"];
const EDU_CATS = ["Seller Education", "Buyer Education", "Market Education", "Marketing Update", "Seasonal", "Other"];
const PREMADE_GRAPHIC_TYPES = ["Just Listed", "Open House", "Price Drop", "Just Sold"];
const BRANDED_TYPES = [
  "Testimonial",
  "Listing Presentation",
  "Buyer Presentation",
  "Headshot",
  "Education",
  "Social Post",
  "Other",
];

function bytesLabel(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function uploadFile(path: string, file: File) {
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, cacheControl: "3600" });
  if (error) throw error;
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
  return { path, url: data?.signedUrl as string };
}

function PublicLinkBanner({ path, label }: { path: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const url = publicUrl(path);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gold/20 bg-gold/5 px-4 py-3">
      <ExternalLink className="h-4 w-4 text-gold shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Public {label}</p>
        <p className="text-xs text-muted-foreground truncate">{url}</p>
      </div>
      <QrCode url={url} size={56} />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-gold hover:underline shrink-0"
      >
        Open
      </a>
      <button
        type="button"
        onClick={onCopy}
        className="flex items-center gap-1 text-xs font-medium text-gold hover:underline shrink-0"
      >
        <Copy className="h-3 w-3" />
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

function ToolboxPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("listings");
  const [openListingId, setOpenListingId] = useState<string | null>(null);
  const [openOpenHouseId, setOpenOpenHouseId] = useState<string | null>(null);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agent Toolbox Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload and organize the assets agents will pull from.
          </p>
        </div>
        <StorageIndicator />
      </div>
      <PublicLinkBanner path="/agent-toolbox" label="Agent Toolbox" />

      <Tabs value={tab} onValueChange={setTab} className="w-full mt-2">
        <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none p-0 h-auto gap-6 mb-6 overflow-x-auto max-w-full no-scrollbar flex whitespace-nowrap">
          {[
            { value: "listings", label: "Listings" },
            { value: "open_houses", label: "Open Houses" },
            { value: "market_stats", label: "MLS Market Stats" },
            { value: "brand", label: "Logos & Branding" },
            { value: "edu", label: "Educational Content" },
            { value: "branded", label: "Agent Branded" },
            { value: "hub_cards", label: "Agent Hub Cards" },
          ].map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="rounded-none border-b-2 border-transparent px-1 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-gold data-[state=active]:text-foreground data-[state=active]:shadow-none bg-transparent data-[state=active]:bg-transparent transition-colors"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="listings">
          <ListingsTab onOpen={setOpenListingId} userId={user?.id ?? null} />
        </TabsContent>
        <TabsContent value="open_houses" className="mt-6">
          <OpenHousesTab onOpen={setOpenOpenHouseId} userId={user?.id ?? null} />
        </TabsContent>
        <TabsContent value="market_stats" className="mt-6">
          <MarketStatsTab userId={user?.id ?? null} />
        </TabsContent>
        <TabsContent value="brand" className="mt-6">
          <BrandTab userId={user?.id ?? null} />
        </TabsContent>
        <TabsContent value="edu" className="mt-6">
          <EduTab userId={user?.id ?? null} />
        </TabsContent>
        <TabsContent value="branded" className="mt-6">
          <BrandedTab userId={user?.id ?? null} />
        </TabsContent>
        <TabsContent value="hub_cards" className="mt-6">
          <HubCardsOrderTab />
        </TabsContent>
      </Tabs>

      <ListingSheet
        listingId={openListingId}
        onClose={() => setOpenListingId(null)}
        userId={user?.id ?? null}
      />
      <OpenHouseSheet
        openHouseId={openOpenHouseId}
        onClose={() => setOpenOpenHouseId(null)}
        userId={user?.id ?? null}
      />
    </div>
  );
}

/* ---------------- Storage indicator ---------------- */

function StorageIndicator() {
  const { data } = useQuery({
    queryKey: ["toolbox-storage"],
    queryFn: async () => {
      const [b, e] = await Promise.all([
        sb.from("toolbox_brand_assets").select("file_size"),
        sb.from("toolbox_educational").select("file_size"),
      ]);
      const sum = (rows: any[] | null) =>
        (rows ?? []).reduce((a, r) => a + (Number(r.file_size) || 0), 0);
      return sum(b.data) + sum(e.data);
    },
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  const used = data ?? 0;
  const cap = 1024 * 1024 * 1024 * 2; // soft 2GB indicator
  const pct = Math.min(100, (used / cap) * 100);
  return (
    <div className="min-w-[220px] rounded-md border border-border bg-card/50 p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Storage used</span>
        <span className="text-gold">{bytesLabel(used)}</span>
      </div>
      <Progress value={pct} className="h-1.5 mt-2" />
      <div className="text-[10px] text-muted-foreground mt-1">of {bytesLabel(cap)} soft cap</div>
    </div>
  );
}

/* ---------------- Listings tab ---------------- */

function ListingsTab({ onOpen, userId }: { onOpen: (id: string) => void; userId: string | null }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"active" | "archived">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({
    address: "",
    agent_name: "",
    status: "active",
    description: "",
  });

  const { data: allListings = [], isLoading } = useQuery<Listing[]>({
    queryKey: ["toolbox-listings"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("toolbox_listings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Listing[];
    },
  });

  const listings = allListings
    .filter((l) => (view === "archived" ? l.archived : !l.archived))
    .filter((l) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (l.address ?? "").toLowerCase().includes(q) ||
        (l.agent_name ?? "").toLowerCase().includes(q) ||
        (l.description ?? "").toLowerCase().includes(q)
      );
    });
  const activeCount = allListings.filter((l) => !l.archived).length;
  const archivedCount = allListings.filter((l) => l.archived).length;

  const { data: counts = {} } = useQuery<Record<string, { assets: number; thumb: string | null }>>({
    queryKey: ["toolbox-listing-counts", allListings.map((l) => l.id).join(",")],
    enabled: allListings.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const ids = allListings.map((l) => l.id);
      const out: Record<string, { assets: number; thumb: string | null }> = {};
      for (const l of allListings) out[l.id] = { assets: 0, thumb: null };
      if (ids.length === 0) return out;
      const { data } = await sb
        .from("toolbox_assets")
        .select("listing_id,thumbnail_url,file_url,drive_url,asset_type")
        .in("listing_id", ids);
      for (const a of (data ?? []) as any[]) {
        if (!out[a.listing_id]) continue;
        out[a.listing_id].assets++;
        const candidate = a.thumbnail_url || a.file_url || a.drive_url;
        if (!out[a.listing_id].thumb && candidate) {
          out[a.listing_id].thumb = getGoogleDrivePreviewUrl(candidate) || candidate;
        }
      }
      return out;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.address.trim()) throw new Error("Address required");
      const { data, error } = await sb
        .from("toolbox_listings")
        .insert({
          address: form.address.trim(),
          agent_name: form.agent_name.trim() || null,
          status: form.status,
          description: form.description.trim() || null,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Listing created");
      setCreating(false);
      setForm({ address: "", agent_name: "", status: "active", description: "" });
      qc.invalidateQueries({ queryKey: ["toolbox-listings"] });
      onOpen(id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("toolbox_listings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listing deleted");
      qc.invalidateQueries({ queryKey: ["toolbox-listings"] });
    },
  });

  const archive = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await sb.from("toolbox_listings").update({ archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.archived ? "Listing archived" : "Listing restored");
      qc.invalidateQueries({ queryKey: ["toolbox-listings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-[280px]">
          <div className="inline-flex rounded-md border border-border overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setView("active")}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
                view === "active"
                  ? "bg-gold text-navy font-medium"
                  : "bg-transparent text-foreground hover:bg-accent/40",
              )}
            >
              Active <span className="ml-1 text-xs opacity-70">({activeCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setView("archived")}
              className={cn(
                "px-3 py-1.5 text-sm border-l border-border transition-colors",
                view === "archived"
                  ? "bg-gold text-navy font-medium"
                  : "bg-transparent text-foreground hover:bg-accent/40",
              )}
            >
              Archived <span className="ml-1 text-xs opacity-70">({archivedCount})</span>
            </button>
          </div>
          <div className="relative flex-1 max-w-sm min-w-[200px]">
            <Input
              type="search"
              placeholder="Search listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-3 pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="bg-gold text-navy hover:bg-gold/90 shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" /> New Listing
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : listings.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground border-dashed">
          {view === "archived"
            ? "No archived listings. Archive a listing to preserve it without deleting."
            : "No listings yet. Create one to start uploading assets."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {listings.map((l) => {
            const c = counts[l.id] ?? { assets: 0, thumb: null };
            const isArchived = !!l.archived;
            return (
              <div
                key={l.id}
                className={cn(
                  "group relative overflow-hidden rounded-xl border border-border/60 bg-card hover:bg-accent/30 hover:border-gold/50 cursor-pointer transition-all duration-300 shadow-sm",
                  isArchived && "opacity-80",
                )}
                onClick={() => onOpen(l.id)}
              >
                <div className="aspect-[4/3] bg-muted/50 relative overflow-hidden">
                  {c.thumb ? (
                    <img
                      src={c.thumb}
                      alt={l.address}
                      className={cn("w-full h-full object-cover transition-transform duration-500 group-hover:scale-105", isArchived && "grayscale")}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                      <Home className="h-10 w-10" />
                    </div>
                  )}
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <div className="absolute top-3 left-3">
                    <Badge className={cn("border border-background/20 font-medium tracking-wide shadow-sm backdrop-blur-sm bg-background/80", STATUS_CLASS[l.status])}>
                      {STATUS_LABEL[l.status] ?? l.status}
                    </Badge>
                  </div>
                  
                  {isArchived && (
                    <Badge className="absolute top-3 right-3 border border-gold/40 bg-navy/90 text-gold shadow-sm backdrop-blur-sm">
                      Archived
                    </Badge>
                  )}
                  
                  <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md rounded-md px-2 py-1 text-[10px] font-medium text-white flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-sm border border-white/10">
                    <ImageIcon className="h-3 w-3" />
                    {c.assets}
                  </div>
                </div>
                
                <div className="p-4 space-y-1.5">
                  <h3 className="font-serif font-medium text-lg leading-tight truncate text-foreground group-hover:text-gold transition-colors">
                    {l.address}
                  </h3>
                  <div className="text-xs text-muted-foreground flex items-center justify-between">
                    <span className="truncate">{l.agent_name || "—"}</span>
                    <span className="shrink-0 tabular-nums opacity-60">
                      {new Date(l.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isArchived ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-gold/50 text-gold hover:bg-gold/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          archive.mutate({ id: l.id, archived: false });
                        }}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Restore
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          archive.mutate({ id: l.id, archived: true });
                        }}
                        title="Archive (e.g. under contract)"
                      >
                        <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            "Delete this listing and all its assets? This cannot be undone — consider Archive instead.",
                          )
                        )
                          del.mutate(l.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Listing</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Property Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 Main St, City"
              />
            </div>
            <div>
              <Label>Agent Name</Label>
              <Input
                value={form.agent_name}
                onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
                placeholder="Agent name"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="bg-gold text-navy hover:bg-gold/90"
            >
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Listing detail sheet ---------------- */

function ListingSheet({
  listingId,
  onClose,
  userId,
}: {
  listingId: string | null;
  onClose: () => void;
  userId: string | null;
}) {
  const qc = useQueryClient();
  const open = !!listingId;

  const { data: listing } = useQuery<Listing | null>({
    queryKey: ["toolbox-listing", listingId],
    enabled: open,
    queryFn: async () => {
      const { data } = await sb
        .from("toolbox_listings")
        .select("*")
        .eq("id", listingId)
        .maybeSingle();
      return data as Listing | null;
    },
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["toolbox-assets", listingId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await sb
        .from("toolbox_assets")
        .select("*")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Asset[];
    },
  });

  const { data: captions = [] } = useQuery<Caption[]>({
    queryKey: ["toolbox-captions", listingId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await sb
        .from("toolbox_captions")
        .select("*")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Caption[];
    },
  });

  const invAll = () => {
    qc.invalidateQueries({ queryKey: ["toolbox-assets", listingId] });
    qc.invalidateQueries({ queryKey: ["toolbox-captions", listingId] });
    qc.invalidateQueries({ queryKey: ["toolbox-listing-counts"] });
  };

  const photos = assets.filter((a) => a.asset_type === "photo");
  const videos = assets.filter((a) => a.asset_type === "video");
  const graphics = assets.filter((a) => a.asset_type === "graphic");

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="truncate">{listing?.address ?? "Listing"}</SheetTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {listing?.agent_name && <span>{listing.agent_name}</span>}
            {listing && (
              <Badge className={cn("border", STATUS_CLASS[listing.status])}>
                {STATUS_LABEL[listing.status]}
              </Badge>
            )}
            {listing && photos.length > 0 && (
              <div className="ml-auto">
                <DownloadPhotosButton photos={photos} address={listing.address} />
              </div>
            )}
          </div>
        </SheetHeader>

        {listing && (
          <div className="mt-6 space-y-8">
            <AssetSection
              title="Photos"
              icon={<ImageIcon className="h-4 w-4" />}
              listingId={listing.id}
              userId={userId}
              assets={photos}
              kind="photo"
              accept="image/*"
              onChange={invAll}
            />

            <VideoSection
              listingId={listing.id}
              userId={userId}
              assets={videos}
              onChange={invAll}
            />

            <GraphicSection
              listingId={listing.id}
              userId={userId}
              assets={graphics}
              onChange={invAll}
            />

            <CaptionsSection
              listingId={listing.id}
              userId={userId}
              captions={captions}
              onChange={invAll}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- Asset sections ---------------- */

function AssetTile({ asset, onDelete }: { asset: Asset; onDelete: () => void }) {
  const thumb = getGoogleDrivePreviewUrl(asset.thumbnail_url || asset.file_url || asset.drive_url);
  return (
    <div className="relative group rounded-md overflow-hidden border border-border bg-muted aspect-square">
      {thumb ? (
        <img src={thumb} alt={asset.name ?? ""} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <FileText className="h-6 w-6" />
        </div>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600/80 rounded p-1 opacity-0 group-hover:opacity-100 transition"
      >
        <Trash2 className="h-3 w-3 text-white" />
      </button>
    </div>
  );
}

function AssetSection({
  title,
  icon,
  listingId,
  userId,
  assets,
  kind,
  accept,
  onChange,
}: {
  title: string;
  icon: React.ReactNode;
  listingId: string;
  userId: string | null;
  assets: Asset[];
  kind: "photo" | "graphic";
  accept: string;
  onChange: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [graphicType, setGraphicType] = useState<string>(PREMADE_GRAPHIC_TYPES[0]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (!arr.length) return;
      setUploading(arr.length);
      let done = 0;
      for (const f of arr) {
        try {
          const path = makeStorageKey(`listings/${listingId}/${kind}`, f.name);
          const { url } = await uploadFile(path, f);
          await sb.from("toolbox_assets").insert({
            listing_id: listingId,
            asset_type: kind,
            file_url: url,
            thumbnail_url: url,
            name: kind === "graphic" ? graphicType : f.name,
            created_by: userId,
          });
        } catch (e: any) {
          toast.error(`Failed: ${f.name}: ${e.message}`);
        }
        done++;
        setUploading(arr.length - done);
      }
      setUploading(0);
      onChange();
      toast.success(`Uploaded ${arr.length} file${arr.length === 1 ? "" : "s"}`);
    },
    [listingId, kind, userId, graphicType, onChange],
  );

  const remove = async (a: Asset) => {
    if (!confirm("Delete this asset?")) return;
    await sb.from("toolbox_assets").delete().eq("id", a.id);
    onChange();
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-gold">
          {icon} {title}
        </h3>
        {kind === "graphic" && (
          <Select value={graphicType} onValueChange={setGraphicType}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PREMADE_GRAPHIC_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-md p-4 text-center cursor-pointer text-sm transition-colors",
          dragOver
            ? "border-gold bg-gold/5"
            : "border-border hover:border-gold/50 text-muted-foreground",
        )}
      >
        {uploading > 0 ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading {uploading} remaining…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Upload className="h-4 w-4" /> Drag &amp; drop or click to upload
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {assets.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
          {assets.map((a) => (
            <div key={a.id} className="space-y-1">
              <AssetTile asset={a} onDelete={() => remove(a)} />
              {kind === "graphic" && (
                <div className="text-[10px] text-muted-foreground truncate">{a.name}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function VideoSection({
  listingId,
  userId,
  assets,
  onChange,
}: {
  listingId: string;
  userId: string | null;
  assets: Asset[];
  onChange: () => void;
}) {
  const [url, setUrl] = useState("");
  const add = async () => {
    if (!url.trim()) return;
    await sb.from("toolbox_assets").insert({
      listing_id: listingId,
      asset_type: "video",
      drive_url: url.trim(),
      name: "Video",
      created_by: userId,
    });
    setUrl("");
    onChange();
    toast.success("Video link added");
  };
  const remove = async (a: Asset) => {
    if (!confirm("Remove this video link?")) return;
    await sb.from("toolbox_assets").delete().eq("id", a.id);
    onChange();
  };
  return (
    <section>
      <h3 className="text-sm font-semibold flex items-center gap-2 text-gold mb-2">
        <VideoIcon className="h-4 w-4" /> Videos (Google Drive)
      </h3>
      <div className="flex gap-2">
        <Input
          placeholder="Paste Google Drive URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button onClick={add} variant="secondary">
          <LinkIcon className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
      <div className="space-y-1 mt-3">
        {assets.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-2 rounded border border-border bg-card/50 px-3 py-2"
          >
            <a
              href={a.drive_url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-gold hover:underline truncate flex items-center gap-2"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />{" "}
              <span className="truncate">{a.drive_url}</span>
            </a>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(a)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function GraphicSection(props: {
  listingId: string;
  userId: string | null;
  assets: Asset[];
  onChange: () => void;
}) {
  return (
    <AssetSection
      title="Pre-made Graphics"
      icon={<ImageIcon className="h-4 w-4" />}
      listingId={props.listingId}
      userId={props.userId}
      assets={props.assets}
      kind="graphic"
      accept="image/*"
      onChange={props.onChange}
    />
  );
}

function CaptionsSection({
  listingId,
  userId,
  captions,
  onChange,
}: {
  listingId: string;
  userId: string | null;
  captions: Caption[];
  onChange: () => void;
}) {
  const [text, setText] = useState("");
  const add = async () => {
    if (!text.trim()) return;
    await sb
      .from("toolbox_captions")
      .insert({ listing_id: listingId, caption_text: text.trim(), created_by: userId });
    setText("");
    onChange();
  };
  const remove = async (id: string) => {
    await sb.from("toolbox_captions").delete().eq("id", id);
    onChange();
  };
  const copy = async (t: string) => {
    await navigator.clipboard.writeText(t);
    toast.success("Caption copied");
  };
  return (
    <section>
      <h3 className="text-sm font-semibold flex items-center gap-2 text-gold mb-2">
        <FileText className="h-4 w-4" /> Ready-to-use Captions
      </h3>
      <div className="space-y-2">
        {captions.map((c) => (
          <div key={c.id} className="rounded border border-border bg-card/50 p-3 group">
            <div className="text-sm whitespace-pre-wrap">{c.caption_text}</div>
            <div className="flex justify-end gap-1 mt-2">
              <Button size="sm" variant="ghost" onClick={() => copy(c.caption_text)}>
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        <Textarea
          rows={3}
          placeholder="Write a caption agents can copy…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button onClick={add} className="bg-gold text-navy hover:bg-gold/90">
          <Plus className="h-4 w-4 mr-1" />
          Add caption
        </Button>
      </div>
    </section>
  );
}

/* ---------------- Brand tab ---------------- */

function BrandTab({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState(BRAND_CATS[0]);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: items = [] } = useQuery<BrandAsset[]>({
    queryKey: ["toolbox-brand"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("toolbox_brand_assets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BrandAsset[];
    },
  });

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const path = makeStorageKey(`brand/${category}`, f.name);
        const { url } = await uploadFile(path, f);
        await sb.from("toolbox_brand_assets").insert({
          name: name.trim() || f.name,
          category,
          file_url: url,
          file_size: f.size,
          created_by: userId,
        });
      }
      setName("");
      toast.success("Uploaded");
      qc.invalidateQueries({ queryKey: ["toolbox-brand"] });
      qc.invalidateQueries({ queryKey: ["toolbox-storage"] });
    } catch (e: any) {
      toast.error(e.message);
    }
    setUploading(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this asset?")) return;
    await sb.from("toolbox_brand_assets").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["toolbox-brand"] });
    qc.invalidateQueries({ queryKey: ["toolbox-storage"] });
  };

  const grouped = useMemo(() => {
    const g: Record<string, BrandAsset[]> = {};
    for (const c of BRAND_CATS) g[c] = [];
    for (const i of items) {
      if (!g[i.category]) g[i.category] = [];
      g[i.category].push(i);
    }
    return g;
  }, [items]);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAND_CATS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Name (optional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Falls back to file name"
            />
          </div>
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="bg-gold text-navy hover:bg-gold/90"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </>
            )}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => upload(e.target.files)}
          />
        </div>
      </Card>

      {BRAND_CATS.map((c) => (
        <section key={c}>
          <h3 className="text-sm font-semibold text-gold mb-2">
            {c} <span className="text-muted-foreground font-normal">· {grouped[c].length}</span>
          </h3>
          {grouped[c].length === 0 ? (
            <div className="text-xs text-muted-foreground">No items yet.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {grouped[c].map((i) => (
                <Card key={i.id} className="overflow-hidden group">
                  <div className="aspect-square bg-muted relative">
                    {/\.(png|jpe?g|gif|webp|svg)$/i.test(i.file_url) ? (
                      <img
                        src={i.file_url}
                        alt={i.name}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <FileText className="h-8 w-8" />
                      </div>
                    )}
                    <button
                      onClick={() => remove(i.id)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600/80 rounded p-1 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3 text-white" />
                    </button>
                  </div>
                  <div className="p-2">
                    <div className="text-xs font-medium truncate">{i.name}</div>
                    <a
                      href={i.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-gold hover:underline"
                    >
                      Open
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

/* ---------------- Educational tab ---------------- */

function EduTab({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    category: EDU_CATS[0],
    caption: "",
    drive_url: "",
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: items = [] } = useQuery<EduItem[]>({
    queryKey: ["toolbox-edu"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("toolbox_educational")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EduItem[];
    },
  });

  const submitFile = async (files: FileList | null) => {
    if (!form.title.trim()) {
      toast.error("Title required");
      return;
    }
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const f = files[0];
      const path = makeStorageKey(`educational/${form.category}`, f.name);
      const { url } = await uploadFile(path, f);
      await sb.from("toolbox_educational").insert({
        title: form.title.trim(),
        category: form.category,
        file_url: url,
        caption: form.caption.trim() || null,
        file_size: f.size,
        created_by: userId,
      });
      setForm({ title: "", category: form.category, caption: "", drive_url: "" });
      toast.success("Added");
      qc.invalidateQueries({ queryKey: ["toolbox-edu"] });
      qc.invalidateQueries({ queryKey: ["toolbox-storage"] });
    } catch (e: any) {
      toast.error(e.message);
    }
    setUploading(false);
  };

  const submitLink = async () => {
    if (!form.title.trim() || !form.drive_url.trim()) {
      toast.error("Title and Drive URL required");
      return;
    }
    await sb.from("toolbox_educational").insert({
      title: form.title.trim(),
      category: form.category,
      drive_url: form.drive_url.trim(),
      caption: form.caption.trim() || null,
      created_by: userId,
    });
    setForm({ title: "", category: form.category, caption: "", drive_url: "" });
    toast.success("Added");
    qc.invalidateQueries({ queryKey: ["toolbox-edu"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await sb.from("toolbox_educational").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["toolbox-edu"] });
    qc.invalidateQueries({ queryKey: ["toolbox-storage"] });
  };

  const updateCategory = async (id: string, category: string) => {
    try {
      const { error } = await sb.from("toolbox_educational").update({ category }).eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["toolbox-edu"] });
      toast.success(`Category updated to ${category}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to update category");
    }
  };

  const copy = async (t: string) => {
    await navigator.clipboard.writeText(t);
    toast.success("Caption copied");
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDU_CATS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Optional caption</Label>
          <Textarea
            rows={2}
            value={form.caption}
            onChange={(e) => setForm({ ...form, caption: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="bg-gold text-navy hover:bg-gold/90"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" />
                Upload file
              </>
            )}
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => submitFile(e.target.files)}
          />
          <div className="flex-1 min-w-[200px] flex gap-2">
            <Input
              placeholder="…or paste Drive URL"
              value={form.drive_url}
              onChange={(e) => setForm({ ...form, drive_url: e.target.value })}
            />
            <Button variant="secondary" onClick={submitLink}>
              <LinkIcon className="h-4 w-4 mr-1" />
              Add link
            </Button>
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground border-dashed">
          No educational content yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((i) => (
            <Card key={i.id} className="overflow-hidden group">
              <div className="aspect-video bg-muted relative">
                {i.file_url && /\.(png|jpe?g|gif|webp|svg)$/i.test(i.file_url) ? (
                  <img src={i.file_url} alt={i.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    {i.drive_url ? (
                      <VideoIcon className="h-8 w-8" />
                    ) : (
                      <FileText className="h-8 w-8" />
                    )}
                  </div>
                )}
                <button
                  onClick={() => remove(i.id)}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600/80 rounded p-1 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3 text-white" />
                </button>
                <Badge className="absolute top-2 left-2 bg-navy/80 border border-gold/30 text-gold">
                  {i.category}
                </Badge>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm leading-snug">{i.title}</div>
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-muted-foreground shrink-0 font-medium">Category:</span>
                  <Select value={i.category} onValueChange={(val) => updateCategory(i.id, val)}>
                    <SelectTrigger className="h-6 text-[11px] py-0 px-2 w-auto min-w-[130px] bg-muted/40 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EDU_CATS.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {i.caption && (
                  <div className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {i.caption}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  {i.file_url && (
                    <a
                      href={i.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-gold hover:underline"
                    >
                      File
                    </a>
                  )}
                  {i.drive_url && (
                    <a
                      href={i.drive_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-gold hover:underline"
                    >
                      Drive
                    </a>
                  )}
                  {i.caption && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-7"
                      onClick={() => copy(i.caption!)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Open Houses (mirrors Listings)
 * ============================================================ */

type OpenHouse = {
  id: string;
  address: string;
  agent_name: string | null;
  status: string;
  open_house_at: string | null;
  description: string | null;
  created_at: string;
  archived?: boolean;
};
type OHAsset = {
  id: string;
  open_house_id: string;
  asset_type: string;
  file_url: string | null;
  drive_url: string | null;
  thumbnail_url: string | null;
  name: string | null;
  category?: string | null;
  created_at: string;
};
type OHCaption = {
  id: string;
  open_house_id: string;
  caption_text: string;
  category?: string | null;
  created_at: string;
};

const OH_STATUS_OPTS = ["upcoming", "past"] as const;
const OH_STATUS_LABEL: Record<string, string> = { upcoming: "Upcoming", past: "Past" };
const OH_STATUS_CLASS: Record<string, string> = {
  upcoming: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  past: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};
const OH_CATEGORIES = [
  "Agent QR Code",
  "Branded Photos and Copy",
  "Coloring Page",
  "Flyer",
  "Other",
] as const;
type OHCategory = (typeof OH_CATEGORIES)[number];
const OH_UPLOAD_ACCEPT = "image/*,application/pdf,.doc,.docx,.txt,.rtf";

function fmtDateTime(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
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

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function OpenHousesTab({
  onOpen,
  userId,
}: {
  onOpen: (id: string) => void;
  userId: string | null;
}) {
  const qc = useQueryClient();
  const cloneAssets = useServerFn(cloneListingAssetsToOpenHouse);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"active" | "archived">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListingId, setSelectedListingId] = useState<string>("none");
  const [form, setForm] = useState({
    address: "",
    agent_name: "",
    status: "upcoming",
    open_house_at: "",
    description: "",
  });

  const { data: allOpenHouses = [], isLoading } = useQuery<OpenHouse[]>({
    queryKey: ["toolbox-open-houses"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("toolbox_open_houses")
        .select("*")
        .order("open_house_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as OpenHouse[];
    },
  });

  // Active listings to select from
  const { data: activeListings = [] } = useQuery<{ id: string; address: string; agent_name: string | null; description: string | null }[]>({
    queryKey: ["active-listings-for-oh"],
    enabled: creating,
    queryFn: async () => {
      const { data } = await sb
        .from("toolbox_listings")
        .select("id, address, agent_name, description")
        .eq("archived", false)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const handleListingSelect = (listingId: string) => {
    setSelectedListingId(listingId);
    if (listingId === "none") return;
    const l = activeListings.find((x) => x.id === listingId);
    if (l) {
      setForm((prev) => ({
        ...prev,
        address: l.address || prev.address,
        agent_name: l.agent_name || prev.agent_name,
        description: l.description || prev.description,
      }));
    }
  };

  const items = allOpenHouses
    .filter((l) => (view === "archived" ? l.archived : !l.archived))
    .filter((l) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (l.address ?? "").toLowerCase().includes(q) ||
        (l.agent_name ?? "").toLowerCase().includes(q) ||
        (l.description ?? "").toLowerCase().includes(q)
      );
    });
  const activeCount = allOpenHouses.filter((l) => !l.archived).length;
  const archivedCount = allOpenHouses.filter((l) => l.archived).length;

  const { data: counts = {} } = useQuery<Record<string, { assets: number; thumb: string | null }>>({
    queryKey: ["toolbox-oh-counts", allOpenHouses.map((l) => l.id).join(",")],
    enabled: allOpenHouses.length > 0,
    queryFn: async () => {
      const { data } = await sb
        .from("toolbox_open_house_assets")
        .select("open_house_id,thumbnail_url,file_url,asset_type,category");
      const isImg = (u: string | null | undefined) =>
        !!u && /\.(png|jpe?g|gif|webp|svg|avif|heic)(\?|#|$)/i.test(String(u).split("?")[0]);
      const out: Record<string, { assets: number; thumb: string | null }> = {};
      for (const l of allOpenHouses) out[l.id] = { assets: 0, thumb: null };
      for (const a of (data ?? []) as any[]) {
        if (!out[a.open_house_id]) continue;
        out[a.open_house_id].assets++;
      }
      // Prefer images in "Branded Photos and Copy"
      for (const a of (data ?? []) as any[]) {
        if (!out[a.open_house_id]) continue;
        if (out[a.open_house_id].thumb) continue;
        if (a.category !== "Branded Photos and Copy") continue;
        const c = a.thumbnail_url || a.file_url;
        if (isImg(c)) out[a.open_house_id].thumb = c;
      }
      // Fallback: any image
      for (const a of (data ?? []) as any[]) {
        if (!out[a.open_house_id]) continue;
        if (out[a.open_house_id].thumb) continue;
        const c = a.thumbnail_url || a.file_url;
        if (isImg(c)) out[a.open_house_id].thumb = c;
      }
      return out;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.address.trim()) throw new Error("Address required");
      const { data, error } = await sb
        .from("toolbox_open_houses")
        .insert({
          address: form.address.trim(),
          agent_name: form.agent_name.trim() || null,
          listing_id: selectedListingId !== "none" ? selectedListingId : null,
          status: form.status,
          open_house_at: form.open_house_at ? new Date(form.open_house_at).toISOString() : null,
          description: form.description.trim() || null,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      const ohId = data.id as string;

      // Auto-clone listing assets if listing was selected
      if (selectedListingId && selectedListingId !== "none") {
        try {
          await cloneAssets({ data: { listingId: selectedListingId, openHouseId: ohId } });
        } catch (e) {
          console.error("Asset clone warning:", e);
        }
      }

      // Seed default checklist items
      const { data: templates } = await sb
        .from("open_house_checklist_templates")
        .select("*")
        .order("phase_order", { ascending: true })
        .order("task_order", { ascending: true });

      if (templates && templates.length > 0) {
        const items = templates.map((t: any) => ({
          open_house_id: ohId,
          phase: t.phase,
          phase_order: t.phase_order,
          task_text: t.task_text,
          task_order: t.task_order,
          completed: false,
        }));
        await sb.from("open_house_checklist_items").insert(items);
      }

      return ohId;
    },
    onSuccess: (id) => {
      toast.success("Open house created & marketing assets initialized");
      setCreating(false);
      setSelectedListingId("none");
      setForm({
        address: "",
        agent_name: "",
        status: "upcoming",
        open_house_at: "",
        description: "",
      });
      qc.invalidateQueries({ queryKey: ["toolbox-open-houses"] });
      onOpen(id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("toolbox_open_houses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Open house deleted");
      qc.invalidateQueries({ queryKey: ["toolbox-open-houses"] });
    },
  });

  const archive = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await sb.from("toolbox_open_houses").update({ archived }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.archived ? "Open house archived" : "Open house restored");
      qc.invalidateQueries({ queryKey: ["toolbox-open-houses"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-[280px]">
          <div className="inline-flex rounded-md border border-border overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setView("active")}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
                view === "active"
                  ? "bg-gold text-navy font-medium"
                  : "bg-transparent text-foreground hover:bg-accent/40",
              )}
            >
              Active <span className="ml-1 text-xs opacity-70">({activeCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setView("archived")}
              className={cn(
                "px-3 py-1.5 text-sm border-l border-border transition-colors",
                view === "archived"
                  ? "bg-gold text-navy font-medium"
                  : "bg-transparent text-foreground hover:bg-accent/40",
              )}
            >
              Archived <span className="ml-1 text-xs opacity-70">({archivedCount})</span>
            </button>
          </div>
          <div className="relative flex-1 max-w-sm min-w-[200px]">
            <Input
              type="search"
              placeholder="Search open houses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-3 pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-gold text-navy hover:bg-gold/90 shrink-0">
          <Plus className="h-4 w-4 mr-2" /> New Open House
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground border-dashed">
          {view === "archived"
            ? "No archived open houses. Archive an open house to preserve it without deleting."
            : "No open houses yet. Create one to start uploading assets."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((l) => {
            const c = counts[l.id] ?? { assets: 0, thumb: null };
            const isArchived = !!l.archived;
            return (
              <Card
                key={l.id}
                className={cn(
                  "overflow-hidden cursor-pointer hover:border-gold/50 transition-colors group",
                  isArchived && "opacity-80",
                )}
                onClick={() => onOpen(l.id)}
              >
                <div className="aspect-video bg-muted relative">
                  {c.thumb ? (
                    <img
                      src={c.thumb}
                      alt={l.address}
                      className={cn("w-full h-full object-cover", isArchived && "grayscale")}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Home className="h-8 w-8" />
                    </div>
                  )}
                  <Badge className={cn("absolute top-2 left-2 border", OH_STATUS_CLASS[l.status])}>
                    {OH_STATUS_LABEL[l.status] ?? l.status}
                  </Badge>
                  {isArchived && (
                    <Badge className="absolute top-2 right-2 border border-gold/40 bg-navy/90 text-gold shadow-sm backdrop-blur-sm">
                      Archived
                    </Badge>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <div className="font-medium truncate">{l.address}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {l.agent_name || "—"}
                  </div>
                  {l.open_house_at && (
                    <div className="text-xs text-gold/90">{fmtDateTime(l.open_house_at)}</div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gold">
                      {c.assets} asset{c.assets === 1 ? "" : "s"}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isArchived ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-gold/50 text-gold hover:bg-gold/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            archive.mutate({ id: l.id, archived: false });
                          }}
                        >
                          <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Restore
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            archive.mutate({ id: l.id, archived: true });
                          }}
                          title="Archive open house"
                        >
                          <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this open house and all its assets?")) del.mutate(l.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Open House</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1 bg-muted/40 p-2.5 rounded-lg border border-border">
              <Label className="text-xs font-semibold text-foreground">Select from Existing Listing (Auto-Attaches Materials)</Label>
              <Select value={selectedListingId} onValueChange={handleListingSelect}>
                <SelectTrigger className="text-xs bg-card">
                  <SelectValue placeholder="Choose a listing..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Enter Manually --</SelectItem>
                  {activeListings.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.address} {l.agent_name ? `(${l.agent_name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Property Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 Main St, City"
              />
            </div>
            <div>
              <Label>Hosting Agent</Label>
              <Input
                value={form.agent_name}
                onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
                placeholder="Agent name"
              />
            </div>
            <div>
              <Label>Open House Date &amp; Time</Label>
              <Input
                type="datetime-local"
                value={form.open_house_at}
                onChange={(e) => setForm({ ...form, open_house_at: e.target.value })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OH_STATUS_OPTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {OH_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="bg-gold text-navy hover:bg-gold/90"
            >
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OpenHouseSheet({
  openHouseId,
  onClose,
  userId,
}: {
  openHouseId: string | null;
  onClose: () => void;
  userId: string | null;
}) {
  const qc = useQueryClient();
  const open = !!openHouseId;
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({
    address: "",
    agent_name: "",
    status: "upcoming",
    open_house_at: "",
    description: "",
  });

  const { data: oh } = useQuery<OpenHouse | null>({
    queryKey: ["toolbox-open-house", openHouseId],
    enabled: open,
    queryFn: async () => {
      const { data } = await sb
        .from("toolbox_open_houses")
        .select("*")
        .eq("id", openHouseId)
        .maybeSingle();
      return data as OpenHouse | null;
    },
  });

  const { data: assets = [] } = useQuery<OHAsset[]>({
    queryKey: ["toolbox-oh-assets", openHouseId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await sb
        .from("toolbox_open_house_assets")
        .select("*")
        .eq("open_house_id", openHouseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OHAsset[];
    },
  });

  const { data: captions = [] } = useQuery<OHCaption[]>({
    queryKey: ["toolbox-oh-captions", openHouseId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await sb
        .from("toolbox_open_house_captions")
        .select("*")
        .eq("open_house_id", openHouseId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as OHCaption[];
    },
  });

  const invAll = () => {
    qc.invalidateQueries({ queryKey: ["toolbox-oh-assets", openHouseId] });
    qc.invalidateQueries({ queryKey: ["toolbox-oh-captions", openHouseId] });
    qc.invalidateQueries({ queryKey: ["toolbox-oh-counts"] });
  };

  const beginEdit = () => {
    if (!oh) return;
    setEdit({
      address: oh.address,
      agent_name: oh.agent_name ?? "",
      status: oh.status,
      open_house_at: toLocalInput(oh.open_house_at),
      description: oh.description ?? "",
    });
    setEditing(true);
  };

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!oh) throw new Error("Missing");
      const { error } = await sb
        .from("toolbox_open_houses")
        .update({
          address: edit.address.trim(),
          agent_name: edit.agent_name.trim() || null,
          status: edit.status,
          open_house_at: edit.open_house_at ? new Date(edit.open_house_at).toISOString() : null,
          description: edit.description.trim() || null,
        })
        .eq("id", oh.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["toolbox-open-house", openHouseId] });
      qc.invalidateQueries({ queryKey: ["toolbox-open-houses"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async (archived: boolean) => {
      if (!oh) return;
      const { error } = await sb.from("toolbox_open_houses").update({ archived }).eq("id", oh.id);
      if (error) throw error;
    },
    onSuccess: (_d, archived) => {
      toast.success(archived ? "Open house archived" : "Open house restored");
      qc.invalidateQueries({ queryKey: ["toolbox-open-house", openHouseId] });
      qc.invalidateQueries({ queryKey: ["toolbox-open-houses"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const ohPhotos = assets.filter((a) => {
    const u = a.file_url || a.thumbnail_url || "";
    if (!u) return false;
    const clean = u.split("?")[0].split("#")[0];
    return /\.(png|jpe?g|gif|webp|avif|heic|heif|tiff?|bmp)$/i.test(clean);
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="truncate">{oh?.address ?? "Open House"}</SheetTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {oh?.agent_name && <span>{oh.agent_name}</span>}
            {oh && (
              <Badge className={cn("border", OH_STATUS_CLASS[oh.status])}>
                {OH_STATUS_LABEL[oh.status]}
              </Badge>
            )}
            {oh?.archived && (
              <Badge className="border border-gold/40 bg-navy/90 text-gold shadow-sm">
                Archived
              </Badge>
            )}
            {oh?.open_house_at && (
              <span className="text-gold">{fmtDateTime(oh.open_house_at)}</span>
            )}
            {oh && (
              <div className="ml-auto flex items-center gap-2">
                {ohPhotos.length > 0 && (
                  <DownloadPhotosButton photos={ohPhotos} address={oh.address} />
                )}
                {oh.archived ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-gold/50 text-gold hover:bg-gold/10"
                    onClick={() => archive.mutate(false)}
                  >
                    <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Restore
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => archive.mutate(true)}
                  >
                    <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7" onClick={beginEdit}>
                  Edit details
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        {oh && (
          <div className="mt-6 space-y-8">
            {OH_CATEGORIES.map((cat) => (
              <OHCategorySection
                key={cat}
                category={cat}
                openHouseId={oh.id}
                userId={userId}
                assets={assets.filter((a) => (a.category ?? "Other") === cat)}
                captions={
                  cat === "Branded Photos and Copy"
                    ? captions.filter((c) => (c.category ?? "Branded Photos and Copy") === cat)
                    : []
                }
                onChange={invAll}
              />
            ))}
          </div>
        )}

        <Dialog open={editing} onOpenChange={setEditing}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Open House</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Property Address</Label>
                <Input
                  value={edit.address}
                  onChange={(e) => setEdit({ ...edit, address: e.target.value })}
                />
              </div>
              <div>
                <Label>Hosting Agent</Label>
                <Input
                  value={edit.agent_name}
                  onChange={(e) => setEdit({ ...edit, agent_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Open House Date &amp; Time</Label>
                <Input
                  type="datetime-local"
                  value={edit.open_house_at}
                  onChange={(e) => setEdit({ ...edit, open_house_at: e.target.value })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OH_STATUS_OPTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {OH_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => saveEdit.mutate()}
                disabled={saveEdit.isPending}
                className="bg-gold text-navy hover:bg-gold/90"
              >
                {saveEdit.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

function OHAssetTile({ asset, onDelete }: { asset: OHAsset; onDelete: () => void }) {
  const thumb = asset.thumbnail_url || asset.file_url;
  const isImg =
    !!thumb && /\.(png|jpe?g|gif|webp|svg|avif|heic)(\?|#|$)/i.test(String(thumb).split("?")[0]);
  return (
    <div className="relative group rounded-md overflow-hidden border border-border bg-muted aspect-square">
      {isImg ? (
        <img src={thumb!} alt={asset.name ?? ""} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1 p-1">
          <FileText className="h-6 w-6" />
          <span className="text-[9px] truncate w-full text-center">{asset.name ?? "File"}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600/80 rounded p-1 opacity-0 group-hover:opacity-100 transition"
      >
        <Trash2 className="h-3 w-3 text-white" />
      </button>
    </div>
  );
}

function OHCategorySection({
  category,
  openHouseId,
  userId,
  assets,
  captions,
  onChange,
}: {
  category: OHCategory;
  openHouseId: string;
  userId: string | null;
  assets: OHAsset[];
  captions: OHCaption[];
  onChange: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [captionText, setCaptionText] = useState("");

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (!arr.length) return;
      setUploading(arr.length);
      let done = 0;
      for (const f of arr) {
        try {
          const slug = category
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
          const path = makeStorageKey(`open-houses/${openHouseId}/${slug}`, f.name);
          const { url } = await uploadFile(path, f);
          await sb.from("toolbox_open_house_assets").insert({
            open_house_id: openHouseId,
            asset_type: "file",
            category,
            file_url: url,
            thumbnail_url: url,
            name: f.name,
            created_by: userId,
          });
        } catch (e: any) {
          toast.error(`Failed: ${f.name}: ${e.message}`);
        }
        done++;
        setUploading(arr.length - done);
      }
      setUploading(0);
      onChange();
      toast.success(`Uploaded ${arr.length} file${arr.length === 1 ? "" : "s"}`);
    },
    [openHouseId, category, userId, onChange],
  );

  const removeAsset = async (a: OHAsset) => {
    if (!confirm("Delete this asset?")) return;
    await sb.from("toolbox_open_house_assets").delete().eq("id", a.id);
    onChange();
  };

  const addCaption = async () => {
    if (!captionText.trim()) return;
    await sb.from("toolbox_open_house_captions").insert({
      open_house_id: openHouseId,
      caption_text: captionText.trim(),
      category,
      created_by: userId,
    });
    setCaptionText("");
    onChange();
  };
  const removeCaption = async (id: string) => {
    await sb.from("toolbox_open_house_captions").delete().eq("id", id);
    onChange();
  };
  const copy = async (t: string) => {
    await navigator.clipboard.writeText(t);
    toast.success("Caption copied");
  };

  const showCaptions = category === "Branded Photos and Copy";

  return (
    <section>
      <h3 className="text-sm font-semibold flex items-center gap-2 text-gold mb-2">
        <ImageIcon className="h-4 w-4" /> {category}
      </h3>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-md p-4 text-center cursor-pointer text-sm transition-colors",
          dragOver
            ? "border-gold bg-gold/5"
            : "border-border hover:border-gold/50 text-muted-foreground",
        )}
      >
        {uploading > 0 ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading {uploading} remaining…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Upload className="h-4 w-4" /> Drag &amp; drop or click — images, PDFs, docs
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={OH_UPLOAD_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>
      {assets.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
          {assets.map((a) => (
            <OHAssetTile key={a.id} asset={a} onDelete={() => removeAsset(a)} />
          ))}
        </div>
      )}

      {showCaptions && (
        <div className="mt-4 rounded-md border border-border bg-card/40 p-3 space-y-3">
          <h4 className="text-xs font-semibold text-gold flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Ready-to-use captions / copy
          </h4>
          {captions.length > 0 && (
            <div className="space-y-2">
              {captions.map((c) => (
                <div key={c.id} className="rounded border border-border bg-background p-2">
                  <div className="text-sm whitespace-pre-wrap">{c.caption_text}</div>
                  <div className="flex justify-end gap-1 mt-1">
                    <Button size="sm" variant="ghost" onClick={() => copy(c.caption_text)}>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeCaption(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Textarea
            rows={3}
            placeholder="Write copy agents can paste with photos…"
            value={captionText}
            onChange={(e) => setCaptionText(e.target.value)}
          />
          <Button size="sm" onClick={addCaption} className="bg-gold text-navy hover:bg-gold/90">
            <Plus className="h-4 w-4 mr-1" />
            Add caption
          </Button>
        </div>
      )}
    </section>
  );
}

/* ============================================================
 * Agent Branded Content
 * ============================================================ */

type BrandedAgent = {
  id: string;
  name: string;
  email: string | null;
  headshot_url: string | null;
  identifier: string | null;
  active: boolean;
  created_at: string;
};
type BrandedContent = {
  id: string;
  agent_id: string;
  content_type: string;
  title: string;
  file_url: string | null;
  drive_url: string | null;
  caption: string | null;
  file_size: number | null;
  created_at: string;
};

function BrandedTab({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [addingAgent, setAddingAgent] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedAgentId && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedAgentId]);

  const { data: agents = [] } = useQuery<BrandedAgent[]>({
    queryKey: ["toolbox-agents"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("toolbox_agents")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as BrandedAgent[];
    },
  });

  const { data: contentCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["toolbox-agent-content-counts"],
    queryFn: async () => {
      const { data } = await sb.from("toolbox_agent_content").select("agent_id");
      const out: Record<string, number> = {};
      for (const r of (data ?? []) as any[]) out[r.agent_id] = (out[r.agent_id] ?? 0) + 1;
      return out;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Agents</h2>
          <p className="text-xs text-muted-foreground">
            Manage the roster used for branded content.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBulkAdding(true)}>
            <Users className="h-4 w-4 mr-2" /> Bulk add agents
          </Button>
          <Button
            onClick={() => setAddingAgent(true)}
            className="bg-gold text-navy hover:bg-gold/90"
          >
            <Plus className="h-4 w-4 mr-2" /> Add agent
          </Button>
        </div>
      </div>

      {agents.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground border-dashed">
          No agents yet. Add one to start uploading branded content.
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {agents.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              count={contentCounts[a.id] ?? 0}
              selected={selectedAgentId === a.id}
              onSelect={() => setSelectedAgentId(a.id === selectedAgentId ? null : a.id)}
              onChanged={() => {
                qc.invalidateQueries({ queryKey: ["toolbox-agents"] });
                qc.invalidateQueries({ queryKey: ["toolbox-agent-content-counts"] });
              }}
            />
          ))}
        </div>
      )}

      {selectedAgentId && (
        <div ref={panelRef} className="scroll-mt-4">
          <AgentBrandedContentPanel
            agent={agents.find((a) => a.id === selectedAgentId)!}
            userId={userId}
            onChanged={() => qc.invalidateQueries({ queryKey: ["toolbox-agent-content-counts"] })}
          />
        </div>
      )}

      <AddAgentDialog
        open={addingAgent}
        onOpenChange={setAddingAgent}
        onAdded={() => qc.invalidateQueries({ queryKey: ["toolbox-agents"] })}
      />
      <BulkAddAgentsDialog
        open={bulkAdding}
        onOpenChange={setBulkAdding}
        onAdded={() => qc.invalidateQueries({ queryKey: ["toolbox-agents"] })}
      />
    </div>
  );
}

function AgentCard({
  agent,
  count,
  selected,
  onSelect,
  onChanged,
}: {
  agent: BrandedAgent;
  count: number;
  selected: boolean;
  onSelect: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const remove = async () => {
    const msg =
      count > 0
        ? `Remove ${agent.name}? This will also permanently delete their ${count} branded content item${count === 1 ? "" : "s"}.`
        : `Remove ${agent.name}?`;
    if (!confirm(msg)) return;
    const { error } = await sb.from("toolbox_agents").delete().eq("id", agent.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Agent removed");
    onChanged();
  };
  return (
    <>
      <Card
        onClick={onSelect}
        className={cn(
          "p-3 cursor-pointer hover:border-gold/60 transition group",
          selected && "border-gold",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center">
            {agent.headshot_url ? (
              <img
                src={agent.headshot_url}
                alt={agent.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">
                {agent.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">{agent.name}</div>
            <div className="text-xs text-muted-foreground">
              {count} item{count === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              className="p-1 rounded hover:bg-gold/20 text-muted-foreground hover:text-gold"
              aria-label="Edit agent"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                remove();
              }}
              className="p-1 rounded hover:bg-rose-600/20 text-muted-foreground hover:text-rose-400"
              aria-label="Remove agent"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Card>
      <EditAgentDialog open={editing} onOpenChange={setEditing} agent={agent} onSaved={onChanged} />
    </>
  );
}

function AddAgentDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [headshot, setHeadshot] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    setBusy(true);
    try {
      let headshot_url: string | null = null;
      const { data: row, error } = await sb
        .from("toolbox_agents")
        .insert({
          name: name.trim(),
          email: email.trim() || null,
          identifier: identifier.trim() || null,
          active: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (headshot) {
        const path = makeStorageKey(`agents/${row.id}/headshot`, headshot.name);
        const { url } = await uploadFile(path, headshot);
        headshot_url = url;
        await sb.from("toolbox_agents").update({ headshot_url }).eq("id", row.id);
      }
      toast.success("Agent added");
      setName("");
      setEmail("");
      setIdentifier("");
      setHeadshot(null);
      onAdded();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add agent</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Agent name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              autoFocus
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>
          <div>
            <Label>Identifier (optional)</Label>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="license #, etc."
            />
          </div>
          <div>
            <Label>Headshot (optional)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setHeadshot(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="bg-gold text-navy hover:bg-gold/90">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Saving…
              </>
            ) : (
              "Add agent"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkAddAgentsDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => {
    const valid: { name: string; email: string; line: number }[] = [];
    const invalid: { line: number; text: string; reason: string }[] = [];
    const lines = raw.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i].trim();
      if (!text) continue;
      const idx = text.indexOf(",");
      if (idx === -1) {
        invalid.push({ line: i + 1, text, reason: "Missing comma separator" });
        continue;
      }
      const name = text.slice(0, idx).trim();
      const email = text.slice(idx + 1).trim();
      if (!name) {
        invalid.push({ line: i + 1, text, reason: "Name is empty" });
        continue;
      }
      if (!email) {
        invalid.push({ line: i + 1, text, reason: "Email is empty" });
        continue;
      }
      valid.push({ name, email, line: i + 1 });
    }
    return { valid, invalid };
  }, [raw]);

  const submit = async () => {
    if (parsed.valid.length === 0) return;
    setBusy(true);
    try {
      const rows = parsed.valid.map((v) => ({
        name: v.name,
        email: v.email,
        active: true,
      }));
      const { error } = await sb.from("toolbox_agents").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} agent${rows.length === 1 ? "" : "s"} added`);
      setRaw("");
      onAdded();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk add agents</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            rows={8}
            placeholder={'Paste one agent per line: "Jane Smith, jane@example.com"'}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="text-sm"
            disabled={busy}
          />
          <div className="text-xs text-muted-foreground">
            Format: <span className="font-medium text-foreground">Name, email</span> — one per line.
            Blank lines are skipped.
          </div>

          {parsed.valid.length > 0 && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="text-sm font-medium text-emerald-300">
                {parsed.valid.length} agent{parsed.valid.length === 1 ? "" : "s"} ready to add
              </div>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {parsed.valid.map((v, i) => (
                  <div key={i} className="text-xs text-emerald-200/80 flex gap-2">
                    <span className="font-medium">{v.name}</span>
                    <span className="text-emerald-200/50">{v.email}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsed.invalid.length > 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="text-sm font-medium text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                {parsed.invalid.length} line{parsed.invalid.length === 1 ? "" : "s"} could not be
                parsed
              </div>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {parsed.invalid.map((inv, i) => (
                  <div key={i} className="text-xs text-amber-200/80">
                    <span className="font-medium">Line {inv.line}:</span> {inv.reason} — "{inv.text}
                    "
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy || parsed.valid.length === 0}
            className="bg-gold text-navy hover:bg-gold/90"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Adding…
              </>
            ) : (
              `Add ${parsed.valid.length || ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAgentDialog({
  open,
  onOpenChange,
  agent,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agent: BrandedAgent;
  onSaved: () => void;
}) {
  const [name, setName] = useState(agent.name);
  const [email, setEmail] = useState(agent.email ?? "");
  const [identifier, setIdentifier] = useState(agent.identifier ?? "");
  const [headshot, setHeadshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(agent.headshot_url);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(agent.name);
      setEmail(agent.email ?? "");
      setIdentifier(agent.identifier ?? "");
      setHeadshot(null);
      setPreviewUrl(agent.headshot_url);
    }
  }, [open, agent]);

  const onPickFile = (file: File | null) => {
    setHeadshot(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(agent.headshot_url);
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    setBusy(true);
    try {
      let headshot_url = previewUrl;
      if (headshot) {
        const path = makeStorageKey(`agents/${agent.id}/headshot`, headshot.name);
        const { url } = await uploadFile(path, headshot);
        headshot_url = url;
      }
      const { error } = await sb
        .from("toolbox_agents")
        .update({
          name: name.trim(),
          email: email.trim() || null,
          identifier: identifier.trim() || null,
          headshot_url,
        })
        .eq("id", agent.id);
      if (error) throw error;
      toast.success("Agent updated");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
    setBusy(false);
  };

  const clearHeadshot = () => {
    setHeadshot(null);
    setPreviewUrl(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit agent</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Agent name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>
          <div>
            <Label>Identifier (optional)</Label>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="license #, etc."
            />
          </div>
          <div>
            <Label>Headshot</Label>
            <div className="mt-2 flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center border border-border">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-muted-foreground">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
                {previewUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearHeadshot}
                    className="text-muted-foreground hover:text-rose-400 justify-start"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove headshot
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="bg-gold text-navy hover:bg-gold/90">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgentBrandedContentPanel({
  agent,
  userId,
  onChanged,
}: {
  agent: BrandedAgent;
  userId: string | null;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    content_type: BRANDED_TYPES[0],
    caption: "",
    drive_url: "",
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const { data: items = [] } = useQuery<BrandedContent[]>({
    queryKey: ["toolbox-agent-content", agent.id],
    queryFn: async () => {
      const { data, error } = await sb
        .from("toolbox_agent_content")
        .select("*")
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BrandedContent[];
    },
  });

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.content_type === filter)),
    [items, filter],
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["toolbox-agent-content", agent.id] });
    qc.invalidateQueries({ queryKey: ["toolbox-storage"] });
    onChanged();
  };

  const submitFiles = async (files: FileList | null) => {
    if (!form.title.trim()) {
      toast.error("Title required");
      return;
    }
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const path = makeStorageKey(`agents/${agent.id}/${form.content_type}`, f.name);
        const { url } = await uploadFile(path, f);
        await sb.from("toolbox_agent_content").insert({
          agent_id: agent.id,
          content_type: form.content_type,
          title: form.title.trim(),
          file_url: url,
          caption: form.caption.trim() || null,
          file_size: f.size,
        });
      }
      setForm({ title: "", content_type: form.content_type, caption: "", drive_url: "" });
      toast.success("Added");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
    setUploading(false);
  };

  const submitLink = async () => {
    if (!form.title.trim() || !form.drive_url.trim()) {
      toast.error("Title and Drive URL required");
      return;
    }
    const { error } = await sb.from("toolbox_agent_content").insert({
      agent_id: agent.id,
      content_type: form.content_type,
      title: form.title.trim(),
      drive_url: form.drive_url.trim(),
      caption: form.caption.trim() || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm({ title: "", content_type: form.content_type, caption: "", drive_url: "" });
    toast.success("Added");
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await sb.from("toolbox_agent_content").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  };

  const copy = async (t: string) => {
    await navigator.clipboard.writeText(t);
    toast.success("Caption copied");
  };

  return (
    <Card className="p-4 space-y-4 border-gold/40">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center">
          {agent.headshot_url ? (
            <img src={agent.headshot_url} alt={agent.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">
              {agent.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <div className="font-semibold">{agent.name}</div>
          <div className="text-xs text-muted-foreground">Branded content</div>
        </div>
      </div>

      <div className="rounded-lg border border-border p-3 space-y-3 bg-card/40">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select
              value={form.content_type}
              onValueChange={(v) => setForm({ ...form, content_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRANDED_TYPES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Optional caption</Label>
          <Textarea
            rows={2}
            value={form.caption}
            onChange={(e) => setForm({ ...form, caption: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="bg-gold text-navy hover:bg-gold/90"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" />
                Upload file(s)
              </>
            )}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => submitFiles(e.target.files)}
          />
          <div className="flex-1 min-w-[200px] flex gap-2">
            <Input
              placeholder="…or paste Drive URL (video)"
              value={form.drive_url}
              onChange={(e) => setForm({ ...form, drive_url: e.target.value })}
            />
            <Button variant="secondary" onClick={submitLink}>
              <LinkIcon className="h-4 w-4 mr-1" />
              Add link
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "text-xs px-2 py-1 rounded border",
            filter === "all" ? "border-gold text-gold" : "border-border text-muted-foreground",
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
                "text-xs px-2 py-1 rounded border",
                filter === t ? "border-gold text-gold" : "border-border text-muted-foreground",
              )}
            >
              {t} · {n}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          No items yet for this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((i) => {
            const isImg =
              i.file_url && /\.(png|jpe?g|gif|webp|svg|avif|heic)(\?|#|$)/i.test(i.file_url);
            return (
              <Card key={i.id} className="overflow-hidden group">
                <div className="aspect-video bg-muted relative">
                  {isImg ? (
                    <img src={i.file_url!} alt={i.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      {i.drive_url ? (
                        <VideoIcon className="h-8 w-8" />
                      ) : (
                        <FileText className="h-8 w-8" />
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => remove(i.id)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600/80 rounded p-1 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3 text-white" />
                  </button>
                  <Badge className="absolute top-2 left-2 bg-navy/80 border border-gold/30 text-gold">
                    {i.content_type}
                  </Badge>
                </div>
                <div className="p-3 space-y-2">
                  <div className="font-medium text-sm">{i.title}</div>
                  {i.caption && (
                    <div className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                      {i.caption}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    {i.file_url && (
                      <a
                        href={i.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-gold hover:underline"
                      >
                        File
                      </a>
                    )}
                    {i.drive_url && (
                      <a
                        href={i.drive_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-gold hover:underline"
                      >
                        Drive
                      </a>
                    )}
                    {i.caption && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-7"
                        onClick={() => copy(i.caption!)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ---------------- Agent Hub Cards Order & Visibility Tab ---------------- */

function HubCardsOrderTab() {
  const qc = useQueryClient();

  const { data: serverSettings, isLoading } = useQuery({
    queryKey: ["agent-hub-card-settings"],
    queryFn: () => getPublicHubCardSettings(),
  });

  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [badgeOverrides, setBadgeOverrides] = useState<Record<string, string>>({});
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize or synchronize local state from server
  useEffect(() => {
    if (!serverSettings) return;

    const defaultIds = DEFAULT_HUB_CARDS.map((c) => c.id);
    const existingOrder = Array.isArray(serverSettings.order) && serverSettings.order.length > 0
      ? serverSettings.order
      : defaultIds;

    // Ensure all known cards exist in order
    const mergedOrder = [...existingOrder];
    for (const dId of defaultIds) {
      if (!mergedOrder.includes(dId)) mergedOrder.push(dId);
    }

    setOrderedIds(mergedOrder);
    setHiddenIds(Array.isArray(serverSettings.hiddenIds) ? serverSettings.hiddenIds : []);
    setBadgeOverrides(serverSettings.badgeOverrides || {});
    setHasChanges(false);
  }, [serverSettings]);

  const cardMap = useMemo(() => {
    const map = new Map<string, HubCardDefinition>();
    for (const c of DEFAULT_HUB_CARDS) {
      map.set(c.id, c);
    }
    return map;
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return await saveHubCardSettings({
        data: {
          order: orderedIds,
          hiddenIds,
          badgeOverrides,
        },
      });
    },
    onSuccess: () => {
      toast.success("Agent Hub card order & layout saved!");
      setHasChanges(false);
      qc.invalidateQueries({ queryKey: ["agent-hub-card-settings"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save card layout");
    },
  });

  const moveItem = (index: number, direction: "up" | "down" | "top" | "bottom") => {
    setOrderedIds((prev) => {
      const copy = [...prev];
      if (direction === "top") {
        const [item] = copy.splice(index, 1);
        copy.unshift(item);
      } else if (direction === "bottom") {
        const [item] = copy.splice(index, 1);
        copy.push(item);
      } else if (direction === "up" && index > 0) {
        const [item] = copy.splice(index, 1);
        copy.splice(index - 1, 0, item);
      } else if (direction === "down" && index < copy.length - 1) {
        const [item] = copy.splice(index, 1);
        copy.splice(index + 1, 0, item);
      }
      return copy;
    });
    setHasChanges(true);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    setOrderedIds((prev) => {
      const copy = [...prev];
      const fromIndex = copy.indexOf(draggedId);
      const toIndex = copy.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, draggedId);
      return copy;
    });

    setDraggedId(null);
    setDragOverId(null);
    setHasChanges(true);
  };

  const toggleVisibility = (id: string) => {
    setHiddenIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return next;
    });
    setHasChanges(true);
  };

  const handleBadgeChange = (id: string, text: string) => {
    setBadgeOverrides((prev) => ({
      ...prev,
      [id]: text,
    }));
    setHasChanges(true);
  };

  const resetToDefault = () => {
    if (confirm("Reset card sequence, visibility, and custom badges back to defaults?")) {
      const defaultIds = DEFAULT_HUB_CARDS.map((c) => c.id);
      setOrderedIds(defaultIds);
      setHiddenIds([]);
      setBadgeOverrides({});
      setHasChanges(true);
    }
  };

  const visibleCount = orderedIds.length - hiddenIds.length;

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
        <span>Loading card order settings…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Hero Card with Actions */}
      <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-card via-card to-gold/5 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-gold" />
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Agent Hub Card Layout &amp; Order
              </h2>
              {hasChanges ? (
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[11px] animate-pulse">
                  Unsaved Changes
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[11px]">
                  Live Synced
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
              Arrange cards in the sequence agents will see on{" "}
              <a
                href="/agents"
                target="_blank"
                rel="noreferrer"
                className="text-gold underline underline-offset-2 font-medium"
              >
                /agents
              </a>
              . Drag items or use the directional arrows, toggle visibility, and customize badge labels.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefault}
              className="text-xs border-border hover:bg-surface-2"
              title="Revert to factory sequence"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5 opacity-70" />
              Reset Defaults
            </Button>

            <a
              href="/agents"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5 text-gold" />
              Preview Hub
            </a>

            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !hasChanges}
              className={cn(
                "bg-gold text-navy hover:bg-gold/90 font-semibold shadow-xs transition-all",
                hasChanges && "ring-2 ring-gold/40 shadow-gold/20",
              )}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Save Card Layout
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between gap-4 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-4">
            <span>
              Total Cards: <strong className="text-foreground">{orderedIds.length}</strong>
            </span>
            <span>·</span>
            <span>
              Visible: <strong className="text-emerald-400">{visibleCount}</strong>
            </span>
            <span>·</span>
            <span>
              Hidden: <strong className="text-muted-foreground">{hiddenIds.length}</strong>
            </span>
          </div>
          {serverSettings?.updatedAt && (
            <div className="text-[11px] text-muted-foreground/70">
              Last saved: {new Date(serverSettings.updatedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Cards List Reorder Deck */}
      <div className="space-y-3">
        {orderedIds.map((id, index) => {
          const card = cardMap.get(id);
          if (!card) return null;

          const isHidden = hiddenIds.includes(id);
          const isFirst = index === 0;
          const isLast = index === orderedIds.length - 1;
          const IconComp = card.icon;
          const currentBadge = badgeOverrides[id] ?? card.defaultBadge;
          const isDragged = draggedId === id;
          const isOver = dragOverId === id;

          return (
            <div
              key={id}
              draggable
              onDragStart={(e) => handleDragStart(e, id)}
              onDragOver={(e) => handleDragOver(e, id)}
              onDrop={(e) => handleDrop(e, id)}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
              className={cn(
                "group relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl border transition-all duration-200",
                isHidden
                  ? "bg-card/40 border-dashed border-border/60 opacity-65 hover:opacity-90"
                  : "bg-card border-border/80 hover:border-gold/50 shadow-xs",
                isDragged && "opacity-30 scale-[0.99] border-gold",
                isOver && "border-gold ring-2 ring-gold/30 bg-gold/5",
              )}
            >
              {/* Left Side: Grip Handle + Rank + Icon + Details */}
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                {/* Drag Handle */}
                <div
                  className="cursor-grab active:cursor-grabbing p-1.5 rounded text-muted-foreground/50 group-hover:text-muted-foreground hover:bg-surface-2 transition-colors shrink-0"
                  title="Drag to reorder"
                >
                  <GripVertical className="h-5 w-5" />
                </div>

                {/* Rank Number */}
                <div className="h-7 w-7 rounded-lg bg-surface-2 border border-border/80 flex items-center justify-center text-xs font-bold text-foreground shrink-0 shadow-2xs">
                  #{index + 1}
                </div>

                {/* Card Icon */}
                <div className="h-10 w-10 rounded-xl bg-surface-2 border border-white/[0.08] flex items-center justify-center text-foreground group-hover:text-gold group-hover:bg-gold/10 transition-colors shrink-0 shadow-2xs">
                  <IconComp className="h-5 w-5" />
                </div>

                {/* Title and Metadata */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-gold transition-colors">
                      {card.title}
                    </h3>
                    <Badge variant="outline" className="text-[10px] px-2 py-0 uppercase tracking-wider font-semibold border-border/80 text-muted-foreground">
                      {card.category}
                    </Badge>
                    {isHidden && (
                      <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30 text-[10px] px-2 py-0">
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {card.subtitle}
                  </p>
                  <div className="text-[11px] text-muted-foreground/70 truncate mt-0.5 flex items-center gap-1.5">
                    <span className="font-mono">{card.to || card.href}</span>
                  </div>
                </div>
              </div>

              {/* Middle & Right: Badge editor + Visibility + Reorder controls */}
              <div className="flex items-center gap-3 flex-wrap w-full md:w-auto justify-between md:justify-end pt-2 md:pt-0 border-t md:border-t-0 border-border/40">
                {/* Inline Badge Customizer */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    Badge:
                  </span>
                  <div className="relative">
                    <Input
                      type="text"
                      value={currentBadge}
                      onChange={(e) => handleBadgeChange(id, e.target.value)}
                      placeholder={card.defaultBadge}
                      className="h-7 w-32 sm:w-36 text-xs px-2 bg-surface-2/90 border-border/70 rounded-md focus-visible:ring-gold"
                    />
                  </div>
                </div>

                {/* Visibility Toggle Button */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleVisibility(id)}
                  className={cn(
                    "h-8 px-2.5 text-xs font-medium gap-1.5 rounded-lg border",
                    isHidden
                      ? "border-rose-500/40 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      : "border-border text-foreground hover:bg-surface-2",
                  )}
                  title={isHidden ? "Click to show card to agents" : "Click to hide card from agents"}
                >
                  {isHidden ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5 text-rose-400" />
                      <span>Hidden</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Visible</span>
                    </>
                  )}
                </Button>

                {/* Direct Directional Reorder Buttons */}
                <div className="flex items-center gap-0.5 bg-surface-2/80 rounded-lg p-0.5 border border-border/70">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isFirst}
                    onClick={() => moveItem(index, "top")}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Move to Top"
                  >
                    <ChevronsUp className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isFirst}
                    onClick={() => moveItem(index, "up")}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Move Up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isLast}
                    onClick={() => moveItem(index, "down")}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Move Down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isLast}
                    onClick={() => moveItem(index, "bottom")}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Move to Bottom"
                  >
                    <ChevronsDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- MLS Market Stats Staff Tab ---------------- */

function MarketStatsTab({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<MarketStatsReport | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [scanningPdf, setScanningPdf] = useState(false);
  const [uploadingGraphic, setUploadingGraphic] = useState(false);

  // Form State
  const [form, setForm] = useState<{
    id?: string;
    month: string;
    title: string;
    area: string;
    summaryNotes: string;
    pdfUrl: string | null;
    pdfName: string | null;
    pdfSize: number | null;
    metrics: {
      medianSalePrice: string;
      medianPriceChange: string;
      avgDaysOnMarket: string;
      domChange: string;
      activeInventory: string;
      inventoryChange: string;
      closedSales: string;
      closedSalesChange: string;
      listToSaleRatio: string;
      monthsSupply: string;
    };
    graphics: MarketSocialGraphic[];
  }>({
    month: "",
    title: "",
    area: "Central Missouri MLS",
    summaryNotes: "",
    pdfUrl: null,
    pdfName: null,
    pdfSize: null,
    metrics: {
      medianSalePrice: "",
      medianPriceChange: "",
      avgDaysOnMarket: "",
      domChange: "",
      activeInventory: "",
      inventoryChange: "",
      closedSales: "",
      closedSalesChange: "",
      listToSaleRatio: "",
      monthsSupply: "",
    },
    graphics: [],
  });

  const { data: reports = [], isLoading } = useQuery<MarketStatsReport[]>({
    queryKey: ["public-market-stats-reports"],
    queryFn: () => getPublicMarketStatsReports(),
  });

  const openCreate = () => {
    const nextMonth = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    setEditingReport(null);
    setForm({
      month: nextMonth,
      title: `${nextMonth} MLS Market Stats`,
      area: "Central Missouri MLS & Regional Area",
      summaryNotes: "",
      pdfUrl: null,
      pdfName: null,
      pdfSize: null,
      metrics: {
        medianSalePrice: "$248,500",
        medianPriceChange: "+4.2% MoM",
        avgDaysOnMarket: "28 Days",
        domChange: "-3 Days MoM",
        activeInventory: "348",
        inventoryChange: "+6.1% MoM",
        closedSales: "142",
        closedSalesChange: "+2.8% MoM",
        listToSaleRatio: "98.6%",
        monthsSupply: "2.4 Mos",
      },
      graphics: [],
    });
    setDialogOpen(true);
  };

  const openEdit = (report: MarketStatsReport) => {
    setEditingReport(report);
    setForm({
      id: report.id,
      month: report.month,
      title: report.title,
      area: report.area || "Central Missouri MLS",
      summaryNotes: report.summaryNotes || "",
      pdfUrl: report.pdfUrl || null,
      pdfName: report.pdfName || null,
      pdfSize: report.pdfSize || null,
      metrics: {
        medianSalePrice: report.metrics?.medianSalePrice || "",
        medianPriceChange: report.metrics?.medianPriceChange || "",
        avgDaysOnMarket: report.metrics?.avgDaysOnMarket || "",
        domChange: report.metrics?.domChange || "",
        activeInventory: report.metrics?.activeInventory || "",
        inventoryChange: report.metrics?.inventoryChange || "",
        closedSales: report.metrics?.closedSales || "",
        closedSalesChange: report.metrics?.closedSalesChange || "",
        listToSaleRatio: report.metrics?.listToSaleRatio || "",
        monthsSupply: report.metrics?.monthsSupply || "",
      },
      graphics: report.graphics || [],
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.month.trim()) throw new Error("Month is required (e.g. October 2026)");
      if (!form.title.trim()) throw new Error("Title is required");

      return await saveMarketStatsReport({
        data: {
          id: form.id,
          month: form.month.trim(),
          title: form.title.trim(),
          area: form.area.trim() || "Central Missouri MLS",
          summaryNotes: form.summaryNotes.trim(),
          pdfUrl: form.pdfUrl,
          pdfName: form.pdfName,
          pdfSize: form.pdfSize,
          metrics: form.metrics,
          graphics: form.graphics,
        },
      });
    },
    onSuccess: () => {
      toast.success("Market stats report saved!");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["public-market-stats-reports"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save market stats");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteMarketStatsReport({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Market stats report deleted");
      qc.invalidateQueries({ queryKey: ["public-market-stats-reports"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete report");
    },
  });

  // Handle PDF file upload with AI Auto-Scanning
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPdf(true);
      setScanningPdf(true);

      // 1. Scan and parse PDF contents
      let extracted: any = null;
      try {
        extracted = await extractMarketStatsFromPdf(file);
      } catch (scanErr) {
        console.warn("PDF auto-scan notice:", scanErr);
      }

      // 2. Upload file to Supabase storage
      const storagePath = makeStorageKey("market-stats/pdf", file.name);
      const res = await uploadFile(storagePath, file);

      setForm((prev) => {
        const updated = {
          ...prev,
          pdfUrl: res.url,
          pdfName: file.name,
          pdfSize: file.size,
        };

        if (extracted) {
          if (extracted.month) {
            updated.month = extracted.month;
          }
          if (extracted.region) {
            updated.area = extracted.region;
          }
          updated.title = `${extracted.month || updated.month} MLS Market Stats — ${extracted.region || updated.area}`;

          if (extracted.highlights && extracted.highlights.length > 0) {
            updated.summaryNotes = extracted.highlights.join(" ");
          }

          if (extracted.metrics) {
            updated.metrics = {
              ...prev.metrics,
              ...extracted.metrics,
            };
          }
        }

        return updated;
      });

      if (extracted && extracted.metrics?.medianSalePrice) {
        toast.success(
          `✨ Scanned "${file.name}"! Auto-filled ${extracted.region} (${extracted.month}) stats: ${extracted.metrics.medianSalePrice} Median, ${extracted.metrics.closedSales || "—"} Closed Sales.`
        );
      } else {
        toast.success(`PDF "${file.name}" uploaded successfully!`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload or scan PDF");
    } finally {
      setUploadingPdf(false);
      setScanningPdf(false);
    }
  };

  // Handle Graphic image upload
  const handleGraphicUpload = async (e: React.ChangeEvent<HTMLInputElement>, formatType = "Square 1:1") => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadingGraphic(true);
      const newGraphics: MarketSocialGraphic[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const storagePath = makeStorageKey("market-stats/graphics", file.name);
        const res = await uploadFile(storagePath, file);

        const defaultCaption = `🏡 ${form.month || "MONTHLY"} MARKET UPDATE 📈\n\nMedian Price: ${form.metrics.medianSalePrice || "$248,500"} (${form.metrics.medianPriceChange || "+4.2%"})\nAvg Days on Market: ${form.metrics.avgDaysOnMarket || "28 Days"}\nActive Listings: ${form.metrics.activeInventory || "348"}\n\nThinking about buying or selling? Contact us today!\n#MattSmithRealEstateGroup #MarketUpdate #CentralMORealEstate`;

        newGraphics.push({
          id: `g-${Date.now()}-${i}`,
          title: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
          format: formatType,
          imageUrl: res.url,
          caption: defaultCaption,
        });
      }

      setForm((prev) => ({
        ...prev,
        graphics: [...prev.graphics, ...newGraphics],
      }));
      toast.success(`Uploaded ${newGraphics.length} social graphic(s)!`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload graphic image");
    } finally {
      setUploadingGraphic(false);
    }
  };

  const removeGraphic = (id: string) => {
    setForm((prev) => ({
      ...prev,
      graphics: prev.graphics.filter((g) => g.id !== id),
    }));
  };

  const updateGraphic = (id: string, field: "title" | "format" | "caption", value: string) => {
    setForm((prev) => ({
      ...prev,
      graphics: prev.graphics.map((g) => (g.id === id ? { ...g, [field]: value } : g)),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Actions */}
      <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-card via-card to-gold/5 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gold" />
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              MLS Market Stats &amp; Social Kits
            </h2>
            <Badge className="bg-gold/15 text-gold border-gold/30 text-[11px]">
              {reports.length} Monthly Report{reports.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
            Upload monthly MLS executive summaries, configure key price/inventory numbers, and upload ready-to-post social media graphics for agents to download and share.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <a
            href="/market-stats"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 text-gold" />
            View Agent Page
          </a>

          <Button
            onClick={openCreate}
            className="bg-gold text-navy hover:bg-gold/90 font-semibold text-xs shadow-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Monthly Stats Report
          </Button>
        </div>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-gold" />
          <span>Loading market stats reports…</span>
        </div>
      ) : reports.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground border-dashed">
          <BarChart3 className="h-8 w-8 mx-auto opacity-40 text-gold mb-2" />
          <p className="text-sm font-medium text-foreground">No market stats reports published yet.</p>
          <p className="text-xs mt-1">Click "New Monthly Stats Report" to create your first report.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report) => (
            <Card
              key={report.id}
              className="p-5 rounded-2xl border border-border/80 hover:border-gold/50 transition-all duration-200 flex flex-col justify-between space-y-4 shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gold uppercase tracking-wider">
                        {report.month}
                      </span>
                      <span className="text-muted-foreground text-xs">·</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {report.area || "Central Missouri MLS"}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-foreground mt-0.5">{report.title}</h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(report)}
                      className="h-8 w-8 text-muted-foreground hover:text-gold hover:bg-surface-2"
                      title="Edit Report"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete market report "${report.title}"?`)) {
                          deleteMutation.mutate(report.id);
                        }
                      }}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      title="Delete Report"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Key Metrics Quick View */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 px-3 rounded-xl bg-surface-2/70 border border-border/60 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Median Price</span>
                    <strong className="text-foreground text-xs">{report.metrics?.medianSalePrice || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Avg DOM</span>
                    <strong className="text-foreground text-xs">{report.metrics?.avgDaysOnMarket || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Inventory</span>
                    <strong className="text-foreground text-xs">{report.metrics?.activeInventory || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase">Closed Sales</span>
                    <strong className="text-foreground text-xs">{report.metrics?.closedSales || "—"}</strong>
                  </div>
                </div>

                {/* Attachments status */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-1">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-gold" />
                    {report.pdfUrl ? (
                      <a
                        href={report.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground hover:text-gold hover:underline font-medium"
                      >
                        PDF Attached
                      </a>
                    ) : (
                      <span className="opacity-60">No PDF uploaded</span>
                    )}
                  </div>
                  <span>·</span>
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-gold" />
                    <span>{report.graphics?.length || 0} Social Graphic(s)</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/50 text-xs">
                <a
                  href="/market-stats"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold hover:underline font-medium flex items-center gap-1"
                >
                  <span>Preview Page</span>
                  <ExternalLink className="h-3 w-3" />
                </a>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(report)}
                  className="text-xs h-7 border-border hover:bg-surface-2"
                >
                  Edit Report
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Create / Edit Market Stats Report */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReport ? "Edit Market Stats Report" : "New Monthly MLS Market Report"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Quick Auto-Scan Banner */}
            <div className="rounded-xl border border-gold/30 bg-gradient-to-r from-gold/15 via-gold/5 to-transparent p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gold uppercase tracking-wider">
                  <Sparkles className="h-4 w-4" />
                  <span>AI Auto-Scan &amp; Extract MLS PDF</span>
                </div>
                <p className="text-xs text-muted-foreground max-w-lg">
                  Drop or select your MLS Report PDF (MARIS County Update or Lake of the Ozarks Report) to auto-fill all price, inventory, and volume statistics instantly.
                </p>
              </div>

              <label className="inline-flex shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploadingPdf || scanningPdf}
                  asChild
                  className="cursor-pointer text-xs border-gold text-gold bg-gold/10 hover:bg-gold/20 font-semibold shadow-xs"
                >
                  <span>
                    {scanningPdf || uploadingPdf ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        {scanningPdf ? "Scanning PDF Stats…" : "Uploading…"}
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                        Auto-Scan MLS PDF
                      </>
                    )}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                  disabled={uploadingPdf || scanningPdf}
                />
              </label>
            </div>

            {/* Section 1: Basic Period & Area Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>1. Report Period &amp; Area</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Month / Period (e.g. October 2026)</Label>
                  <Input
                    value={form.month}
                    onChange={(e) => setForm({ ...form, month: e.target.value })}
                    placeholder="e.g. October 2026"
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Report Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. October 2026 MLS Market Stats"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">MLS Region / Area</Label>
                  <Input
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    placeholder="e.g. Central Missouri MLS & Regional Area"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Executive Summary / Agent Talking Points */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span>2. Executive Summary &amp; Agent Talking Points</span>
              </Label>
              <Textarea
                rows={3}
                value={form.summaryNotes}
                onChange={(e) => setForm({ ...form, summaryNotes: e.target.value })}
                placeholder="Write a brief 2-3 sentence overview explaining price trends, inventory shifts, and advice agents can quote to buyers/sellers..."
                className="text-xs leading-relaxed"
              />
            </div>

            {/* Section 3: Headline Visual Numbers */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>3. Key Headline Stats (Instant Visualization)</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-2/40 p-4 rounded-xl border border-border/60">
                <div>
                  <Label className="text-[11px]">Median Sale Price</Label>
                  <Input
                    value={form.metrics.medianSalePrice}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        metrics: { ...form.metrics, medianSalePrice: e.target.value },
                      })
                    }
                    placeholder="$248,500"
                    className="h-8 text-xs font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Price MoM Change</Label>
                  <Input
                    value={form.metrics.medianPriceChange}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        metrics: { ...form.metrics, medianPriceChange: e.target.value },
                      })
                    }
                    placeholder="+4.2% MoM"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Avg Days on Market</Label>
                  <Input
                    value={form.metrics.avgDaysOnMarket}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        metrics: { ...form.metrics, avgDaysOnMarket: e.target.value },
                      })
                    }
                    placeholder="28 Days"
                    className="h-8 text-xs font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">DOM MoM Change</Label>
                  <Input
                    value={form.metrics.domChange}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        metrics: { ...form.metrics, domChange: e.target.value },
                      })
                    }
                    placeholder="-3 Days MoM"
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-[11px]">Active Inventory</Label>
                  <Input
                    value={form.metrics.activeInventory}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        metrics: { ...form.metrics, activeInventory: e.target.value },
                      })
                    }
                    placeholder="348"
                    className="h-8 text-xs font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Inventory Change</Label>
                  <Input
                    value={form.metrics.inventoryChange}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        metrics: { ...form.metrics, inventoryChange: e.target.value },
                      })
                    }
                    placeholder="+6.1%"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Closed Sales</Label>
                  <Input
                    value={form.metrics.closedSales}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        metrics: { ...form.metrics, closedSales: e.target.value },
                      })
                    }
                    placeholder="142"
                    className="h-8 text-xs font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Closed Sales Change</Label>
                  <Input
                    value={form.metrics.closedSalesChange}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        metrics: { ...form.metrics, closedSalesChange: e.target.value },
                      })
                    }
                    placeholder="+2.8%"
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-[11px]">List-to-Sale Ratio</Label>
                  <Input
                    value={form.metrics.listToSaleRatio}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        metrics: { ...form.metrics, listToSaleRatio: e.target.value },
                      })
                    }
                    placeholder="98.6%"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Months Supply</Label>
                  <Input
                    value={form.metrics.monthsSupply}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        metrics: { ...form.metrics, monthsSupply: e.target.value },
                      })
                    }
                    placeholder="2.4 Mos"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Full MLS PDF Upload */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span>4. Official MLS PDF Document</span>
              </h3>
              <div className="p-4 rounded-xl border border-dashed border-border bg-surface-2/30 space-y-3">
                {form.pdfUrl ? (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-2 border border-border">
                    <div className="flex items-center gap-2.5 truncate">
                      <FileText className="h-5 w-5 text-gold shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {form.pdfName || "MLS_Report.pdf"}
                        </p>
                        {form.pdfSize && (
                          <p className="text-[10px] text-muted-foreground">
                            {(form.pdfSize / 1024 / 1024).toFixed(2)} MB
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={form.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-gold hover:underline"
                      >
                        Preview
                      </a>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            pdfUrl: null,
                            pdfName: null,
                            pdfSize: null,
                          }))
                        }
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-2">
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground">
                      Upload the full monthly MLS report PDF (agents can download &amp; view)
                    </p>
                    <label className="inline-flex">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={uploadingPdf}
                        asChild
                        className="cursor-pointer text-xs border-gold/40 text-gold hover:bg-gold/10"
                      >
                        <span>
                          {uploadingPdf ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              Uploading…
                            </>
                          ) : (
                            <>
                              <Upload className="h-3.5 w-3.5 mr-1.5" />
                              Select PDF File
                            </>
                          )}
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={handlePdfUpload}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Section 5: Ready-to-Post Social Media Graphics */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>5. Ready-to-Post Social Media Graphics &amp; Captions</span>
                </h3>

                <label className="inline-flex">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={uploadingGraphic}
                    asChild
                    className="cursor-pointer text-xs h-7 border-border hover:bg-surface-2"
                  >
                    <span>
                      {uploadingGraphic ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3 mr-1" />
                          Upload Graphic Images
                        </>
                      )}
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleGraphicUpload(e, "Square 1:1")}
                  />
                </label>
              </div>

              {form.graphics.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground bg-surface-2/20 border border-dashed border-border rounded-xl">
                  No social graphics added yet. Upload 1:1 Square or 9:16 Story images for agents to download.
                </div>
              ) : (
                <div className="space-y-3">
                  {form.graphics.map((g, idx) => (
                    <div
                      key={g.id || idx}
                      className="p-3.5 rounded-xl border border-border bg-surface-2/60 flex flex-col sm:flex-row gap-3 items-start"
                    >
                      <div className="h-20 w-20 rounded-lg overflow-hidden bg-black/40 shrink-0 border border-border">
                        <img src={g.imageUrl} alt={g.title} className="h-full w-full object-cover" />
                      </div>

                      <div className="flex-1 space-y-2 w-full">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Graphic Title</Label>
                            <Input
                              value={g.title}
                              onChange={(e) => updateGraphic(g.id, "title", e.target.value)}
                              placeholder="e.g. Instagram Feed 1:1"
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Format Tag</Label>
                            <Input
                              value={g.format || ""}
                              onChange={(e) => updateGraphic(g.id, "format", e.target.value)}
                              placeholder="e.g. Square 1:1 / Story 9:16"
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-[10px]">Pre-written Caption &amp; Hashtags for Agents</Label>
                          <Textarea
                            rows={2}
                            value={g.caption || ""}
                            onChange={(e) => updateGraphic(g.id, "caption", e.target.value)}
                            placeholder="Paste suggested caption and hashtags..."
                            className="text-xs leading-relaxed"
                          />
                        </div>
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeGraphic(g.id)}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0 self-end sm:self-start"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-gold text-navy hover:bg-gold/90 font-bold text-xs"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Save &amp; Publish Stats Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

