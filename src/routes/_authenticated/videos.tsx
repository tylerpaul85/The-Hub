import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  PRIORITIES,
  PRIORITY_BORDER,
  PRIORITY_LABEL,
  VIDEO_STAGES,
  VIDEO_STAGE_LABEL,
  type VideoStage,
  type Priority,
  type Brand,
  BRANDS,
  BRAND_STYLES,
} from "@/lib/content";
import { ChatThread } from "@/components/chat-thread";
import {
  Plus,
  AlertTriangle,
  Calendar,
  Send,
  Link2,
  Archive,
  Film,
  Video as VideoIcon,
  Smartphone,
  Clock,
  Camera,
  Scissors,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/videos")({
  component: VideosPage,
  head: () => ({ meta: [{ title: "Video Pipeline — MSREG Hub" }] }),
});

type VideoType = "horizontal" | "reel";

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
  is_listing: boolean;
  is_archived: boolean;
}

function BrandBadge({ brand }: { brand: Brand }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border shadow-2xs",
        BRAND_STYLES[brand],
      )}
    >
      {brand}
    </span>
  );
}

const STAGE_THEME: Record<
  VideoStage,
  { dot: string; headerBg: string; borderAccent: string; pill: string }
> = {
  backlog: {
    dot: "bg-slate-400",
    headerBg: "bg-slate-500/10",
    borderAccent: "border-t-slate-400",
    pill: "text-slate-400 border-slate-500/30",
  },
  idea: {
    dot: "bg-amber-400",
    headerBg: "bg-amber-500/10",
    borderAccent: "border-t-amber-400",
    pill: "text-amber-400 border-amber-500/30",
  },
  scheduled: {
    dot: "bg-sky-400",
    headerBg: "bg-sky-500/10",
    borderAccent: "border-t-sky-400",
    pill: "text-sky-400 border-sky-500/30",
  },
  ready_to_edit: {
    dot: "bg-indigo-400",
    headerBg: "bg-indigo-500/10",
    borderAccent: "border-t-indigo-400",
    pill: "text-indigo-400 border-indigo-500/30",
  },
  ready_to_post: {
    dot: "bg-emerald-400",
    headerBg: "bg-emerald-500/10",
    borderAccent: "border-t-emerald-400",
    pill: "text-emerald-400 border-emerald-500/30",
  },
  scheduled_post: {
    dot: "bg-purple-400",
    headerBg: "bg-purple-500/10",
    borderAccent: "border-t-purple-400",
    pill: "text-purple-400 border-purple-500/30",
  },
};

function VideosPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState<Video | null>(null);
  const [creatingListing, setCreatingListing] = useState<boolean | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [searchQuery, setSearchQuery] = useState("");
  const [pipelineView, setPipelineView] = useState<"all" | "listing" | "brand">("all");
  const [brandFilter, setBrandFilter] = useState<"all" | Brand>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "horizontal" | "reel">("all");
  const [dateSort, setDateSort] = useState<"none" | "soonest" | "latest">("soonest");
  const [dueWithin, setDueWithin] = useState<"all" | "2" | "7" | "30" | "overdue">("all");

  const { data: videos = [] } = useQuery({
    queryKey: ["videos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Video[];
    },
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stage, is_listing }: { id: string; stage: VideoStage; is_listing: boolean }) => {
      const { error } = await supabase.from("videos").update({ stage, is_listing } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["videos"] }),
    onError: (e: any) => toast.error(e.message ?? "Move failed"),
  });

  const handleDragEnd = (e: DragEndEvent) => {
    const id = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId) return;

    const parts = overId.split("|");
    if (parts.length !== 2) return;
    const [pipelineType, stageRaw] = parts;
    if (pipelineType !== "listing" && pipelineType !== "brand") return;

    const stage = stageRaw as VideoStage;
    if (!VIDEO_STAGES.includes(stage)) return;

    const v = videos.find((x) => x.id === id);
    const targetIsListing = pipelineType === "listing";

    if (!v || (v.stage === stage && v.is_listing === targetIsListing)) return;
    moveStage.mutate({ id, stage, is_listing: targetIsListing });
  };

  const filtered = useMemo(() => {
    const now = Date.now();
    const dayMs = 86400000;
    const liveOf = (v: Video) => v.publish_at ?? v.estimated_publish_date ?? null;
    let list = videos.filter((v) => {
      if (v.is_archived) return false;
      if (brandFilter !== "all" && v.brand !== brandFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = v.title.toLowerCase().includes(q);
        const matchesTag = v.campaign_tag?.toLowerCase().includes(q);
        const matchesFilmer = v.filmed_by?.toLowerCase().includes(q);
        const matchesEditor = v.edited_by?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesTag && !matchesFilmer && !matchesEditor) return false;
      }
      return true;
    });

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

    if (typeFilter !== "all") {
      list = list.filter((v) => v.video_type === typeFilter);
    }

    return list;
  }, [videos, brandFilter, dueWithin, dateSort, typeFilter, searchQuery]);

  // Production Metrics
  const activeVideos = videos.filter((v) => !v.is_archived);
  const preProdCount = activeVideos.filter(
    (v) => v.stage === "backlog" || v.stage === "idea" || v.stage === "scheduled",
  ).length;
  const inEditCount = activeVideos.filter((v) => v.stage === "ready_to_edit").length;
  const readyPublishCount = activeVideos.filter(
    (v) => v.stage === "ready_to_post" || v.stage === "scheduled_post",
  ).length;

  return (
    <div className="p-4 lg:p-8 max-w-[1700px] mx-auto space-y-6">
      <PageHeader
        title="Video Production Pipeline"
        description="Drag cuts across production stages. Track editor assignments, drive links, and push approved videos directly to the Content Calendar."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/videos-archive">
              <Button variant="outline" size="sm" className="h-9 border-border/80">
                <Archive className="w-4 h-4 mr-1.5 text-muted-foreground" />
                Archive
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreatingListing(false)}
              className="h-9 border-border/80 hover:border-gold/60"
            >
              <Plus className="h-4 w-4 mr-1.5 text-gold" />
              Brand Video
            </Button>
            <Button
              size="sm"
              onClick={() => setCreatingListing(true)}
              className="h-9 bg-gold text-navy font-semibold hover:bg-gold/90 shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Listing Video
            </Button>
          </div>
        }
      />

      {/* Production Health Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Total In Pipeline
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-foreground">
              {activeVideos.length}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-2 text-gold border border-border/60">
            <Film className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Pre-Production
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-sky-400">
              {preProdCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Camera className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              In Post / Edit
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-indigo-400">
              {inEditCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Scissors className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Ready / Scheduled
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-emerald-400">
              {readyPublishCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-card border border-border/80 rounded-xl shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, tag, crew…"
              className="h-9 pl-8 text-xs bg-surface-2 border-border/80"
            />
          </div>

          {/* Pipeline switcher */}
          <div className="flex items-center rounded-lg bg-surface-2 p-0.5 border border-border/70 text-xs">
            <button
              onClick={() => setPipelineView("all")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-all",
                pipelineView === "all"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All Tracks
            </button>
            <button
              onClick={() => setPipelineView("listing")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-all",
                pipelineView === "listing"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Listings ({videos.filter((v) => !v.is_archived && v.is_listing).length})
            </button>
            <button
              onClick={() => setPipelineView("brand")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-all",
                pipelineView === "brand"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Brand ({videos.filter((v) => !v.is_archived && !v.is_listing).length})
            </button>
          </div>

          <div className="h-5 w-px bg-border hidden sm:block" />

          {/* Brand Filter */}
          <Select value={brandFilter} onValueChange={(v) => setBrandFilter(v as any)}>
            <SelectTrigger className="h-9 w-32 text-xs bg-surface-2 border-border/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {BRANDS.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Video Type Filter */}
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="h-9 w-32 text-xs bg-surface-2 border-border/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Formats</SelectItem>
              <SelectItem value="horizontal">Horizontal (16:9)</SelectItem>
              <SelectItem value="reel">Reels (9:16)</SelectItem>
            </SelectContent>
          </Select>

          {/* Urgency Filter */}
          <Select value={dueWithin} onValueChange={(v) => setDueWithin(v as any)}>
            <SelectTrigger className="h-9 w-36 text-xs bg-surface-2 border-border/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Live Date</SelectItem>
              <SelectItem value="overdue">Overdue Only</SelectItem>
              <SelectItem value="2">Due in ≤ 2 Days</SelectItem>
              <SelectItem value="7">Due in ≤ 7 Days</SelectItem>
              <SelectItem value="30">Due in ≤ 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Select value={dateSort} onValueChange={(v) => setDateSort(v as any)}>
            <SelectTrigger className="h-9 w-36 text-xs bg-surface-2 border-border/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="soonest">Due Soonest First</SelectItem>
              <SelectItem value="latest">Latest First</SelectItem>
              <SelectItem value="none">Default Order</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {/* Listings Pipeline */}
        {(pipelineView === "all" || pipelineView === "listing") && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <Film className="h-4 w-4 text-gold" />
                  Listing Video Pipeline
                </h2>
                <Badge variant="outline" className="text-xs font-mono font-normal">
                  {filtered.filter((v) => v.is_listing).length} active
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCreatingListing(true)}
                className="text-xs text-gold hover:text-gold hover:bg-gold/10 h-8"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Listing Video
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
              {VIDEO_STAGES.map((s) => (
                <StageColumn
                  key={s}
                  stage={s}
                  pipelineType="listing"
                  videos={filtered.filter((v) => v.stage === s && v.is_listing)}
                  onOpen={setEditing}
                />
              ))}
            </div>
          </section>
        )}

        {/* Brand / Non-Listings Pipeline */}
        {(pipelineView === "all" || pipelineView === "brand") && (
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gold" />
                  Brand / Social Content Pipeline
                </h2>
                <Badge variant="outline" className="text-xs font-mono font-normal">
                  {filtered.filter((v) => !v.is_listing).length} active
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCreatingListing(false)}
                className="text-xs text-gold hover:text-gold hover:bg-gold/10 h-8"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Brand Video
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
              {VIDEO_STAGES.map((s) => (
                <StageColumn
                  key={s}
                  stage={s}
                  pipelineType="brand"
                  videos={filtered.filter((v) => v.stage === s && !v.is_listing)}
                  onOpen={setEditing}
                />
              ))}
            </div>
          </section>
        )}
      </DndContext>

      {(editing || creatingListing !== null) && (
        <VideoFormDialog
          key={editing?.id ?? `new-${creatingListing}`}
          video={editing}
          defaultIsListing={creatingListing ?? false}
          open={!!editing || creatingListing !== null}
          onOpenChange={(o) => {
            if (!o) {
              setEditing(null);
              setCreatingListing(null);
            }
          }}
          currentUserId={user?.id ?? null}
        />
      )}
    </div>
  );
}

