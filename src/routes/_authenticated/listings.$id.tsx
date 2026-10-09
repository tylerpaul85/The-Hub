import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import {
  Home,
  ArrowLeft,
  Pencil,
  Check,
  X,
  Loader2,
  Upload,
  Trash2,
  Image as ImageIcon,
  CalendarClock,
  AlertTriangle,
  RefreshCw,
  Archive,
  Download,
  Plus,
  Calendar,
  ExternalLink,
  Send,
  Video,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Listing,
  type ListingGraphic,
  type ListingCopy,
  type ListingPost,
  type ListingVideo,
  type ListingStatus,
  type PostType,
  LISTING_STATUS_LABEL,
  LISTING_STATUS_CLASS,
  POST_TYPE_LABEL,
  POST_TYPE_CLASS,
  POST_STATUS_LABEL,
  POST_STATUS_CLASS,
  calcDaysListed,
  formatPrice,
} from "@/lib/listings";
import {
  updateListing,
  markUnderContract,
  archiveListing,
  scheduleManualPost,
  autoScheduleReposts,
  cancelListingPost,
  saveListingCopy,
  pushToToolbox,
  syncListingAssets,
} from "@/lib/listings.functions";

export const Route = createFileRoute("/_authenticated/listings/$id")({
  component: ListingDetailPage,
  head: () => ({ meta: [{ title: "Listing Detail — MSREG Hub" }] }),
});

const sb = supabase as any;
const BUCKET = "toolbox";

// ─── Page ─────────────────────────────────────────────────────────────────────

function ListingDetailPage() {
  const { id } = Route.useParams();
  const { user, isAdmin, canEditContent, roles } = useAuth();
  const userId = user?.id ?? "";
  const canManage = isAdmin || canEditContent || roles.includes("marketing_coordinator" as any);
  const navigate = useNavigate({ from: "/listings/$id" });
  const qc = useQueryClient();

  const { data: listing, isLoading: listingLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data, error } = await sb.from("listings").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Listing;
    },
  });

  const { data: graphics = [] } = useQuery({
    queryKey: ["listing-graphics", id],
    queryFn: async () => {
      const { data, error } = await sb
        .from("listing_graphics")
        .select("*")
        .eq("listing_id", id)
        .order("created_at");
      if (error) throw error;
      return data as ListingGraphic[];
    },
  });

  const { data: copyData } = useQuery({
    queryKey: ["listing-copy", id],
    queryFn: async () => {
      const { data } = await sb.from("listing_copy").select("*").eq("listing_id", id).single();
      return data as ListingCopy | null;
    },
  });

  const [copyText, setCopyText] = useState("");

  useEffect(() => {
    if (copyData) {
      setCopyText(copyData.social_media_copy ?? "");
    } else {
      setCopyText("");
    }
  }, [copyData]);

  const { data: posts = [] } = useQuery({
    queryKey: ["listing-posts", id],
    queryFn: async () => {
      const { data, error } = await sb
        .from("listing_posts")
        .select("*")
        .eq("listing_id", id)
        .order("scheduled_date");
      if (error) throw error;
      return data as ListingPost[];
    },
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["listing-videos", id],
    queryFn: async () => {
      const { data, error } = await sb
        .from("listing_videos")
        .select("*")
        .eq("listing_id", id)
        .order("created_at");
      if (error) {
        // table may not exist yet — return empty gracefully
        console.warn("[listing-videos]", error.message);
        return [] as ListingVideo[];
      }
      return data as ListingVideo[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["listing", id] });
    qc.invalidateQueries({ queryKey: ["listings"] });
    qc.invalidateQueries({ queryKey: ["listing-posts", id] });
  };

  if (listingLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="p-10 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Listing not found.</p>
        <Link to="/listings" className="text-gold hover:underline text-sm mt-2 inline-block">
          ← Back to Listings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 w-full min-w-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-muted min-w-0 flex-wrap">
        <Link to="/listings" className="hover:text-accent transition-colors flex items-center gap-1 shrink-0 font-medium">
          <ArrowLeft className="h-3.5 w-3.5" /> Listings
        </Link>
        <span className="shrink-0 opacity-50">/</span>
        <span className="text-text-primary font-semibold truncate min-w-0 max-w-[240px] sm:max-w-md">{listing.address}</span>
      </div>

      {/* Header card */}
      <div className="bg-surface-1 border border-border rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full min-w-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-12 w-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
            <Home className="h-6 w-6 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-serif font-bold text-text-primary truncate">{listing.address}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium border shrink-0",
                  LISTING_STATUS_CLASS[listing.status],
                )}
              >
                {LISTING_STATUS_LABEL[listing.status]}
              </span>
              {listing.agent_name && (
                <span className="text-text-secondary text-sm truncate">{listing.agent_name}</span>
              )}
              <span className="text-text-muted text-sm shrink-0">
                {calcDaysListed(listing.list_date)} days on market
              </span>
            </div>
          </div>
        </div>
        {canManage && listing.status === "active" && (
          <div className="shrink-0 w-full sm:w-auto">
            <MarkUnderContractButton
              listingId={listing.id}
              userId={userId}
              onSuccess={invalidateAll}
            />
          </div>
        )}
      </div>

      {/* Section 1: Listing Info */}
      <ListingInfoSection listing={listing} userId={userId} canManage={canManage} onSaved={invalidateAll} />

      {/* Section 2: Graphics & Copy */}
      <GraphicsCopySection
        listingId={id}
        userId={userId}
        graphics={graphics}
        copyText={copyText}
        setCopyText={setCopyText}
        canManage={canManage}
        canvaLink={listing.canva_link}
        onGraphicsChanged={() => qc.invalidateQueries({ queryKey: ["listing-graphics", id] })}
        onCopyChanged={() => qc.invalidateQueries({ queryKey: ["listing-copy", id] })}
        onCanvaLinkSaved={invalidateAll}
      />

      {/* Section 3: Listing Videos */}
      <VideosSection
        listingId={id}
        userId={userId}
        videos={videos}
        canManage={canManage}
        onChanged={() => qc.invalidateQueries({ queryKey: ["listing-videos", id] })}
      />

      {/* Section 4: Scheduled Posts */}
      <PostsSection
        listing={listing}
        userId={userId}
        posts={posts}
        graphics={graphics}
        canManage={canManage}
        onChanged={() => qc.invalidateQueries({ queryKey: ["listing-posts", id] })}
      />

      {/* Section 5: Version History */}
      <HistorySection listingId={id} />

      {/* Section 6: Actions */}
      {canManage && (
        <ActionsSection
          listing={listing}
          userId={userId}
          graphics={graphics}
          videos={videos}
          copyText={copyText}
          onArchived={() => navigate({ to: "/listings" })}
          onGraphicsRefresh={() => qc.invalidateQueries({ queryKey: ["listing-graphics", id] })}
        />
      )}
    </div>
  );
}

