import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek, subMonths, subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, AlertTriangle, Archive, Download, Sparkles, Copy, X, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ContentItemForm } from "@/components/content-item-form";
import { CalendarListView } from "@/components/calendar-list-view";
import { useContentDetail } from "@/components/content-detail-provider";
import { HOURS, QUARTERS, SLOT_HEIGHT_PX, STATUS_CLASS, STATUS_LABEL, PRIORITY_BORDER, BRAND_STYLES, type ContentItem, type Status, type Brand } from "@/lib/content";
import { getHolidaysForDate, HOLIDAY_TYPE_CLASS } from "@/lib/holidays";
import { exportContentItems } from "@/lib/content-export";
import { CalendarAnalyzePanel } from "@/components/calendar-analyze-panel";
import { toast } from "sonner";

type ViewMode = "daily" | "weekly" | "monthly" | "list";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
  head: () => ({ meta: [{ title: "Calendar — Matt Smith Real Estate Group Content Hub" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    prefillTitle: typeof s.prefillTitle === "string" ? s.prefillTitle : undefined,
    prefillThumb: typeof s.prefillThumb === "string" ? s.prefillThumb : undefined,
    prefillPlatforms: typeof s.prefillPlatforms === "string" ? s.prefillPlatforms : undefined,
    prefillNotes: typeof s.prefillNotes === "string" ? s.prefillNotes : undefined,
  }),
});

const slotId = (d: Date) => `slot|${d.toISOString()}`;
const parseSlot = (id: string) => new Date(id.split("|")[1]);

