import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PRIORITIES, PRIORITY_BORDER, PRIORITY_LABEL, VIDEO_STAGES, VIDEO_STAGE_LABEL, type VideoStage, type Priority } from "@/lib/content";
import { ChatThread } from "@/components/chat-thread";
import { Plus, AlertTriangle, Calendar, Send, Link2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/videos")({
  component: VideosPage,
  head: () => ({ meta: [{ title: "Video Pipeline — Matt Smith Real Estate Group Content Hub" }] }),
});

type VideoType = "horizontal" | "reel";
type Brand = "MSREG" | "AON";

interface Video {
  id: string;
  title: string;
  drive_link: string | null;
  estimated_publish_date: string | null;
  publish_at: string | null;
  linked_content_item_id: string | null;
  filmed_by: string | null;
  edited_by: string | null;
  duration: string | null;
  campaign_tag: string | null;
  priority: Priority;
  stage: VideoStage;
  video_type: VideoType;
  brand: Brand;
}

const REEL_STAGES: VideoStage[] = ["ready_to_edit", "ready_to_post"];

const BRAND_STYLES: Record<Brand, string> = {
  MSREG: "bg-gold/15 text-gold border-gold/40",
  AON: "bg-sky-500/15 text-sky-400 border-sky-500/40",
};

function BrandBadge({ brand }: { brand: Brand }) {
  return (
    <span className={cn("inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border", BRAND_STYLES[brand])}>
      {brand}
    </span>
  );
}

function VideosPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState<Video | null>(null);
  const [creatingType, setCreatingType] = useState<VideoType | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [brandFilter, setBrandFilter] = useState<"all" | Brand>("all");
  const [showHorizontal, setShowHorizontal] = useState(true);
  const [showReels, setShowReels] = useState(true);
  const [dateSort, setDateSort] = useState<"none" | "soonest" | "latest">("soonest");
  const [dueWithin, setDueWithin] = useState<"all" | "2" | "7" | "30" | "overdue">("all");

  const { data: videos = [] } = useQuery({
    queryKey: ["videos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("videos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Video[];
    },
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: VideoStage }) => {
      const { error } = await (supabase as any).from("videos").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["videos"] }),
    onError: (e: any) => toast.error(e.message ?? "Move failed"),
  });

  const makeDragHandler = (allowed: VideoStage[]) => (e: DragEndEvent) => {
    const id = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId?.startsWith("stage|")) return;
    const [, scope, stageRaw] = overId.split("|");
    const stage = stageRaw as VideoStage;
    if (!allowed.includes(stage)) return;
    const v = videos.find((x) => x.id === id);
    if (!v || v.stage === stage) return;
    // Prevent cross-pipeline drops
    if (scope === "horizontal" && v.video_type !== "horizontal") return;
    if (scope === "reel" && v.video_type !== "reel") return;
    moveStage.mutate({ id, stage });
  };

  const filtered = useMemo(() => {
    const now = Date.now();
    const dayMs = 86400000;
    const liveOf = (v: Video) => v.publish_at ?? v.estimated_publish_date ?? null;
    let list = videos.filter((v) => brandFilter === "all" || v.brand === brandFilter);
    if (dueWithin !== "all") {
      list = list.filter((v) => {
        const d = liveOf(v);
        if (!d) return false;
        const diff = new Date(d).getTime() - now;
        if (dueWithin === "overdue") return diff < 0;
        const days = Number(dueWithin);
        return diff >= 0 && diff <= days * dayMs;
      });
    }
    if (dateSort !== "none") {
      list = [...list].sort((a, b) => {
        const da = liveOf(a);
        const db = liveOf(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        const ta = new Date(da).getTime();
        const tb = new Date(db).getTime();
        return dateSort === "soonest" ? ta - tb : tb - ta;
      });
    }
    return list;
  }, [videos, brandFilter, dueWithin, dateSort]);
  const horizontal = filtered.filter((v) => v.video_type === "horizontal");
  const reels = filtered.filter((v) => v.video_type === "reel");

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
      <header className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Video Pipeline</h1>
          <p className="text-sm text-muted-foreground">Drag cards across stages. Push ready videos to the calendar.</p>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5 p-3 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Brand</Label>
          <Select value={brandFilter} onValueChange={(v) => setBrandFilter(v as any)}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              <SelectItem value="MSREG">MSREG only</SelectItem>
              <SelectItem value="AON">AON only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="h-6 w-px bg-border" />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={showHorizontal} onCheckedChange={(v) => setShowHorizontal(!!v)} />
          Horizontal
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={showReels} onCheckedChange={(v) => setShowReels(!!v)} />
          Reels
        </label>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Live date</Label>
          <Select value={dueWithin} onValueChange={(v) => setDueWithin(v as any)}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any date</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="2">Due in 2 days</SelectItem>
              <SelectItem value="7">Due in 7 days</SelectItem>
              <SelectItem value="30">Due in 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateSort} onValueChange={(v) => setDateSort(v as any)}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="soonest">Soonest first</SelectItem>
              <SelectItem value="latest">Latest first</SelectItem>
              <SelectItem value="none">No sort</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Horizontal pipeline */}
      {showHorizontal && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Horizontal Video</h2>
              <span className="text-xs text-muted-foreground">({horizontal.length})</span>
            </div>
            <Button size="sm" onClick={() => setCreatingType("horizontal")} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Plus className="h-4 w-4 mr-1" /> New Video
            </Button>
          </div>
          <DndContext sensors={sensors} onDragEnd={makeDragHandler(VIDEO_STAGES as unknown as VideoStage[])}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {VIDEO_STAGES.map((s) => (
                <StageColumn
                  key={s}
                  scope="horizontal"
                  stage={s}
                  videos={horizontal.filter((v) => v.stage === s)}
                  onOpen={setEditing}
                />
              ))}
            </div>
          </DndContext>
        </section>
      )}

      {/* Reels pipeline */}
      {showReels && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Short-Form Reels</h2>
              <span className="text-xs text-muted-foreground">({reels.length})</span>
            </div>
            <Button size="sm" onClick={() => setCreatingType("reel")} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Plus className="h-4 w-4 mr-1" /> New Reel
            </Button>
          </div>
          <DndContext sensors={sensors} onDragEnd={makeDragHandler(REEL_STAGES)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {REEL_STAGES.map((s) => (
                <StageColumn
                  key={s}
                  scope="reel"
                  stage={s}
                  videos={reels.filter((v) => v.stage === s)}
                  onOpen={setEditing}
                  isReel
                />
              ))}
            </div>
          </DndContext>
        </section>
      )}

      {(editing || creatingType) && (
        <VideoFormDialog
          key={editing?.id ?? `new-${creatingType}`}
          video={editing}
          defaultType={creatingType ?? "horizontal"}
          open={!!editing || !!creatingType}
          onOpenChange={(o) => { if (!o) { setEditing(null); setCreatingType(null); } }}
          currentUserId={user?.id ?? null}
        />
      )}
    </div>
  );
}