// ─── Mark Under Contract ──────────────────────────────────────────────────────

function MarkUnderContractButton({
  listingId,
  userId,
  onSuccess,
}: {
  listingId: string;
  userId: string;
  onSuccess: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const mut = useMutation({
    mutationFn: () => markUnderContract(sb, userId, listingId),
    onSuccess: (result) => {
      toast.success(
        `${result.cancelledCount} future repost${result.cancelledCount !== 1 ? "s" : ""} cancelled. A task has been created and assigned to Regine.`,
      );
      setConfirm(false);
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
        onClick={() => setConfirm(true)}
      >
        Under Contract
      </Button>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Mark as Under Contract?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>This will:</p>
            <ul className="space-y-1.5 pl-3">
              <li className="flex items-center gap-2">
                <X className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                Cancel all future 30/60/90-day repost posts
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                Create a to-do task assigned to Regine to send the Under Contract graphic
                to the agent
              </li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={mut.isPending}>
              Cancel
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
            >
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Listing Info Section ─────────────────────────────────────────────────────

function ListingInfoSection({
  listing,
  userId,
  canManage,
  onSaved,
}: {
  listing: Listing;
  userId: string;
  canManage: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    address: listing.address,
    agent_name: listing.agent_name ?? "",
    mls_id: listing.mls_id ?? "",
    list_price: listing.list_price?.toString() ?? "",
    list_date: listing.list_date,
    post_date: listing.post_date ?? listing.list_date,
    post_time: listing.post_time?.slice(0, 5) ?? "09:00",
    status: listing.status,
    canva_link: listing.canva_link ?? "",
    website_link: listing.website_link ?? "",
    brand: listing.brand ?? "MSREG ALL",
  });

  const mut = useMutation({
    mutationFn: () =>
      updateListing(sb, listing.id, userId, {
        address: form.address.trim() || undefined,
        agent_name: form.agent_name.trim() || null,
        mls_id: form.mls_id.trim() || null,
        list_price: form.list_price ? parseFloat(form.list_price) : null,
        list_date: form.list_date || undefined,
        post_date: form.post_date || undefined,
        post_time: form.post_time ? form.post_time + ":00" : undefined,
        status: form.status,
        canva_link: form.canva_link.trim() || null,
        website_link: form.website_link.trim() || null,
        brand: form.brand,
      }),
    onSuccess: () => {
      toast.success("Listing updated and calendar synced");
      setEditing(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <section className="bg-surface-1 border border-border rounded-xl overflow-hidden shadow-xs">
      <div className="flex items-center gap-2 p-4 border-b border-border bg-surface-2/40">
        <Home className="h-4 w-4 text-accent" />
        <h2 className="font-semibold text-text-primary text-base">Listing Info</h2>
        {canManage && !editing && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1.5 text-xs text-text-secondary hover:text-accent hover:bg-accent/10"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
        {editing && (
          <div className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={mut.isPending}
              className="text-text-muted hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
              className="bg-accent hover:bg-accent-hover text-white font-semibold text-xs"
            >
              {mut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1" />
              )}
              Save
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="p-4 grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 grid gap-1.5">
            <Label>Address</Label>
            <Input className="bg-surface-2 border-border" value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Agent Name</Label>
            <Input className="bg-surface-2 border-border" value={form.agent_name} onChange={(e) => set("agent_name", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>MLS #</Label>
            <Input className="bg-surface-2 border-border" value={form.mls_id} onChange={(e) => set("mls_id", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>List Price</Label>
            <Input
              type="number"
              className="bg-surface-2 border-border"
              value={form.list_price}
              onChange={(e) => set("list_price", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>List Date</Label>
            <Input
              type="date"
              className="bg-surface-2 border-border"
              value={form.list_date}
              onChange={(e) => set("list_date", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Post Date</Label>
            <Input
              type="date"
              className="bg-surface-2 border-border"
              value={form.post_date}
              onChange={(e) => set("post_date", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Post Time</Label>
            <Input
              type="time"
              className="bg-surface-2 border-border"
              value={form.post_time}
              onChange={(e) => set("post_time", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger className="bg-surface-2 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-1 border-border">
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="under_contract">Under Contract</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Marketing Brand / Destination</Label>
            <Select value={form.brand} onValueChange={(v) => set("brand", v)}>
              <SelectTrigger className="bg-surface-2 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-1 border-border">
                <SelectItem value="PP">PP</SelectItem>
                <SelectItem value="LOZ">LOZ</SelectItem>
                <SelectItem value="MSREG ALL">MSREG ALL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Canva Link</Label>
            <div className="relative">
              <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-9 text-sm bg-surface-2 border-border"
                placeholder="https://www.canva.com/design/…"
                value={form.canva_link}
                onChange={(e) => set("canva_link", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>MSREG Website Link</Label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-9 text-sm bg-surface-2 border-border"
                placeholder="https://www.realtysignatures.com/properties/…"
                value={form.website_link}
                onChange={(e) => set("website_link", e.target.value)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 grid sm:grid-cols-3 gap-4">
          <InfoField label="Address" value={listing.address} className="sm:col-span-2" />
          <InfoField label="Agent" value={listing.agent_name ?? "—"} />
          <InfoField label="MLS #" value={listing.mls_id ?? "—"} mono />
          <InfoField label="List Price" value={formatPrice(listing.list_price)} />
          <InfoField
            label="List Date"
            value={format(new Date(listing.list_date + "T00:00:00"), "MMMM d, yyyy")}
          />
          <InfoField label="Days on Market" value={`${calcDaysListed(listing.list_date)} days`} />
          {listing.post_date && (
            <InfoField
              label="Post Date/Time"
              value={`${format(new Date(listing.post_date + "T00:00:00"), "MMM d, yyyy")} @ ${listing.post_time?.slice(0, 5) ?? "09:00"}`}
            />
          )}
          <InfoField label="Marketing Brand" value={listing.brand ?? "MSREG ALL"} />
          {listing.canva_link && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Canva Link</p>
              <a
                href={listing.canva_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:underline flex items-center gap-1.5 truncate"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{listing.canva_link}</span>
              </a>
            </div>
          )}
          {listing.website_link && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                MSREG Website Link
              </p>
              <a
                href={listing.website_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:underline flex items-center gap-1.5 truncate"
              >
                <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{listing.website_link}</span>
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function InfoField({
  label,
  value,
  className,
  mono,
}: {
  label: string;
  value: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn("text-sm font-medium", mono && "font-mono")}>{value}</p>
    </div>
  );
}

// ─── Graphics & Copy Section ──────────────────────────────────────────────────

function GraphicsCopySection({
  listingId,
  userId,
  graphics,
  copyText,
  setCopyText,
  canManage,
  canvaLink,
  onGraphicsChanged,
  onCopyChanged,
  onCanvaLinkSaved,
}: {
  listingId: string;
  userId: string;
  graphics: ListingGraphic[];
  copyText: string;
  setCopyText: (v: string) => void;
  canManage: boolean;
  canvaLink: string | null;
  onGraphicsChanged: () => void;
  onCopyChanged: () => void;
  onCanvaLinkSaved: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [copySaving, setCopySaving] = useState(false);
  const [canvaValue, setCanvaValue] = useState(canvaLink ?? "");
  const [canvaSaving, setCanvaSaving] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `listings/${listingId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await sb.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false, cacheControl: "3600" });
        if (upErr) throw upErr;
        const { data: urlData } = await sb.storage
          .from(BUCKET)
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        const url = urlData?.signedUrl as string;
        await sb
          .from("listing_graphics")
          .insert({ listing_id: listingId, image_url: url, label: file.name });
      }
      toast.success(`${files.length} graphic${files.length > 1 ? "s" : ""} uploaded`);
      onGraphicsChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteGraphic = async (g: ListingGraphic) => {
    await sb.from("listing_graphics").delete().eq("id", g.id);
    onGraphicsChanged();
    toast.success("Graphic removed");
  };

  const handleSaveCopy = async () => {
    setCopySaving(true);
    try {
      await saveListingCopy(sb, listingId, userId, copyText);
      toast.success("Copy saved");
      onCopyChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCopySaving(false);
    }
  };

  const handleSaveCanva = async () => {
    setCanvaSaving(true);
    try {
      await updateListing(sb, listingId, userId, { canva_link: canvaValue.trim() || null });
      toast.success("Canva link saved");
      onCanvaLinkSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCanvaSaving(false);
    }
  };

  return (
    <section className="bg-surface-1 border border-border rounded-xl overflow-hidden shadow-xs">
      <div className="flex items-center gap-2 p-4 border-b border-border bg-surface-2/40">
        <ImageIcon className="h-4 w-4 text-accent" />
        <h2 className="font-semibold text-text-primary text-base">Graphics &amp; Copy</h2>
      </div>

      <div className="p-4 space-y-5">
        {/* ── Canva Link — always visible, easy to update ── */}
        <div className="rounded-lg border border-accent/30 bg-surface-2/60 p-3">
          <div className="flex items-center gap-2 mb-2">
            <ExternalLink className="h-3.5 w-3.5 text-accent" />
            <Label className="text-accent text-xs font-semibold uppercase tracking-wide">
              Canva Design Link
            </Label>
            {canvaLink && (
              <a
                href={canvaLink}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-accent hover:underline flex items-center gap-1 font-medium"
              >
                Open <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              className="flex-1 h-8 text-sm bg-surface-1 border-border"
              placeholder="https://www.canva.com/design/…"
              value={canvaValue}
              onChange={(e) => setCanvaValue(e.target.value)}
              readOnly={!canManage}
            />
            {canManage && (
              <Button
                size="sm"
                className="h-8 bg-accent hover:bg-accent-hover text-white font-semibold shrink-0"
                onClick={handleSaveCanva}
                disabled={canvaSaving}
              >
                {canvaSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Auto-filled into all 30/60/90-day repost calendar entries.
          </p>
        </div>

        {/* Graphics */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-text-primary font-medium">Listing Graphics</Label>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-xs border-border bg-surface-1"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                )}
                Upload
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />

          {graphics.length === 0 ? (
            canManage ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent/50 hover:bg-surface-2/40 transition-colors group cursor-pointer"
              >
                <Upload className="h-8 w-8 text-text-muted/40 mx-auto mb-2 group-hover:text-accent transition-colors" />
                <p className="text-sm text-text-secondary">Drop images here or click to upload</p>
                <p className="text-xs text-text-muted mt-1">PNG, JPG, WEBP supported</p>
              </button>
            ) : (
              <p className="text-sm text-text-muted text-center py-6">
                No graphics uploaded yet.
              </p>
            )
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {graphics.map((g) => (
                <div
                  key={g.id}
                  className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-surface-2"
                >
                  <img
                    src={g.image_url}
                    alt={g.label ?? "listing graphic"}
                    className="w-full h-full object-cover"
                  />
                  {canManage && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => deleteGraphic(g)}
                        className="p-1.5 bg-rose-500/80 rounded-md text-white hover:bg-rose-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {g.label && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                      <p className="text-[10px] text-white truncate">{g.label}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Social copy */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-text-primary font-medium">Social Media Copy</Label>
            {canManage && (
              <Button variant="outline" size="sm" onClick={handleSaveCopy} disabled={copySaving} className="text-xs border-border bg-surface-1">
                {copySaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1" />
                )}
                Save Copy
              </Button>
            )}
          </div>
          <Textarea
            rows={5}
            placeholder="Write the social media caption for this listing…"
            value={copyText}
            onChange={(e) => setCopyText(e.target.value)}
            readOnly={!canManage}
            className={cn("text-sm bg-surface-2 border-border", !canManage && "opacity-70 cursor-default")}
          />
        </div>
      </div>
    </section>
  );
}

// ─── Listing Videos Section ───────────────────────────────────────────────────

function VideosSection({
  listingId,
  userId,
  videos,
  canManage,
  onChanged,
}: {
  listingId: string;
  userId: string;
  videos: ListingVideo[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const addVideo = async () => {
    if (!url.trim()) return;
    setAdding(true);
    try {
      const { error } = await sb.from("listing_videos").insert({
        listing_id: listingId,
        drive_url: url.trim(),
        label: label.trim() || null,
        created_by: userId,
      });
      if (error) throw error;

      // Sync updated videos list to Content Calendar
      await syncListingAssets(sb, listingId);

      toast.success("Video link added & calendar synced");
      setUrl("");
      setLabel("");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add video");
    } finally {
      setAdding(false);
    }
  };

  const removeVideo = async (id: string) => {
    await sb.from("listing_videos").delete().eq("id", id);
    // Sync updated videos list to Content Calendar
    await syncListingAssets(sb, listingId);
    onChanged();
    toast.success("Video removed & calendar synced");
  };

  return (
    <section className="bg-surface-1 border border-border rounded-xl overflow-hidden shadow-xs">
      <div className="flex items-center gap-2 p-4 border-b border-border bg-surface-2/40">
        <Video className="h-4 w-4 text-accent" />
        <h2 className="font-semibold text-text-primary text-base">Listing Videos</h2>
        <span className="ml-auto text-xs text-text-muted">
          Google Drive, YouTube, or any video URL
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Existing videos */}
        {videos.length > 0 && (
          <div className="space-y-2">
            {videos.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2.5"
              >
                <Video className="h-4 w-4 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  {v.label && <p className="text-xs font-medium truncate text-text-primary">{v.label}</p>}
                  <a
                    href={v.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:underline flex items-center gap-1.5 truncate"
                  >
                    <LinkIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{v.drive_url}</span>
                  </a>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-text-muted hover:text-rose-400"
                    onClick={() => removeVideo(v.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new video */}
        {canManage && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                <Input
                  className="pl-9 text-sm bg-surface-2 border-border"
                  placeholder="Paste Google Drive or YouTube URL…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addVideo()}
                />
              </div>
              <Input
                className="text-sm w-36 shrink-0 bg-surface-2 border-border"
                placeholder="Label (optional)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <Button
                onClick={addVideo}
                disabled={!url.trim() || adding}
                className="bg-[var(--accent)] hover:opacity-90 text-white font-semibold shrink-0"
              >
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {videos.length === 0 && !canManage && (
          <p className="text-xs text-muted-foreground text-center py-4">No videos linked yet.</p>
        )}
      </div>
    </section>
  );
}

// ─── Posts Section ────────────────────────────────────────────────────────────

function PostsSection({
  listing,
  userId,
  posts,
  graphics,
  canManage,
  onChanged,
}: {
  listing: Listing;
  userId: string;
  posts: ListingPost[];
  graphics: ListingGraphic[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);

  const cancelPost = useMutation({
    mutationFn: (post: ListingPost) => cancelListingPost(sb, post.id, listing.id, userId, post.calendar_entry_id),
    onSuccess: () => {
      toast.success("Post cancelled");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const existingRepostTypes = new Set(
    posts.filter((p) => p.post_type.startsWith("repost")).map((p) => p.post_type),
  );

  return (
    <section className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border/60 bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Scheduled Posts</h2>
            <p className="text-[11px] text-muted-foreground">Automated and manual publishing timeline</p>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoOpen(true)}
              className="text-xs h-8 border-border hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-[var(--accent)]" /> 30/60/90-Day Reposts
            </Button>
            <Button
              size="sm"
              onClick={() => setManualOpen(true)}
              className="text-xs h-8 bg-[var(--accent)] hover:opacity-90 text-white font-medium"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Schedule Post
            </Button>
          </div>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="py-12 px-4 text-center">
          <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-2 text-muted-foreground">
            <CalendarClock className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-foreground">No posts scheduled yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">Use 30/60/90-Day Reposts or schedule a manual announcement.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 bg-muted/10 hover:bg-transparent">
                <TableHead className="text-xs font-semibold">Post Date</TableHead>
                <TableHead className="text-xs font-semibold">Type</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-right text-xs font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id} className="border-border/40 hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs font-medium text-foreground">
                    {format(new Date(post.scheduled_date + "T00:00:00"), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium border inline-flex items-center gap-1",
                        POST_TYPE_CLASS[post.post_type],
                      )}
                    >
                      {POST_TYPE_LABEL[post.post_type]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium border inline-flex items-center gap-1",
                        POST_STATUS_CLASS[post.status],
                      )}
                    >
                      {POST_STATUS_LABEL[post.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && post.status === "scheduled" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                        onClick={() => cancelPost.mutate(post)}
                        disabled={cancelPost.isPending}
                        title="Cancel scheduled post"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {canManage && (
        <>
          <ManualPostModal
            open={manualOpen}
            listing={listing}
            userId={userId}
            graphics={graphics}
            onClose={() => setManualOpen(false)}
            onSuccess={() => {
              setManualOpen(false);
              onChanged();
            }}
          />
          <AutoScheduleModal
            open={autoOpen}
            listing={listing}
            userId={userId}
            existingTypes={existingRepostTypes}
            onClose={() => setAutoOpen(false)}
            onSuccess={() => {
              setAutoOpen(false);
              onChanged();
            }}
          />
        </>
      )}
    </section>
  );
}

// ─── Manual Post Modal ────────────────────────────────────────────────────────

function ManualPostModal({
  open,
  listing,
  userId,
  graphics,
  onClose,
  onSuccess,
}: {
  open: boolean;
  listing: Listing;
  userId: string;
  graphics: ListingGraphic[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    graphicUrl: "",
    copy: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () =>
      scheduleManualPost(sb, userId, {
        listing_id: listing.id,
        address: listing.address,
        scheduled_date: form.date,
        graphic_url: form.graphicUrl || null,
        copy: form.copy || null,
        canva_link: listing.canva_link,
      }),
    onSuccess: () => {
      toast.success("Post scheduled and added to Content Calendar");
      setForm({ date: new Date().toISOString().slice(0, 10), graphicUrl: "", copy: "" });
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Calendar className="h-4 w-4 text-[var(--accent)]" /> Schedule Manual Post
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">
              Post Date <span className="text-destructive">*</span>
            </Label>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className="h-9 text-xs" />
          </div>
          {graphics.length > 0 && (
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">
                Select Graphic <span className="text-muted-foreground text-[11px] font-normal">(optional)</span>
              </Label>
              <Select value={form.graphicUrl} onValueChange={(v) => set("graphicUrl", v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choose uploaded graphic…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No graphic</SelectItem>
                  {graphics.map((g) => (
                    <SelectItem key={g.id} value={g.image_url}>
                      {g.label ?? g.image_url.split("/").pop()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.graphicUrl && (
                <img
                  src={form.graphicUrl}
                  alt="preview"
                  className="w-32 h-32 object-cover rounded-lg border border-border mt-1 shadow-sm"
                />
              )}
            </div>
          )}
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">
              Copy <span className="text-muted-foreground text-[11px] font-normal">(optional)</span>
            </Label>
            <Textarea
              rows={3}
              placeholder="Social media caption…"
              value={form.copy}
              onChange={(e) => set("copy", e.target.value)}
              className="text-xs leading-relaxed"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={mut.isPending} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.date}
            className="bg-[var(--accent)] hover:opacity-90 text-white font-medium text-xs shadow-sm"
          >
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Schedule Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Auto-Schedule Reposts Modal ──────────────────────────────────────────────

function AutoScheduleModal({
  open,
  listing,
  userId,
  existingTypes,
  onClose,
  onSuccess,
}: {
  open: boolean;
  listing: Listing;
  userId: string;
  existingTypes: Set<string>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () =>
      autoScheduleReposts(
        sb,
        userId,
        listing.id,
        listing.address,
        listing.post_date ?? listing.list_date,
        listing.post_time?.slice(0, 5) ?? "09:00",
        listing.canva_link,
        listing.website_link,
        listing.brand,
        null,
      ),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["content-items"] });
      qc.invalidateQueries({ queryKey: ["content-items-list"] });
      qc.invalidateQueries({ queryKey: ["listing-posts", listing.id] });
      if (result.created === 0) toast.info("All 30/60/90-day reposts are already scheduled.");
      else
        toast.success(
          `${result.created} repost${result.created !== 1 ? "s" : ""} scheduled in Content Calendar.`,
        );
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const baseDate = listing.post_date ?? listing.list_date;
  const base = new Date(baseDate + "T00:00:00");
  const entries = [30, 60, 90].map((days) => {
    const type = `repost_${days}` as PostType;
    const d = addDays(base, days);
    return { days, type, date: format(d, "MMM d, yyyy"), exists: existingTypes.has(type) };
  });
  const newCount = entries.filter((e) => !e.exists).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <RefreshCw className="h-4 w-4 text-[var(--accent)]" /> Auto-Schedule Reposts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Creates 30, 60, and 90-day repost entries in the Content Calendar calculated from the
            listing's post date ({baseDate}). Existing entries are preserved.
          </p>
          <div className="space-y-2">
            {entries.map((e) => (
              <div
                key={e.type}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 transition-colors",
                  e.exists ? "border-border/60 bg-muted/30 opacity-60" : "border-[var(--accent)]/30 bg-[var(--accent)]/5",
                )}
              >
                <div>
                  <p className="text-xs font-semibold text-foreground">{POST_TYPE_LABEL[e.type]}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {e.date} @ {listing.post_time?.slice(0, 5) ?? "09:00"}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                    e.exists
                      ? "bg-muted text-muted-foreground border-border"
                      : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                  )}
                >
                  {e.exists ? "Already scheduled" : "Will create"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={mut.isPending} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => mut.mutate()}
            disabled={mut.isPending || newCount === 0}
            className="bg-[var(--accent)] hover:opacity-90 text-white font-medium text-xs shadow-sm"
          >
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            {newCount === 0
              ? "All scheduled"
              : `Schedule ${newCount} Post${newCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Actions Section ──────────────────────────────────────────────────────────

function ActionsSection({
  listing,
  userId,
  graphics,
  videos,
  copyText,
  onArchived,
  onGraphicsRefresh,
}: {
  listing: Listing;
  userId: string;
  graphics: ListingGraphic[];
  videos: ListingVideo[];
  copyText: string;
  onArchived: () => void;
  onGraphicsRefresh: () => void;
}) {
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [pushConfirm, setPushConfirm] = useState(false);
  const qc = useQueryClient();

  const archiveMut = useMutation({
    mutationFn: () => archiveListing(sb, listing.id, userId),
    onSuccess: () => {
      toast.success("Listing archived");
      setArchiveConfirm(false);
      onArchived();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pushMut = useMutation({
    mutationFn: () =>
      pushToToolbox(sb, userId, {
        listing_id: listing.id,
        address: listing.address,
        agent_name: listing.agent_name,
        graphics: graphics.map((g) => ({ image_url: g.image_url, label: g.label })),
        videos: videos.map((v) => ({ drive_url: v.drive_url, label: v.label })),
        social_copy: copyText || null,
        website_link: listing.website_link || null,
      }),
    onSuccess: () => {
      toast.success(
        "Listing pushed to Agent Toolbox! Graphics, videos, and copy are now available for agents.",
        { duration: 5000 },
      );
      setPushConfirm(false);
      qc.invalidateQueries({ queryKey: ["listing-copy", listing.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadAll = async () => {
    if (graphics.length === 0) {
      toast.error("No graphics to download");
      return;
    }
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const folder = zip.folder("listing-graphics")!;
      for (const g of graphics) {
        const resp = await fetch(g.image_url, { credentials: "omit" });
        if (!resp.ok) continue;
        const blob = await resp.blob();
        folder.file(g.label ?? `graphic-${g.id}.jpg`, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "listing-graphics.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Downloaded ${graphics.length} graphic${graphics.length !== 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error("Download failed: " + e.message);
    }
  };

  const hasAssetsToPush = graphics.length > 0 || videos.length > 0 || !!copyText;

  return (
    <section className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-border/60 bg-muted/20">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Listing Distribution & Actions</h2>
        <p className="text-[11px] text-muted-foreground">Publish to agent portal or package media assets</p>
      </div>
      <div className="p-4 space-y-4">
        {/* Push to Toolbox — prominent */}
        <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              <p className="font-semibold text-sm text-[var(--accent)]">Push to Agent Toolbox</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Sends all {graphics.length} graphic{graphics.length !== 1 ? "s" : ""}, {videos.length}{" "}
              video{videos.length !== 1 ? "s" : ""}, and social copy to the Agent Marketing Toolbox
              so agents can self-serve and download them immediately.
            </p>
          </div>
          <Button
            className="bg-[var(--accent)] hover:opacity-90 text-white font-medium text-xs shrink-0 shadow-sm"
            onClick={() => setPushConfirm(true)}
            disabled={!hasAssetsToPush}
          >
            <Send className="h-3.5 w-3.5 mr-1.5" /> Push to Toolbox
          </Button>
        </div>

        {/* Secondary actions */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadAll}
            disabled={graphics.length === 0}
            className="text-xs h-8 border-border"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download Graphics ({graphics.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/50"
            onClick={() => setArchiveConfirm(true)}
          >
            <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive Listing
          </Button>
        </div>
      </div>

      {/* Push to Toolbox confirm */}
      <Dialog open={pushConfirm} onOpenChange={setPushConfirm}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Send className="h-4 w-4 text-[var(--accent)]" /> Push to Agent Toolbox?
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground space-y-2.5">
            <p>This will create a new listing entry in the Agent Toolbox with:</p>
            <ul className="space-y-1.5 pl-1">
              <li className="flex items-center gap-2 text-foreground font-medium">
                <Check className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                <span>{listing.address} — {listing.agent_name ?? "No agent assigned"}</span>
              </li>
              {graphics.length > 0 && (
                <li className="flex items-center gap-2 text-foreground">
                  <Check className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                  <span>{graphics.length} graphic{graphics.length !== 1 ? "s" : ""} as pre-made assets</span>
                </li>
              )}
              {videos.length > 0 && (
                <li className="flex items-center gap-2 text-foreground">
                  <Check className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                  <span>{videos.length} video{videos.length !== 1 ? "s" : ""} linked in Google Drive</span>
                </li>
              )}
              {copyText && (
                <li className="flex items-center gap-2 text-foreground">
                  <Check className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                  <span>Social media copy as a ready-to-use caption</span>
                </li>
              )}
            </ul>
            <p className="text-[11px] text-muted-foreground pt-1">
              Agents will be able to access, copy, and download these directly from their toolbox.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPushConfirm(false)}
              disabled={pushMut.isPending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-[var(--accent)] hover:opacity-90 text-white font-medium text-xs shadow-sm"
              onClick={() => pushMut.mutate()}
              disabled={pushMut.isPending}
            >
              {pushMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1.5" />
              )}
              Push to Toolbox
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirm */}
      <Dialog open={archiveConfirm} onOpenChange={setArchiveConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Archive this listing?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The listing will be hidden from the active workspace. This does not delete any uploaded assets or history.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setArchiveConfirm(false)}
              disabled={archiveMut.isPending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-rose-500 hover:bg-rose-600 text-white font-medium text-xs"
              onClick={() => archiveMut.mutate()}
              disabled={archiveMut.isPending}
            >
              {archiveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Archive Listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ─── Version History ──────────────────────────────────────────────────────────

function HistorySection({ listingId }: { listingId: string }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["listing-history", listingId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("listing_history")
        .select(`
          *,
          agent_accounts (
            first_name,
            last_name
          )
        `)
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.warn("[listing-history]", error.message);
        return [];
      }
      return data;
    },
  });

  return (
    <section className="bg-card rounded-xl border border-border/70 p-5 mb-8 shadow-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/60">
        <div className="h-7 w-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
          <CalendarClock className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Audit Log & Version History</h2>
          <p className="text-[11px] text-muted-foreground">Historical trail of changes and sync operations</p>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : history.length === 0 ? (
        <p className="text-xs text-muted-foreground p-4 border border-dashed border-border rounded-lg text-center">No history recorded yet.</p>
      ) : (
        <div className="space-y-4 pt-1">
          {history.map((event: any) => (
            <div key={event.id} className="flex gap-3 text-xs">
              <div className="mt-1 flex flex-col items-center">
                <div className="h-2 w-2 rounded-full bg-[var(--accent)] ring-4 ring-[var(--accent)]/15"></div>
                <div className="w-px h-full bg-border/60 mt-2" />
              </div>
              <div className="pb-3 flex-1 overflow-hidden">
                <p className="font-medium text-foreground">
                  {event.agent_accounts?.first_name 
                    ? `${event.agent_accounts.first_name} ${event.agent_accounts.last_name || ""}` 
                    : "System"}
                  {" "}
                  <span className="font-normal text-muted-foreground">
                    {formatActionType(event.action_type)}
                  </span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(new Date(event.created_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
                {event.changes && Object.keys(event.changes).length > 0 && (
                  <div className="mt-2 text-[11px] bg-muted/40 p-2.5 rounded-lg overflow-x-auto max-w-full border border-border/50 text-muted-foreground font-mono">
                    <pre className="leading-relaxed">{JSON.stringify(event.changes, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatActionType(action: string) {
  switch (action) {
    case "created": return "created the listing";
    case "updated": return "updated listing details";
    case "marked_under_contract": return "marked listing as Under Contract";
    case "archived": return "archived the listing";
    case "scheduled_manual_post": return "scheduled a manual post";
    case "auto_scheduled_reposts": return "auto-scheduled reposts";
    case "cancelled_post": return "cancelled a post";
    case "updated_copy": return "updated the social media copy";
    default: return action;
  }
}
