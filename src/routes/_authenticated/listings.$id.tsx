import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
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
import { format, addDays } from "date-fns";
import {
  Home, ArrowLeft, Pencil, Check, X, Loader2, Upload, Trash2,
  Image as ImageIcon, CalendarClock, AlertTriangle, RefreshCw,
  Archive, Download, Plus, Calendar, ExternalLink, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Listing, type ListingGraphic, type ListingCopy, type ListingPost,
  type ListingStatus, type PostType,
  LISTING_STATUS_LABEL, LISTING_STATUS_CLASS,
  POST_TYPE_LABEL, POST_TYPE_CLASS,
  POST_STATUS_LABEL, POST_STATUS_CLASS,
  calcDaysListed, formatPrice,
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
} from "@/lib/listings.functions";

export const Route = createFileRoute("/_authenticated/listings/$id")({
  component: ListingDetailPage,
  head: () => ({ meta: [{ title: "Listing Detail — MSREG Marketing Hub" }] }),
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
      const { data } = await sb
        .from("listing_copy")
        .select("*")
        .eq("listing_id", id)
        .single();
      return data as ListingCopy | null;
    },
  });

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
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/listings" className="hover:text-gold transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Listings
        </Link>
        <span>/</span>
        <span className="text-foreground truncate max-w-[300px]">{listing.address}</span>
      </div>

      {/* Header card */}
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
          <Home className="h-6 w-6 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{listing.address}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={cn("px-2 py-0.5 rounded text-xs font-medium border", LISTING_STATUS_CLASS[listing.status])}>
              {LISTING_STATUS_LABEL[listing.status]}
            </span>
            {listing.agent_name && (
              <span className="text-muted-foreground text-sm">{listing.agent_name}</span>
            )}
            <span className="text-muted-foreground text-sm">{calcDaysListed(listing.list_date)} days on market</span>
          </div>
        </div>
        {canManage && listing.status === "active" && (
          <div className="shrink-0">
            <MarkUnderContractButton listingId={listing.id} userId={userId} onSuccess={invalidateAll} />
          </div>
        )}
      </div>

      {/* Section 1: Listing Info */}
      <ListingInfoSection listing={listing} canManage={canManage} onSaved={invalidateAll} />

      {/* Section 2: Graphics & Copy */}
      <GraphicsCopySection
        listingId={id}
        userId={userId}
        graphics={graphics}
        copyData={copyData ?? null}
        canManage={canManage}
        onGraphicsChanged={() => qc.invalidateQueries({ queryKey: ["listing-graphics", id] })}
        onCopyChanged={() => qc.invalidateQueries({ queryKey: ["listing-copy", id] })}
      />

      {/* Section 3: Scheduled Posts */}
      <PostsSection
        listing={listing}
        userId={userId}
        posts={posts}
        graphics={graphics}
        canManage={canManage}
        onChanged={() => qc.invalidateQueries({ queryKey: ["listing-posts", id] })}
      />

      {/* Section 4: Actions */}
      {canManage && (
        <ActionsSection
          listing={listing}
          userId={userId}
          graphics={graphics}
          copyData={copyData ?? null}
          onArchived={() => navigate({ to: "/listings" })}
          onGraphicsRefresh={() => qc.invalidateQueries({ queryKey: ["listing-graphics", id] })}
        />
      )}
    </div>
  );
}

// ─── Mark Under Contract ──────────────────────────────────────────────────────

