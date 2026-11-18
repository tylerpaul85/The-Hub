/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import {
  ShoppingBag,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Home,
  Trees,
  Search,
  History,
  TrendingDown,
  Layers,
  MapPin,
  Image as ImageIcon,
  Loader2,
  Calendar,
  XCircle,
} from "lucide-react";
import {
  getMetaCatalogStats,
  getMetaCatalogListings,
  toggleListingExclusion,
  triggerManualCatalogSync,
  getMetaSyncHistory,
} from "@/lib/meta-catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/catalog-ads")({
  component: CatalogAdsPage,
  head: () => ({
    meta: [
      { title: "Catalog Ads & Meta Feed — MSREG Hub" },
      {
        name: "description",
        content: "Automated Meta Commerce Home Listings feed management from Ruuster MLS inventory.",
      },
    ],
  }),
});

type FilterType = "all" | "residential" | "land" | "reduced" | "missing";

function CatalogAdsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Server functions
  const fetchStats = useServerFn(getMetaCatalogStats);
  const fetchListings = useServerFn(getMetaCatalogListings);
  const toggleExclusionFn = useServerFn(toggleListingExclusion);
  const triggerSyncFn = useServerFn(triggerManualCatalogSync);
  const fetchHistoryFn = useServerFn(getMetaSyncHistory);

  // 1. Stats Query
  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["meta-catalog-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 30000,
  });

  // 2. Listings Query
  const { data: listings = [], isLoading: isListingsLoading, isRefetching } = useQuery({
    queryKey: ["meta-catalog-listings", activeFilter, searchQuery],
    queryFn: () =>
      fetchListings({
        data: {
          filter: activeFilter,
          search: searchQuery,
          limit: 200,
        },
      }),
  });

  // 3. Sync History Query
  const { data: syncHistory = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ["meta-catalog-history"],
    queryFn: () => fetchHistoryFn(),
    enabled: isHistoryOpen,
  });

  // 4. Manual Sync Mutation
  const syncMutation = useMutation({
    mutationFn: () => triggerSyncFn(),
    onMutate: () => {
      toast.info("Starting sync with Ruuster MLS listings...");
    },
    onSuccess: (res: any) => {
      if (res.success) {
        toast.success(res.message || "Catalog successfully synced with Ruuster MLS!");
      } else {
        toast.error(res.message || "Sync finished with issues. Check sync history.");
      }
      queryClient.invalidateQueries({ queryKey: ["meta-catalog-stats"] });
      queryClient.invalidateQueries({ queryKey: ["meta-catalog-listings"] });
      queryClient.invalidateQueries({ queryKey: ["meta-catalog-history"] });
    },
    onError: (err: any) => {
      toast.error(`Sync failed: ${err.message}`);
    },
  });

  // 5. Toggle Exclusion Mutation
  const toggleMutation = useMutation({
    mutationFn: ({ id, excluded }: { id: string; excluded: boolean }) =>
      toggleExclusionFn({ data: { id, excluded } }),
    onMutate: async ({ id, excluded }) => {
      await queryClient.cancelQueries({ queryKey: ["meta-catalog-listings"] });
      const previous = queryClient.getQueryData(["meta-catalog-listings", activeFilter, searchQuery]);

      queryClient.setQueryData(
        ["meta-catalog-listings", activeFilter, searchQuery],
        (old: any[] = []) =>
          old.map((item) => (item.id === id ? { ...item, excluded } : item)),
      );

      return { previous };
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.excluded
          ? "Listing excluded from Meta catalog ads."
          : "Listing added back into Meta catalog feed.",
      );
      queryClient.invalidateQueries({ queryKey: ["meta-catalog-stats"] });
    },
    onError: (err: any, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["meta-catalog-listings", activeFilter, searchQuery],
          context.previous,
        );
      }
      toast.error(`Failed to update listing: ${err.message}`);
    },
  });

  // Resolved public feed URL
  const feedUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/feeds/meta-listings.xml`;
    }
    return "https://mattsmithrealestategroup.com/feeds/meta-listings.xml";
  }, []);

  const handleCopyFeedUrl = () => {
    navigator.clipboard.writeText(feedUrl);
    setIsCopied(true);
    toast.success("Feed URL copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* ─── Hero Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-gold/10 text-gold border border-gold/25 mb-2.5">
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Meta Catalog Ads &amp; Home Listings</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Catalog Ads Feed Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Automated sync from Ruuster MLS inventory to Meta Commerce Manager. Powers dynamic Advantage+ Real Estate ads and Marketplace home listings.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHistoryOpen(true)}
            className="border-border/80 hover:bg-surface-2 text-xs font-semibold gap-1.5"
          >
            <History className="h-4 w-4 text-muted-foreground" />
            <span>Sync History</span>
          </Button>

          <Button
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="bg-gold text-navy font-semibold hover:bg-gold/90 transition-all text-xs gap-2 shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            <span>{syncMutation.isPending ? "Syncing MLS..." : "Sync now"}</span>
          </Button>
        </div>
      </div>

      {/* ─── Feed URL Card ─── */}
      <Card className="bg-surface-1/90 border-border/80 shadow-md backdrop-blur-sm overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gold">Public Feed URL (Meta Scheduled Fetch)</span>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                1-Hr Cache
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-surface-2 text-muted-foreground border-border/60">
                No Auth Required
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Provide this URL in Meta Commerce Manager under <strong>Data Sources &gt; Add Items &gt; Data Feed &gt; Scheduled Feed</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 max-w-xl w-full md:w-auto">
            <div className="flex-1 md:w-96 px-3 py-2 rounded-lg bg-surface-2 border border-border/70 text-xs font-mono text-muted-foreground truncate select-all">
              {feedUrl}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyFeedUrl}
              className="gap-1.5 text-xs font-semibold shrink-0 border-border/80 hover:bg-surface-2"
            >
              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{isCopied ? "Copied" : "Copy"}</span>
            </Button>
            <a
              href={feedUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg border border-border/80 hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Open raw XML feed in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </Card>

      {/* ─── Header Stats ─── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Stat 1: Active Listings */}
        <Card className="bg-surface-1 border-border/80 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Active Listings</span>
              <Home className="h-4 w-4 text-gold/70" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {isStatsLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : stats?.totalActive ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground">Live on Ruuster MLS</p>
          </CardContent>
        </Card>

        {/* Stat 2: In Feed */}
        <Card className="bg-surface-1 border-border/80 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">In Meta Feed</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-400">
              {isStatsLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : stats?.inFeed ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground">Active for dynamic ads</p>
          </CardContent>
        </Card>

        {/* Stat 3: Excluded */}
        <Card className="bg-surface-1 border-border/80 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Excluded</span>
              <XCircle className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-amber-400">
              {isStatsLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : stats?.excluded ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground">Manually suppressed</p>
          </CardContent>
        </Card>

        {/* Stat 4: Missing Data */}
        <Card className="bg-surface-1 border-border/80 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Missing Data</span>
              <AlertTriangle className="h-4 w-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-rose-400">
              {isStatsLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : stats?.missingData ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground">Needs lat/lng or remarks</p>
          </CardContent>
        </Card>

        {/* Stat 5: Last Sync */}
        <Card className="col-span-2 md:col-span-1 bg-surface-1 border-border/80 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Last Sync</span>
              <Calendar className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-sm font-semibold tracking-tight text-foreground truncate">
              {isStatsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : stats?.lastRun ? (
                formatDistanceToNow(new Date(stats.lastRun.runTime), { addSuffix: true })
              ) : (
                "Never synced"
              )}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              {stats?.lastRun ? (
                stats.lastRun.hasErrors ? (
                  <span className="text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Errors logged
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {stats.lastRun.listingCount} listings
                  </span>
                )
              ) : (
                "Scheduled 5:00 AM CT"
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Filter Pills & Search ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-surface-1 border border-border/70">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFilter === "all"
                ? "bg-gold text-navy shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            All Listings
          </button>
          <button
            onClick={() => setActiveFilter("residential")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeFilter === "residential"
                ? "bg-gold text-navy shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            <span>Residential</span>
          </button>
          <button
            onClick={() => setActiveFilter("land")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeFilter === "land"
                ? "bg-gold text-navy shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            <Trees className="h-3.5 w-3.5" />
            <span>Land</span>
          </button>
          <button
            onClick={() => setActiveFilter("reduced")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeFilter === "reduced"
                ? "bg-gold text-navy shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
            <span>Price Reduced</span>
          </button>
          <button
            onClick={() => setActiveFilter("missing")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeFilter === "missing"
                ? "bg-gold text-navy shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
            <span>Missing Data</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search address, city, MLS #..."
            className="pl-8 text-xs bg-surface-1 border-border/80 h-9"
          />
        </div>
      </div>

      {/* ─── Listings Table ─── */}
      <Card className="bg-surface-1 border-border/80 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-surface-2/60">
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="w-16 text-xs font-bold text-foreground">Photo</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Address &amp; MLS</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Price</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Beds / Baths / Sqft</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Type &amp; Label</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Feed Status</TableHead>
                <TableHead className="text-right text-xs font-bold text-foreground">Exclude</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isListingsLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                    <div className="inline-flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-gold" />
                      <span className="text-xs">Loading listings catalog...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : listings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                    <div className="inline-flex flex-col items-center gap-2">
                      <Layers className="h-8 w-8 text-muted-foreground/50" />
                      <div className="font-semibold text-foreground text-sm">No listings found</div>
                      <p className="text-xs max-w-sm">
                        {stats?.totalActive === 0
                          ? "The database has not been synced yet. Click 'Sync now' above to load listings from Ruuster."
                          : "No listings matched your active filter or search query."}
                      </p>
                      {stats?.totalActive === 0 && (
                        <Button
                          size="sm"
                          onClick={() => syncMutation.mutate()}
                          disabled={syncMutation.isPending}
                          className="bg-gold text-navy text-xs font-semibold mt-2"
                        >
                          Run First Sync Now
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                listings.map((item: any) => {
                  const hasReduction = item.old_price && item.price && item.old_price > item.price;
                  const isLand = (item.property_type || "").toLowerCase() === "land";
                  const primaryPhoto =
                    Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : null;
                  const missingFields: string[] = Array.isArray(item.missing_fields)
                    ? item.missing_fields
                    : [];

                  return (
                    <TableRow
                      key={item.id}
                      className={`border-border/60 transition-colors ${
                        item.excluded ? "opacity-60 bg-surface-2/20" : "hover:bg-surface-2/40"
                      }`}
                    >
                      {/* Photo Thumbnail */}
                      <TableCell className="py-2.5">
                        <div className="relative h-12 w-16 rounded-md overflow-hidden bg-surface-2 border border-border/80 shrink-0">
                          {primaryPhoto ? (
                            <img
                              src={primaryPhoto}
                              alt={item.first_address || "Listing"}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-muted-foreground/60">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          )}
                          {Array.isArray(item.images) && item.images.length > 0 && (
                            <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-[9px] font-mono px-1 py-0.2 rounded text-white">
                              {item.images.length}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Address & MLS ID */}
                      <TableCell className="py-2.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground text-xs leading-snug">
                              {item.first_address || "Unspecified Address"}
                            </span>
                            <a
                              href={`https://mattsmithrealestategroup.com/featured-listings/?propertyId=${item.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-muted-foreground hover:text-gold transition-colors inline-flex items-center"
                              title="View on public website"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                            <span>
                              {item.city}, {item.state} {item.zip}
                            </span>
                            <span className="text-border">•</span>
                            <span className="font-mono text-gold/90">MLS #{item.listing_number}</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Price */}
                      <TableCell className="py-2.5">
                        <div className="space-y-0.5">
                          <div className="font-bold text-xs text-foreground">
                            ${Number(item.price || 0).toLocaleString()}
                          </div>
                          {hasReduction && (
                            <div className="text-[10px] text-rose-400/90 line-through">
                              ${Number(item.old_price).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Beds / Baths / Sqft */}
                      <TableCell className="py-2.5">
                        {isLand ? (
                          <div className="text-xs text-muted-foreground font-medium">
                            {item.lot_acres ? `${item.lot_acres} Acres` : "Lot / Land"}
                          </div>
                        ) : (
                          <div className="text-xs text-foreground font-medium">
                            <span>{item.bedrooms ?? "—"} bd</span>
                            <span className="text-muted-foreground mx-1">/</span>
                            <span>{item.bathrooms ?? "—"} ba</span>
                            {item.sqft ? (
                              <>
                                <span className="text-muted-foreground mx-1">/</span>
                                <span className="text-muted-foreground">
                                  {Number(item.sqft).toLocaleString()} sqft
                                </span>
                              </>
                            ) : null}
                          </div>
                        )}
                      </TableCell>

                      {/* Type & Label */}
                      <TableCell className="py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-semibold ${
                              isLand
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            }`}
                          >
                            {item.property_type || "Residential"}
                          </Badge>
                          {item.label && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                item.label.toLowerCase().includes("reduced") ||
                                item.label.toLowerCase().includes("price")
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  : "bg-surface-2 text-muted-foreground border-border/70"
                              }`}
                            >
                              {item.label}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Feed Status & Missing Warnings */}
                      <TableCell className="py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.excluded ? (
                            <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/25">
                              Excluded
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/25">
                              In Feed
                            </Badge>
                          )}

                          {missingFields.length > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1"
                              title={`Missing: ${missingFields.join(", ")}`}
                            >
                              <AlertTriangle className="h-2.5 w-2.5" />
                              <span>{missingFields.length} missing</span>
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Exclude Toggle */}
                      <TableCell className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={!item.excluded}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({
                                id: item.id,
                                excluded: !checked,
                              })
                            }
                            aria-label="Toggle inclusion in Meta feed"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ─── Sync History Modal ─── */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-lg bg-surface-1 border-border/80 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <History className="h-4 w-4 text-gold" />
              <span>Catalog Sync Runs History</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Past runs of the automated 5:00 AM CT scheduled sync and manual triggers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 max-h-96 overflow-y-auto">
            {isHistoryLoading ? (
              <div className="py-8 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-gold" />
                <span>Loading sync history...</span>
              </div>
            ) : syncHistory.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                No sync runs recorded yet.
              </div>
            ) : (
              syncHistory.map((run: any) => {
                const hasErrors = Array.isArray(run.errors) && run.errors.length > 0;
                return (
                  <div
                    key={run.id}
                    className="p-3 rounded-xl bg-surface-2/60 border border-border/70 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {hasErrors ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className="font-semibold text-foreground">
                          {format(new Date(run.run_time), "MMM d, yyyy h:mm:ss a")}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-[11px] pl-5.5">
                        Listings returned: <strong className="text-foreground">{run.listing_count}</strong>
                      </div>
                      {hasErrors && (
                        <div className="pl-5.5 pt-1 text-rose-400 font-mono text-[10px] space-y-0.5">
                          {run.errors.map((err: string, i: number) => (
                            <div key={i}>• {err}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        hasErrors
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {hasErrors ? "Errors" : "Success"}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
