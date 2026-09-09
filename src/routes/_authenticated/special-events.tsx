import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  format,
  parseISO,
  isBefore,
  startOfToday,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns";
import {
  Sparkles,
  Calendar as CalendarIcon,
  CalendarCheck,
  Plus,
  MapPin,
  Clock,
  Users,
  UserCheck,
  Star,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  FileSpreadsheet,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  Upload,
  UserPlus,
  RefreshCw,
  LayoutGrid,
} from "lucide-react";
import type {
  SpecialEvent,
  SpecialEventGroup,
  SpecialEventSignup,
  SpecialEventCommittee,
  SpecialEventType,
  CapacityMode,
  SpecialEventProfile,
} from "@/lib/special-events";
import {
  SPECIAL_EVENT_TYPE_LABELS,
  SPECIAL_EVENT_TYPE_BADGES,
  formatEventDateTime,
  formatEventTime,
  buildGoogleCalendarUrl,
  downloadIcsFile,
  exportAttendeesCsv,
  exportCommitteeCsv,
} from "@/lib/special-events";
import { syncEventToGoogleCalendar } from "@/lib/special-events.functions";

const sb = supabase as any;

export const Route = createFileRoute("/_authenticated/special-events")({
  component: SpecialEventsPage,
  head: () => ({ meta: [{ title: "Special Events — MSREG Marketing Hub" }] }),
});