function StageColumn({
  stage,
  videos,
  pipelineType,
  onOpen,
}: {
  stage: VideoStage;
  videos: Video[];
  pipelineType: "listing" | "brand";
  onOpen: (v: Video) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${pipelineType}|${stage}` });
  const theme = STAGE_THEME[stage];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-card/75 border border-border/80 border-t-2 rounded-xl p-3 min-h-[300px] flex flex-col transition-colors shadow-2xs",
        theme.borderAccent,
        isOver && "ring-2 ring-gold/60 bg-gold/5 border-gold/60",
      )}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", theme.dot)} />
          <h3 className="font-semibold text-xs tracking-tight text-foreground">
            {VIDEO_STAGE_LABEL[stage]}
          </h3>
        </div>
        <span
          className={cn(
            "text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border bg-surface-2",
            theme.pill,
          )}
        >
          {videos.length}
        </span>
      </div>

      <div className="space-y-2.5 flex-1">
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} onOpen={() => onOpen(v)} />
        ))}
        {videos.length === 0 && (
          <div className="h-28 flex flex-col items-center justify-center border border-dashed border-border/70 rounded-lg text-[11px] text-muted-foreground/70">
            <span>Drop cards here</span>
          </div>
        )}
      </div>
    </div>
  );
}

function urgencyFor(video: Video) {
  const live = video.publish_at ?? video.estimated_publish_date;
  if (!live) return { level: "none" as const, card: "", badge: "", label: "" };
  const diff = new Date(live).getTime() - Date.now();
  const day = 86400000;
  if (diff < 0)
    return {
      level: "overdue" as const,
      card: "border-destructive/70 bg-destructive/5",
      badge: "bg-destructive/20 text-destructive border-destructive/40",
      label: "Overdue",
    };
  if (diff <= 2 * day)
    return {
      level: "urgent" as const,
      card: "border-destructive/50 bg-destructive/5",
      badge: "bg-destructive/15 text-destructive border-destructive/30",
      label: "Due ≤2d",
    };
  if (diff <= 7 * day)
    return {
      level: "soon" as const,
      card: "border-amber-500/50 bg-amber-500/5",
      badge: "bg-amber-500/15 text-amber-500 border-amber-500/30",
      label: "Due ≤7d",
    };
  return {
    level: "ok" as const,
    card: "border-emerald-500/30",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    label: "On track",
  };
}

function VideoCard({
  video,
  onOpen,
}: {
  video: Video;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: video.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;
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
        "group relative bg-card border rounded-lg p-3 text-xs cursor-grab active:cursor-grabbing hover:border-gold/50 transition-all shadow-2xs hover:shadow-xs border-border/80",
        PRIORITY_BORDER[video.priority],
        urgency.card,
        isDragging && "opacity-40 scale-95 shadow-xl",
      )}
    >
      <div className="flex items-center justify-between gap-1 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <BrandBadge brand={video.brand} />
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border bg-surface-2 text-muted-foreground border-border/60">
            {video.video_type === "reel" ? (
              <>
                <Smartphone className="h-3 w-3 text-amber-400" /> Reel
              </>
            ) : (
              <>
                <VideoIcon className="h-3 w-3 text-sky-400" /> 16:9
              </>
            )}
          </span>
        </div>

        {video.duration && (
          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {video.duration}
          </span>
        )}
      </div>

      <div className="font-semibold text-foreground line-clamp-2 leading-snug">
        {video.title}
      </div>

      <div className="text-[11px] text-muted-foreground mt-2.5 space-y-1.5 pt-2 border-t border-border/50">
        {/* Drive link preview */}
        {video.drive_link && (
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1 text-gold truncate">
              <Link2 className="h-3 w-3 shrink-0" />
              <span className="truncate text-[10px]">Drive / Footage</span>
            </span>
            <a
              href={video.drive_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-gold p-0.5"
              title="Open link in new tab"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Crew pills */}
        {(video.filmed_by || video.edited_by) && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground truncate">
            {video.filmed_by && (
              <span className="truncate flex items-center gap-0.5">
                <Camera className="h-2.5 w-2.5 shrink-0 text-sky-400" />
                {video.filmed_by}
              </span>
            )}
            {video.edited_by && (
              <span className="truncate flex items-center gap-0.5">
                <Scissors className="h-2.5 w-2.5 shrink-0 text-indigo-400" />
                {video.edited_by}
              </span>
            )}
          </div>
        )}

        {/* Date & Urgency */}
        {liveDate && (
          <div className="flex items-center justify-between gap-1 flex-wrap pt-0.5">
            <span className="flex items-center gap-1 text-[10px]">
              {urgency.level === "overdue" && (
                <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
              )}
              <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
              {format(new Date(liveDate), "MMM d, yyyy")}
            </span>
            {urgency.level !== "none" && urgency.level !== "ok" && (
              <span
                className={cn(
                  "inline-flex items-center text-[9px] font-semibold px-1.5 py-0.2 rounded border",
                  urgency.badge,
                )}
              >
                {urgency.label}
              </span>
            )}
          </div>
        )}

        {/* Campaign & Priority bottom row */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
          {video.campaign_tag ? (
            <span className="truncate text-muted-foreground/90">🏷 {video.campaign_tag}</span>
          ) : (
            <span />
          )}
          <span className="capitalize font-mono text-[9px]">{PRIORITY_LABEL[video.priority]}</span>
        </div>
      </div>
    </div>
  );
}

interface FormProps {
  video: Video | null;
  defaultIsListing: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentUserId: string | null;
}

function VideoFormDialog({
  video,
  defaultIsListing,
  open,
  onOpenChange,
  currentUserId,
}: FormProps) {
  const qc = useQueryClient();
  const [pushOpen, setPushOpen] = useState(false);
  const initialType: VideoType = video?.video_type ?? "horizontal";
  const initialStage: VideoStage = video?.stage ?? "idea";
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
    brand: (video?.brand ?? "MSREG ALL") as Brand,
    is_listing: video?.is_listing ?? defaultIsListing,
    is_archived: video?.is_archived ?? false,
  });

  const isReel = form.video_type === "reel";
  const stageOptions = VIDEO_STAGES as unknown as VideoStage[];
  const isReadyToPost = form.stage === "ready_to_post" || form.stage === "scheduled_post";

  const save = useMutation({
    mutationFn: async () => {
      const publishIso = form.publish_at ? new Date(form.publish_at).toISOString() : null;
      const payload: any = {
        title: form.title.trim(),
        drive_link: form.drive_link || null,
        estimated_publish_date: isReel ? null : form.estimated_publish_date || null,
        publish_at: publishIso,
        filmed_by: isReel ? null : form.filmed_by || null,
        edited_by: isReel ? null : form.edited_by || null,
        duration: isReel ? null : form.duration || null,
        campaign_tag: form.campaign_tag || null,
        priority: form.priority,
        stage: form.stage,
        video_type: form.video_type,
        brand: form.brand,
        is_listing: form.is_listing,
        is_archived: form.is_archived,
      };

      let videoId = video?.id ?? null;
      let linkedId = video?.linked_content_item_id ?? null;
      if (video) {
        const { error } = await (supabase as any).from("videos").update(payload).eq("id", video.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("videos")
          .insert({ ...payload, created_by: currentUserId })
          .select("id")
          .single();
        if (error) throw error;
        videoId = data?.id ?? null;
      }

      // Auto-sync to calendar: only when stage is Ready to Publish/Scheduled AND a publish date is set
      if (videoId && (form.stage === "ready_to_post" || form.stage === "scheduled_post") && publishIso) {
        const contentPayload = {
          title: form.title.trim(),
          link: form.drive_link || null,
          priority: form.priority,
          brand: form.brand,
          status: "draft" as const,
          scheduled_at: publishIso,
          platforms: [] as string[],
          created_by: currentUserId,
        };
        if (linkedId) {
          const { error: upErr } = await (supabase as any)
            .from("content_items")
            .update({
              title: contentPayload.title,
              link: contentPayload.link,
              priority: contentPayload.priority,
              brand: contentPayload.brand,
              scheduled_at: contentPayload.scheduled_at,
            })
            .eq("id", linkedId);
          if (upErr) {
            const { data: ins, error: insErr } = await (supabase as any)
              .from("content_items")
              .insert(contentPayload)
              .select("id")
              .single();
            if (insErr) throw insErr;
            linkedId = ins?.id ?? null;
            await (supabase as any)
              .from("videos")
              .update({ linked_content_item_id: linkedId })
              .eq("id", videoId);
          }
        } else {
          const { data: ins, error: insErr } = await (supabase as any)
            .from("content_items")
            .insert(contentPayload)
            .select("id")
            .single();
          if (insErr) throw insErr;
          linkedId = ins?.id ?? null;
          await (supabase as any)
            .from("videos")
            .update({ linked_content_item_id: linkedId })
            .eq("id", videoId);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["videos"] });
      qc.invalidateQueries({ queryKey: ["content-items"] });
      qc.invalidateQueries({ queryKey: ["content-items-list"] });
      toast.success(
        form.stage === "ready_to_post" && form.publish_at
          ? "Saved — mirrored to calendar"
          : "Saved",
      );
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
              <Badge variant="outline" className={cn("text-[10px]", BRAND_STYLES[form.brand])}>
                {form.brand}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Format</Label>
                <Select
                  value={form.video_type}
                  onValueChange={(v) => setForm({ ...form, video_type: v as VideoType })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horizontal">Horizontal (16:9)</SelectItem>
                    <SelectItem value="reel">Short-Form Reel (9:16)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Track
                </Label>
                <div className="mt-1 flex items-center h-10 border border-input rounded-md px-3 bg-surface-2">
                  <label className="flex items-center gap-2 cursor-pointer w-full">
                    <Checkbox
                      checked={form.is_listing}
                      onCheckedChange={(c) => setForm({ ...form, is_listing: !!c })}
                    />
                    <span className="text-sm font-medium">Listing Video Track</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Brand
                </Label>
                <Select
                  value={form.brand}
                  onValueChange={(v) => setForm({ ...form, brand: v as Brand })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANDS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Linked Content Item
                </Label>
                <div className="mt-1">
                  {video?.linked_content_item_id ? (
                    <Button
                      variant="outline"
                      className="w-full text-left justify-start px-3 text-emerald-400 border-emerald-500/30"
                      disabled
                    >
                      <Link2 className="h-4 w-4 mr-2" /> Linked to Calendar
                    </Button>
                  ) : (
                    <div className="text-xs text-muted-foreground h-10 flex items-center px-3 border border-border/60 rounded-md bg-surface-2">
                      Not linked to calendar
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label>Video Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. 1428 Elm St — Cinematic Property Walkthrough"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>{isReel ? "Source / Footage / Drive Link" : "Google Drive Footage Link"}</Label>
              <Input
                value={form.drive_link}
                onChange={(e) => setForm({ ...form, drive_link: e.target.value })}
                placeholder={
                  isReel ? "Raw footage, Zoom recording, or Drive link" : "https://drive.google.com/..."
                }
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {!isReel && (
                <>
                  <div>
                    <Label>Estimated Publish Date</Label>
                    <Input
                      type="date"
                      value={form.estimated_publish_date}
                      onChange={(e) => setForm({ ...form, estimated_publish_date: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Duration</Label>
                    <Input
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: e.target.value })}
                      placeholder="e.g. 1:45"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Filmed by</Label>
                    <Input
                      value={form.filmed_by}
                      onChange={(e) => setForm({ ...form, filmed_by: e.target.value })}
                      placeholder="Videographer name"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Editor</Label>
                    <Input
                      value={form.edited_by}
                      onChange={(e) => setForm({ ...form, edited_by: e.target.value })}
                      placeholder="Editor name"
                      className="mt-1.5"
                    />
                  </div>
                </>
              )}
              <div>
                <Label>{isReel ? "Campaign / Series Tag" : "Listing / Campaign Tag"}</Label>
                <Input
                  value={form.campaign_tag}
                  onChange={(e) => setForm({ ...form, campaign_tag: e.target.value })}
                  placeholder="e.g. Community Spotlight, Price Drop"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v as Priority })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Pipeline Stage</Label>
                <Select
                  value={form.stage}
                  onValueChange={(v) => setForm({ ...form, stage: v as VideoStage })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stageOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {VIDEO_STAGE_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isReadyToPost && (
                <div className="col-span-2 rounded-xl border border-gold/40 bg-gold/5 p-3.5 space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5 text-gold font-semibold">
                    <Calendar className="h-3.5 w-3.5" /> Publish Date &amp; Time
                  </Label>
                  <Input
                    type="datetime-local"
                    value={form.publish_at}
                    step={900}
                    onChange={(e) => setForm({ ...form, publish_at: e.target.value })}
                    className="mt-1.5 bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {video?.linked_content_item_id
                      ? "Saving will update the linked calendar item."
                      : form.publish_at
                        ? "Saving will automatically create a matching Content Calendar item."
                        : "Select a date & time to auto-create a calendar item."}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-2">
              <div className="flex gap-2">
                {video && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm("Delete this video?")) del.mutate();
                    }}
                  >
                    Delete
                  </Button>
                )}
                {video && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const archiving = !form.is_archived;
                      const { error } = await supabase
                        .from("videos")
                        .update({ is_archived: archiving } as any)
                        .eq("id", video.id);

                      if (error) {
                        toast.error(error.message);
                        return;
                      }

                      toast.success(archiving ? "Video archived" : "Video unarchived");
                      qc.invalidateQueries({ queryKey: ["videos"] });
                      onOpenChange(false);
                    }}
                  >
                    {form.is_archived ? "Unarchive" : "Archive"}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {video && form.stage === "ready_to_post" && (
                  <Button
                    onClick={() => setPushOpen(true)}
                    variant="outline"
                    className="border-gold/40 text-gold hover:bg-gold/10"
                  >
                    <Send className="h-4 w-4 mr-1.5" /> Push to Calendar
                  </Button>
                )}
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending || !form.title.trim()}
                  className="bg-gold text-navy font-semibold hover:bg-gold/90"
                >
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </DialogFooter>

            {video && <ChatThread parentId={video.id} kind="video" />}
          </div>
        </DialogContent>
      </Dialog>

      {video && pushOpen && (
        <PushToCalendarDialog
          video={{ ...video, ...form }}
          open={pushOpen}
          onOpenChange={setPushOpen}
          onPushed={() => {
            setPushOpen(false);
            onOpenChange(false);
          }}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}

function PushToCalendarDialog({
  video,
  open,
  onOpenChange,
  onPushed,
  currentUserId,
}: {
  video: Video;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPushed: () => void;
  currentUserId: string | null;
}) {
  const qc = useQueryClient();
  const now = new Date();
  now.setMinutes(Math.round(now.getMinutes() / 15) * 15, 0, 0);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
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
        post_type: "video",
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
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-gold" /> Push to Content Calendar
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Schedule date &amp; time</Label>
            <Input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              step={900}
              className="mt-1.5"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Will automatically snap to 15-minute slot.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => push.mutate()}
            disabled={push.isPending}
            className="bg-gold text-navy font-semibold hover:bg-gold/90"
          >
            {push.isPending ? "Pushing…" : "Push to Calendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