function MarkUnderContractButton({
  listingId, userId, onSuccess,
}: { listingId: string; userId: string; onSuccess: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const mut = useMutation({
    mutationFn: () => markUnderContract(sb, userId, listingId),
    onSuccess: (result) => {
      toast.success(
        `${result.cancelledCount} future repost${result.cancelledCount !== 1 ? "s" : ""} cancelled. A task has been created for the content coordinator.`
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
                Cancel all future 60/90/120-day repost posts
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                Create a to-do task for the content coordinator to send the Under Contract graphic to the agent
              </li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={mut.isPending}>Cancel</Button>
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
  listing, canManage, onSaved,
}: { listing: Listing; canManage: boolean; onSaved: () => void }) {
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
  });

  const mut = useMutation({
    mutationFn: () =>
      updateListing(sb, listing.id, {
        address: form.address.trim() || undefined,
        agent_name: form.agent_name.trim() || null,
        mls_id: form.mls_id.trim() || null,
        list_price: form.list_price ? parseFloat(form.list_price) : null,
        list_date: form.list_date || undefined,
        post_date: form.post_date || undefined,
        post_time: form.post_time ? form.post_time + ":00" : undefined,
        status: form.status,
        canva_link: form.canva_link.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Listing updated");
      setEditing(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Home className="h-4 w-4 text-gold" />
        <h2 className="font-semibold">Listing Info</h2>
        {canManage && !editing && (
          <Button variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
        {editing && (
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={mut.isPending}>
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}
              className="bg-gold hover:bg-gold/90 text-navy font-semibold">
              {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="p-4 grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 grid gap-1.5">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Agent Name</Label>
            <Input value={form.agent_name} onChange={(e) => set("agent_name", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>MLS #</Label>
            <Input value={form.mls_id} onChange={(e) => set("mls_id", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>List Price</Label>
            <Input type="number" value={form.list_price} onChange={(e) => set("list_price", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>List Date</Label>
            <Input type="date" value={form.list_date} onChange={(e) => set("list_date", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Post Date</Label>
            <Input type="date" value={form.post_date} onChange={(e) => set("post_date", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Post Time</Label>
            <Input type="time" value={form.post_time} onChange={(e) => set("post_time", e.target.value)} />
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
          <div className="sm:col-span-2 grid gap-1.5">
            <Label>Canva Link</Label>
            <div className="relative">
              <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="https://www.canva.com/design/…"
                value={form.canva_link}
                onChange={(e) => set("canva_link", e.target.value)}
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
          <InfoField label="List Date" value={format(new Date(listing.list_date + "T00:00:00"), "MMMM d, yyyy")} />
          <InfoField label="Days on Market" value={`${calcDaysListed(listing.list_date)} days`} />
          {listing.post_date && (
            <InfoField
              label="Post Date/Time"
              value={`${format(new Date(listing.post_date + "T00:00:00"), "MMM d, yyyy")} @ ${listing.post_time?.slice(0, 5) ?? "09:00"}`}
            />
          )}
          {listing.canva_link && (
            <div className="sm:col-span-2 space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Canva Link</p>
              <a
                href={listing.canva_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gold hover:underline flex items-center gap-1.5 truncate"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{listing.canva_link}</span>
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function InfoField({ label, value, className, mono }: { label: string; value: string; className?: string; mono?: boolean }) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn("text-sm font-medium", mono && "font-mono")}>{value}</p>
    </div>
  );
}

// ─── Graphics & Copy Section ──────────────────────────────────────────────────

function GraphicsCopySection({
  listingId, userId, graphics, copyData, canManage, onGraphicsChanged, onCopyChanged,
}: {
  listingId: string;
  userId: string;
  graphics: ListingGraphic[];
  copyData: ListingCopy | null;
  canManage: boolean;
  onGraphicsChanged: () => void;
  onCopyChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [copyText, setCopyText] = useState(copyData?.social_media_copy ?? "");
  const [copySaving, setCopySaving] = useState(false);

  // Sync copy text when data reloads
  const prevCopyRef = useRef(copyData?.social_media_copy ?? "");
  if ((copyData?.social_media_copy ?? "") !== prevCopyRef.current) {
    prevCopyRef.current = copyData?.social_media_copy ?? "";
    setCopyText(copyData?.social_media_copy ?? "");
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `listings/${listingId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false, cacheControl: "3600" });
        if (upErr) throw upErr;
        const { data: urlData } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
        const url = urlData?.signedUrl as string;
        await sb.from("listing_graphics").insert({ listing_id: listingId, image_url: url, label: file.name });
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
      await saveListingCopy(sb, listingId, copyText);
      toast.success("Copy saved");
      onCopyChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCopySaving(false);
    }
  };

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <ImageIcon className="h-4 w-4 text-gold" />
        <h2 className="font-semibold">Graphics &amp; Copy</h2>
      </div>

      <div className="p-4 space-y-5">
        {/* Graphics */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Listing Graphics</Label>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                Upload
              </Button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => handleUpload(e.target.files)} />

          {graphics.length === 0 ? (
            canManage ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-gold/50 hover:bg-gold/5 transition-colors group"
              >
                <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2 group-hover:text-gold/60 transition-colors" />
                <p className="text-sm text-muted-foreground">Drop images here or click to upload</p>
                <p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG, WEBP supported</p>
              </button>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No graphics uploaded yet.</p>
            )
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {graphics.map((g) => (
                <div key={g.id} className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                  <img src={g.image_url} alt={g.label ?? "listing graphic"} className="w-full h-full object-cover" />
                  {canManage && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={() => deleteGraphic(g)}
                        className="p-1.5 bg-rose-500/80 rounded-md text-white hover:bg-rose-500">
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
            <Label>Social Media Copy</Label>
            {canManage && (
              <Button variant="outline" size="sm" onClick={handleSaveCopy} disabled={copySaving}>
                {copySaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
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
            className={cn("text-sm", !canManage && "opacity-70 cursor-default")}
          />
        </div>
      </div>
    </section>
  );
}

// ─── Posts Section ────────────────────────────────────────────────────────────

function PostsSection({
  listing, userId, posts, graphics, canManage, onChanged,
}: {
  listing: Listing; userId: string; posts: ListingPost[];
  graphics: ListingGraphic[]; canManage: boolean; onChanged: () => void;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);

  const cancelPost = useMutation({
    mutationFn: (post: ListingPost) => cancelListingPost(sb, post.id, post.calendar_entry_id),
    onSuccess: () => { toast.success("Post cancelled"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const existingRepostTypes = new Set(
    posts.filter((p) => p.post_type.startsWith("repost")).map((p) => p.post_type)
  );

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <CalendarClock className="h-4 w-4 text-gold" />
        <h2 className="font-semibold">Scheduled Posts</h2>
        {canManage && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAutoOpen(true)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> 60/90/120-Day Reposts
            </Button>
            <Button variant="outline" size="sm" onClick={() => setManualOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Schedule Post
            </Button>
          </div>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="p-10 text-center">
          <CalendarClock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No posts scheduled yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Post Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id} className="border-border">
                  <TableCell className="text-sm">
                    {format(new Date(post.scheduled_date + "T00:00:00"), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium border", POST_TYPE_CLASS[post.post_type])}>
                      {POST_TYPE_LABEL[post.post_type]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium border", POST_STATUS_CLASS[post.status])}>
                      {POST_STATUS_LABEL[post.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && post.status === "scheduled" && (
                      <Button
                        variant="ghost" size="sm"
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        onClick={() => cancelPost.mutate(post)}
                        disabled={cancelPost.isPending}
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
            open={manualOpen} listing={listing} userId={userId} graphics={graphics}
            onClose={() => setManualOpen(false)}
            onSuccess={() => { setManualOpen(false); onChanged(); }}
          />
          <AutoScheduleModal
            open={autoOpen} listing={listing} userId={userId} existingTypes={existingRepostTypes}
            onClose={() => setAutoOpen(false)}
            onSuccess={() => { setAutoOpen(false); onChanged(); }}
          />
        </>
      )}
    </section>
  );
}

// ─── Manual Post Modal ────────────────────────────────────────────────────────

function ManualPostModal({ open, listing, userId, graphics, onClose, onSuccess }: {
  open: boolean; listing: Listing; userId: string; graphics: ListingGraphic[];
  onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), graphicUrl: "", copy: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () => scheduleManualPost(sb, userId, {
      listing_id: listing.id, address: listing.address,
      scheduled_date: form.date, graphic_url: form.graphicUrl || null,
      copy: form.copy || null, canva_link: listing.canva_link,
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
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gold" /> Schedule Manual Post
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Post Date <span className="text-destructive">*</span></Label>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          {graphics.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Select Graphic <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={form.graphicUrl} onValueChange={(v) => set("graphicUrl", v)}>
                <SelectTrigger><SelectValue placeholder="Choose uploaded graphic…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No graphic</SelectItem>
                  {graphics.map((g) => (
                    <SelectItem key={g.id} value={g.image_url}>{g.label ?? g.image_url.split("/").pop()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.graphicUrl && (
                <img src={form.graphicUrl} alt="preview" className="w-32 h-32 object-cover rounded-md border border-border" />
              )}
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Copy <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea rows={3} placeholder="Social media caption…" value={form.copy} onChange={(e) => set("copy", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.date}
            className="bg-gold hover:bg-gold/90 text-navy font-semibold">
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Schedule Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Auto-Schedule Reposts Modal ──────────────────────────────────────────────

function AutoScheduleModal({ open, listing, userId, existingTypes, onClose, onSuccess }: {
  open: boolean; listing: Listing; userId: string; existingTypes: Set<string>;
  onClose: () => void; onSuccess: () => void;
}) {
  const mut = useMutation({
    mutationFn: () => autoScheduleReposts(
      sb, userId, listing.id, listing.address,
      listing.post_date ?? listing.list_date,
      listing.post_time?.slice(0, 5) ?? "09:00",
      listing.canva_link, null
    ),
    onSuccess: (result) => {
      if (result.created === 0) toast.info("All 60/90/120-day reposts are already scheduled.");
      else toast.success(`${result.created} repost${result.created !== 1 ? "s" : ""} scheduled in Content Calendar.`);
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const baseDate = listing.post_date ?? listing.list_date;
  const base = new Date(baseDate + "T00:00:00");
  const entries = [60, 90, 120].map((days) => {
    const type = `repost_${days}` as PostType;
    const d = addDays(base, days);
    return { days, type, date: format(d, "MMM d, yyyy"), exists: existingTypes.has(type) };
  });
  const newCount = entries.filter((e) => !e.exists).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-gold" /> Auto-Schedule Reposts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Creates 60, 90, and 120-day repost entries in the Content Calendar calculated from the listing's post date ({baseDate}). Existing entries are skipped.
          </p>
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.type} className={cn(
                "flex items-center justify-between rounded-lg border p-3",
                e.exists ? "border-border bg-muted/40 opacity-60" : "border-gold/30 bg-gold/5"
              )}>
                <div>
                  <p className="text-sm font-medium">{POST_TYPE_LABEL[e.type]}</p>
                  <p className="text-xs text-muted-foreground">{e.date} @ {listing.post_time?.slice(0, 5) ?? "09:00"}</p>
                </div>
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded border font-medium",
                  e.exists ? "bg-muted text-muted-foreground border-border" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                )}>
                  {e.exists ? "Already scheduled" : "Will create"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || newCount === 0}
            className="bg-gold hover:bg-gold/90 text-navy font-semibold">
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {newCount === 0 ? "All scheduled" : `Schedule ${newCount} Post${newCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Actions Section ──────────────────────────────────────────────────────────

function ActionsSection({
  listing, userId, graphics, copyData, onArchived, onGraphicsRefresh,
}: {
  listing: Listing; userId: string; graphics: ListingGraphic[];
  copyData: ListingCopy | null; onArchived: () => void; onGraphicsRefresh: () => void;
}) {
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [pushConfirm, setPushConfirm] = useState(false);

  const archiveMut = useMutation({
    mutationFn: () => archiveListing(sb, listing.id),
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
        address: listing.address,
        agent_name: listing.agent_name,
        graphics: graphics.map((g) => ({ image_url: g.image_url, label: g.label })),
        social_copy: copyData?.social_media_copy ?? null,
      }),
    onSuccess: () => {
      toast.success("Listing pushed to Agent Toolbox! Graphics and copy are now available for agents.", { duration: 5000 });
      setPushConfirm(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadAll = async () => {
    if (graphics.length === 0) { toast.error("No graphics to download"); return; }
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
      a.href = url; a.download = "listing-graphics.zip";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Downloaded ${graphics.length} graphic${graphics.length !== 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error("Download failed: " + e.message);
    }
  };

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <h2 className="font-semibold">Actions</h2>
      </div>
      <div className="p-4 space-y-4">
        {/* Push to Toolbox — prominent */}
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gold">Push to Agent Toolbox</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sends all {graphics.length} graphic{graphics.length !== 1 ? "s" : ""} and social copy to the Agent Marketing Toolbox so agents can access and download them.
            </p>
          </div>
          <Button
            className="bg-gold hover:bg-gold/90 text-navy font-semibold shrink-0"
            onClick={() => setPushConfirm(true)}
            disabled={graphics.length === 0 && !copyData?.social_media_copy}
          >
            <Send className="h-4 w-4 mr-2" /> Push to Toolbox
          </Button>
        </div>

        {/* Secondary actions */}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={downloadAll} disabled={graphics.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Download Graphics ({graphics.length})
          </Button>
          <Button
            variant="outline"
            className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
            onClick={() => setArchiveConfirm(true)}
          >
            <Archive className="h-4 w-4 mr-2" /> Archive Listing
          </Button>
        </div>
      </div>

      {/* Push to Toolbox confirm */}
      <Dialog open={pushConfirm} onOpenChange={setPushConfirm}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-gold" /> Push to Agent Toolbox?
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>This will create a new listing in the Agent Toolbox with:</p>
            <ul className="space-y-1 pl-3">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-gold shrink-0" />
                <strong>{listing.address}</strong> — {listing.agent_name ?? "No agent"}
              </li>
              {graphics.length > 0 && (
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-gold shrink-0" />
                  {graphics.length} graphic{graphics.length !== 1 ? "s" : ""} as pre-made assets
                </li>
              )}
              {copyData?.social_media_copy && (
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-gold shrink-0" />
                  Social media copy as a ready-to-use caption
                </li>
              )}
            </ul>
            <p className="text-xs mt-2">Agents will be able to access, copy, and download these directly from the Agent Toolbox.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPushConfirm(false)} disabled={pushMut.isPending}>Cancel</Button>
            <Button
              className="bg-gold hover:bg-gold/90 text-navy font-semibold"
              onClick={() => pushMut.mutate()}
              disabled={pushMut.isPending}
            >
              {pushMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Push to Toolbox
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirm */}
      <Dialog open={archiveConfirm} onOpenChange={setArchiveConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Archive this listing?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            The listing will be hidden from the main list. This does not delete any data.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveConfirm(false)} disabled={archiveMut.isPending}>Cancel</Button>
            <Button
              className="bg-rose-500 hover:bg-rose-600 text-white"
              onClick={() => archiveMut.mutate()}
              disabled={archiveMut.isPending}
            >
              {archiveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