function CalendarPage() {
  const { canEditContent } = useAuth();
  const qc = useQueryClient();
  const detail = useContentDetail();
  const navigate = useNavigate({ from: "/calendar" });
  const search = Route.useSearch();
  const [view, setView] = useState<ViewMode>("weekly");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [formOpen, setFormOpen] = useState(false);
  const [slotDate, setSlotDate] = useState<Date | null>(null);
  const [prefill, setPrefill] = useState<{ title?: string; thumbnail_url?: string; platforms?: string[]; notes?: string } | undefined>();
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [brandFilter, setBrandFilter] = useState<"all" | Brand>("all");
  const [hideReposts, setHideReposts] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Refetch calendar when the tab regains focus (replaces firehose realtime on content_items).
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        qc.invalidateQueries({ queryKey: ["content-items"] });
      }
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [qc]);



  useEffect(() => {
    if (search.prefillTitle || search.prefillThumb || search.prefillPlatforms || search.prefillNotes) {
      setPrefill({
        title: search.prefillTitle,
        thumbnail_url: search.prefillThumb,
        platforms: search.prefillPlatforms ? search.prefillPlatforms.split(",").filter(Boolean) : undefined,
        notes: search.prefillNotes,
      });
      setSlotDate(new Date());
      setFormOpen(true);
      navigate({ search: {}, replace: true });
    }
  }, [search.prefillTitle, search.prefillThumb, search.prefillPlatforms, search.prefillNotes, navigate]);

  const range = useMemo(() => {
    if (view === "daily") return { start: startOfDay(cursor), end: addDays(startOfDay(cursor), 1) };
    if (view === "weekly") {
      const start = startOfWeek(cursor, { weekStartsOn: 0 });
      return { start, end: addDays(start, 7) };
    }
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = addDays(endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }), 1);
    return { start, end };
  }, [view, cursor]);

  const { data: items = [] } = useQuery({
    queryKey: ["content-items", range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_items").select("*")
        .gte("scheduled_at", range.start.toISOString())
        .lt("scheduled_at", range.end.toISOString())
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContentItem[];
    },
  });

  const filteredItems = useMemo(
    () => items.filter((it) => {
      if (brandFilter !== "all" && (it.brand ?? "PP") !== brandFilter) {
        return false;
      }
      if (hideReposts) {
        const titleLower = (it.title ?? "").toLowerCase();
        if (titleLower.includes("60-day") || titleLower.includes("90-day") || titleLower.includes("120-day")) {
          return false;
        }
      }
      return true;
    }),
    [items, brandFilter, hideReposts],
  );


  const reschedule = useMutation({
    mutationFn: async ({ id, newDate }: { id: string; newDate: Date }) => {
      const { error } = await (supabase as any).from("content_items").update({ scheduled_at: newDate.toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-items"] });
      toast.success("Rescheduled");
    },
    onError: (e: any) => toast.error(e.message ?? "Update failed"),
  });

  const selectedItem = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);

  const duplicate = useMutation({
    mutationFn: async (src: ContentItem) => {
      const payload: any = {
        title: src.title,
        caption: src.caption ?? null,
        platforms: src.platforms ?? [],
        status: src.status,
        scheduled_at: src.scheduled_at,
        link: (src as any).link ?? null,
        priority: src.priority,
        notes: (src as any).notes ?? null,
        thumbnail_url: src.thumbnail_url ?? null,
        target_publish_date: (src as any).target_publish_date ?? null,
        created_by: (src as any).created_by ?? null,
        brand: src.brand ?? "PP",
      };
      const { data, error } = await (supabase as any).from("content_items").insert(payload).select("id").single();
      if (error) throw error;
      return data?.id as string | undefined;
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ["content-items"] });
      if (newId) setSelectedId(newId);
      toast.success("Duplicated — drag to reschedule");
    },
    onError: (e: any) => toast.error(e.message ?? "Duplicate failed"),
  });


  const handleDragEnd = (e: DragEndEvent) => {
    if (!canEditContent) return;
    const id = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId || !overId.startsWith("slot|")) return;
    const newDate = parseSlot(overId);
    const item = items.find((i) => i.id === id);
    if (!item) return;
    // preserve nothing - snap exactly to slot
    if (new Date(item.scheduled_at).getTime() === newDate.getTime()) return;
    reschedule.mutate({ id, newDate });
  };

  const goPrev = () => setCursor((c) => (view === "daily" ? addDays(c, -1) : view === "weekly" ? subWeeks(c, 1) : subMonths(c, 1)));
  const goNext = () => setCursor((c) => (view === "daily" ? addDays(c, 1) : view === "weekly" ? addWeeks(c, 1) : addMonths(c, 1)));
  const goToday = () => setCursor(startOfDay(new Date()));

  const openSlot = (d: Date) => {
    if (!canEditContent) return;
    setSlotDate(d); setFormOpen(true);
  };

  const title = view === "monthly" ? format(cursor, "MMMM yyyy")
    : view === "weekly" ? `${format(range.start, "MMM d")} – ${format(addDays(range.end, -1), "MMM d, yyyy")}`
    : format(cursor, "EEEE, MMMM d, yyyy");

  const { data: exportProfiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("profiles").select("id, first_name, last_name, email");
      if (error) throw error;
      return (data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[];
    },
  });

  const handleExport = (currentView: ViewMode, currentItems: ContentItem[]) => {
    if (currentView === "list") {
      window.dispatchEvent(new CustomEvent("msreg-export-calendar-list"));
      return;
    }
    exportContentItems(currentItems, exportProfiles);
  };


  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-[1400px] mx-auto">
      <header className="mb-4 space-y-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">Content Calendar</h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{title}</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Brand filter — own row, horizontal scroll on small screens */}
          <div className="flex gap-1 bg-muted rounded-md p-0.5 overflow-x-auto flex-nowrap w-full sm:w-fit">
            {(["all", "LOZ", "PP", "AON", "MSREG ALL"] as const).map((b) => (
              <button key={b} onClick={() => setBrandFilter(b)} className={cn(
                "shrink-0 px-2.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap",
                brandFilter === b
                  ? (b === "PP" ? "bg-gold text-gold-foreground"
                    : b === "LOZ" ? "bg-indigo-400 text-background"
                    : b === "MSREG ALL" ? "bg-purple-400 text-background"
                    : b === "AON" ? "bg-sky-500 text-white"
                    : "bg-foreground text-background")
                  : "text-muted-foreground hover:text-foreground",
              )}>{b === "all" ? "All" : b}</button>
            ))}
          </div>

          {/* Hide 60/90/120 Reposts Checkbox */}
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              id="hide-reposts-check"
              checked={hideReposts}
              onCheckedChange={(checked) => setHideReposts(!!checked)}
            />
            <label
              htmlFor="hide-reposts-check"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
            >
              Hide 60/90/120 Reposts
            </label>
          </div>
        </div>

        {/* Toolbar — wraps on mobile */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-muted rounded-md p-0.5">
            {(["list", "daily", "weekly", "monthly"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn(
                "px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded capitalize transition-colors",
                view === v ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground",
              )}>{v}</button>
            ))}
          </div>
          {view !== "list" && (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={goPrev} className="px-2"><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={goToday}>Today</Button>
              <Button size="sm" variant="outline" onClick={goNext} className="px-2"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => handleExport(view, filteredItems)}>
              <Download className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Export</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAnalyzeOpen(true)}>
              <Sparkles className="h-4 w-4 sm:mr-1 text-gold" /> <span className="hidden sm:inline">Analyze</span>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/archive"><Archive className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Archive</span></Link>
            </Button>
            {canEditContent && (
              <Button size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => openSlot(new Date())}>
                <Plus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">New</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {view === "list" ? (
        <CalendarListView brandFilter={brandFilter} />
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="bg-card border border-border rounded-xl overflow-hidden" onClick={() => setSelectedId(null)}>
            {view === "daily" && <DailyView day={cursor} items={filteredItems} onSlotClick={openSlot} onItemClick={detail.open} draggable={canEditContent} selectedId={selectedId} onSelect={setSelectedId} />}
            {view === "weekly" && <WeeklyView start={range.start} items={filteredItems} onSlotClick={openSlot} onItemClick={detail.open} draggable={canEditContent} selectedId={selectedId} onSelect={setSelectedId} />}
            {view === "monthly" && <MonthlyView cursor={cursor} start={range.start} end={range.end} items={filteredItems} onDayClick={openSlot} onItemClick={detail.open} draggable={canEditContent} selectedId={selectedId} onSelect={setSelectedId} />}
          </div>
        </DndContext>
      )}


      {selectedItem && canEditContent && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-primary text-primary-foreground border border-gold/40 shadow-2xl rounded-full pl-4 pr-2 py-2">
          <span className="text-xs font-medium truncate max-w-[200px]">{selectedItem.title}</span>
          <span className="text-[10px] opacity-70">selected</span>
          <Button
            size="sm"
            className="bg-gold text-gold-foreground hover:bg-gold/90 h-8 rounded-full"
            disabled={duplicate.isPending}
            onClick={() => duplicate.mutate(selectedItem)}
          >
            <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-white/10" onClick={() => setSelectedId(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}



      {formOpen && (
        <ContentItemForm key={slotDate?.toISOString() ?? "new"} open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setPrefill(undefined); }} initialDate={slotDate} initial={prefill} />
      )}

      <CalendarAnalyzePanel
        open={analyzeOpen}
        onOpenChange={setAnalyzeOpen}
        weekRange={{
          start: startOfWeek(cursor, { weekStartsOn: 0 }),
          end: addDays(startOfWeek(cursor, { weekStartsOn: 0 }), 7),
        }}
        monthRange={{
          start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }),
          end: addDays(endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }), 1),
        }}
        fetchItems={async (start, end) => {
          const { data, error } = await (supabase as any)
            .from("content_items").select("*")
            .gte("scheduled_at", start.toISOString())
            .lt("scheduled_at", end.toISOString())
            .order("scheduled_at", { ascending: true });
          if (error) throw error;
          return (data ?? []) as ContentItem[];
        }}
        onCreatePost={(date) => {
          setAnalyzeOpen(false);
          setSlotDate(date);
          setFormOpen(true);
        }}
      />
    </div>
  );
}


