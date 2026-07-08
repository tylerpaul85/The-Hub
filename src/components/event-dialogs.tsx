import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, Sparkles, X, Check, Trash2, ClipboardCheck } from "lucide-react";
import { displayName, type Member } from "@/lib/eos";
import {
  EVENT_TYPES, EVENT_TYPE_CLASS, NEEDS_LISTING, DEFAULT_CHECKLIST, SUGGESTION_OFFSETS,
  type EventType, type EventRow, type ChecklistItem, type Suggestion,
  addDays, todayStr,
} from "@/lib/events";

const sb = supabase as any;

export function NewEventDialog({
  open, onClose, members, onCreated,
}: { open: boolean; onClose: () => void; members: Member[]; onCreated: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [type, setType] = useState<EventType>("Open House");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [hosts, setHosts] = useState<string[]>([]);
  const [headcount, setHeadcount] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [listing, setListing] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleHost = (id: string) => setHosts((h) => h.includes(id) ? h.filter((x) => x !== id) : [...h, id]);

  const submit = async () => {
    if (!name.trim() || !date) { toast.error("Name and date are required"); return; }
    setSaving(true);
    try {
      const { data: ev, error } = await sb.from("events").insert({
        name: name.trim(),
        type,
        event_date: date,
        event_time: time || null,
        location: location.trim() || null,
        hosts,
        headcount: headcount ? Number(headcount) : null,
        budget: budget ? Number(budget) : null,
        notes: notes.trim() || null,
        linked_listing: NEEDS_LISTING.includes(type) ? (listing.trim() || null) : null,
        created_by: user?.id ?? null,
      }).select().single();
      if (error) throw error;

      const checklistRows = DEFAULT_CHECKLIST.map((label, i) => ({ event_id: ev.id, label, sort_order: i }));
      await sb.from("event_checklist_items").insert(checklistRows);

      const today = todayStr();
      const sugRows = SUGGESTION_OFFSETS
        .map((o) => ({ event_id: ev.id, slot_type: o.type, suggested_date: addDays(date, o.days), status: "pending" }))
        .filter((r) => r.suggested_date >= today);
      if (sugRows.length) await sb.from("event_content_suggestions").insert(sugRows);

      toast.success("Event created");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Event</DialogTitle>
          <DialogDescription>Fill in the event details. Suggested content slots will be generated automatically.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><label className="text-xs text-muted-foreground">Event name</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Type</label>
            <Select value={type} onValueChange={(v) => setType(v as EventType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-muted-foreground">Date</label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Time</label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-muted-foreground">Location</label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          {NEEDS_LISTING.includes(type) && (
            <div><label className="text-xs text-muted-foreground">Linked listing address</label><Input value={listing} onChange={(e) => setListing(e.target.value)} /></div>
          )}
          <div>
            <label className="text-xs text-muted-foreground">Hosts / assigned people</label>
            <div className="max-h-32 overflow-y-auto border border-border rounded-md p-2 space-y-1">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={hosts.includes(m.id)} onCheckedChange={() => toggleHost(m.id)} />
                  {displayName(m)}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-muted-foreground">Headcount</label><Input type="number" value={headcount} onChange={(e) => setHeadcount(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Budget ($)</label><Input type="number" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-muted-foreground">Notes</label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-gold text-navy hover:bg-gold/90">{saving ? "Creating…" : "Create Event"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EventTaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  owner: string | null;
  event_id: string | null;
};

export function EventDetailSheet({
  event, members, onClose, isAdmin, onOpenTask,
}: {
  event: EventRow | null;
  members: Member[];
  onClose: () => void;
  isAdmin: boolean;
  onOpenTask?: (taskId: string) => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [newItem, setNewItem] = useState("");

  // Quick add task state
  const [qTitle, setQTitle] = useState("");
  const [qOwner, setQOwner] = useState<string>("__me__");
  const [qDue, setQDue] = useState("");
  const [qNote, setQNote] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["event-checklist", event?.id],
    queryFn: async () => {
      const { data, error } = await sb.from("event_checklist_items").select("*").eq("event_id", event!.id).order("sort_order");
      if (error) throw error;
      return (data ?? []) as ChecklistItem[];
    },
    enabled: !!event,
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ["event-suggestions", event?.id],
    queryFn: async () => {
      const { data, error } = await sb.from("event_content_suggestions").select("*").eq("event_id", event!.id).eq("status", "pending").order("suggested_date");
      if (error) throw error;
      return (data ?? []) as Suggestion[];
    },
    enabled: !!event,
  });

  const { data: eventTasks = [] } = useQuery<EventTaskRow[]>({
    queryKey: ["event-tasks", event?.id],
    queryFn: async () => {
      const { data, error } = await sb
        .from("tasks")
        .select("id,title,status,priority,due_date,owner,event_id")
        .eq("event_id", event!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventTaskRow[];
    },
    enabled: !!event,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["event-checklist", event?.id] });
    qc.invalidateQueries({ queryKey: ["event-checklist-all"] });
    qc.invalidateQueries({ queryKey: ["event-suggestions", event?.id] });
  };
  const invalidateTasks = () => {
    qc.invalidateQueries({ queryKey: ["event-tasks", event?.id] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
  };

  const quickAddTask = useMutation({
    mutationFn: async () => {
      const owner = qOwner === "__me__" ? user?.id : qOwner;
      const { error } = await sb.from("tasks").insert({
        title: qTitle.trim(),
        owner,
        priority: "normal",
        status: "todo",
        description: qNote.trim() || null,
        due_date: qDue || null,
        created_by: user?.id,
        event_id: event!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(qOwner === "__me__" ? "Task added" : "Task delegated");
      setQTitle(""); setQNote(""); setQOwner("__me__"); setQDue("");
      invalidateTasks();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleItem = async (item: ChecklistItem) => {
    const completed = !item.completed;
    const { error } = await sb.from("event_checklist_items").update({
      completed,
      completed_by: completed ? user?.id ?? null : null,
      completed_at: completed ? new Date().toISOString() : null,
    }).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    invalidate();
  };

  const addItem = async () => {
    if (!newItem.trim() || !event) return;
    const { error } = await sb.from("event_checklist_items").insert({ event_id: event.id, label: newItem.trim(), sort_order: items.length });
    if (error) { toast.error(error.message); return; }
    setNewItem("");
    invalidate();
  };

  const removeItem = async (id: string) => {
    const { error } = await sb.from("event_checklist_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    invalidate();
  };

  const approveSuggestion = async (s: Suggestion) => {
    if (!event) return;
    const scheduled = new Date(s.suggested_date + "T09:00:00");
    const { data: ci, error } = await sb.from("content_items").insert({
      title: `${event.name} — ${s.slot_type}`,
      caption: null,
      platforms: [],
      status: "draft",
      scheduled_at: scheduled.toISOString(),
      priority: "normal",
      notes: `Event: ${event.name} on ${event.event_date}${event.location ? ` @ ${event.location}` : ""}`,
      created_by: user?.id ?? null,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    await sb.from("event_content_suggestions").update({ status: "approved", content_id: ci.id }).eq("id", s.id);
    toast.success(`${s.slot_type} added to calendar`);
    invalidate();
  };

  const dismissSuggestion = async (s: Suggestion) => {
    const { error } = await sb.from("event_content_suggestions").update({ status: "dismissed" }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    invalidate();
  };

  if (!event) return null;
  const hostNames = event.hosts.map((id) => displayName(members.find((m) => m.id === id))).filter(Boolean);
  const done = items.filter((i) => i.completed).length;
  const tasksDone = eventTasks.filter((t) => t.status === "complete").length;
  const today = todayStr();
  const STATUS_LABEL: Record<string, string> = {
    todo: "To do", in_progress: "In progress", needs_review: "Needs review", revision_needed: "Revision needed", complete: "Complete",
  };

  const deleteEvent = async () => {
    if (!event) return;
    if (!confirm(`Delete event "${event.name}"? This removes its checklist and content suggestions. Tasks linked to it will be unlinked, not deleted.`)) return;
    await sb.from("tasks").update({ event_id: null }).eq("event_id", event.id);
    await sb.from("event_checklist_items").delete().eq("event_id", event.id);
    await sb.from("event_content_suggestions").delete().eq("event_id", event.id);
    const { error } = await sb.from("events").delete().eq("id", event.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Event deleted");
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["event-checklist-all"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    onClose();
  };

  return (
    <Sheet open={!!event} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className={cn("text-[10px]", EVENT_TYPE_CLASS[event.type as EventType] ?? "")}>{event.type}</Badge>
            {isAdmin && (
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 px-2" onClick={deleteEvent}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete event
              </Button>
            )}
          </div>
          <SheetTitle className="text-xl">{event.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><div className="text-muted-foreground">Date & time</div><div>{format(new Date(event.event_date + "T00:00:00"), "EEE, MMM d, yyyy")}{event.event_time ? ` · ${event.event_time.slice(0,5)}` : ""}</div></div>
            {event.location && <div><div className="text-muted-foreground">Location</div><div>{event.location}</div></div>}
            {event.headcount != null && <div><div className="text-muted-foreground">Headcount</div><div>{event.headcount}</div></div>}
            {event.budget != null && <div><div className="text-muted-foreground">Budget</div><div>${Number(event.budget).toLocaleString()}</div></div>}
            {event.linked_listing && <div className="col-span-2"><div className="text-muted-foreground">Listing</div><div>{event.linked_listing}</div></div>}
            {hostNames.length > 0 && <div className="col-span-2"><div className="text-muted-foreground">Hosts / assigned</div><div>{hostNames.join(", ")}</div></div>}
            {event.notes && <div className="col-span-2"><div className="text-muted-foreground">Notes</div><div className="whitespace-pre-wrap">{event.notes}</div></div>}
          </div>

          {/* Tasks for this event */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-gold" />
                <h3 className="font-semibold text-sm">Tasks</h3>
              </div>
              <span className="text-xs text-gold">{tasksDone} of {eventTasks.length} done</span>
            </div>
            <div className="space-y-1.5">
              {eventTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md py-3 text-center">No tasks yet — add one below.</p>
              ) : eventTasks.map((t) => {
                const ownerLabel = displayName(members.find((m) => m.id === t.owner));
                const overdue = t.due_date && t.due_date < today && t.status !== "complete";
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onOpenTask?.(t.id)}
                    className="w-full text-left bg-muted/30 hover:bg-muted/50 border border-border hover:border-gold/40 rounded-md p-2.5 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate text-sm">{t.title}</span>
                      <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[t.status] ?? t.status}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {ownerLabel ? `Owner: ${ownerLabel}` : "Unassigned"}
                      {t.due_date && (
                        <> · <span className={overdue ? "text-destructive font-medium" : ""}>Due {t.due_date}{overdue ? " (overdue)" : ""}</span></>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 rounded-md border border-border bg-muted/20 p-2.5 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add task to this event
              </div>
              <Input value={qTitle} onChange={(e) => setQTitle(e.target.value)} placeholder="Task title…" />
              <div className="flex gap-2 flex-wrap">
                <Select value={qOwner} onValueChange={setQOwner}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Assign to…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__me__">Me (keep)</SelectItem>
                    {members.filter((m) => m.id !== user?.id).map((m) => (
                      <SelectItem key={m.id} value={m.id}>Delegate to {displayName(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="date" value={qDue} onChange={(e) => setQDue(e.target.value)} className="w-[160px]" />
                <Button
                  disabled={!qTitle.trim() || quickAddTask.isPending}
                  onClick={() => quickAddTask.mutate()}
                  className="bg-gold text-navy hover:bg-gold/90"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
              <Textarea value={qNote} onChange={(e) => setQNote(e.target.value)} rows={2}
                placeholder={qOwner === "__me__" ? "Optional notes…" : "Notes / context for the person you're delegating to…"} />
            </div>
          </div>

          {suggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4 text-gold" /><h3 className="font-semibold text-sm">Suggested Content</h3></div>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md border border-border bg-card/50 p-2.5">
                    <div>
                      <div className="text-sm font-medium">{s.slot_type}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(s.suggested_date + "T00:00:00"), "EEE, MMM d")}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => dismissSuggestion(s)}><X className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" className="bg-gold text-navy hover:bg-gold/90" onClick={() => approveSuggestion(s)}><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Checklist</h3>
              <span className="text-xs text-muted-foreground">{done} of {items.length} ready</span>
            </div>
            <div className="space-y-1.5">
              {items.map((i) => (
                <div key={i.id} className="flex items-center gap-2 group">
                  <Checkbox checked={i.completed} onCheckedChange={() => toggleItem(i)} />
                  <span className={cn("text-sm flex-1", i.completed && "line-through text-muted-foreground")}>{i.label}</span>
                  {i.completed && i.completed_by && (
                    <span className="text-[10px] text-muted-foreground">{displayName(members.find((m) => m.id === i.completed_by))}</span>
                  )}
                  {isAdmin && (
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0" onClick={() => removeItem(i.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {isAdmin && (
              <div className="flex gap-2 mt-3">
                <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add checklist item" onKeyDown={(e) => e.key === "Enter" && addItem()} />
                <Button size="sm" onClick={addItem}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
