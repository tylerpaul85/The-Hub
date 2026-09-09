import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  MapPin,
  Clock,
  Users,
  UserCheck,
  Star,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Plus,
  Loader2,
  Calendar as CalendarIcon,
  X,
  Info,
  UserPlus,
} from "lucide-react";
import { format, parseISO, isBefore, startOfToday, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  SpecialEvent,
  SpecialEventGroup,
  SpecialEventSignup,
  SpecialEventCommittee,
  SpecialEventType,
} from "@/lib/special-events";
import {
  SPECIAL_EVENT_TYPE_LABELS,
  SPECIAL_EVENT_TYPE_BADGES,
  formatEventDateTime,
  formatEventTime,
  buildGoogleCalendarUrl,
  downloadIcsFile,
} from "@/lib/special-events";
import {
  listPublicSpecialEvents,
  rsvpPublicSpecialEvent,
  cancelPublicSpecialEventRsvp,
  togglePublicSpecialEventCommittee,
  createPublicSpecialEventGroup,
} from "@/lib/toolbox-public.functions";

const AGENT_NAME_KEY = "msreg-agent-name";
const AGENT_EMAIL_KEY = "msreg-agent-email";

export function SpecialEventsAgentView({ token }: { token: string }) {
  const qc = useQueryClient();
  const fetchEvents = useServerFn(listPublicSpecialEvents);
  const rsvpFn = useServerFn(rsvpPublicSpecialEvent);
  const cancelRsvpFn = useServerFn(cancelPublicSpecialEventRsvp);
  const toggleCommitteeFn = useServerFn(togglePublicSpecialEventCommittee);
  const createGroupFn = useServerFn(createPublicSpecialEventGroup);

  // Filter state
  const [activeTimeFilter, setActiveTimeFilter] = useState<"upcoming" | "past">("upcoming");
  const [selectedType, setSelectedType] = useState<"all" | SpecialEventType>("all");
  const [viewMode, setViewMode] = useState<"cards" | "calendar">("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Agent profile state (stored in localStorage for fast repeated RSVPs)
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [isEditingAgentProfile, setIsEditingAgentProfile] = useState(false);

  useEffect(() => {
    try {
      const savedName = localStorage.getItem(AGENT_NAME_KEY) || "";
      const savedEmail = localStorage.getItem(AGENT_EMAIL_KEY) || "";
      if (savedName) setAgentName(savedName);
      if (savedEmail) setAgentEmail(savedEmail);
    } catch {}
  }, []);

  const saveAgentProfile = (name: string, email: string) => {
    try {
      localStorage.setItem(AGENT_NAME_KEY, name.trim());
      localStorage.setItem(AGENT_EMAIL_KEY, email.trim().toLowerCase());
    } catch {}
    setAgentName(name.trim());
    setAgentEmail(email.trim().toLowerCase());
  };

  // Dialog state
  const [rsvpEvent, setRsvpEvent] = useState<SpecialEvent | null>(null);
  const [committeeEvent, setCommitteeEvent] = useState<SpecialEvent | null>(null);
  const [detailsEvent, setDetailsEvent] = useState<SpecialEvent | null>(null);

  // RSVP Form state
  const [rsvpName, setRsvpName] = useState("");
  const [rsvpEmail, setRsvpEmail] = useState("");
  const [rsvpGroupId, setRsvpGroupId] = useState<string>("");
  const [rsvpNotes, setRsvpNotes] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  // Committee Form state
  const [comName, setComName] = useState("");
  const [comEmail, setComEmail] = useState("");
  const [comNotes, setComNotes] = useState("");

  // Queries
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-special-events", token],
    queryFn: () => fetchEvents({ data: { token } }),
  });

  const events = (data?.events ?? []) as SpecialEvent[];
  const groups = (data?.groups ?? []) as SpecialEventGroup[];
  const signups = (data?.signups ?? []) as SpecialEventSignup[];
  const committee = (data?.committee ?? []) as SpecialEventCommittee[];

  const today = startOfToday();

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const evDate = parseISO(ev.event_date);
      const isPast = isBefore(evDate, today);

      if (activeTimeFilter === "upcoming" && isPast) return false;
      if (activeTimeFilter === "past" && !isPast) return false;

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
  }, [events, activeTimeFilter, selectedType, searchQuery, today]);

  // Mutations
  const rsvpMutation = useMutation({
    mutationFn: async (payload: {
      eventId: string;
      agentName: string;
      agentEmail: string;
      groupId?: string | null;
      notes?: string | null;
    }) => {
      return await rsvpFn({
        data: {
          token,
          ...payload,
        },
      });
    },
    onSuccess: (res, vars) => {
      saveAgentProfile(vars.agentName, vars.agentEmail);
      qc.invalidateQueries({ queryKey: ["public-special-events", token] });
      if (res.status === "waitlist") {
        toast.info("You've been added to the Waitlist! We'll notify you if a spot opens up.");
      } else {
        toast.success("RSVP Confirmed! See you there.");
      }
      setRsvpEvent(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to RSVP");
    },
  });

  const cancelRsvpMutation = useMutation({
    mutationFn: async ({ eventId, email }: { eventId: string; email: string }) => {
      return await cancelRsvpFn({
        data: { token, eventId, agentEmail: email },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-special-events", token] });
      toast.success("RSVP cancelled.");
      setRsvpEvent(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Could not cancel RSVP");
    },
  });

  const committeeMutation = useMutation({
    mutationFn: async (payload: {
      eventId: string;
      agentName: string;
      agentEmail: string;
      isJoining: boolean;
      notes?: string | null;
    }) => {
      return await toggleCommitteeFn({
        data: { token, ...payload },
      });
    },
    onSuccess: (res, vars) => {
      saveAgentProfile(vars.agentName, vars.agentEmail);
      qc.invalidateQueries({ queryKey: ["public-special-events", token] });
      if (vars.isJoining) {
        toast.success("Thank you for volunteering for the event committee!");
      } else {
        toast.info("Removed from committee roster.");
      }
      setCommitteeEvent(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Could not update committee status");
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async ({ eventId, name }: { eventId: string; name: string }) => {
      return await createGroupFn({ data: { token, eventId, name } });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["public-special-events", token] });
      if (res?.group?.id) {
        setRsvpGroupId(res.group.id);
      }
      setIsCreatingGroup(false);
      setNewGroupName("");
      toast.success("Team/group created!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Could not create team");
    },
  });

  const openRsvpModal = (event: SpecialEvent) => {
    setRsvpEvent(event);
    setRsvpName(agentName || "");
    setRsvpEmail(agentEmail || "");
    setRsvpNotes("");
    setIsCreatingGroup(false);
    setNewGroupName("");

    // Check if user already signed up with a group
    const mySignup = signups.find(
      (s) => s.event_id === event.id && (s.agent_email ?? "").toLowerCase() === (agentEmail || "").toLowerCase(),
    );
    if (mySignup) {
      setRsvpGroupId(mySignup.group_id || "");
      setRsvpNotes(mySignup.notes || "");
      if (mySignup.agent_name) setRsvpName(mySignup.agent_name);
    } else {
      setRsvpGroupId("");
    }
  };

  const openCommitteeModal = (event: SpecialEvent) => {
    setCommitteeEvent(event);
    setComName(agentName || "");
    setComEmail(agentEmail || "");
    const myCom = committee.find(
      (c) => c.event_id === event.id && (c.agent_email ?? "").toLowerCase() === (agentEmail || "").toLowerCase(),
    );
    setComNotes(myCom?.notes || "");
    if (myCom?.agent_name) setComName(myCom.agent_name);
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-gold" />
        <p className="text-sm">Loading upcoming events…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-8 text-center border-dashed">
        <AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-2" />
        <p className="text-sm font-medium">Could not load special events.</p>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3">
          Try Again
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Agent Quick Profile Bar */}
      <div className="rounded-xl border border-gold/30 bg-card/60 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-gold/15 text-gold flex items-center justify-center font-semibold text-sm shrink-0">
            {agentName ? agentName.charAt(0).toUpperCase() : <Users className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">RSVPing as:</div>
            <div className="text-sm font-semibold truncate text-white">
              {agentName ? agentName : "Agent Name Not Set"}{" "}
              <span className="text-xs text-gold/80 font-normal">
                {agentEmail ? `(${agentEmail})` : "— Enter your details when RSVPing"}
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditingAgentProfile(!isEditingAgentProfile)}
          className="text-xs text-gold hover:text-gold/90 h-8 self-end sm:self-center"
        >
          {isEditingAgentProfile ? "Done" : "Update Profile Info"}
        </Button>
      </div>

      {isEditingAgentProfile && (
        <Card className="p-4 border-gold/40 bg-card space-y-3 animate-in fade-in slide-in-from-top-2">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-gold">
            Saved Agent Info for Fast Sign-ups
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Your Full Name</label>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="h-9 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Your Agent Email</label>
              <Input
                type="email"
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
                placeholder="e.g. jane@mattsmithrealestategroup.com"
                className="h-9 text-sm mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="sm"
              className="bg-gold text-navy hover:bg-gold/90 text-xs font-semibold h-8"
              onClick={() => {
                saveAgentProfile(agentName, agentEmail);
                setIsEditingAgentProfile(false);
                toast.success("Profile details saved");
              }}
            >
              Save & Close
            </Button>
          </div>
        </Card>
      )}

      {/* Controls & Search */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search upcoming events by title, description, or location..."
              className="pl-9 h-11 text-base bg-card"
            />
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto bg-card border border-border rounded-lg p-1">
            <Button
              size="sm"
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              onClick={() => setViewMode("cards")}
              className="text-xs h-8 px-3"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Cards
            </Button>
            <Button
              size="sm"
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              onClick={() => setViewMode("calendar")}
              className="text-xs h-8 px-3"
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1" /> Calendar
            </Button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <Button
              size="sm"
              variant={selectedType === "all" ? "default" : "outline"}
              onClick={() => setSelectedType("all")}
              className={cn("text-xs h-8 rounded-full px-3", selectedType === "all" && "bg-gold text-navy font-semibold hover:bg-gold/90")}
            >
              All Types
            </Button>
            <Button
              size="sm"
              variant={selectedType === "internal" ? "default" : "outline"}
              onClick={() => setSelectedType("internal")}
              className={cn("text-xs h-8 rounded-full px-3", selectedType === "internal" && "bg-gold text-navy font-semibold hover:bg-gold/90")}
            >
              Internal MSREG
            </Button>
            <Button
              size="sm"
              variant={selectedType === "community" ? "default" : "outline"}
              onClick={() => setSelectedType("community")}
              className={cn("text-xs h-8 rounded-full px-3", selectedType === "community" && "bg-emerald-500 text-white font-semibold hover:bg-emerald-600")}
            >
              Community
            </Button>
            <Button
              size="sm"
              variant={selectedType === "sponsorship" ? "default" : "outline"}
              onClick={() => setSelectedType("sponsorship")}
              className={cn("text-xs h-8 rounded-full px-3", selectedType === "sponsorship" && "bg-purple-500 text-white font-semibold hover:bg-purple-600")}
            >
              Sponsorships
            </Button>
          </div>

          <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border">
            <Button
              size="sm"
              variant={activeTimeFilter === "upcoming" ? "secondary" : "ghost"}
              onClick={() => setActiveTimeFilter("upcoming")}
              className="text-xs h-7 px-2.5"
            >
              Upcoming
            </Button>
            <Button
              size="sm"
              variant={activeTimeFilter === "past" ? "secondary" : "ghost"}
              onClick={() => setActiveTimeFilter("past")}
              className="text-xs h-7 px-2.5 text-muted-foreground"
            >
              Past
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "cards" ? (
        filteredEvents.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground border-dashed">
            <CalendarIcon className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-60" />
            <p className="font-medium text-base text-foreground">
              {searchQuery ? "No events match your search." : activeTimeFilter === "upcoming" ? "No upcoming special events right now." : "No past events found."}
            </p>
            <p className="text-xs mt-1 text-muted-foreground">
              {searchQuery ? "Try searching for a different keyword or clearing filters." : "Check back soon for upcoming team gatherings, community events, and sponsorships!"}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredEvents.map((event) => {
              const eventSignups = signups.filter((s) => s.event_id === event.id && s.status !== "cancelled");
              const confirmedSignups = eventSignups.filter((s) => s.status === "confirmed");
              const waitlistSignups = eventSignups.filter((s) => s.status === "waitlist");
              const eventGroups = groups.filter((g) => g.event_id === event.id);
              const eventCommittee = committee.filter((c) => c.event_id === event.id);

              const mySignup = agentEmail
                ? eventSignups.find((s) => (s.agent_email ?? "").toLowerCase() === agentEmail.toLowerCase())
                : null;
              const myCommittee = agentEmail
                ? eventCommittee.find((c) => (c.agent_email ?? "").toLowerCase() === agentEmail.toLowerCase())
                : null;

              // Capacity calculations
              let capacityBadge: React.ReactNode = null;
              let isFull = false;

              if (event.capacity_mode === "simple" && event.max_capacity) {
                const remaining = Math.max(0, event.max_capacity - confirmedSignups.length);
                isFull = remaining === 0;
                const percent = Math.min(100, Math.round((confirmedSignups.length / event.max_capacity) * 100));

                capacityBadge = (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={cn("font-medium", isFull ? "text-amber-400" : "text-emerald-400")}>
                        {isFull ? (event.enable_waitlist ? "Full (Waitlist Open)" : "Full Capacity") : `${remaining} of ${event.max_capacity} spots left`}
                      </span>
                      <span className="text-muted-foreground font-mono">{confirmedSignups.length}/{event.max_capacity}</span>
                    </div>
                    <Progress value={percent} className="h-1.5 bg-muted" />
                  </div>
                );
              } else if (event.capacity_mode === "group") {
                const maxPerGroup = event.max_per_group || 4;
                const totalTeamSpots = eventGroups.length * maxPerGroup;
                capacityBadge = (
                  <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span className="text-gold font-medium">
                      {eventGroups.length} Teams Registered
                    </span>
                    <span>{confirmedSignups.length} Players ({maxPerGroup}/team)</span>
                  </div>
                );
              }

              return (
                <Card
                  key={event.id}
                  className={cn(
                    "overflow-hidden border border-border bg-card flex flex-col justify-between hover:border-gold/50 transition-all duration-200 shadow-md",
                    mySignup && "ring-1 ring-gold/40 border-gold/40",
                  )}
                >
                  <div>
                    {/* Cover or Header Banner */}
                    <div className="relative aspect-[21/9] sm:aspect-[2.4/1] bg-muted overflow-hidden">
                      {event.cover_image_url ? (
                        <img
                          src={event.cover_image_url}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-navy via-card to-background flex items-center justify-center p-4 text-center">
                          <Sparkles className="h-10 w-10 text-gold/30" />
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex items-center gap-2 flex-wrap z-10">
                        <Badge className={cn("border font-medium text-xs", SPECIAL_EVENT_TYPE_BADGES[event.event_type])}>
                          {SPECIAL_EVENT_TYPE_LABELS[event.event_type]}
                        </Badge>
                        {mySignup && (
                          <Badge className="bg-gold text-navy border-gold font-semibold text-xs flex items-center gap-1 shadow-md">
                            <CheckCircle2 className="h-3.5 w-3.5" /> You're RSVP'd
                          </Badge>
                        )}
                        {myCommittee && (
                          <Badge className="bg-purple-900/80 text-purple-200 border-purple-500/40 text-xs flex items-center gap-1 shadow-md">
                            <Star className="h-3 w-3 fill-purple-300" /> On Committee
                          </Badge>
                        )}
                      </div>

                      {/* Date Badge in Corner */}
                      <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md rounded-lg px-2.5 py-1 text-right border border-white/10 shadow-lg">
                        <div className="text-[10px] uppercase font-bold text-gold">
                          {format(parseISO(event.event_date), "MMM")}
                        </div>
                        <div className="text-base font-bold leading-none text-white">
                          {format(parseISO(event.event_date), "d")}
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 space-y-4">
                      <div>
                        <h2 className="text-lg font-semibold text-white leading-tight hover:text-gold transition-colors">
                          {event.title}
                        </h2>
                        <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-gold shrink-0" />
                            <span>{formatEventDateTime(event.event_date, event.start_time, event.end_time)}</span>
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-gold shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {event.description && (
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-wrap">
                          {event.description}
                        </p>
                      )}

                      {/* Capacity / Team Status */}
                      {capacityBadge && (
                        <div className="pt-2 border-t border-border/60">
                          {capacityBadge}
                        </div>
                      )}

                      {/* Team / Group Breakdown Preview */}
                      {event.capacity_mode === "group" && eventGroups.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-semibold uppercase text-gold/80 flex items-center gap-1">
                            <Users className="h-3 w-3" /> Teams
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                            {eventGroups.map((g) => {
                              const groupCount = confirmedSignups.filter((s) => s.group_id === g.id).length;
                              const maxPer = event.max_per_group || 4;
                              const isGroupFull = groupCount >= maxPer;
                              const isMyGroup = mySignup?.group_id === g.id;

                              return (
                                <Badge
                                  key={g.id}
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] py-0.5 px-2 border",
                                    isMyGroup ? "border-gold bg-gold/20 text-gold font-bold" : isGroupFull ? "bg-zinc-900/60 text-zinc-400 border-zinc-700/40" : "bg-card border-border text-foreground",
                                  )}
                                >
                                  {g.name} ({groupCount}/{maxPer}) {isMyGroup ? "★" : ""}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Committee Info */}
                      {event.allows_committee && (
                        <div className="flex items-center justify-between text-xs bg-purple-950/20 border border-purple-500/20 rounded-lg p-2.5">
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-purple-400 shrink-0" />
                            <span className="text-[11px] text-purple-200">
                              Event Committee: <strong>{eventCommittee.length}</strong> volunteers
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCommitteeModal(event)}
                            className="text-[11px] text-purple-300 hover:text-purple-100 h-6 px-2 hover:bg-purple-900/40"
                          >
                            {myCommittee ? "Manage" : "Volunteer"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-4 pt-0 border-t border-border/40 mt-3 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      {/* Calendar Export Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground">
                            <CalendarIcon className="h-3.5 w-3.5 mr-1" /> Add to Cal
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 bg-card border-border">
                          <DropdownMenuItem asChild>
                            <a
                              href={buildGoogleCalendarUrl(event)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 cursor-pointer text-xs"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-gold" /> Google Calendar
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => downloadIcsFile(event)}
                            className="flex items-center gap-2 cursor-pointer text-xs"
                          >
                            <Download className="h-3.5 w-3.5 text-gold" /> Apple / Outlook (.ics)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* View Details Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailsEvent(event)}
                        className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Info className="h-3.5 w-3.5 mr-1" /> Details
                      </Button>
                    </div>

                    {/* Primary RSVP Action */}
                    {event.requires_rsvp && (
                      <Button
                        onClick={() => openRsvpModal(event)}
                        size="sm"
                        className={cn(
                          "h-9 px-4 text-xs font-semibold shadow-sm transition-all",
                          mySignup
                            ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                            : isFull && !event.enable_waitlist
                            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                            : "bg-gold text-navy hover:bg-gold/90 hover:scale-[1.02]",
                        )}
                        disabled={isFull && !event.enable_waitlist && !mySignup}
                      >
                        {mySignup ? (
                          <>
                            <UserCheck className="h-3.5 w-3.5 mr-1" /> Manage RSVP
                          </>
                        ) : isFull && event.enable_waitlist ? (
                          <>
                            <Users className="h-3.5 w-3.5 mr-1" /> Join Waitlist
                          </>
                        ) : isFull ? (
                          "Event Full"
                        ) : (
                          <>
                            <UserPlus className="h-3.5 w-3.5 mr-1" /> RSVP Now
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        /* Calendar Monthly View */
        <Card className="p-4 sm:p-6 border-border bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setCurrentMonth(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground pb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {eachDayOfInterval({
              start: startOfMonth(currentMonth),
              end: endOfMonth(currentMonth),
            }).map((day, idx) => {
              const dayEvents = events.filter((ev) => isSameDay(parseISO(ev.event_date), day));
              const isToday = isSameDay(day, new Date());
              const dayColStart = idx === 0 ? day.getDay() + 1 : undefined;

              return (
                <div
                  key={day.toISOString()}
                  style={dayColStart ? { gridColumnStart: dayColStart } : undefined}
                  className={cn(
                    "min-h-[85px] sm:min-h-[110px] p-1.5 rounded-lg border border-border/50 bg-card/50 flex flex-col justify-between transition-colors",
                    isToday && "ring-1 ring-gold/60 bg-gold/5",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-xs font-semibold", isToday ? "text-gold" : "text-muted-foreground")}>
                      {format(day, "d")}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="h-2 w-2 rounded-full bg-gold" />
                    )}
                  </div>

                  <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-20">
                    {dayEvents.map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => setDetailsEvent(ev)}
                        className={cn(
                          "w-full text-left text-[10px] font-medium p-1 rounded border truncate block",
                          ev.event_type === "internal"
                            ? "bg-gold/15 text-gold border-gold/30 hover:bg-gold/25"
                            : ev.event_type === "community"
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                            : "bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/25",
                        )}
                      >
                        {ev.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* RSVP Dialog */}
      <Dialog open={!!rsvpEvent} onOpenChange={(open) => !open && setRsvpEvent(null)}>
        <DialogContent className="max-w-lg bg-card border-gold/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">
              RSVP for {rsvpEvent?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {rsvpEvent && formatEventDateTime(rsvpEvent.event_date, rsvpEvent.start_time, rsvpEvent.end_time)}
            </DialogDescription>
          </DialogHeader>

          {rsvpEvent && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Your Name <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    value={rsvpName}
                    onChange={(e) => setRsvpName(e.target.value)}
                    placeholder="Jane Doe"
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Your Agent Email <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    type="email"
                    value={rsvpEmail}
                    onChange={(e) => setRsvpEmail(e.target.value)}
                    placeholder="jane@mattsmithrealestategroup.com"
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              {/* Group / Team Selection */}
              {rsvpEvent.capacity_mode === "group" && (
                <div className="space-y-3 rounded-lg border border-gold/30 bg-card/80 p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-gold">Select Team / Group</div>
                      <div className="text-[11px] text-muted-foreground">
                        Max {rsvpEvent.max_per_group || 4} people per team
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCreatingGroup(!isCreatingGroup)}
                      className="text-xs h-7 border-gold/40 text-gold hover:bg-gold/10"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Create New Team
                    </Button>
                  </div>

                  {isCreatingGroup && (
                    <div className="flex items-center gap-2 pt-1 animate-in fade-in">
                      <Input
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Team Name (e.g. Golf Squad A)"
                        className="h-9 text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!newGroupName.trim()) return toast.error("Enter a team name");
                          createGroupMutation.mutate({ eventId: rsvpEvent.id, name: newGroupName.trim() });
                        }}
                        disabled={createGroupMutation.isPending}
                        className="bg-gold text-navy hover:bg-gold/90 text-xs h-9 font-semibold"
                      >
                        {createGroupMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                      </Button>
                    </div>
                  )}

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1">
                    {groups.filter((g) => g.event_id === rsvpEvent.id).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No teams created yet. Click "Create New Team" above to start one!</p>
                    ) : (
                      groups
                        .filter((g) => g.event_id === rsvpEvent.id)
                        .map((grp) => {
                          const groupMembers = signups.filter((s) => s.group_id === grp.id && s.status !== "cancelled");
                          const maxPer = rsvpEvent.max_per_group || 4;
                          const isFull = groupMembers.length >= maxPer && rsvpGroupId !== grp.id;
                          const isSelected = rsvpGroupId === grp.id;

                          return (
                            <button
                              key={grp.id}
                              type="button"
                              disabled={isFull}
                              onClick={() => setRsvpGroupId(grp.id)}
                              className={cn(
                                "w-full flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-all",
                                isSelected
                                  ? "border-gold bg-gold/15 text-gold font-semibold"
                                  : isFull
                                  ? "opacity-50 border-border bg-muted/40 cursor-not-allowed"
                                  : "border-border bg-card hover:border-gold/50",
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <div className={cn("h-3.5 w-3.5 rounded-full border flex items-center justify-center", isSelected ? "border-gold bg-gold text-navy" : "border-muted-foreground")}>
                                  {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-navy" />}
                                </div>
                                <span>{grp.name}</span>
                              </div>
                              <span className={cn("text-[11px]", isFull ? "text-rose-400 font-medium" : "text-muted-foreground")}>
                                {groupMembers.length} / {maxPer} {isFull ? "(Full)" : "spots"}
                              </span>
                            </button>
                          );
                        })
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Notes / Comments (Optional)</label>
                <Textarea
                  value={rsvpNotes}
                  onChange={(e) => setRsvpNotes(e.target.value)}
                  placeholder="Dietary requirements, questions, or golf handicap..."
                  className="text-xs h-20"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            {rsvpEvent && signups.some((s) => s.event_id === rsvpEvent.id && (s.agent_email ?? "").toLowerCase() === (agentEmail || "").toLowerCase()) && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Cancel your RSVP for this event?")) {
                    cancelRsvpMutation.mutate({ eventId: rsvpEvent.id, email: rsvpEmail || agentEmail });
                  }
                }}
                disabled={cancelRsvpMutation.isPending}
                className="text-xs mr-auto"
              >
                {cancelRsvpMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancel My RSVP"}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setRsvpEvent(null)}
              className="text-xs"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!rsvpName.trim()) return toast.error("Please enter your name");
                if (!rsvpEmail.trim() || !rsvpEmail.includes("@")) return toast.error("Please enter a valid email");
                if (rsvpEvent?.capacity_mode === "group" && !rsvpGroupId) {
                  return toast.error("Please select or create a team");
                }

                rsvpMutation.mutate({
                  eventId: rsvpEvent!.id,
                  agentName: rsvpName.trim(),
                  agentEmail: rsvpEmail.trim().toLowerCase(),
                  groupId: rsvpGroupId || null,
                  notes: rsvpNotes.trim() || null,
                });
              }}
              disabled={rsvpMutation.isPending}
              className="bg-gold text-navy hover:bg-gold/90 text-xs font-semibold"
            >
              {rsvpMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Confirm RSVP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Committee Volunteering Dialog */}
      <Dialog open={!!committeeEvent} onOpenChange={(open) => !open && setCommitteeEvent(null)}>
        <DialogContent className="max-w-md bg-card border-purple-500/40">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Star className="h-5 w-5 text-purple-400 fill-purple-400" />
              Join Committee: {committeeEvent?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Event committee volunteering is always open and uncapped. Help plan, organize, and execute MSREG events!
            </DialogDescription>
          </DialogHeader>

          {committeeEvent && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Your Name</label>
                  <Input
                    value={comName}
                    onChange={(e) => setComName(e.target.value)}
                    placeholder="Jane Doe"
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Your Email</label>
                  <Input
                    type="email"
                    value={comEmail}
                    onChange={(e) => setComEmail(e.target.value)}
                    placeholder="jane@mattsmithrealestategroup.com"
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Volunteer Notes (e.g. how you'd like to help)
                </label>
                <Textarea
                  value={comNotes}
                  onChange={(e) => setComNotes(e.target.value)}
                  placeholder="e.g. Can help coordinate check-in, bring equipment, assist with setup..."
                  className="text-xs h-20"
                />
              </div>

              {/* Existing Committee Volunteers */}
              <div className="rounded-lg bg-purple-950/30 border border-purple-500/20 p-3 space-y-2">
                <div className="text-xs font-semibold text-purple-300">
                  Current Committee Volunteers ({committee.filter((c) => c.event_id === committeeEvent.id).length})
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {committee.filter((c) => c.event_id === committeeEvent.id).map((c) => (
                    <Badge key={c.id} variant="outline" className="text-[10px] bg-purple-900/30 border-purple-500/30 text-purple-200">
                      {c.agent_name || c.agent_email || "Volunteer"}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            {committeeEvent && committee.some((c) => c.event_id === committeeEvent.id && (c.agent_email ?? "").toLowerCase() === (agentEmail || "").toLowerCase()) && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  committeeMutation.mutate({
                    eventId: committeeEvent.id,
                    agentName: comName,
                    agentEmail: comEmail || agentEmail,
                    isJoining: false,
                  });
                }}
                disabled={committeeMutation.isPending}
                className="text-xs mr-auto"
              >
                Leave Committee
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCommitteeEvent(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!comName.trim()) return toast.error("Please enter your name");
                if (!comEmail.trim()) return toast.error("Please enter your email");
                committeeMutation.mutate({
                  eventId: committeeEvent!.id,
                  agentName: comName.trim(),
                  agentEmail: comEmail.trim().toLowerCase(),
                  isJoining: true,
                  notes: comNotes.trim() || null,
                });
              }}
              disabled={committeeMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
            >
              {committeeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Star className="h-3.5 w-3.5 mr-1 fill-white" />}
              Join Committee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Details Modal */}
      <Dialog open={!!detailsEvent} onOpenChange={(open) => !open && setDetailsEvent(null)}>
        <DialogContent className="max-w-xl bg-card border-border">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn("border font-medium text-xs", detailsEvent && SPECIAL_EVENT_TYPE_BADGES[detailsEvent.event_type])}>
                {detailsEvent && SPECIAL_EVENT_TYPE_LABELS[detailsEvent.event_type]}
              </Badge>
            </div>
            <DialogTitle className="text-xl font-bold text-white">
              {detailsEvent?.title}
            </DialogTitle>
          </DialogHeader>

          {detailsEvent && (
            <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-1">
              {detailsEvent.cover_image_url && (
                <div className="rounded-lg overflow-hidden aspect-video bg-muted">
                  <img src={detailsEvent.cover_image_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/40 p-3 rounded-lg border border-border text-xs">
                <div>
                  <div className="text-muted-foreground">Date & Time</div>
                  <div className="font-semibold text-white mt-0.5">
                    {formatEventDateTime(detailsEvent.event_date, detailsEvent.start_time, detailsEvent.end_time)}
                  </div>
                </div>
                {detailsEvent.location && (
                  <div>
                    <div className="text-muted-foreground">Location</div>
                    <div className="font-semibold text-white mt-0.5">{detailsEvent.location}</div>
                  </div>
                )}
              </div>

              {detailsEvent.description && (
                <div>
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-gold mb-1">About This Event</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {detailsEvent.description}
                  </p>
                </div>
              )}

              {/* Attendees Roster */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-gold">
                    Confirmed Attendees ({signups.filter((s) => s.event_id === detailsEvent.id && s.status === "confirmed").length})
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                  {signups
                    .filter((s) => s.event_id === detailsEvent.id && s.status === "confirmed")
                    .map((s) => {
                      const group = groups.find((g) => g.id === s.group_id);
                      return (
                        <div key={s.id} className="p-2 rounded bg-card border border-border text-xs flex items-center justify-between">
                          <span className="font-medium truncate">{s.agent_name || s.agent_email || "Agent"}</span>
                          {group && <Badge variant="outline" className="text-[10px]">{group.name}</Badge>}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {detailsEvent && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadIcsFile(detailsEvent)}
                  className="text-xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> .ICS Calendar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setDetailsEvent(null);
                    openRsvpModal(detailsEvent);
                  }}
                  className="bg-gold text-navy hover:bg-gold/90 text-xs font-semibold"
                >
                  RSVP for Event
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