function ContentCard({ item, onClick, draggable, selected, onSelect }: { item: ContentItem; onClick: () => void; draggable: boolean; selected?: boolean; onSelect?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({ id: item.id, disabled: !draggable });
  const targetMissed = item.target_publish_date && new Date(item.target_publish_date) < new Date(new Date().toDateString()) && item.status !== "published";
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "relative w-full text-left bg-background/80 hover:bg-background rounded-md p-1.5 text-[11px] leading-tight overflow-hidden border border-border cursor-pointer",
        PRIORITY_BORDER[item.priority],
        isDragging && "opacity-50",
        draggable && "cursor-grab active:cursor-grabbing",
        selected && "ring-2 ring-gold border-gold shadow-md",
      )}
    >
      {onSelect && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onSelect(selected ? "" : item.id); }}
          title={selected ? "Deselect" : "Select"}
          className={cn(
            "absolute top-0.5 right-0.5 h-4 w-4 rounded-full border flex items-center justify-center transition-colors z-10",
            selected ? "bg-gold border-gold text-gold-foreground" : "bg-background/80 border-border hover:border-gold text-muted-foreground",
          )}
        >
          {selected ? <Check className="h-2.5 w-2.5" /> : <span className="block h-1.5 w-1.5 rounded-full bg-current opacity-40" />}
        </button>
      )}
      <div className="flex items-start gap-1.5">
        {item.thumbnail_url && <img src={item.thumbnail_url} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />}
        <div className="flex-1 min-w-0 pr-4">
          <div className="font-medium truncate text-foreground flex items-center gap-1">
            <span className={cn("text-[8px] font-bold px-1 py-px rounded border shrink-0", BRAND_STYLES[(item.brand ?? "PP") as Brand])}>
              {item.brand ?? "PP"}
            </span>
            <span className="truncate">{item.title}</span>
            {targetMissed && <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <span className={cn("px-1 py-px rounded border text-[9px]", STATUS_CLASS[item.status as Status])}>{STATUS_LABEL[item.status as Status]}</span>
            {item.platforms.slice(0, 2).map((p) => (<span key={p} className="text-[9px] text-muted-foreground">{p}</span>))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DropSlot({ date, children, onSlotClick }: { date: Date; children?: React.ReactNode; onSlotClick: (d: Date) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(date) });
  const isHour = date.getMinutes() === 0;
  return (
    <div
      ref={setNodeRef}
      onClick={() => onSlotClick(date)}
      title={format(date, "EEE MMM d · h:mm a")}
      style={{ minHeight: SLOT_HEIGHT_PX }}
      className={cn(
        "border-l border-border/40 px-0.5 hover:bg-gold/10 hover:ring-1 hover:ring-inset hover:ring-gold/30 cursor-pointer transition-colors",
        isHour ? "border-b border-border/60" : "border-b border-border/15",
        isOver && "bg-gold/20 ring-1 ring-inset ring-gold",
      )}
    >
      {children}
    </div>
  );
}

function QuarterRows({ day, items, onSlotClick, onItemClick, draggable, showLabel, selectedId, onSelect }: {
  day: Date; items: ContentItem[]; onSlotClick: (d: Date) => void; onItemClick: (id: string) => void; draggable: boolean; showLabel: boolean; selectedId?: string | null; onSelect?: (id: string) => void;
}) {
  return (
    <>
      {HOURS.map((h) =>
        QUARTERS.map((q) => {
          const slot = new Date(day); slot.setHours(h, q, 0, 0);
          const slotItems = items.filter((it) => {
            const d = new Date(it.scheduled_at);
            return isSameDay(d, day) && d.getHours() === h && Math.floor(d.getMinutes() / 15) * 15 === q;
          });
          return (
            <div key={`${h}-${q}`} className="contents">
              {showLabel && (
                <div className={cn(
                  "text-[10px] px-2 text-right border-r border-border/40 bg-sidebar/40 flex items-start justify-end",
                  q === 0 ? "border-b border-border/60 text-muted-foreground pt-0.5" : "border-b border-border/15",
                )} style={{ minHeight: SLOT_HEIGHT_PX }}>
                  {q === 0 ? format(slot, "h a") : <span className="text-border/60">·</span>}
                </div>
              )}
              <DropSlot date={slot} onSlotClick={onSlotClick}>
                <div className="space-y-0.5">
                  {slotItems.map((it) => <ContentCard key={it.id} item={it} draggable={draggable} onClick={() => onItemClick(it.id)} selected={selectedId === it.id} onSelect={onSelect} />)}
                </div>
              </DropSlot>
            </div>
          );
        })
      )}
    </>
  );
}

function HolidayBanner({ date, className }: { date: Date; className?: string }) {
  const holidays = getHolidaysForDate(date);
  if (holidays.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1 px-1.5 py-1 border-t border-border/40", className)}>
      {holidays.map((h, i) => (
        <span
          key={i}
          title={h.name}
          className={cn(
            "text-[9px] leading-tight font-medium px-1.5 py-0.5 rounded border truncate max-w-full",
            HOLIDAY_TYPE_CLASS[h.type],
          )}
        >
          {h.name}
        </span>
      ))}
    </div>
  );
}

function DailyView({ day, items, onSlotClick, onItemClick, draggable, selectedId, onSelect }: any) {
  return (
    <div className="grid" style={{ gridTemplateColumns: "60px 1fr" }}>
      <div className="bg-sidebar/60 border-b border-r border-border px-2 py-2 text-xs font-semibold text-muted-foreground">Time</div>
      <div className="bg-sidebar/60 border-b border-border text-xs font-semibold">
        <div className="px-3 py-2">{format(day, "EEEE, MMM d")}</div>
        <HolidayBanner date={day} />
      </div>
      <QuarterRows day={day} items={items} onSlotClick={onSlotClick} onItemClick={onItemClick} draggable={draggable} showLabel selectedId={selectedId} onSelect={onSelect} />
    </div>
  );
}

function WeeklyView({ start, items, onSlotClick, onItemClick, draggable, selectedId, onSelect }: any) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[900px]" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
        <div className="bg-sidebar/60 border-b border-r border-border px-2 py-2 text-xs font-semibold text-muted-foreground">Time</div>
        {days.map((d) => (
          <div key={d.toISOString()} className={cn("bg-sidebar/60 border-b border-l border-border text-xs font-semibold text-center", isSameDay(d, new Date()) && "text-gold")}>
            <div className="px-2 py-2">
              <div>{format(d, "EEE")}</div>
              <div className="text-base">{format(d, "d")}</div>
            </div>
            <HolidayBanner date={d} className="justify-center" />
          </div>
        ))}
        {HOURS.map((h) =>
          QUARTERS.map((q) => (
            <div key={`${h}-${q}`} className="contents">
              <div className={cn(
                "text-[10px] px-2 text-right border-r border-border/40 bg-sidebar/40 flex items-start justify-end",
                q === 0 ? "border-b border-border/60 text-muted-foreground pt-0.5" : "border-b border-border/15",
              )} style={{ minHeight: SLOT_HEIGHT_PX }}>
                {q === 0 ? format(new Date(2000, 0, 1, h), "h a") : <span className="text-border/60">·</span>}
              </div>
              {days.map((d) => {
                const slot = new Date(d); slot.setHours(h, q, 0, 0);
                const slotItems = items.filter((it: ContentItem) => {
                  const itd = new Date(it.scheduled_at);
                  return isSameDay(itd, d) && itd.getHours() === h && Math.floor(itd.getMinutes() / 15) * 15 === q;
                });
                return (
                  <DropSlot key={d.toISOString() + h + q} date={slot} onSlotClick={onSlotClick}>
                    <div className="space-y-0.5">
                      {slotItems.map((it: ContentItem) => (
                        <ContentCard key={it.id} item={it} draggable={draggable} onClick={() => onItemClick(it.id)} selected={selectedId === it.id} onSelect={onSelect} />
                      ))}
                    </div>
                  </DropSlot>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MonthlyView({ cursor, start, end, items, onDayClick, onItemClick, draggable, selectedId, onSelect }: any) {
  const days: Date[] = [];
  let d = start; while (d < end) { days.push(d); d = addDays(d, 1); }
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return (
    <div>
      <div className="grid grid-cols-7 bg-sidebar/60 border-b border-border">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="px-2 py-2 text-xs font-semibold text-center text-muted-foreground">{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((day) => {
            const dayItems = items.filter((it: ContentItem) => isSameDay(new Date(it.scheduled_at), day));
            const inMonth = isSameMonth(day, cursor);
            const isToday = isSameDay(day, new Date());
            const noon = new Date(day); noon.setHours(12, 0, 0, 0);
            return (
              <MonthDayCell key={day.toISOString()} date={noon} inMonth={inMonth} isToday={isToday} onDayClick={onDayClick}>
                <div className={cn("text-xs font-medium mb-1", !inMonth && "text-muted-foreground/50", isToday && "text-gold")}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayItems.slice(0, 3).map((it: ContentItem) => <ContentCard key={it.id} item={it} draggable={draggable} onClick={() => onItemClick(it.id)} selected={selectedId === it.id} onSelect={onSelect} />)}
                  {dayItems.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{dayItems.length - 3} more</div>}
                </div>
              </MonthDayCell>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MonthDayCell({ date, inMonth, isToday, onDayClick, children }: { date: Date; inMonth: boolean; isToday: boolean; onDayClick: (d: Date) => void; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(date) });
  return (
    <div
      ref={setNodeRef}
      onClick={() => onDayClick(date)}
      className={cn(
        "border-b border-l border-border min-h-[110px] p-1.5 hover:bg-accent/20 cursor-pointer",
        !inMonth && "bg-muted/20",
        isOver && "bg-gold/15 border-gold",
        isToday && "ring-1 ring-gold/40 ring-inset",
      )}
    >
      {children}
    </div>
  );
}