export function SpecialEventsPage() {
  const { user, isAdmin, roles } = useAuth();
  const qc = useQueryClient();
  const canManage = isAdmin || roles.includes("marketing_coordinator" as any);

  // Filters & State
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [selectedType, setSelectedType] = useState<"all" | SpecialEventType>("all");
  const [viewMode, setViewMode] = useState<"cards" | "calendar">("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Dialog states
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SpecialEvent | null>(null);
  const [groupSignupEvent, setGroupSignupEvent] = useState<SpecialEvent | null>(null);
  const [rosterEvent, setRosterEvent] = useState<SpecialEvent | null>(null);

  // Queries
  const { data: events = [], isLoading: loadingEvents } = useQuery<SpecialEvent[]>({
    queryKey: ["special-events"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("special_events")
        .select("*")
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data as SpecialEvent[];
    },
  });

  const { data: signups = [] } = useQuery<SpecialEventSignup[]>({
    queryKey: ["special-event-signups"],
    queryFn: async () => {
      const { data, error } = await sb.from("special_event_signups").select("*");
      if (error) throw error;
      return data as SpecialEventSignup[];
    },
  });

  const { data: groups = [] } = useQuery<SpecialEventGroup[]>({
    queryKey: ["special-event-groups"],
    queryFn: async () => {
      const { data, error } = await sb.from("special_event_groups").select("*");
      if (error) throw error;
      return data as SpecialEventGroup[];
    },
  });

  const { data: committee = [] } = useQuery<SpecialEventCommittee[]>({
    queryKey: ["special-event-committee"],
    queryFn: async () => {
      const { data, error } = await sb.from("special_event_committee").select("*");
      if (error) throw error;
      return data as SpecialEventCommittee[];
    },
  });

  const { data: profiles = [] } = useQuery<SpecialEventProfile[]>({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("profiles")
        .select("id, email, first_name, last_name");
      if (error) throw error;
      return data as SpecialEventProfile[];
    },
  });

  const today = startOfToday();

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const evDate = parseISO(ev.event_date);
      const isPast = isBefore(evDate, today) || ev.archived;

      if (activeTab === "upcoming" && isPast) return false;
      if (activeTab === "past" && !isPast) return false;

      if (selectedType !== "all" && ev.event_type !== selectedType) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = ev.title.toLowerCase().includes(q);
        const matchDesc = (ev.description || "").toLowerCase().includes(q);
        const matchLoc = (ev.location || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchLoc) return false;
      }

      return true;
    });
  }, [events, activeTab, selectedType, searchQuery, today]);

  // Actions / Mutations
  const toggleCommittee = useMutation({
    mutationFn: async ({ eventId, isMember }: { eventId: string; isMember: boolean }) => {
      if (isMember) {
        const { error } = await sb
          .from("special_event_committee")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("special_event_committee").insert({
          event_id: eventId,
          user_id: user!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      toast.success(vars.isMember ? "Removed from committee" : "Joined event committee! Thank you for helping.");
      qc.invalidateQueries({ queryKey: ["special-event-committee"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelSignup = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await sb
        .from("special_event_signups")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("RSVP cancelled");
      qc.invalidateQueries({ queryKey: ["special-event-signups"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const simpleSignup = useMutation({
    mutationFn: async ({
      eventId,
      status,
    }: {
      eventId: string;
      status: "confirmed" | "waitlist";
    }) => {
      const { error } = await sb.from("special_event_signups").upsert(
        {
          event_id: eventId,
          user_id: user!.id,
          status,
        },
        { onConflict: "event_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(
        vars.status === "confirmed" ? "RSVP confirmed! See you there." : "Added to the waitlist.",
      );
      qc.invalidateQueries({ queryKey: ["special-event-signups"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("special_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event deleted");
      qc.invalidateQueries({ queryKey: ["special-events"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleArchive = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await sb
        .from("special_events")
        .update({ archived, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.archived ? "Event archived" : "Event restored");
      qc.invalidateQueries({ queryKey: ["special-events"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gold/15 text-gold border border-gold/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Special Events</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Internal celebrations, community outreach, and team tournaments
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="h-9"
          >
            <TabsList className="bg-muted/50 p-0.5 border border-border">
              <TabsTrigger value="upcoming" className="text-xs px-3">
                Upcoming
              </TabsTrigger>
              <TabsTrigger value="past" className="text-xs px-3">
                Past Events
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/40">
            <button
              onClick={() => setViewMode("cards")}
              className={cn(
                "p-1.5 rounded-md text-xs font-medium transition-colors",
                viewMode === "cards"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Cards Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "p-1.5 rounded-md text-xs font-medium transition-colors",
                viewMode === "calendar"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Calendar Month View"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </div>

          {canManage && (
            <Button
              onClick={() => {
                setEditingEvent(null);
                setEditorOpen(true);
              }}
              className="bg-gold text-gold-foreground hover:bg-gold/90 shadow-sm"
            >
              <Plus className="h-4 w-4 mr-1.5" /> New Event
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(
            [
              ["all", "All Events"],
              ["internal", "Internal"],
              ["community", "Community"],
              ["sponsorship", "Sponsorship"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setSelectedType(val)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border",
                selectedType === val
                  ? "bg-gold text-gold-foreground border-gold shadow-sm"
                  : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/70 hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events or locations…"
            className="pl-8 text-xs h-9 bg-muted/20"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loadingEvents ? (
        <div className="py-20 text-center text-muted-foreground animate-pulse">
          Loading special events…
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-border rounded-2xl bg-card/40 p-8 space-y-3">
          <CalendarCheck className="h-10 w-10 text-gold/40 mx-auto" />
          <h3 className="text-base font-semibold">No events found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? "No events matching your search query. Try clearing filters."
              : activeTab === "upcoming"
                ? "There are no upcoming special events scheduled right now. Check back soon!"
                : "No past events found."}
          </p>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingEvent(null);
                setEditorOpen(true);
              }}
              className="mt-2 border-gold/40 text-gold"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Create an event
            </Button>
          )}
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((ev) => {
            const evSignups = signups.filter((s) => s.event_id === ev.id);
            const evGroups = groups.filter((g) => g.event_id === ev.id);
            const evCommittee = committee.filter((c) => c.event_id === ev.id);
            const mySignup = signups.find(
              (s) => s.event_id === ev.id && s.user_id === user?.id,
            );
            const onMyCommittee = committee.some(
              (c) => c.event_id === ev.id && c.user_id === user?.id,
            );

            return (
              <SpecialEventCard
                key={ev.id}
                event={ev}
                signups={evSignups}
                groups={evGroups}
                committee={evCommittee}
                mySignup={mySignup ?? null}
                onCommittee={onMyCommittee}
                profiles={profiles}
                currentUserId={user?.id}
                canManage={canManage}
                onSimpleSignup={(status) =>
                  simpleSignup.mutate({ eventId: ev.id, status })
                }
                onCancelSignup={() => cancelSignup.mutate(ev.id)}
                onOpenGroupSignup={() => setGroupSignupEvent(ev)}
                onToggleCommittee={() =>
                  toggleCommittee.mutate({
                    eventId: ev.id,
                    isMember: onMyCommittee,
                  })
                }
                onOpenRoster={() => setRosterEvent(ev)}
                onEditEvent={() => {
                  setEditingEvent(ev);
                  setEditorOpen(true);
                }}
                onDeleteEvent={() => {
                  if (confirm(`Delete event "${ev.title}"?`)) {
                    deleteEvent.mutate(ev.id);
                  }
                }}
                onToggleArchive={() =>
                  toggleArchive.mutate({ id: ev.id, archived: !ev.archived })
                }
              />
            );
          })}
        </div>
      ) : (
        <SpecialEventsCalendarView
          currentMonth={currentMonth}
          onPrevMonth={() => setCurrentMonth((m) => subMonths(m, 1))}
          onNextMonth={() => setCurrentMonth((m) => addMonths(m, 1))}
          events={filteredEvents}
          signups={signups}
          currentUserId={user?.id}
          onSelectEvent={(ev) => {
            setRosterEvent(ev);
          }}
        />
      )}

      {/* Group Sign-Up Dialog */}
      {groupSignupEvent && (
        <GroupSignupDialog
          event={groupSignupEvent}
          groups={groups.filter((g) => g.event_id === groupSignupEvent.id)}
          signups={signups.filter((s) => s.event_id === groupSignupEvent.id)}
          profiles={profiles}
          currentUserId={user?.id}
          mySignup={
            signups.find(
              (s) =>
                s.event_id === groupSignupEvent.id && s.user_id === user?.id,
            ) ?? null
          }
          onClose={() => setGroupSignupEvent(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["special-event-groups"] });
            qc.invalidateQueries({ queryKey: ["special-event-signups"] });
          }}
        />
      )}

      {/* Admin Event Editor Dialog */}
      {editorOpen && (
        <EventEditorDialog
          event={editingEvent}
          onClose={() => {
            setEditorOpen(false);
            setEditingEvent(null);
          }}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["special-events"] });
            setEditorOpen(false);
            setEditingEvent(null);
          }}
        />
      )}

      {/* Manage Roster Dialog */}
      {rosterEvent && (
        <EventRosterDialog
          event={rosterEvent}
          signups={signups.filter((s) => s.event_id === rosterEvent.id)}
          groups={groups.filter((g) => g.event_id === rosterEvent.id)}
          committee={committee.filter((c) => c.event_id === rosterEvent.id)}
          profiles={profiles}
          canManage={canManage}
          onClose={() => setRosterEvent(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["special-event-signups"] });
            qc.invalidateQueries({ queryKey: ["special-event-groups"] });
            qc.invalidateQueries({ queryKey: ["special-event-committee"] });
            qc.invalidateQueries({ queryKey: ["special-events"] });
          }}
        />
      )}
    </div>
  );
}

// ─── Special Event Card Component ─────────────────────────────────────────────

function SpecialEventCard({
  event,
  signups,
  groups,
  committee,
  mySignup,
  onCommittee,
  profiles,
  currentUserId,
  canManage,
  onSimpleSignup,
  onCancelSignup,
  onOpenGroupSignup,
  onToggleCommittee,
  onOpenRoster,
  onEditEvent,
  onDeleteEvent,
  onToggleArchive,
}: {
  event: SpecialEvent;
  signups: SpecialEventSignup[];
  groups: SpecialEventGroup[];
  committee: SpecialEventCommittee[];
  mySignup: SpecialEventSignup | null;
  onCommittee: boolean;
  profiles: SpecialEventProfile[];
  currentUserId?: string;
  canManage: boolean;
  onSimpleSignup: (status: "confirmed" | "waitlist") => void;
  onCancelSignup: () => void;
  onOpenGroupSignup: () => void;
  onToggleCommittee: () => void;
  onOpenRoster: () => void;
  onEditEvent: () => void;
  onDeleteEvent: () => void;
  onToggleArchive: () => void;
}) {
  const confirmedSignups = signups.filter((s) => s.status === "confirmed");
  const waitlistSignups = signups.filter((s) => s.status === "waitlist");

  // Capacity calculations
  const isCapped = event.capacity_mode === "simple" && !!event.max_capacity;
  const isFull = isCapped && confirmedSignups.length >= (event.max_capacity ?? 0);
  const spotsLeft = isCapped ? Math.max(0, (event.max_capacity ?? 0) - confirmedSignups.length) : null;
  const capacityPercent = isCapped
    ? Math.min(100, (confirmedSignups.length / (event.max_capacity || 1)) * 100)
    : 0;

  // Group calculations
  const isGroupMode = event.capacity_mode === "group";
  const maxPerGroup = event.max_per_group || 4;
  const openGroupsCount = groups.filter((g) => {
    const membersCount = signups.filter((s) => s.group_id === g.id && s.status === "confirmed").length;
    return membersCount < maxPerGroup;
  }).length;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-gold/40 transition-all flex flex-col group">
      {/* Cover Image Banner */}
      <div className="relative h-44 w-full bg-gradient-to-br from-navy-800 via-navy-900 to-black overflow-hidden flex items-center justify-center">
        {event.cover_image_url ? (
          <img
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-gold/10 via-navy-800 to-gold/5 p-6 text-center">
            <Sparkles className="h-10 w-10 text-gold/30" />
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className={cn("text-[11px] font-semibold tracking-wide backdrop-blur-md shadow-sm", SPECIAL_EVENT_TYPE_BADGES[event.event_type])}
          >
            {SPECIAL_EVENT_TYPE_LABELS[event.event_type]}
          </Badge>
          {event.archived && (
            <Badge variant="secondary" className="text-[10px] bg-muted/80">
              Archived
            </Badge>
          )}
        </div>

        {/* Admin Menu */}
        {canManage && (
          <div className="absolute top-3 right-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onOpenRoster}>
                  <Users className="h-4 w-4 mr-2 text-gold" /> Manage Roster
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEditEvent}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleArchive}>
                  {event.archived ? (
                    <>
                      <ArchiveRestore className="h-4 w-4 mr-2" /> Restore Event
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 mr-2" /> Archive Event
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDeleteEvent}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Event
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Date / Time Overlay Tag */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white drop-shadow">
          <span className="font-semibold text-sm truncate text-white">
            {format(parseISO(event.event_date), "MMM d, yyyy")}
            {event.start_time && ` · ${formatEventTime(event.start_time)}`}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2.5">
          <h2 className="font-bold text-lg text-foreground line-clamp-2 group-hover:text-gold transition-colors">
            {event.title}
          </h2>

          {event.location && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-gold shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}

          {event.description && (
            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
              {event.description}
            </p>
          )}
        </div>

        {/* Capacity / Group Details Section */}
        <div className="pt-3 border-t border-border/50 space-y-2.5">
          {event.requires_rsvp ? (
            isCapped ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Attendee Spots</span>
                  <span className={cn("font-medium", isFull ? "text-amber-400" : "text-foreground")}>
                    {confirmedSignups.length} of {event.max_capacity} filled
                    {isFull && " (Full)"}
                  </span>
                </div>
                <Progress value={capacityPercent} className="h-2 bg-muted/60" />
                {waitlistSignups.length > 0 && (
                  <p className="text-[11px] text-amber-400">
                    {waitlistSignups.length} person{waitlistSignups.length === 1 ? "" : "s"} on waitlist
                  </p>
                )}
              </div>
            ) : isGroupMode ? (
              <div className="bg-muted/30 border border-border/60 rounded-lg p-2.5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-gold" />
                    Team Sign-Up ({maxPerGroup} per group)
                  </span>
                  <span className="text-[11px] text-gold font-medium">
                    {openGroupsCount} open group{openGroupsCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {confirmedSignups.length} player{confirmedSignups.length === 1 ? "" : "s"} registered across {groups.length} group{groups.length === 1 ? "" : "s"}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>{confirmedSignups.length} attendee{confirmedSignups.length === 1 ? "" : "s"} registered (Open RSVP)</span>
              </div>
            )
          ) : (
            <div className="text-xs text-muted-foreground italic">
              No RSVP required — open attendance for all agents
            </div>
          )}

          {/* Committee count badge */}
          {event.allows_committee && (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Star className="h-3 w-3 text-gold" /> Event Committee:
              </span>
              <span className="text-[11px] font-medium text-gold">
                {committee.length} volunteer{committee.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-border/50 flex flex-col gap-2">
          {/* Main RSVP Area */}
          {event.requires_rsvp && (
            mySignup ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-medium text-emerald-300">
                      {mySignup.status === "confirmed" ? "You're Going!" : "On Waitlist"}
                    </span>
                  </div>
                  {isGroupMode && mySignup.group_id && (
                    <span className="text-[10px] text-emerald-400/80 max-w-[100px] truncate">
                      {groups.find((g) => g.id === mySignup.group_id)?.name}
                    </span>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                      Options
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isGroupMode && (
                      <DropdownMenuItem onClick={onOpenGroupSignup}>
                        <Layers className="h-3.5 w-3.5 mr-2" /> Change Group
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={onCancelSignup}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Cancel RSVP
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : isGroupMode ? (
              <Button
                onClick={onOpenGroupSignup}
                className="w-full bg-gold text-gold-foreground hover:bg-gold/90 text-xs font-semibold h-9 shadow-sm"
              >
                <UserPlus className="h-4 w-4 mr-1.5" /> Join or Create Group
              </Button>
            ) : isCapped && isFull ? (
              event.enable_waitlist ? (
                <Button
                  onClick={() => onSimpleSignup("waitlist")}
                  variant="outline"
                  className="w-full border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-xs font-semibold h-9"
                >
                  <Clock className="h-4 w-4 mr-1.5" /> Join Waitlist
                </Button>
              ) : (
                <Button disabled className="w-full text-xs h-9 bg-muted text-muted-foreground">
                  Event Full (Capacity Reached)
                </Button>
              )
            ) : (
              <Button
                onClick={() => onSimpleSignup("confirmed")}
                className="w-full bg-gold text-gold-foreground hover:bg-gold/90 text-xs font-semibold h-9 shadow-sm"
              >
                <UserCheck className="h-4 w-4 mr-1.5" /> RSVP — Attend Event
              </Button>
            )
          )}

          {/* Secondary Actions: Committee & Calendar */}
          <div className="flex items-center gap-2">
            {event.allows_committee && (
              <Button
                onClick={onToggleCommittee}
                variant="outline"
                size="sm"
                className={cn(
                  "flex-1 text-xs h-8",
                  onCommittee
                    ? "bg-gold/15 text-gold border-gold/40 hover:bg-gold/25"
                    : "border-border text-muted-foreground hover:text-gold hover:border-gold/40",
                )}
                title="Volunteer to help plan and organize this event"
              >
                <Star className={cn("h-3.5 w-3.5 mr-1.5", onCommittee && "fill-current")} />
                {onCommittee ? "On Committee" : "Join Committee"}
              </Button>
            )}

            {/* Calendar Integration Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground"
                  title="Add to Calendar"
                >
                  <CalendarIcon className="h-3.5 w-3.5 mr-1" /> Add to Cal
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => window.open(buildGoogleCalendarUrl(event), "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-2 text-gold" /> Google Calendar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadIcsFile(event)}>
                  <Download className="h-3.5 w-3.5 mr-2" /> Apple / Outlook (.ics)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Roster button for everyone to see friends / committee */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenRoster}
              className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
              title="View Attendee & Committee Roster"
            >
              <Users className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Special Events Calendar Month View ──────────────────────────────────────

function SpecialEventsCalendarView({
  currentMonth,
  onPrevMonth,
  onNextMonth,
  events,
  signups,
  currentUserId,
  onSelectEvent,
}: {
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  events: SpecialEvent[];
  signups: SpecialEventSignup[];
  currentUserId?: string;
  onSelectEvent: (ev: SpecialEvent) => void;
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const today = new Date();

  // Prefix empty slots for grid alignment
  const startDay = monthStart.getDay();
  const blanks = Array.from({ length: startDay });

  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
      {/* Month Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" onClick={onPrevMonth} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onNextMonth} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground py-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} className="min-h-[90px] rounded-lg bg-muted/10" />
        ))}
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayEvents = events.filter((e) => e.event_date === dateStr);
          const isCurrentDay = isSameDay(day, today);

          return (
            <div
              key={dateStr}
              className={cn(
                "min-h-[90px] rounded-xl border p-2 flex flex-col justify-between transition-colors",
                isCurrentDay
                  ? "border-gold/60 bg-gold/5"
                  : "border-border/60 bg-card hover:border-gold/30",
              )}
            >
              <div className="flex items-center justify-between text-xs font-medium mb-1">
                <span className={cn("px-1.5 py-0.5 rounded-full", isCurrentDay && "bg-gold text-gold-foreground font-bold")}>
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <div className="space-y-1 overflow-y-auto max-h-20">
                {dayEvents.map((ev) => {
                  const isAttending = signups.some(
                    (s) => s.event_id === ev.id && s.user_id === currentUserId && s.status === "confirmed",
                  );
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onSelectEvent(ev)}
                      className={cn(
                        "w-full text-left px-1.5 py-1 rounded-md text-[11px] truncate block font-medium transition-transform hover:scale-[1.02]",
                        SPECIAL_EVENT_TYPE_BADGES[ev.event_type],
                      )}
                    >
                      {isAttending && "✓ "}
                      {ev.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Group Sign-Up Dialog (e.g. Golf Tournament) ──────────────────────────────

function GroupSignupDialog({
  event,
  groups,
  signups,
  profiles,
  currentUserId,
  mySignup,
  onClose,
  onChanged,
}: {
  event: SpecialEvent;
  groups: SpecialEventGroup[];
  signups: SpecialEventSignup[];
  profiles: SpecialEventProfile[];
  currentUserId?: string;
  mySignup: SpecialEventSignup | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const maxPerGroup = event.max_per_group || 4;
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const joinGroup = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await sb.from("special_event_signups").upsert(
        {
          event_id: event.id,
          user_id: currentUserId,
          group_id: groupId,
          status: "confirmed",
        },
        { onConflict: "event_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Joined group!");
      onChanged();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createAndJoinGroup = useMutation({
    mutationFn: async () => {
      if (!newGroupName.trim()) return;
      setCreating(true);

      // 1. Insert new group
      const { data: newGroup, error: gErr } = await sb
        .from("special_event_groups")
        .insert({
          event_id: event.id,
          name: newGroupName.trim(),
          created_by: currentUserId,
        })
        .select("id")
        .single();
      if (gErr) throw gErr;

      // 2. Assign user to this group
      const { error: sErr } = await sb.from("special_event_signups").upsert(
        {
          event_id: event.id,
          user_id: currentUserId,
          group_id: newGroup.id,
          status: "confirmed",
        },
        { onConflict: "event_id,user_id" },
      );
      if (sErr) throw sErr;
    },
    onSuccess: () => {
      toast.success("Created and joined group!");
      setNewGroupName("");
      setCreating(false);
      onChanged();
      onClose();
    },
    onError: (e: any) => {
      setCreating(false);
      toast.error(e.message);
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-gold" />
            Group Sign-Up: {event.title}
          </DialogTitle>
          <DialogDescription>
            Join an existing open group or create a new team (Max {maxPerGroup} players per group).
          </DialogDescription>
        </DialogHeader>

        {/* Existing Groups List */}
        <div className="space-y-3 py-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Available Groups ({groups.length})
          </h3>

          {groups.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
              No groups created yet. Be the first to start a group!
            </div>
          ) : (
            <div className="space-y-2.5">
              {groups.map((g) => {
                const groupMembers = signups.filter(
                  (s) => s.group_id === g.id && s.status === "confirmed",
                );
                const isFull = groupMembers.length >= maxPerGroup;
                const isMyGroup = mySignup?.group_id === g.id;

                return (
                  <div
                    key={g.id}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3",
                      isMyGroup
                        ? "border-emerald-500/50 bg-emerald-500/5"
                        : isFull
                          ? "border-border/40 bg-muted/20 opacity-75"
                          : "border-border bg-card hover:border-gold/40",
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{g.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            isFull
                              ? "bg-muted text-muted-foreground"
                              : "bg-gold/10 text-gold border-gold/30",
                          )}
                        >
                          {groupMembers.length} / {maxPerGroup} spots
                        </Badge>
                        {isMyGroup && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                            Your Group
                          </Badge>
                        )}
                      </div>

                      {/* Members Names List */}
                      <div className="text-xs text-muted-foreground truncate">
                        {groupMembers.length === 0 ? (
                          <span className="italic">Empty group</span>
                        ) : (
                          groupMembers.map((m, idx) => {
                            const p = profileMap.get(m.user_id);
                            const name = p
                              ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email
                              : "Player";
                            return (
                              <span key={m.id}>
                                {idx > 0 && ", "}
                                {name}
                                {m.user_id === currentUserId && " (You)"}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div>
                      {isMyGroup ? (
                        <Button size="sm" variant="outline" disabled className="text-xs h-8">
                          Current
                        </Button>
                      ) : isFull ? (
                        <Button size="sm" variant="ghost" disabled className="text-xs h-8 text-muted-foreground">
                          Full
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => joinGroup.mutate(g.id)}
                          disabled={joinGroup.isPending}
                          className="bg-gold text-gold-foreground hover:bg-gold/90 text-xs h-8"
                        >
                          Join Group
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Start New Group Section */}
        <div className="pt-4 border-t border-border space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5 text-gold" /> Start a New Group
          </h3>
          <div className="flex gap-2">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Enter team or group name (e.g. Foursome Alpha)…"
              className="text-xs"
            />
            <Button
              onClick={() => createAndJoinGroup.mutate()}
              disabled={!newGroupName.trim() || creating}
              className="bg-gold text-gold-foreground hover:bg-gold/90 text-xs shrink-0"
            >
              Create &amp; Join
            </Button>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Admin Event Editor Dialog ────────────────────────────────────────────────

function EventEditorDialog({
  event,
  onClose,
  onSuccess,
}: {
  event: SpecialEvent | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [eventDate, setEventDate] = useState(event?.event_date || format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(event?.start_time ? event.start_time.slice(0, 5) : "18:00");
  const [endTime, setEndTime] = useState(event?.end_time ? event.end_time.slice(0, 5) : "21:00");
  const [location, setLocation] = useState(event?.location || "");
  const [eventType, setEventType] = useState<SpecialEventType>(event?.event_type || "internal");
  const [coverImageUrl, setCoverImageUrl] = useState(event?.cover_image_url || "");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Settings
  const [requiresRsvp, setRequiresRsvp] = useState(event ? event.requires_rsvp : true);
  const [allowsCommittee, setAllowsCommittee] = useState(event ? event.allows_committee : false);
  const [capacityMode, setCapacityMode] = useState<CapacityMode>(event?.capacity_mode || "none");
  const [maxCapacity, setMaxCapacity] = useState<string>(event?.max_capacity ? String(event.max_capacity) : "50");
  const [enableWaitlist, setEnableWaitlist] = useState(event ? event.enable_waitlist : true);
  const [maxGroups, setMaxGroups] = useState<string>(event?.max_groups ? String(event.max_groups) : "");
  const [maxPerGroup, setMaxPerGroup] = useState<string>(event?.max_per_group ? String(event.max_per_group) : "4");

  const [syncGoogleCalendar, setSyncGoogleCalendar] = useState(event ? event.sync_google_calendar : false);

  const onCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const key = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("special-event-covers")
        .upload(key, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("special-event-covers")
        .getPublicUrl(key);
      setCoverImageUrl(urlData.publicUrl);
      toast.success("Cover photo uploaded");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo");
    } finally {
      setUploadingImage(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !eventDate) {
        throw new Error("Title and Event Date are required");
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        event_date: eventDate,
        start_time: startTime ? `${startTime}:00` : null,
        end_time: endTime ? `${endTime}:00` : null,
        location: location.trim() || null,
        event_type: eventType,
        cover_image_url: coverImageUrl.trim() || null,
        requires_rsvp: requiresRsvp,
        allows_committee: allowsCommittee,
        capacity_mode: capacityMode,
        max_capacity: capacityMode === "simple" && maxCapacity ? parseInt(maxCapacity, 10) : null,
        enable_waitlist: enableWaitlist,
        max_groups: capacityMode === "group" && maxGroups ? parseInt(maxGroups, 10) : null,
        max_per_group: capacityMode === "group" && maxPerGroup ? parseInt(maxPerGroup, 10) : 4,
        sync_google_calendar: syncGoogleCalendar,
        updated_at: new Date().toISOString(),
      };

      if (event) {
        const { error } = await sb.from("special_events").update(payload).eq("id", event.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("special_events").insert({
          ...payload,
          created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(event ? "Event updated" : "Event created");
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            {event ? "Edit Special Event" : "Create New Special Event"}
          </DialogTitle>
          <DialogDescription>
            Configure event details, cover image, RSVP rules, and capacity limits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title & Category */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Event Title *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Boopalooza 2026, MSREG Annual Golf Classic…"
                className="text-sm font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Event Type
              </label>
              <Select value={eventType} onValueChange={(v) => setEventType(v as SpecialEventType)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal Event</SelectItem>
                  <SelectItem value="community">Community Event</SelectItem>
                  <SelectItem value="sponsorship">Sponsorship</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date, Times & Location */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Event Date *
              </label>
              <Input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Start Time
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                End Time
              </label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Location / Venue
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Oak Meadow Country Club / Rolla City Park"
              className="text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Event Description &amp; Details
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Provide context, schedule, dress code, or agent expectations…"
              className="text-xs"
            />
          </div>

          {/* Cover Photo Upload */}
          <div className="space-y-2 p-3 bg-muted/20 border border-border rounded-xl">
            <label className="text-xs font-semibold text-muted-foreground uppercase block">
              Cover Image / Poster
            </label>
            <div className="flex items-center gap-3">
              {coverImageUrl && (
                <img
                  src={coverImageUrl}
                  alt="Cover preview"
                  className="h-16 w-28 object-cover rounded-lg border border-border shrink-0"
                />
              )}
              <div className="flex-1 space-y-1.5">
                <Input
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="Paste image URL or upload below…"
                  className="text-xs"
                />
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onCoverUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                    <span className="inline-flex items-center text-xs font-medium text-gold hover:underline">
                      <Upload className="h-3 w-3 mr-1" />
                      {uploadingImage ? "Uploading…" : "Upload from Computer"}
                    </span>
                  </label>
                  {coverImageUrl && (
                    <button
                      type="button"
                      onClick={() => setCoverImageUrl("")}
                      className="text-xs text-destructive hover:underline ml-auto"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RSVP & Committee Toggles */}
          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Requires RSVP / Signup</span>
                <input
                  type="checkbox"
                  checked={requiresRsvp}
                  onChange={(e) => setRequiresRsvp(e.target.checked)}
                  className="h-4 w-4 accent-gold"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                When enabled, agents can sign up as attendees.
              </p>
            </div>

            <div className="p-3 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Event Committee Opt-In</span>
                <input
                  type="checkbox"
                  checked={allowsCommittee}
                  onChange={(e) => setAllowsCommittee(e.target.checked)}
                  className="h-4 w-4 accent-gold"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Allows agents to volunteer to help plan/organize this event.
              </p>
            </div>
          </div>

          {/* Capacity Settings (If RSVP required) */}
          {requiresRsvp && (
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Capacity Mode
                </label>
                <Select
                  value={capacityMode}
                  onValueChange={(v) => setCapacityMode(v as CapacityMode)}
                >
                  <SelectTrigger className="w-56 text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Capacity Limit (Open)</SelectItem>
                    <SelectItem value="simple">Simple Total Cap (Seats Limit)</SelectItem>
                    <SelectItem value="group">Group / Team Cap (Foursomes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {capacityMode === "simple" && (
                <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Max Total Spots
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={maxCapacity}
                      onChange={(e) => setMaxCapacity(e.target.value)}
                      placeholder="e.g. 50"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1 flex flex-col justify-center">
                    <label className="text-xs font-medium text-foreground flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={enableWaitlist}
                        onChange={(e) => setEnableWaitlist(e.target.checked)}
                        className="h-4 w-4 accent-gold"
                      />
                      Enable Waitlist when full
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Allows overflow agents to queue up.
                    </p>
                  </div>
                </div>
              )}

              {capacityMode === "group" && (
                <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Max Players Per Group
                    </label>
                    <Input
                      type="number"
                      min="2"
                      value={maxPerGroup}
                      onChange={(e) => setMaxPerGroup(e.target.value)}
                      placeholder="e.g. 4 (foursome)"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Max Number of Groups (Optional)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={maxGroups}
                      onChange={(e) => setMaxGroups(e.target.value)}
                      placeholder="Leave blank for unlimited groups"
                      className="text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Google Calendar Sync */}
          <div className="p-3 rounded-xl border border-border bg-card flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-gold" />
                Google Calendar Auto-Invite Sync
              </span>
              <p className="text-[11px] text-muted-foreground">
                Sync this event and dispatch Google Calendar invites to confirmed signups.
              </p>
            </div>
            <input
              type="checkbox"
              checked={syncGoogleCalendar}
              onChange={(e) => setSyncGoogleCalendar(e.target.checked)}
              className="h-4 w-4 accent-gold"
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !title.trim()}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            {saveMutation.isPending ? "Saving…" : event ? "Save Changes" : "Create Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manage Roster Dialog ─────────────────────────────────────────────────────

function EventRosterDialog({
  event,
  signups,
  groups,
  committee,
  profiles,
  canManage,
  onClose,
  onChanged,
}: {
  event: SpecialEvent;
  signups: SpecialEventSignup[];
  groups: SpecialEventGroup[];
  committee: SpecialEventCommittee[];
  profiles: SpecialEventProfile[];
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"attendees" | "committee">("attendees");
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const groupMap = new Map(groups.map((g) => [g.id, g.name]));

  const confirmed = signups.filter((s) => s.status === "confirmed");
  const waitlist = signups.filter((s) => s.status === "waitlist");

  const syncGcal = useMutation({
    mutationFn: async () => {
      const res = await syncEventToGoogleCalendar({
        data: { eventId: event.id },
      });
      return res;
    },
    onSuccess: (res) => {
      if (res.synced) {
        toast.success(`Synced ${res.attendeesCount} attendees with Google Calendar!`);
        onChanged();
      } else {
        toast.warning(res.warning || "Google Calendar sync completed with warnings.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeAttendee = useMutation({
    mutationFn: async (signupId: string) => {
      const { error } = await sb.from("special_event_signups").delete().eq("id", signupId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendee removed");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ signupId, status }: { signupId: string; status: "confirmed" | "waitlist" }) => {
      const { error } = await sb
        .from("special_event_signups")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", signupId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendee status updated");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gold" />
              Event Roster: {event.title}
            </DialogTitle>
          </div>
          <DialogDescription>
            {formatEventDateTime(event.event_date, event.start_time, event.end_time)}
            {event.location && ` · ${event.location}`}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs & Actions Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-b border-border pb-3">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="h-8"
          >
            <TabsList className="bg-muted/50 p-0.5 border border-border">
              <TabsTrigger value="attendees" className="text-xs">
                Attendees ({signups.length})
              </TabsTrigger>
              <TabsTrigger value="committee" className="text-xs">
                Committee ({committee.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            {activeTab === "attendees" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportAttendeesCsv(event, signups, profiles, groups)}
                disabled={signups.length === 0}
                className="text-xs h-8"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Export Attendees CSV
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCommitteeCsv(event, committee, profiles)}
                disabled={committee.length === 0}
                className="text-xs h-8"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Export Committee CSV
              </Button>
            )}

            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncGcal.mutate()}
                disabled={syncGcal.isPending}
                className="text-xs h-8 border-gold/40 text-gold"
                title="Dispatch Google Calendar invites"
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", syncGcal.isPending && "animate-spin")} />
                Sync GCal
              </Button>
            )}
          </div>
        </div>

        {/* Attendees View */}
        {activeTab === "attendees" && (
          <div className="space-y-4 py-2">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl border border-border bg-card">
                <span className="text-muted-foreground block text-[11px]">Confirmed</span>
                <span className="text-lg font-bold text-emerald-400">{confirmed.length}</span>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-card">
                <span className="text-muted-foreground block text-[11px]">Waitlist</span>
                <span className="text-lg font-bold text-amber-400">{waitlist.length}</span>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-card">
                <span className="text-muted-foreground block text-[11px]">Groups / Teams</span>
                <span className="text-lg font-bold text-gold">{groups.length}</span>
              </div>
            </div>

            {signups.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                No signups yet for this event.
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                {signups.map((s) => {
                  const p = profileMap.get(s.user_id);
                  const name = p
                    ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email
                    : "Unknown User";
                  const groupName = s.group_id ? groupMap.get(s.group_id) : null;

                  return (
                    <div
                      key={s.id}
                      className="p-3 flex items-center justify-between gap-3 text-xs bg-card/60 hover:bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground truncate">{name}</span>
                          <span className="text-muted-foreground text-[11px] truncate">
                            {p?.email}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              s.status === "confirmed"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30",
                            )}
                          >
                            {s.status === "confirmed" ? "Confirmed" : "Waitlist"}
                          </Badge>
                          {groupName && (
                            <Badge variant="outline" className="text-[10px] bg-gold/10 text-gold border-gold/30">
                              {groupName}
                            </Badge>
                          )}
                        </div>
                        {s.notes && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            Note: {s.notes}
                          </p>
                        )}
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              toggleStatus.mutate({
                                signupId: s.id,
                                status: s.status === "confirmed" ? "waitlist" : "confirmed",
                              })
                            }
                            className="h-7 text-[11px] px-2"
                          >
                            {s.status === "confirmed" ? "Move to Waitlist" : "Confirm"}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Remove ${name} from this event?`)) {
                                removeAttendee.mutate(s.id);
                              }
                            }}
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Remove Attendee"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Committee View */}
        {activeTab === "committee" && (
          <div className="space-y-4 py-2">
            {committee.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                No committee volunteers yet.
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                {committee.map((c) => {
                  const p = profileMap.get(c.user_id);
                  const name = p
                    ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email
                    : "Unknown User";

                  return (
                    <div
                      key={c.id}
                      className="p-3 flex items-center justify-between gap-3 text-xs bg-card/60 hover:bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{name}</span>
                          <span className="text-muted-foreground text-[11px]">{p?.email}</span>
                          <Badge variant="outline" className="text-[10px] bg-gold/10 text-gold border-gold/30 flex items-center gap-1">
                            <Star className="h-2.5 w-2.5 fill-current" /> Committee Member
                          </Badge>
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Joined {format(new Date(c.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
