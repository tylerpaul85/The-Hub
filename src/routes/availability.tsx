import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  ChevronLeft,
  Pencil,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  Sparkles,
  CalendarRange,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logo from "@/assets/msreg-logo.png";
import { useAgentAuth } from "@/hooks/use-agent-auth";
import { useAuth } from "@/hooks/use-auth";
import {
  publicListActiveAgents,
  publicListAvailability,
  publicSubmitAvailability,
  publicDeleteAvailability,
} from "@/lib/agent-availability.functions";

export const Route = createFileRoute("/availability")({
  ssr: false,
  component: PublicAvailabilityPage,
  head: () => ({
    meta: [
      { title: "Duty Day Time Off & Availability — MSREG Hub" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const OFFICES = [
  { value: "all", label: "All Offices" },
  { value: "rolla", label: "Rolla" },
  { value: "str", label: "St. Robert" },
  { value: "loz", label: "Lake of the Ozarks" },
] as const;

const STORAGE_KEY = "msreg-availability-selected-agent";

function PublicAvailabilityPage() {
  const qc = useQueryClient();
  const { agent: loggedInAgent } = useAgentAuth();
  const { user: authUser } = useAuth();

  const allAgents = useServerFn(publicListActiveAgents);
  const listForAgent = useServerFn(publicListAvailability);
  const save = useServerFn(publicSubmitAvailability);
  const remove = useServerFn(publicDeleteAvailability);

  const agentsQ = useQuery({ queryKey: ["pub-duty-agents"], queryFn: () => allAgents() });

  const [officeFilter, setOfficeFilter] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"calendar" | "list">("calendar");

  // Track if user explicitly clicked/changed the agent dropdown in this session
  const userChangedManual = useRef(false);

  // Determine January target year (e.g. if Nov/Dec 2026, target is 2027)
  const targetJanYear = useMemo(() => {
    const now = new Date();
    return now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear();
  }, []);

  // Display name for the signed-in user
  const signedInDisplayName = useMemo(() => {
    return (
      loggedInAgent?.full_name ||
      (authUser?.user_metadata as any)?.full_name ||
      (authUser?.user_metadata as any)?.name ||
      authUser?.email?.split("@")[0] ||
      null
    );
  }, [loggedInAgent, authUser]);

  // Intelligent auto-match for whoever is signed in (Tyler, agent accounts, or client care)
  useEffect(() => {
    if (!agentsQ.data || agentsQ.data.length === 0) return;

    // If user already manually selected an agent in this session, keep their choice
    if (userChangedManual.current && selectedAgent) return;

    const emails = [loggedInAgent?.email, authUser?.email]
      .filter(Boolean)
      .map((e) => e!.toLowerCase().trim());

    const names = [
      loggedInAgent?.full_name,
      (authUser?.user_metadata as any)?.full_name,
      (authUser?.user_metadata as any)?.name,
    ]
      .filter(Boolean)
      .map((n) => n!.toLowerCase().trim());

    let match: any = null;

    // Tier 1: exact email match
    for (const a of agentsQ.data) {
      if (a.email && emails.includes(a.email.toLowerCase().trim())) {
        match = a;
        break;
      }
    }

    // Tier 2: exact full name match
    if (!match) {
      for (const a of agentsQ.data) {
        const aName = a.name.toLowerCase().trim();
        if (names.some((n) => n === aName)) {
          match = a;
          break;
        }
      }
    }

    // Tier 3: First name + Last initial match (e.g. "Tyler p" vs "Tyler Paul")
    if (!match) {
      for (const cn of names) {
        const parts = cn.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          const first = parts[0];
          const lastInit = parts[parts.length - 1][0];
          for (const a of agentsQ.data) {
            const aParts = a.name.toLowerCase().trim().split(/\s+/).filter(Boolean);
            if (aParts.length >= 2 && aParts[0] === first && aParts[aParts.length - 1][0] === lastInit) {
              match = a;
              break;
            }
          }
        }
        if (match) break;
      }
    }

    // Tier 4: Email prefix / username match (e.g. "tyler.p" in tyler.p@mattsmithrealestategroup.com matches Tyler Paul)
    if (!match) {
      for (const em of emails) {
        const prefix = em.split("@")[0].replace(/[^a-z0-9]/g, "");
        for (const a of agentsQ.data) {
          const cleaned = a.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (
            (prefix.length >= 4 && cleaned.startsWith(prefix)) ||
            (cleaned.length >= 4 && prefix.startsWith(cleaned)) ||
            (prefix.startsWith("tyler") && cleaned.startsWith("tyler"))
          ) {
            match = a;
            break;
          }
        }
        if (match) break;
      }
    }

    // Tier 5: First name match if unique in roster
    if (!match) {
      for (const cn of names) {
        const first = cn.split(/\s+/)[0];
        if (first && first.length >= 3) {
          const candidates = agentsQ.data.filter(
            (a: any) => a.name.toLowerCase().trim().split(/\s+/)[0] === first,
          );
          if (candidates.length === 1) {
            match = candidates[0];
            break;
          }
        }
      }
    }

    if (match) {
      setSelectedAgent(match.id);
      if (match.office && ["rolla", "str", "loz"].includes(match.office)) {
        setOfficeFilter(match.office);
      }
      return;
    }

    // Fallback to localStorage if no signed-in match was made
    if (!selectedAgent) {
      const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved && agentsQ.data.some((a: any) => a.id === saved)) {
        setSelectedAgent(saved);
      }
    }
  }, [loggedInAgent, authUser, agentsQ.data, selectedAgent]);

  // Persist selectedAgent
  useEffect(() => {
    if (selectedAgent && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, selectedAgent);
    }
  }, [selectedAgent]);

  const filteredAgents = useMemo(
    () =>
      (agentsQ.data ?? []).filter((a: any) =>
        officeFilter === "all" ? true : a.office === officeFilter,
      ),
    [agentsQ.data, officeFilter],
  );

  const currentAgent = useMemo(
    () => (agentsQ.data ?? []).find((a: any) => a.id === selectedAgent),
    [agentsQ.data, selectedAgent],
  );

  const listQ = useQuery({
    queryKey: ["pub-availability-for", selectedAgent],
    queryFn: () => listForAgent({ data: { agent_id: selectedAgent } }),
    enabled: !!selectedAgent,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isSingleDay, setIsSingleDay] = useState(false);
  const [note, setNote] = useState<string>("" );

  function openNew(defaultStart?: string, defaultEnd?: string) {
    setEditing(null);
    setStart(defaultStart || "");
    setEnd(defaultEnd || defaultStart || "");
    setIsSingleDay(!!defaultStart && defaultStart === defaultEnd);
    setNote("");
    setOpen(true);
  }

  function openNewForJanuary() {
    const defaultStart = `${targetJanYear}-01-01`;
    openNew(defaultStart, defaultStart);
  }

  function openEdit(row: any) {
    setEditing(row);
    setStart(row.date_start);
    setEnd(row.date_end);
    setIsSingleDay(row.date_start === row.date_end);
    setNote(row.note ?? "");
    setOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selectedAgent) throw new Error("Select your name first");
      if (!start) throw new Error("Start date is required");
      const effectiveEnd = isSingleDay ? start : end;
      if (!effectiveEnd) throw new Error("End date is required");
      if (effectiveEnd < start) throw new Error("End date cannot be earlier than start date");

      await save({
        data: {
          id: editing?.id,
          agent_id: selectedAgent,
          date_start: start,
          date_end: effectiveEnd,
          reason: null,
          note: note.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Time off request updated" : "Time off request submitted!");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["pub-availability-for", selectedAgent] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Time off entry removed");
      qc.invalidateQueries({ queryKey: ["pub-availability-for", selectedAgent] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  // Calculate days in January that are blacked out
  const janDaysCoverage = useMemo(() => {
    const daysMap = new Map<string, any>();
    if (!listQ.data) return daysMap;

    for (const item of listQ.data) {
      const s = parseISO(item.date_start);
      const e = parseISO(item.date_end);
      let curr = s;
      while (curr <= e) {
        const dStr = format(curr, "yyyy-MM-dd");
        if (dStr.startsWith(`${targetJanYear}-01`)) {
          daysMap.set(dStr, item);
        }
        curr = addDays(curr, 1);
      }
    }
    return daysMap;
  }, [listQ.data, targetJanYear]);

  // Generate January calendar cells
  const janCalendarGrid = useMemo(() => {
    const firstDay = new Date(targetJanYear, 0, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon ...
    const totalDaysInJan = 31;

    const cells: Array<{
      dayNumber: number | null;
      dateStr: string | null;
      isWeekend: boolean;
      coverage: any | null;
    }> = [];

    // Empty lead cells
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push({ dayNumber: null, dateStr: null, isWeekend: false, coverage: null });
    }

    // January 1 to 31
    for (let day = 1; day <= totalDaysInJan; day++) {
      const dStr = `${targetJanYear}-01-${String(day).padStart(2, "0")}`;
      const d = new Date(targetJanYear, 0, day);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const coverage = janDaysCoverage.get(dStr) || null;
      cells.push({ dayNumber: day, dateStr: dStr, isWeekend, coverage });
    }

    return cells;
  }, [targetJanYear, janDaysCoverage]);

  const janCount = janDaysCoverage.size;

  return (
    <div className="relative min-h-screen bg-background text-foreground px-4 py-8 sm:py-12 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] overflow-x-hidden selection:bg-gold/30 selection:text-white">
      {/* Ambient Top Spotlight Halo */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.16),transparent)] pointer-events-none -z-10" />

      {/* Subtle Brand Emblem Watermark in Background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[600px] h-[420px] sm:h-[600px] pointer-events-none opacity-[0.035] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      <div className="max-w-3xl mx-auto relative z-10 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Link
            to="/agents"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-surface-2/70 hover:bg-surface-2 hover:border-gold/50 text-xs text-muted-foreground hover:text-foreground transition-all shadow-2xs backdrop-blur-md"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to Agent Hub
          </Link>

          {signedInDisplayName && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2/80 border border-border/80 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>
                Signed in as <strong className="text-foreground font-medium">{signedInDisplayName}</strong>
              </span>
            </div>
          )}
        </div>

        <header className="text-center space-y-2">
          <img src={logo} alt="MSREG" className="h-16 sm:h-20 w-auto mx-auto drop-shadow-sm" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Duty Day Time Off
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
              Submit your blackout dates for the duty rotation. Client care will automatically honor these when scheduling floor and weekend duty.
            </p>
          </div>
        </header>

        {/* January Duty Rotation Testing Callout */}
        <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-surface-1/90 to-surface-1/80 p-5 sm:p-6 backdrop-blur-md shadow-xl ring-1 ring-inset ring-amber-500/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="h-11 w-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-foreground">
                    January {targetJanYear} Duty Rotation
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Active Testing
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We are actively building the January schedule! Submit any dates you cannot work so our client care team can balance duty days without scheduling conflicts.
                </p>
              </div>
            </div>
            <Button
              onClick={openNewForJanuary}
              disabled={!selectedAgent}
              className="w-full sm:w-auto shrink-0 rounded-xl bg-gold text-navy hover:bg-gold/90 font-bold text-xs h-10 px-4 shadow-md shadow-gold/20 active:scale-[0.985] transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Request Off for Jan
            </Button>
          </div>
        </div>

        {/* Main Agent Availability Selection & Calendar Card */}
        <div className="rounded-3xl border border-border/80 bg-surface-1/90 backdrop-blur-md p-6 sm:p-8 shadow-2xl ring-1 ring-inset ring-white/[0.04] space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Office Filter</Label>
              <Select
                value={officeFilter}
                onValueChange={(val) => {
                  userChangedManual.current = true;
                  setOfficeFilter(val);
                }}
              >
                <SelectTrigger className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFICES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-foreground">Select Your Name *</Label>
                {selectedAgent && currentAgent && (
                  <span className="text-[11px] text-muted-foreground">
                    Change anytime below
                  </span>
                )}
              </div>
              <Select
                value={selectedAgent}
                onValueChange={(val) => {
                  userChangedManual.current = true;
                  setSelectedAgent(val);
                }}
              >
                <SelectTrigger className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground">
                  <SelectValue placeholder={agentsQ.isLoading ? "Loading agents…" : "Choose your name"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredAgents.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} {a.office ? `· ${a.office.toUpperCase()}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedAgent && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 pb-1 border-t border-border/60">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Managing time off for:</span>
                <span className="text-xs font-semibold text-foreground px-2.5 py-0.5 rounded-full bg-surface-2 border border-border/70">
                  {currentAgent?.name} {currentAgent?.office ? `(${currentAgent.office.toUpperCase()})` : ""}
                </span>
                {janCount > 0 && (
                  <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                    {janCount} {janCount === 1 ? "day" : "days"} requested in Jan
                  </span>
                )}
              </div>

              {/* View Switcher */}
              <div className="flex items-center gap-1 p-1 bg-surface-2/70 border border-border/70 rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("calendar")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "calendar"
                      ? "bg-surface-1 text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CalendarIcon className="h-3.5 w-3.5" /> January View
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("list")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "list"
                      ? "bg-surface-1 text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CalendarRange className="h-3.5 w-3.5" /> All Requests
                </button>
              </div>
            </div>
          )}

          {/* VIEW: January Calendar Grid */}
          {selectedAgent && activeTab === "calendar" && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-gold" />
                    January {targetJanYear} Time Off Grid
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Click any day to request off or adjust an existing blackout date.
                  </p>
                </div>
                <Button
                  onClick={openNewForJanuary}
                  size="sm"
                  className="h-8 rounded-xl bg-gold text-navy hover:bg-gold/90 font-bold text-xs px-3 shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Dates
                </Button>
              </div>

              <div className="rounded-2xl border border-border/80 bg-surface-2/30 p-3 sm:p-4">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, idx) => (
                    <div
                      key={dayName}
                      className={`text-[11px] font-semibold py-1 ${
                        idx === 0 || idx === 6 ? "text-amber-400/80" : "text-muted-foreground"
                      }`}
                    >
                      {dayName}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {janCalendarGrid.map((cell, idx) => {
                    if (!cell.dayNumber) {
                      return (
                        <div
                          key={`empty-${idx}`}
                          className="h-14 sm:h-16 rounded-xl bg-transparent"
                        />
                      );
                    }

                    const isCovered = !!cell.coverage;
                    const cov = cell.coverage;

                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        onClick={() => {
                          if (cov) {
                            openEdit(cov);
                          } else {
                            openNew(cell.dateStr!, cell.dateStr!);
                          }
                        }}
                        className={`h-14 sm:h-16 rounded-xl p-1 sm:p-1.5 text-left border transition-all flex flex-col justify-between group cursor-pointer relative ${
                          isCovered
                            ? "bg-rose-500/15 border-rose-500/40 text-foreground hover:bg-rose-500/25 ring-1 ring-rose-500/30"
                            : "bg-surface-2/60 border-border/60 hover:bg-surface-2 hover:border-gold/50 text-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`text-xs font-semibold ${
                              isCovered
                                ? "text-rose-400"
                                : cell.isWeekend
                                ? "text-amber-400/90"
                                : "text-foreground"
                            }`}
                          >
                            {cell.dayNumber}
                          </span>
                          {isCovered ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                          ) : (
                            <Plus className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>

                        {isCovered ? (
                          <div className="w-full">
                            <span className="inline-block w-full truncate text-[10px] font-semibold text-rose-300 leading-tight">
                              Time Off
                            </span>
                            {cov.note && (
                              <span className="hidden sm:inline-block w-full truncate text-[9px] text-rose-300/80 italic leading-none">
                                {cov.note}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40 font-normal leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                            Available
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground gap-2">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-md bg-surface-2/80 border border-border/80" /> Available
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-md bg-rose-500/25 border border-rose-500/40" /> Requested Off (Blackout)
                    </span>
                  </div>
                  <span className="italic">Click any cell to add or edit blackout dates</span>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: All Requests Table */}
          {(!selectedAgent || activeTab === "list") && (
            <div className="space-y-3">
              <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-foreground">
                    All Upcoming Time Off Requests
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    All blackout dates submitted for scheduling
                  </p>
                </div>
                <Button
                  onClick={() => openNew()}
                  disabled={!selectedAgent}
                  className="h-10 px-4 rounded-xl bg-gold text-navy hover:bg-gold/90 font-bold text-xs shadow-md shadow-gold/20 active:scale-[0.985] transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Add Time Off
                </Button>
              </div>

              <div className="rounded-2xl border border-border/80 overflow-hidden bg-surface-2/40">
                <Table>
                  <TableHeader className="bg-surface-2/80">
                    <TableRow className="border-border/60">
                      <TableHead className="text-xs font-semibold text-foreground">Date Range</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!selectedAgent ? (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-center text-xs text-muted-foreground py-10"
                        >
                          Select your name above to view and submit time off.
                        </TableCell>
                      </TableRow>
                    ) : listQ.isLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-center text-xs text-muted-foreground py-10"
                        >
                          Loading your schedule…
                        </TableCell>
                      </TableRow>
                    ) : (listQ.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-center text-xs text-muted-foreground py-10"
                        >
                          No time off submitted yet. Click "Add Time Off" to request blackout days for January.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (listQ.data ?? []).map((row: any) => {
                        const s = parseISO(row.date_start);
                        const e = parseISO(row.date_end);
                        const dayCount = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        const isJan =
                          row.date_start.startsWith(`${targetJanYear}-01`) ||
                          row.date_end.startsWith(`${targetJanYear}-01`);

                        return (
                          <TableRow key={row.id} className="border-border/50 hover:bg-surface-2/60">
                            <TableCell className="text-xs font-medium text-foreground">
                              <div className="flex items-center gap-2">
                                <span>
                                  {format(s, "MMM d, yyyy")}
                                  {row.date_start !== row.date_end && ` – ${format(e, "MMM d, yyyy")}`}
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground border border-border/70">
                                  {dayCount} {dayCount === 1 ? "day" : "days"}
                                </span>
                                {isJan && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Jan {targetJanYear}
                                  </span>
                                )}
                              </div>
                              {row.note && (
                                <div className="text-[11px] text-muted-foreground italic font-normal mt-0.5">
                                  "{row.note}"
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEdit(row)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Delete this time off entry?")) delMut.mutate(row.id);
                                }}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <footer className="text-center text-xs text-muted-foreground pt-4">
          © {new Date().getFullYear()} Matt Smith Real Estate Group · All Rights Reserved
        </footer>
      </div>

      {/* Add / Edit Time Off Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl border border-border/80 bg-surface-1/95 p-6 sm:p-7 shadow-2xl backdrop-blur-md max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <CalendarClock className="h-5 w-5 text-gold" />
              {editing ? "Edit Time Off Request" : "Request Time Off / Blackout Dates"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Quick January Presets */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Quick January {targetJanYear} Shortcuts
              </Label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setStart(`${targetJanYear}-01-01`);
                    setEnd(`${targetJanYear}-01-03`);
                    setIsSingleDay(false);
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-surface-2 border border-border/70 hover:border-gold/50 text-foreground transition-all cursor-pointer"
                >
                  New Year's (Jan 1–3)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStart(`${targetJanYear}-01-15`);
                    setEnd(`${targetJanYear}-01-18`);
                    setIsSingleDay(false);
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-surface-2 border border-border/70 hover:border-gold/50 text-foreground transition-all cursor-pointer"
                >
                  MLK Weekend (Jan 15–18)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStart(`${targetJanYear}-01-01`);
                    setEnd(`${targetJanYear}-01-31`);
                    setIsSingleDay(false);
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-surface-2 border border-border/70 hover:border-gold/50 text-foreground transition-all cursor-pointer"
                >
                  Full Month (Jan 1–31)
                </button>
              </div>
            </div>

            {/* Single Day toggle */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isSingleDayToggle"
                checked={isSingleDay}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsSingleDay(checked);
                  if (checked && start) {
                    setEnd(start);
                  }
                }}
                className="rounded border-border text-gold focus:ring-gold"
              />
              <label htmlFor="isSingleDayToggle" className="text-xs font-medium text-foreground cursor-pointer select-none">
                This is a single day request
              </label>
            </div>

            {/* Date Pickers */}
            <div className={`grid ${isSingleDay ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  {isSingleDay ? "Date Off" : "Start Date"}
                </Label>
                <Input
                  type="date"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    if (isSingleDay) setEnd(e.target.value);
                  }}
                  className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground"
                />
              </div>
              {!isSingleDay && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">End Date</Label>
                  <Input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground"
                  />
                </div>
              )}
            </div>

            {/* Optional Note */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Optional Note / Details</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. out of town, family trip, attending conference"
                className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                No reason is required. Optional details help client care and Claude schedule coverage around your plans.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border/60">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-xl border-border text-xs h-10 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="bg-gold text-navy hover:bg-gold/90 font-bold rounded-xl text-xs h-10 px-5 shadow-md shadow-gold/20 cursor-pointer"
            >
              {saveMut.isPending ? "Saving…" : editing ? "Update Request" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