function StageColumn({ scope, stage, videos, onOpen, isReel }: {
  scope: "horizontal" | "reel"; stage: VideoStage; videos: Video[]; onOpen: (v: Video) => void; isReel?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage|${scope}|${stage}` });
  return (
    <div ref={setNodeRef} className={cn(
      "bg-card border border-border rounded-xl p-3 min-h-[240px] flex flex-col",
      isOver && "ring-1 ring-gold/60 bg-gold/5",
    )}>
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-semibold text-sm">{VIDEO_STAGE_LABEL[stage]}</h3>
        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{videos.length}</span>
      </div>
      <div className="space-y-2 flex-1">
        {videos.map((v) => <VideoCard key={v.id} video={v} onOpen={() => onOpen(v)} isReel={isReel} />)}
        {videos.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Drop {isReel ? "reels" : "videos"} here</div>}
      </div>
    </div>
  );
}

function urgencyFor(video: Video) {
  const live = video.publish_at ?? video.estimated_publish_date;
  if (!live) return { level: "none" as const, card: "", badge: "", label: "" };
  const diff = new Date(live).getTime() - Date.now();
  const day = 86400000;
  if (diff < 0) return { level: "overdue" as const, card: "border-destructive/70 bg-destructive/10", badge: "bg-destructive/20 text-destructive border-destructive/40", label: "Overdue" };
  if (diff <= 2 * day) return { level: "urgent" as const, card: "border-destructive/60 bg-destructive/5", badge: "bg-destructive/15 text-destructive border-destructive/40", label: "Due ≤2d" };
  if (diff <= 7 * day) return { level: "soon" as const, card: "border-amber-500/60 bg-amber-500/5", badge: "bg-amber-500/15 text-amber-500 border-amber-500/40", label: "Due ≤7d" };
  return { level: "ok" as const, card: "border-emerald-500/40", badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30", label: "On track" };
}

function VideoCard({ video, onOpen, isReel }: { video: Video; onOpen: () => void; isReel?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({ id: video.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;
  const urgency = urgencyFor(video);
  const liveDate = video.publish_at ?? video.estimated_publish_date;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className={cn(
        "bg-background border rounded-md p-2.5 text-sm cursor-pointer hover:border-gold/40 border-border",
        PRIORITY_BORDER[video.priority],
        urgency.card,
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium truncate flex-1">{video.title}</div>
        <BrandBadge brand={video.brand} />
      </div>
      <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
        {isReel && video.drive_link && (
          <div className="flex items-center gap-1 truncate">
            <Link2 className="h-3 w-3" /> <span className="truncate">{video.drive_link}</span>
          </div>
        )}
        {liveDate && (
          <div className="flex items-center gap-1 flex-wrap">
            {urgency.level === "overdue" && <AlertTriangle className="h-3 w-3 text-destructive" />}
            <Calendar className="h-3 w-3" /> {format(new Date(liveDate), "MMM d, yyyy")}
            {urgency.level !== "none" && urgency.level !== "ok" && (
              <span className={cn("inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded border", urgency.badge)}>
                {urgency.label}
              </span>
            )}
          </div>
        )}
        {video.campaign_tag && <div>🏷 {video.campaign_tag}</div>}
        <div className="capitalize text-[10px]">{PRIORITY_LABEL[video.priority]}</div>
      </div>
    </div>
  );
}

interface FormProps {
  video: Video | null;
  defaultType: VideoType;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentUserId: string | null;
}

function VideoFormDialog({ video, defaultType, open, onOpenChange, currentUserId }: FormProps) {
  const qc = useQueryClient();
  const [pushOpen, setPushOpen] = useState(false);
  const initialType: VideoType = video?.video_type ?? defaultType;
  const initialStage: VideoStage = video?.stage ?? (initialType === "reel" ? "ready_to_edit" : "idea");
  const toLocalInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const [form, setForm] = useState({
    title: video?.title ?? "",
    drive_link: video?.drive_link ?? "",
    estimated_publish_date: video?.estimated_publish_date ?? "",
    publish_at: toLocalInput(video?.publish_at ?? null),
    filmed_by: video?.filmed_by ?? "",
    edited_by: video?.edited_by ?? "",
    duration: video?.duration ?? "",
    campaign_tag: video?.campaign_tag ?? "",
    priority: (video?.priority ?? "normal") as Priority,
    stage: initialStage,
    video_type: initialType,
    brand: (video?.brand ?? "MSREG") as Brand,
  });

  const isReel = form.video_type === "reel";
  const stageOptions = isReel ? REEL_STAGES : (VIDEO_STAGES as unknown as VideoStage[]);
  const isReadyToPost = form.stage === "ready_to_post";

  // Map video brand (MSREG/AON) to content_items.brand
  const mapBrandForContent = (b: Brand): "LOZ" | "PP" | "AON" | "MSREG ALL" =>
    b === "AON" ? "AON" : "MSREG ALL";

  const save = useMutation({
    mutationFn: async () => {
      const publishIso = form.publish_at ? new Date(form.publish_at).toISOString() : null;
      const payload: any = {
        title: form.title.trim(),
        drive_link: form.drive_link || null,
        estimated_publish_date: isReel ? null : (form.estimated_publish_date || null),
        publish_at: publishIso,
        filmed_by: isReel ? null : (form.filmed_by || null),
        edited_by: isReel ? null : (form.edited_by || null),
        duration: isReel ? null : (form.duration || null),
        campaign_tag: form.campaign_tag || null,
        priority: form.priority,
        stage: form.stage,
        video_type: form.video_type,
        brand: form.brand,
      };

      let videoId = video?.id ?? null;
      let linkedId = video?.linked_content_item_id ?? null;
      if (video) {
        const { error } = await (supabase as any).from("videos").update(payload).eq("id", video.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("videos")
          .insert({ ...payload, created_by: currentUserId }).select("id").single();
        if (error) throw error;
        videoId = data?.id ?? null;
      }

      // Auto-sync to calendar: only when stage is Ready to Publish AND a publish date is set
      if (videoId && form.stage === "ready_to_post" && publishIso) {
        const contentPayload = {
          title: form.title.trim(),
          link: form.drive_link || null,
          priority: form.priority,
          brand: mapBrandForContent(form.brand),
          status: "draft" as const,
          scheduled_at: publishIso,
          platforms: [] as string[],
          created_by: currentUserId,
        };
        if (linkedId) {
          const { error: upErr } = await (supabase as any).from("content_items")
            .update({
              title: contentPayload.title,
              link: contentPayload.link,
              priority: contentPayload.priority,
              brand: contentPayload.brand,
              scheduled_at: contentPayload.scheduled_at,
            }).eq("id", linkedId);
          // If row was deleted, fall back to insert
          if (upErr) {
            const { data: ins, error: insErr } = await (supabase as any).from("content_items")
              .insert(contentPayload).select("id").single();
            if (insErr) throw insErr;
            linkedId = ins?.id ?? null;
            await (supabase as any).from("videos").update({ linked_content_item_id: linkedId }).eq("id", videoId);
          }
        } else {
          const { data: ins, error: insErr } = await (supabase as any).from("content_items")
            .insert(contentPayload).select("id").single();
          if (insErr) throw insErr;
          linkedId = ins?.id ?? null;
          await (supabase as any).from("videos").update({ linked_content_item_id: linkedId }).eq("id", videoId);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["videos"] });
      qc.invalidateQueries({ queryKey: ["content-items"] });
      qc.invalidateQueries({ queryKey: ["content-items-list"] });
      toast.success(form.stage === "ready_to_post" && form.publish_at
        ? "Saved — mirrored to calendar"
        : "Saved");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!video) return;
      const { error } = await (supabase as any).from("videos").delete().eq("id", video.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["videos"] });
      onOpenChange(false);
    },
  });

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {video ? "Edit" : "New"} {isReel ? "Reel" : "Video"}
            <Badge variant="outline" className={cn("text-[10px]", BRAND_STYLES[form.brand])}>{form.brand}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select
                value={form.video_type}
                onValueChange={(v) => {
                  const t = v as VideoType;
                  setForm((f) => ({
                    ...f,
                    video_type: t,
                    stage: t === "reel" && !REEL_STAGES.includes(f.stage) ? "ready_to_edit" : f.stage,
                  }));
                }}
              >
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Horizontal Video</SelectItem>
                  <SelectItem value="reel">Short-Form Reel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Brand</Label>
              <Select value={form.brand} onValueChange={(v) => setForm({ ...form, brand: v as Brand })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MSREG">MSREG</SelectItem>
                  <SelectItem value="AON">AON (All Or Nothing)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label>{isReel ? "Source / Drive Link" : "Google Drive Link"}</Label>
            <Input value={form.drive_link} onChange={(e) => setForm({ ...form, drive_link: e.target.value })}
              placeholder={isReel ? "Zoom recording, raw footage, etc." : "https://drive.google.com/..."} className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {!isReel && (
              <>
                <div>
                  <Label>Estimated Publish Date</Label>
                  <Input type="date" value={form.estimated_publish_date} onChange={(e) => setForm({ ...form, estimated_publish_date: e.target.value })} className="mt-1.5" />
                </div>
                <div>
                  <Label>Duration</Label>
                  <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 1:30" className="mt-1.5" />
                </div>
                <div>
                  <Label>Filmed by</Label>
                  <Input value={form.filmed_by} onChange={(e) => setForm({ ...form, filmed_by: e.target.value })} className="mt-1.5" />
                </div>
                <div>
                  <Label>Editor</Label>
                  <Input value={form.edited_by} onChange={(e) => setForm({ ...form, edited_by: e.target.value })} className="mt-1.5" />
                </div>
              </>
            )}
            <div>
              <Label>{isReel ? "Brand Tag / Campaign" : "Listing / Campaign Tag"}</Label>
              <Input value={form.campaign_tag} onChange={(e) => setForm({ ...form, campaign_tag: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as VideoStage })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{stageOptions.map((s) => <SelectItem key={s} value={s}>{VIDEO_STAGE_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isReadyToPost && (
              <div className="col-span-2 rounded-md border border-gold/30 bg-gold/5 p-3">
                <Label className="text-xs flex items-center gap-1.5 text-gold"><Calendar className="h-3.5 w-3.5" /> Publish date &amp; time</Label>
                <Input
                  type="datetime-local"
                  value={form.publish_at}
                  step={900}
                  onChange={(e) => setForm({ ...form, publish_at: e.target.value })}
                  className="mt-1.5"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {video?.linked_content_item_id
                    ? "Saving will update the linked calendar item."
                    : form.publish_at
                      ? "Saving will automatically create a matching content calendar item."
                      : "Add a date & time to auto-create a calendar item."}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
            <div>
              {video && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm("Delete this video?")) del.mutate(); }}>
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {video && form.stage === "ready_to_post" && (
                <Button onClick={() => setPushOpen(true)} variant="outline">
                  <Send className="h-4 w-4 mr-1.5" /> Push to Calendar
                </Button>
              )}
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim()} className="bg-gold text-gold-foreground hover:bg-gold/90">
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>

          {video && <ChatThread parentId={video.id} kind="video" />}
        </div>
      </DialogContent>
    </Dialog>

    {video && pushOpen && (
      <PushToCalendarDialog video={{ ...video, ...form }} open={pushOpen} onOpenChange={setPushOpen}
        onPushed={() => { setPushOpen(false); onOpenChange(false); }} currentUserId={currentUserId} />
    )}
    </>
  );
}

function PushToCalendarDialog({ video, open, onOpenChange, onPushed, currentUserId }: {
  video: Video; open: boolean; onOpenChange: (o: boolean) => void; onPushed: () => void; currentUserId: string | null;
}) {
  const qc = useQueryClient();
  const now = new Date(); now.setMinutes(Math.round(now.getMinutes() / 15) * 15, 0, 0);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [when, setWhen] = useState(local);

  const push = useMutation({
    mutationFn: async () => {
      const scheduled = new Date(when);
      scheduled.setMinutes(Math.round(scheduled.getMinutes() / 15) * 15, 0, 0);
      const mappedBrand: "LOZ" | "PP" | "AON" | "MSREG ALL" =
        video.brand === "AON" ? "AON" : "MSREG ALL";
      const { error } = await (supabase as any).from("content_items").insert({
        title: `[${video.brand}] ${video.title}`,
        link: video.drive_link,
        priority: video.priority,
        brand: mappedBrand,
        platforms: [],
        status: "scheduled",
        scheduled_at: scheduled.toISOString(),
        created_by: currentUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-items"] });
      toast.success("Pushed to calendar");
      onPushed();
    },
    onError: (e: any) => toast.error(e.message ?? "Push failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Push to Calendar</DialogTitle></DialogHeader>
        <div>
          <Label>Schedule date &amp; time</Label>
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} step={900} className="mt-1.5" />
          <p className="text-[11px] text-muted-foreground mt-1.5">Will snap to 15-minute increment.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => push.mutate()} disabled={push.isPending} className="bg-gold text-gold-foreground hover:bg-gold/90">
            {push.isPending ? "Pushing…" : "Push to Calendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
