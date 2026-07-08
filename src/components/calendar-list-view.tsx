import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, isToday,
  isBefore, startOfDay, startOfMonth,
} from "date-fns";
import { ChevronDown, ChevronRight, MessageSquare, Plus, AlertTriangle, Trash2, User } from "lucide-react";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useContentDetail } from "@/components/content-detail-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContentItemForm } from "@/components/content-item-form";
import { exportContentItems } from "@/lib/content-export";
import {
  PLATFORMS, PLATFORM_CHIP, STATUSES, PRIORITIES, STATUS_CLASS, STATUS_LABEL, PRIORITY_BORDER, PRIORITY_LABEL,
  BRANDS, BRAND_STYLES, type Brand,
  type ContentItem, type Status, type Priority,
} from "@/lib/content";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Profile { id: string; first_name: string | null; last_name: string | null; email: string | null; }

function profileLabel(p?: Profile | null) {
  if (!p) return "Unassigned";
  const n = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return n || p.email || "Unknown";
}
function profileInitials(p?: Profile | null) {
  if (!p) return "?";
  const f = (p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "");
  return (f || p.email?.[0] || "?").toUpperCase();
}


export function CalendarListView({ brandFilter = "all" }: { brandFilter?: "all" | Brand } = {}) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const detail = useContentDetail();

  const today = useMemo(() => startOfDay(new Date()), []);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => startOfMonth(addMonths(today, i))), [today]);

  const [activeMonth, setActiveMonth] = useState<Date>(months[0]);
  const [filters, setFilters] = useState<{ platform: string; status: string; priority: string; owner: string }>(
    { platform: "all", status: "all", priority: "all", owner: "all" },
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hidePast, setHidePast] = useState<boolean>(true);
  const [formOpen, setFormOpen] = useState(false);
  const [slotDate, setSlotDate] = useState<Date | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const todayRowRef = useRef<HTMLDivElement | null>(null);

  // Auto-collapse past dates when activeMonth changes
  useEffect(() => {
    const next = new Set<string>();
    const monthStart = activeMonth;
    const monthEnd = endOfMonth(activeMonth);
    eachDayOfInterval({ start: monthStart, end: monthEnd }).forEach((d) => {
      if (isBefore(d, today) && !isToday(d)) next.add(d.toDateString());
    });
    setCollapsed(next);
  }, [activeMonth, today]);

  // Scroll today into view when current month is active
  useEffect(() => {
    if (isSameDay(startOfMonth(today), activeMonth)) {
      const t = setTimeout(() => todayRowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return () => clearTimeout(t);
    }
  }, [activeMonth, today]);

  // Fetch all items for the 12-month window (for month-tab badges)
  const windowStart = months[0];
  const windowEnd = endOfMonth(months[months.length - 1]);
  const { data: allItems = [] } = useQuery({
    queryKey: ["content-items-list", windowStart.toISOString(), windowEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_items").select("*")
        .gte("scheduled_at", windowStart.toISOString())
        .lt("scheduled_at", new Date(windowEnd.getTime() + 86400000).toISOString())
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContentItem[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("profiles").select("id, first_name, last_name, email");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  // Month badge counts (respect filters)
  const filteredAll = useMemo(
    () => allItems.filter((it) => matchesFilters(it, filters) && (brandFilter === "all" || (it.brand ?? "PP") === brandFilter)),
    [allItems, filters, brandFilter],
  );
  const monthCounts = useMemo(() => {
    const m = new Map<string, number>();
    filteredAll.forEach((it) => {
      const k = format(startOfMonth(new Date(it.scheduled_at)), "yyyy-MM");
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m;
  }, [filteredAll]);

  // Items shown for active month
  const monthDays = useMemo(() => {
    const all = eachDayOfInterval({ start: activeMonth, end: endOfMonth(activeMonth) });
    if (!hidePast) return all;
    return all.filter((d) => !isBefore(d, today) || isToday(d));
  }, [activeMonth, hidePast, today]);
  const itemsByDay = useMemo(() => {
    const m = new Map<string, ContentItem[]>();
    filteredAll.forEach((it) => {
      const d = new Date(it.scheduled_at);
      const k = startOfDay(d).toDateString();
      const arr = m.get(k) ?? [];
      arr.push(it);
      m.set(k, arr);
    });
    return m;
  }, [filteredAll]);

  useEffect(() => {
    const handler = () => exportContentItems(filteredAll, profiles);
    window.addEventListener("msreg-export-calendar-list", handler as EventListener);
    return () => window.removeEventListener("msreg-export-calendar-list", handler as EventListener);
  }, [filteredAll, profiles]);


  // Mutations
  const updateField = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await (supabase as any).from("content_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-items"] });
      qc.invalidateQueries({ queryKey: ["content-items-list"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Update failed"),
  });

  const bulkUpdate = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const ids = [...selected];
      const { error } = await (supabase as any).from("content_items").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-items"] });
      qc.invalidateQueries({ queryKey: ["content-items-list"] });
      toast.success("Updated");
      setSelected(new Set());
    },
    onError: (e: any) => toast.error(e.message ?? "Bulk update failed"),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const ids = [...selected];
      const { error } = await (supabase as any).from("content_items").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-items"] });
      qc.invalidateQueries({ queryKey: ["content-items-list"] });
      toast.success(`Deleted ${selected.size} item(s)`);
      setSelected(new Set());
      setConfirmDelete(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  const toggleSel = (id: string) => setSelected((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleCollapse = (key: string) => setCollapsed((s) => {
    const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  const openAdd = (d: Date) => {
    if (!isAdmin) return;
    const dt = new Date(d); dt.setHours(9, 0, 0, 0);
    setSlotDate(dt); setFormOpen(true);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const reschedule = useMutation({
    mutationFn: async ({ id, newDate }: { id: string; newDate: Date }) => {
      const { error } = await (supabase as any).from("content_items").update({ scheduled_at: newDate.toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["content-items"] });
      qc.invalidateQueries({ queryKey: ["content-items-list"] });
      toast.success(`Moved to ${format(v.newDate, "EEE MMM d")}`);
    },
    onError: (e: any) => toast.error(e.message ?? "Move failed"),
  });

  const handleDragEnd = (e: DragEndEvent) => {
    if (!isAdmin) return;
    const id = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId || !overId.startsWith("day|")) return;
    const targetDate = new Date(overId.slice(4));
    const item = allItems.find((i) => i.id === id);
    if (!item) return;
    const current = new Date(item.scheduled_at);
    if (isSameDay(current, targetDate)) return;
    const next = new Date(targetDate);
    next.setHours(current.getHours(), current.getMinutes(), current.getSeconds(), 0);
    reschedule.mutate({ id, newDate: next });
  };

  return (
    <div className="space-y-4">
      {/* Month tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-border">
        {months.map((m) => {
          const key = format(m, "yyyy-MM");
          const isActive = isSameDay(m, activeMonth);
          const count = monthCounts.get(key) ?? 0;
          return (
            <button
              key={key}
              onClick={() => { setActiveMonth(m); setSelected(new Set()); }}
              className={cn(
                "shrink-0 px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-colors flex items-center gap-2",
                isActive ? "border-gold text-gold bg-gold/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              {format(m, "MMM yyyy")}
              <span className={cn(
                "text-[10px] px-1.5 py-px rounded-full border",
                count === 0 ? "border-border text-muted-foreground" : "border-gold/40 bg-gold/10 text-gold",
              )}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="Platform" value={filters.platform} onChange={(v) => setFilters({ ...filters, platform: v })}
          options={[["all", "All platforms"], ...PLATFORMS.map((p) => [p, p] as [string, string])]} />
        <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })}
          options={[["all", "All statuses"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]] as [string, string])]} />
        <FilterSelect label="Priority" value={filters.priority} onChange={(v) => setFilters({ ...filters, priority: v })}
          options={[["all", "All priorities"], ...PRIORITIES.map((p) => [p, PRIORITY_LABEL[p]] as [string, string])]} />
        <FilterSelect label="Owner" value={filters.owner} onChange={(v) => setFilters({ ...filters, owner: v })}
          options={[["all", "All owners"], ["unassigned", "Unassigned"], ...profiles.map((p) => [p.id, profileLabel(p)] as [string, string])]} />
        <button
          type="button"
          onClick={() => setHidePast((v) => !v)}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
            hidePast
              ? "border-gold/50 bg-gold/10 text-gold"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40",
          )}
          title={hidePast ? "Showing today and future days" : "Showing all days in this month"}
        >
          {hidePast ? "Hiding past days" : "Show past days"}
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 bg-gold/10 border border-gold/40 rounded-md px-3 py-2">
          <span className="text-sm font-medium text-gold">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Select onValueChange={(v) => bulkUpdate.mutate({ status: v })}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Set status" /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
            <Select onValueChange={(v) => bulkUpdate.mutate({ created_by: v === "unassigned" ? null : v })}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Reassign owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      {/* Date sections */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        {monthDays.map((day) => {
          const key = day.toDateString();
          const dayItems = (itemsByDay.get(key) ?? []).sort((a, b) =>
            new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
          const isCollapsed = collapsed.has(key) && !isToday(day);
          const dayIsToday = isToday(day);
          const isEmpty = dayItems.length === 0;
          return (
            <DayDropSection
              key={key}
              day={day}
              dayIsToday={dayIsToday}
              isEmpty={isEmpty}
              sectionRef={dayIsToday ? todayRowRef : undefined}
            >
              <button
                onClick={() => toggleCollapse(key)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left bg-card hover:bg-muted/30 transition-colors",
                  dayIsToday && "bg-gold/5",
                )}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                <span className={cn("font-semibold text-sm", dayIsToday ? "text-gold" : "text-foreground")}>
                  {format(day, "EEEE MMMM do yyyy")}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {dayItems.length} {dayItems.length === 1 ? "item" : "items"}
                </span>
              </button>

              {!isCollapsed && (
                <div className="bg-background/40">
                  {dayItems.length > 0 && (
                    <div className="hidden md:grid grid-cols-[32px_1fr_28px_36px_minmax(120px,1fr)_140px_80px_60px_100px_60px] items-center text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border px-2 py-1.5 gap-2">
                      <div></div>
                      <div>Task</div>
                      <div></div>
                      <div>Owner</div>
                      <div>Platforms</div>
                      <div>Status</div>
                      <div>Time</div>
                      <div>Priority</div>
                      <div>Due</div>
                      <div className="text-right">Actions</div>
                    </div>
                  )}
                  {dayItems.map((it) => {
                    const owner = it.created_by ? profileMap.get(it.created_by) : null;
                    const sel = selected.has(it.id);
                    const targetMissed = it.target_publish_date &&
                      new Date(it.target_publish_date) < today && it.status !== "published";
                    return (
                      <DraggableRow
                        key={it.id}
                        id={it.id}
                        sel={sel}
                        priorityClass={PRIORITY_BORDER[it.priority]}
                        draggable={isAdmin}
                      >
                        <div className="flex justify-center">
                          <Checkbox checked={sel} onCheckedChange={() => toggleSel(it.id)} />
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0", BRAND_STYLES[(it.brand ?? "PP") as Brand])}>
                            {it.brand ?? "PP"}
                          </span>
                          <button
                            onClick={() => detail.open(it.id)}
                            className="text-left text-sm font-medium truncate hover:text-gold transition-colors min-w-0"
                          >
                            {it.title}
                          </button>
                        </div>
                        <button
                          onClick={() => detail.open(it.id)}
                          className="text-muted-foreground hover:text-gold transition-colors"
                          title="Open comments"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        <Select
                          value={it.created_by ?? "unassigned"}
                          onValueChange={(v) => updateField.mutate({ id: it.id, patch: { created_by: v === "unassigned" ? null : v } })}
                        >
                          <SelectTrigger className="h-7 w-9 p-0 border-none bg-transparent hover:bg-muted/40 [&>svg]:hidden">
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold" title={profileLabel(owner)}>
                              {owner ? profileInitials(owner) : <User className="h-3.5 w-3.5 text-muted-foreground" />}
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-1 min-w-0">
                          {it.platforms.slice(0, 3).map((p) => (
                            <span key={p} className={cn("text-[9px] px-1.5 py-0.5 rounded border truncate", PLATFORM_CHIP[p] ?? "border-border text-muted-foreground")}>
                              {p}
                            </span>
                          ))}
                          {it.platforms.length > 3 && (
                            <span className="text-[9px] text-muted-foreground">+{it.platforms.length - 3}</span>
                          )}
                        </div>
                        <Select
                          value={it.status}
                          onValueChange={(v) => updateField.mutate({ id: it.id, patch: { status: v } })}
                        >
                          <SelectTrigger className={cn("h-7 text-[10px] border px-2 py-0 [&>svg]:h-3 [&>svg]:w-3", STATUS_CLASS[it.status as Status])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(it.scheduled_at), "h:mm a")}
                        </span>
                        <span className="text-xs capitalize text-muted-foreground" title={PRIORITY_LABEL[it.priority]}>
                          <span className={cn(
                            "inline-block h-2 w-2 rounded-full mr-1",
                            it.priority === "urgent" && "bg-[oklch(0.62_0.22_25)]",
                            it.priority === "high" && "bg-[oklch(0.72_0.18_55)]",
                            it.priority === "normal" && "bg-gold",
                            it.priority === "low" && "bg-muted-foreground/60",
                          )} />
                          {PRIORITY_LABEL[it.priority]}
                        </span>
                        <span className={cn("text-xs flex items-center gap-1", targetMissed ? "text-destructive font-medium" : "text-muted-foreground")}>
                          {targetMissed && <AlertTriangle className="h-3 w-3" />}
                          {it.target_publish_date ? format(new Date(it.target_publish_date), "MMM d") : "—"}
                        </span>
                        <div className="text-right">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => detail.open(it.id)}>
                            Open
                          </Button>
                        </div>
                      </DraggableRow>
                    );
                  })}

                  {isAdmin && (
                    <button
                      onClick={() => openAdd(day)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-gold hover:bg-gold/5 transition-colors border-t border-dashed border-border/60",
                        isEmpty && "py-3",
                      )}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add task
                    </button>
                  )}
                </div>
              )}
            </DayDropSection>
          );
        })}
      </div>
      </DndContext>

      {formOpen && (
        <ContentItemForm
          key={slotDate?.toISOString() ?? "new"}
          open={formOpen}
          onOpenChange={(o) => setFormOpen(o)}
          initialDate={slotDate}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} item(s)?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the selected content items. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => bulkDelete.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function matchesFilters(
  it: ContentItem,
  f: { platform: string; status: string; priority: string; owner: string },
) {
  if (f.platform !== "all" && !it.platforms.includes(f.platform)) return false;
  if (f.status !== "all" && it.status !== f.status) return false;
  if (f.priority !== "all" && it.priority !== f.priority) return false;
  if (f.owner !== "all") {
    if (f.owner === "unassigned") return !it.created_by;
    if (it.created_by !== f.owner) return false;
  }
  return true;
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
        <span className="text-muted-foreground mr-1">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function DayDropSection({
  day, dayIsToday, isEmpty, sectionRef, children,
}: {
  day: Date; dayIsToday: boolean; isEmpty: boolean;
  sectionRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day|${day.toISOString()}` });
  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        if (sectionRef) (sectionRef as { current: HTMLDivElement | null }).current = el;
      }}
      className={cn(
        "rounded-lg border border-border overflow-hidden transition-colors",
        dayIsToday && "border-l-[3px] border-l-gold",
        isEmpty && !dayIsToday && "opacity-70",
        isOver && "border-gold ring-2 ring-gold/40 bg-gold/5 opacity-100",
      )}
    >
      {children}
    </div>
  );
}

function DraggableRow({
  id, sel, priorityClass, draggable, children,
}: {
  id: string; sel: boolean; priorityClass: string; draggable: boolean; children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({ id, disabled: !draggable });
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 50,
  } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2 border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors",
        "md:grid md:grid-cols-[32px_1fr_28px_36px_minmax(120px,1fr)_140px_80px_60px_100px_60px] md:gap-2 md:flex-nowrap",
        "[&>*]:min-w-0",
        priorityClass,
        sel && "bg-primary/10",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 shadow-lg ring-1 ring-gold/40",
      )}
    >
      {children}
    </div>
  );
}

