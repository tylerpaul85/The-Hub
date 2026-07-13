import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Home, Plus, Upload, ArrowUpDown, ArrowUp, ArrowDown,
  AlertTriangle, Loader2, ChevronRight, ExternalLink, Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Listing, type ListingStatus,
  LISTING_STATUS_LABEL, LISTING_STATUS_CLASS,
  calcDaysListed, formatPrice, parseCsvListings,
} from "@/lib/listings";
import { createListing, bulkImportListings } from "@/lib/listings.functions";

export const Route = createFileRoute("/_authenticated/listings/")({
  component: ListingsPage,
  head: () => ({ meta: [{ title: "Listings — MSREG Marketing Hub" }] }),
});

const sb = supabase as any;

type SortKey = "list_date" | "days_listed";
type SortDir = "asc" | "desc";

// ─── Page ─────────────────────────────────────────────────────────────────────

function ListingsPage() {
  const { user, isAdmin, canEditContent, roles } = useAuth();
  const canManage = isAdmin || canEditContent || roles.includes("marketing_coordinator" as any);
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<"all" | ListingStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("list_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["listings"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("listings")
        .select("*")
        .eq("archived", false)
        .order("list_date", { ascending: false });
      if (error) throw error;
      return data as Listing[];
    },
  });

  const filtered = useMemo(() => {
    let rows = listings;
    if (statusFilter !== "all") rows = rows.filter((l) => l.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (l) =>
          l.address.toLowerCase().includes(q) ||
          (l.agent_name ?? "").toLowerCase().includes(q) ||
          (l.mls_id ?? "").toLowerCase().includes(q)
      );
    }
    rows = [...rows].sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "days_listed") {
        av = calcDaysListed(a.list_date);
        bv = calcDaysListed(b.list_date);
      } else {
        av = new Date(a.list_date).getTime();
        bv = new Date(b.list_date).getTime();
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [listings, statusFilter, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 text-gold" />
      : <ArrowDown className="h-3.5 w-3.5 text-gold" />;
  };

  const counts = useMemo(() => ({
    all: listings.length,
    active: listings.filter((l) => l.status === "active").length,
    under_contract: listings.filter((l) => l.status === "under_contract").length,
    sold: listings.filter((l) => l.status === "sold").length,
  }), [listings]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="h-10 w-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center">
            <Home className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Listings</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage listing lifecycle, marketing, and scheduled posts.
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" /> Bulk Import
            </Button>
            <Button
              size="sm"
              className="bg-gold hover:bg-gold/90 text-navy font-semibold"
              onClick={() => setNewOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" /> New Listing
            </Button>
          </div>
        )}
      </header>

      {/* Filter + search bar */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
          {(["all", "active", "under_contract"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                statusFilter === s
                  ? "bg-gold/20 text-gold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "all" ? "All" : LISTING_STATUS_LABEL[s as ListingStatus]}
              <span className="ml-1.5 text-[10px] opacity-70">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Search address, agent, MLS…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Home className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {listings.length === 0
                ? "No listings yet. Add your first listing to get started."
                : "No listings match your current filters."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-semibold">Address</TableHead>
                <TableHead className="font-semibold">Agent</TableHead>
                <TableHead className="font-semibold">MLS #</TableHead>
                <TableHead className="font-semibold">Price</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead>
                  <button
                    className="flex items-center gap-1.5 font-semibold hover:text-foreground"
                    onClick={() => toggleSort("list_date")}
                  >
                    Date Listed <SortIcon k="list_date" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="flex items-center gap-1.5 font-semibold hover:text-foreground"
                    onClick={() => toggleSort("days_listed")}
                  >
                    Days Listed <SortIcon k="days_listed" />
                  </button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((listing) => (
                <TableRow key={listing.id} className="border-border hover:bg-accent/20 transition-colors">
                  <TableCell className="font-medium max-w-[220px]">
                    <Link
                      to="/listings/$id"
                      params={{ id: listing.id }}
                      className="hover:text-gold transition-colors line-clamp-2 leading-snug"
                    >
                      {listing.address}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {listing.agent_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {listing.mls_id ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatPrice(listing.list_price)}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border",
                      LISTING_STATUS_CLASS[listing.status]
                    )}>
                      {LISTING_STATUS_LABEL[listing.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(listing.list_date + "T00:00:00"), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {calcDaysListed(listing.list_date)} days
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to="/listings/$id" params={{ id: listing.id }}>
                      <Button variant="ghost" size="sm" className="gap-1.5">
                        View <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modals */}
      {canManage && (
        <>
          <NewListingModal
            open={newOpen}
            userId={user?.id ?? ""}
            onClose={() => setNewOpen(false)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["listings"] });
              setNewOpen(false);
            }}
          />
          <BulkImportModal
            open={importOpen}
            userId={user?.id ?? ""}
            onClose={() => setImportOpen(false)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["listings"] });
              setImportOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}

// ─── New Listing Modal ────────────────────────────────────────────────────────

function NewListingModal({
  open, userId, onClose, onSuccess,
}: { open: boolean; userId: string; onClose: () => void; onSuccess: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    address: "",
    agent_name: "",
    mls_id: "",
    list_price: "",
    list_date: today,
    post_date: today,
    post_time: "09:00",
    status: "active" as ListingStatus,
    canva_link: "",
    website_link: "",
    brand: "MSREG ALL",
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.address.trim()) throw new Error("Address is required");
      if (!form.list_date) throw new Error("List date is required");
      if (!form.post_date) throw new Error("Post date is required");
      await createListing(sb, userId, {
        address: form.address.trim(),
        agent_name: form.agent_name.trim() || null,
        mls_id: form.mls_id.trim() || null,
        list_price: form.list_price ? parseFloat(form.list_price) : null,
        list_date: form.list_date,
        post_date: form.post_date,
        post_time: form.post_time,
        status: form.status,
        canva_link: form.canva_link.trim() || null,
        website_link: form.website_link.trim() || null,
        brand: form.brand,
      });
    },
    onSuccess: () => {
      toast.success("Listing created! Just Listed + 60/90/120-day reposts scheduled.");
      setForm({
        address: "", agent_name: "", mls_id: "", list_price: "",
        list_date: today, post_date: today, post_time: "09:00",
        status: "active", canva_link: "", website_link: "", brand: "MSREG ALL",
      });
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create listing"),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-gold" /> New Listing
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Address */}
          <div className="grid gap-1.5">
            <Label htmlFor="nl-address">Address <span className="text-destructive">*</span></Label>
            <Input
              id="nl-address"
              placeholder="123 Main St, Rolla, MO 65401"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>

          {/* Agent */}
          <div className="grid gap-1.5">
            <Label htmlFor="nl-agent">Agent Name</Label>
            <Input
              id="nl-agent"
              placeholder="Agent full name"
              value={form.agent_name}
              onChange={(e) => set("agent_name", e.target.value)}
            />
          </div>

          {/* MLS + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nl-mls">MLS # <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="nl-mls"
                placeholder="12345"
                value={form.mls_id}
                onChange={(e) => set("mls_id", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nl-price">Listing Price</Label>
              <Input
                id="nl-price"
                type="number"
                placeholder="250000"
                value={form.list_price}
                onChange={(e) => set("list_price", e.target.value)}
              />
            </div>
          </div>

          {/* List date + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nl-list-date">List Date <span className="text-destructive">*</span></Label>
              <Input
                id="nl-list-date"
                type="date"
                value={form.list_date}
                onChange={(e) => set("list_date", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="under_contract">Under Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Brand select */}
          <div className="grid gap-1.5">
            <Label>Marketing Brand / Destination</Label>
            <Select value={form.brand} onValueChange={(v) => set("brand", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PP">PP (Premier Properties / Signature Brands)</SelectItem>
                <SelectItem value="LOZ">LOZ (Lake of the Ozarks)</SelectItem>
                <SelectItem value="MSREG ALL">MSREG ALL (Mike Thomas Group)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controls which calendar filters and social media groups this listing maps to.
            </p>
          </div>

          {/* Post Date + Time — the key scheduling fields */}
          <div className="rounded-lg border border-gold/25 bg-gold/5 p-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gold mb-0.5">📅 Listing Post Schedule</p>
              <p className="text-xs text-muted-foreground">
                When is this listing going live on social? The Just Listed, 60, 90, and 120-day reposts are all scheduled from this date and time.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="nl-post-date">Post Date <span className="text-destructive">*</span></Label>
                <Input
                  id="nl-post-date"
                  type="date"
                  value={form.post_date}
                  onChange={(e) => set("post_date", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nl-post-time">Post Time</Label>
                <Input
                  id="nl-post-time"
                  type="time"
                  value={form.post_time}
                  onChange={(e) => set("post_time", e.target.value)}
                />
              </div>
            </div>
            {form.post_date && (
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                {[60, 90, 120].map((d) => {
                  const dt = new Date(form.post_date + "T00:00:00");
                  dt.setDate(dt.getDate() + d);
                  return (
                    <div key={d}>
                      <span className="text-gold/80 font-medium">{d}-day repost:</span>{" "}
                      {dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} @ {form.post_time || "09:00"}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Canva link */}
          <div className="grid gap-1.5">
            <Label htmlFor="nl-canva" className="flex items-center gap-1.5">
              Canva Link <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <div className="relative">
              <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="nl-canva"
                className="pl-9"
                placeholder="https://www.canva.com/design/…"
                value={form.canva_link}
                onChange={(e) => set("canva_link", e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Will be auto-filled into all 60/90/120-day repost calendar entries.
            </p>
          </div>

          {/* MSREG Website Link */}
          <div className="grid gap-1.5">
            <Label htmlFor="nl-website" className="flex items-center gap-1.5">
              MSREG Website Link <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="nl-website"
                className="pl-9"
                placeholder="https://www.realtysignatures.com/properties/…"
                value={form.website_link}
                onChange={(e) => set("website_link", e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Will be auto-filled into all scheduled Content Calendar entries and pushed to the Agent Toolbox.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancel</Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="bg-gold hover:bg-gold/90 text-navy font-semibold"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Listing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk Import Modal ────────────────────────────────────────────────────────

const CSV_EXAMPLE = `Address,Agent,MLS #,Price,List Date,Status
123 Main St Rolla,Erik Kean,12345,250000,2026-06-01,Active
456 Oak Ave STR,Nicole Shaffer,12346,300000,2026-06-15,Active`;

function BulkImportModal({
  open, userId, onClose, onSuccess,
}: { open: boolean; userId: string; onClose: () => void; onSuccess: () => void }) {
  const [csv, setCsv] = useState("");
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [stage, setStage] = useState<"input" | "preview">("input");

  const parseAndPreview = () => {
    const result = parseCsvListings(csv);
    setParseErrors(result.errors);
    setPreview(result.valid);
    if (result.valid.length > 0) setStage("preview");
    else if (result.errors.length === 0) {
      toast.error("No valid rows found in the CSV.");
    }
  };

  const mut = useMutation({
    mutationFn: () => bulkImportListings(sb, userId, preview),
    onSuccess: (result) => {
      toast.success(
        `Imported ${result.imported} listing${result.imported !== 1 ? "s" : ""}${result.skipped > 0 ? `. Skipped ${result.skipped} duplicate${result.skipped !== 1 ? "s" : ""}.` : "."} Repost posts auto-scheduled.`
      );
      handleClose();
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message ?? "Import failed"),
  });

  const handleClose = () => {
    setCsv("");
    setPreview([]);
    setParseErrors([]);
    setStage("input");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-gold" /> Bulk Import Listings
          </DialogTitle>
        </DialogHeader>

        {stage === "input" ? (
          <>
            <div className="grid gap-3">
              <div>
                <Label>Paste CSV Data</Label>
                <p className="text-xs text-muted-foreground mb-2 mt-0.5">
                  Include a header row or paste raw data. Columns: Address, Agent, MLS #, Price, List Date, Status
                </p>
                <Textarea
                  rows={10}
                  placeholder={CSV_EXAMPLE}
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="rounded-lg border border-gold/20 bg-gold/5 p-3">
                <p className="text-xs font-semibold text-gold mb-1.5">Example format:</p>
                <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap">{CSV_EXAMPLE}</pre>
              </div>
              {parseErrors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 space-y-1">
                  {parseErrors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Row {e.row}: {e.message}
                    </p>
                  ))}
                  {parseErrors.length > 5 && (
                    <p className="text-xs text-muted-foreground">…and {parseErrors.length - 5} more errors</p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={parseAndPreview}
                disabled={!csv.trim()}
                className="bg-gold hover:bg-gold/90 text-navy font-semibold"
              >
                Parse &amp; Preview
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Preview — {preview.length} listing{preview.length !== 1 ? "s" : ""} ready to import
                </p>
                <Button variant="ghost" size="sm" onClick={() => setStage("input")}>
                  ← Edit CSV
                </Button>
              </div>
              {parseErrors.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-xs text-amber-400 font-medium mb-1">
                    {parseErrors.length} row{parseErrors.length !== 1 ? "s" : ""} had errors and will be skipped:
                  </p>
                  {parseErrors.slice(0, 3).map((e, i) => (
                    <p key={i} className="text-xs text-amber-300/80">Row {e.row}: {e.message}</p>
                  ))}
                </div>
              )}
              <div className="border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Address</TableHead>
                      <TableHead className="text-xs">Agent</TableHead>
                      <TableHead className="text-xs">MLS #</TableHead>
                      <TableHead className="text-xs">Price</TableHead>
                      <TableHead className="text-xs">List Date</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i} className="text-xs">
                        <TableCell className="py-2 max-w-[160px] truncate">{row.address}</TableCell>
                        <TableCell className="py-2">{row.agent_name ?? "—"}</TableCell>
                        <TableCell className="py-2 font-mono">{row.mls_id ?? "—"}</TableCell>
                        <TableCell className="py-2">{formatPrice(row.list_price)}</TableCell>
                        <TableCell className="py-2">{row.list_date}</TableCell>
                        <TableCell className="py-2">
                          <span className={cn("px-1.5 py-0.5 rounded border text-[10px]", LISTING_STATUS_CLASS[row.status as ListingStatus])}>
                            {LISTING_STATUS_LABEL[row.status as ListingStatus]}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Each listing will automatically have 60, 90, and 120-day repost posts scheduled in the Content Calendar.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={mut.isPending}>Cancel</Button>
              <Button
                onClick={() => mut.mutate()}
                disabled={mut.isPending || preview.length === 0}
                className="bg-gold hover:bg-gold/90 text-navy font-semibold"
              >
                {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Import {preview.length} Listing{preview.length !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
