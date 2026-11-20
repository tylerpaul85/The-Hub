import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  Trash2,
  Download,
  AlertTriangle,
  CalendarClock,
  Users,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  getDutyCalendar,
  assignDutyDay,
  analyzeDutyAssignments,
  createDutyCalendar,
  deleteDutyCalendarMonth,
  submitAvailability,
  deleteAvailability,
} from "@/lib/duty-calendar.functions";

export const Route = createFileRoute("/_authenticated/duty-calendar")({
  component: DutyCalendarPage,
  head: () => ({ meta: [{ title: "Duty Calendar — MSREG Hub" }] }),
});

const OFFICES = [
  { value: "rolla", label: "Rolla" },
  { value: "str", label: "St. Robert" },
  { value: "loz", label: "Lake of the Ozarks" },
] as const;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthLabel(y: number, m: number) {
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function formatDate(iso: string) {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function DutyCalendarPage() {
  const navigate = useNavigate();
  const { isAdmin, roles, loading } = useAuth();
  const canManage = isAdmin || roles.includes("client_care");

  useEffect(() => {
    if (!loading && !canManage) navigate({ to: "/dashboard", replace: true });
  }, [loading, canManage, navigate]);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [office, setOffice] = useState<"rolla" | "str" | "loz">("rolla");

  // Edit single day assignment state
  const [editDay, setEditDay] = useState<number | null>(null);
  const [editAgent, setEditAgent] = useState<string>("none");

  // Claude AI Prompt & Analysis dialog state
  const [claudeOpen, setClaudeOpen] = useState(false);
  const [promptNotes, setPromptNotes] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{
    day: number;
    agent_id: string | null;
    agent_name: string;
  }> | null>(null);

  // Direct No-Go Day modal state from Calendar
  const [addOooOpen, setAddOooOpen] = useState(false);
  const [oooAgentId, setOooAgentId] = useState("");
  const [oooMode, setOooMode] = useState<"single" | "range">("single");
  const [oooStartDate, setOooStartDate] = useState("");
  const [oooEndDate, setOooEndDate] = useState("");
  const [oooReason, setOooReason] = useState<"vacation" | "sick" | "personal" | "other">("vacation");
  const [oooNote, setOooNote] = useState("");

  const qc = useQueryClient();
  const getCal = useServerFn(getDutyCalendar);
  const assign = useServerFn(assignDutyDay);
  const analyze = useServerFn(analyzeDutyAssignments);
  const createCal = useServerFn(createDutyCalendar);
  const delMonth = useServerFn(deleteDutyCalendarMonth);
  const saveOoo = useServerFn(submitAvailability);
  const delOoo = useServerFn(deleteAvailability);

  const key = ["duty-calendar", year, month, office] as const;
  const calQ = useQuery({
    queryKey: key,
    queryFn: () => getCal({ data: { year, month, office } }),
    enabled: canManage,
  });

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else setMonth(month + 1);
  };

  const assignMut = useMutation({
    mutationFn: (vars: { day: number; agent_id: string | null }) =>
      assign({ data: { year, month, office, day: vars.day, agent_id: vars.agent_id } }),
    onSuccess: () => {
      toast.success("Assignment saved");
      setEditDay(null);
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save assignment"),
  });

  const analyzeMut = useMutation({
    mutationFn: (notes?: string) =>
      analyze({
        data: {
          year,
          month,
          office,
          promptNotes: notes?.trim() || undefined,
        },
      }),
    onSuccess: (res: any) => {
      setClaudeOpen(false);
      setSuggestions(res.suggestions);
      toast.success("Claude generated duty suggestions");
    },
    onError: (e: any) => toast.error(e?.message ?? "Claude analysis failed"),
  });

  const applyMut = useMutation({
    mutationFn: (assignments: Array<{ day: number; agent_id: string | null }>) =>
      createCal({ data: { year, month, office, assignments } }),
    onSuccess: () => {
      toast.success("Duty schedule saved to calendar");
      setSuggestions(null);
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save schedule"),
  });

  const createNextMonth = () => {
    const ny = month === 12 ? year + 1 : year;
    const nm = month === 12 ? 1 : month + 1;
    setYear(ny);
    setMonth(nm);
    toast.info(`Switched to ${monthLabel(ny, nm)} — assign agents or click Analyze`);
  };

  const deleteMonthMut = useMutation({
    mutationFn: () => delMonth({ data: { year, month, office } }),
    onSuccess: () => {
      toast.success("Month cleared");
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const addOooMut = useMutation({
    mutationFn: () => {
      if (!oooAgentId) throw new Error("Select an agent");
      const end = oooMode === "single" ? oooStartDate : oooEndDate;
      if (end < oooStartDate) throw new Error("End date must be on or after start date");
      return saveOoo({
        data: {
          agent_id: oooAgentId,
          date_start: oooStartDate,
          date_end: end,
          reason: oooReason,
          note: oooNote.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("No-go day recorded");
      setAddOooOpen(false);
      setOooNote("");
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["duty-agents"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save no-go day"),
  });

  const deleteOooMut = useMutation({
    mutationFn: (id: string) => delOoo({ data: { id } }),
    onSuccess: () => {
      toast.success("No-go day removed");
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["duty-agents"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete no-go day"),
  });

  const grid = calQ.data?.grid ?? [];
  const agents: any[] = calQ.data?.agents ?? [];
  const officeName = OFFICES.find((o) => o.value === office)?.label ?? office;
  const oooRanges: any[] = (calQ.data as any)?.ooo_ranges ?? [];

  // Distribution per agent
  const distribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cell of grid) {
      if (cell.agent_id) counts.set(cell.agent_id, (counts.get(cell.agent_id) ?? 0) + 1);
    }
    return agents
      .filter((a) => a.status === "active")
      .map((a) => ({ id: a.id, name: a.name, days: counts.get(a.id) ?? 0, notes: a.notes }))
      .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name));
  }, [grid, agents]);

  // Leading blanks for Sunday-based 7-col calendar
  const leadingBlanks = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    return first.getDay(); // 0=Sun
  }, [year, month]);

  function openAddOooDialog(defaultDay?: number, defaultAgentId?: string) {
    const dStr = defaultDay
      ? `${year}-${String(month).padStart(2, "0")}-${String(defaultDay).padStart(2, "0")}`
      : `${year}-${String(month).padStart(2, "0")}-01`;
    setOooStartDate(dStr);
    setOooEndDate(dStr);
    setOooMode("single");
    setOooReason("vacation");
    setOooNote("");
    if (defaultAgentId) {
      setOooAgentId(defaultAgentId);
    } else if (agents.length > 0) {
      setOooAgentId(agents[0].id);
    }
    setAddOooOpen(true);
  }

  const exportPdf = () => {
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Popup blocked — allow popups to export");
      return;
    }
    const title = `Duty_Calendar_${officeName.replace(/\s+/g, "_")}_${MONTH_NAMES[month - 1]}_${year}`;
    const navy = "#0a1f44";
    const gold = "#c9a85f";
    const cellsHtml: string[] = [];
    for (let i = 0; i < leadingBlanks; i++) cellsHtml.push(`<div class="cell blank"></div>`);
    for (const cell of grid) {
      const isOoo = !!cell.agent_id && (cell.ooo_agent_ids ?? []).includes(cell.agent_id);
      cellsHtml.push(
        `<div class="cell">
          <div class="day">${cell.day}</div>
          <div class="agent ${cell.agent_name ? "" : "empty"}">${cell.agent_name ?? "—"}</div>
          ${isOoo ? `<div class="ooo">OOO conflict</div>` : ""}
        </div>`,
      );
    }
    const distRows = distribution
      .map((d) => `<tr><td>${d.name}</td><td class="num">${d.days}</td></tr>`)
      .join("");
    const html = `<!doctype html>
<html><head><title>${title}</title><meta charset="utf-8" />
<style>
  *{box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;color:${navy};background:#fff;}
  .header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid ${gold};padding-bottom:12px;margin-bottom:18px;}
  .title{font-size:24px;font-weight:700;color:${navy};}
  .subtitle{font-size:14px;color:#555;margin-top:4px;}
  .office{font-size:18px;color:${gold};font-weight:600;letter-spacing:1px;text-transform:uppercase;}
  .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
  .weekday{background:${navy};color:${gold};text-align:center;font-weight:600;padding:6px 0;font-size:11px;letter-spacing:1px;text-transform:uppercase;}
  .cell{border:1px solid #d4c89a;min-height:78px;padding:6px;position:relative;background:#fff;}
  .cell.blank{background:#f6f3ea;border-color:#ece6d2;}
  .day{font-size:11px;color:#666;font-weight:600;}
  .agent{margin-top:8px;font-size:13px;font-weight:600;color:${navy};text-align:center;line-height:1.2;}
  .agent.empty{color:#bbb;font-weight:400;}
  .ooo{color:#a33;font-size:10px;text-align:center;margin-top:2px;}
  .footer{margin-top:24px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#777;border-top:1px solid #ddd;padding-top:8px;}
  .layout{display:grid;grid-template-columns:1fr 220px;gap:18px;}
  .dist{border:1px solid ${gold};border-radius:4px;}
  .dist h3{margin:0;padding:8px 12px;background:${navy};color:${gold};font-size:12px;letter-spacing:1px;text-transform:uppercase;}
  .dist table{width:100%;border-collapse:collapse;font-size:12px;}
  .dist td{padding:5px 10px;border-bottom:1px solid #eee;}
  .dist td.num{text-align:right;font-weight:600;color:${gold};}
  @media print {body{padding:12px;} .no-print{display:none;}}
</style>
</head><body>
  <div class="header">
    <div>
      <div class="title">Duty Calendar — ${monthLabel(year, month)}</div>
      <div class="subtitle">MSREG Internal · ${officeName} Office</div>
    </div>
    <div class="office">${officeName}</div>
  </div>
  <div class="layout">
    <div>
      <div class="grid">${WEEKDAYS.map((w) => `<div class="weekday">${w}</div>`).join("")}${cellsHtml.join("")}</div>
    </div>
    <div class="dist">
      <h3>Distribution</h3>
      <table>${distRows || `<tr><td colspan="2" style="color:#999;padding:10px;">No assignments</td></tr>`}</table>
    </div>
  </div>
  <div class="footer">
    <span>Generated ${new Date().toLocaleString()}</span>
    <span>MSREG · ${officeName}</span>
  </div>
  <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
</body></html>`;
    win.document.write(html);
    win.document.title = title;
    win.document.close();
  };

  if (!canManage) return null;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap pb-4 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-gold" />
              Duty Calendar
            </h1>
            <Badge variant="outline" className="border-gold/30 text-gold bg-gold/10 font-medium">
              Internal Only
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage office duty rotations, record agent no-go days, and generate balanced schedules with Claude.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" asChild className="border-gold/30 hover:bg-gold/10">
            <Link to="/duty-agents">
              <Users className="h-4 w-4 mr-1.5 text-gold" /> Duty Agents Roster
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() => setClaudeOpen(true)}
            disabled={analyzeMut.isPending}
            className="bg-gold text-navy hover:bg-gold/90 font-medium"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            {analyzeMut.isPending ? "Analyzing…" : "Analyze with Claude"}
          </Button>
          <Button size="sm" variant="outline" onClick={createNextMonth}>
            <Plus className="h-4 w-4 mr-1" /> Next Month
          </Button>
          <Button size="sm" variant="outline" onClick={exportPdf}>
            <Download className="h-4 w-4 mr-1 text-gold" /> Export Calendar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("Clear all duty assignments for this month and office?"))
                deleteMonthMut.mutate();
            }}
          >
            <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Clear Month
          </Button>
        </div>
      </div>

      {/* Date navigation & office tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={prevMonth} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36 h-9 font-medium bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24 h-9 font-medium bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 6 }, (_, i) => today.getFullYear() - 1 + i).map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon" variant="outline" onClick={nextMonth} className="h-9 w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Tabs value={office} onValueChange={(v) => setOffice(v as any)}>
          <TabsList className="bg-navy border border-gold/20">
            {OFFICES.map((o) => (
              <TabsTrigger
                key={o.value}
                value={o.value}
                className="data-[state=active]:bg-gold data-[state=active]:text-navy font-medium text-xs px-4"
              >
                {o.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar Grid + Right Sidebar */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main Calendar View */}
        <div className="space-y-1">
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="text-center text-xs font-semibold text-gold uppercase tracking-wider py-2 bg-navy/70 rounded border border-gold/20"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div
                key={`b${i}`}
                className="min-h-[100px] rounded border border-border/30 bg-card/20"
              />
            ))}
            {grid.map((cell: any) => {
              const isOoo = !!cell.agent_id && (cell.ooo_agent_ids ?? []).includes(cell.agent_id);
              const oooCountForDay = (cell.ooo_agent_ids ?? []).length;
              return (
                <button
                  key={cell.day}
                  onClick={() => {
                    setEditDay(cell.day);
                    setEditAgent(cell.agent_id ?? "none");
                  }}
                  className={`rounded-lg border ${
                    isOoo
                      ? "border-destructive/80 bg-destructive/5 hover:bg-destructive/10"
                      : "border-border/60 bg-card hover:border-gold/50 hover:bg-gold/5"
                  } p-2.5 text-left transition-all min-h-[100px] flex flex-col relative group`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-gold">
                      {cell.day}
                    </span>
                    {oooCountForDay > 0 && (
                      <span
                        className="text-[10px] text-amber-400 font-medium flex items-center gap-0.5 bg-amber-400/10 px-1 rounded"
                        title={`${oooCountForDay} agent(s) marked No-Go on this day`}
                      >
                        <CalendarClock className="h-3 w-3" /> {oooCountForDay} OOO
                      </span>
                    )}
                  </div>

                  <div
                    className={`mt-auto text-center text-xs font-semibold leading-snug ${
                      cell.agent_name ? "text-gold" : "text-muted-foreground/40 font-normal"
                    } ${isOoo ? "line-through opacity-70" : ""}`}
                  >
                    {cell.agent_name ?? "Unassigned"}
                  </div>

                  {isOoo && (
                    <div className="flex items-center justify-center gap-1 text-[10px] text-destructive font-semibold mt-1">
                      <AlertTriangle className="h-3 w-3" /> No-Go Conflict
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar: Shift Distribution & No-Go Days Management */}
        <aside className="space-y-4">
          {/* Shift Distribution Card */}
          <div className="rounded-lg border border-gold/30 bg-card overflow-hidden shadow-sm">
            <div className="bg-navy/80 border-b border-gold/30 px-4 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-gold font-semibold">
                  Shift Distribution
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {officeName} · {monthLabel(year, month)}
                </div>
              </div>
              <Badge variant="outline" className="border-gold/30 text-gold text-xs">
                {distribution.reduce((acc, d) => acc + d.days, 0)} shifts
              </Badge>
            </div>
            <div className="max-h-[220px] overflow-y-auto divide-y divide-border/40">
              {distribution.length === 0 ? (
                <div className="px-4 py-6 text-xs text-muted-foreground text-center">
                  No active agents in {officeName}.
                </div>
              ) : (
                distribution.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between px-3.5 py-2 text-xs hover:bg-gold/5"
                  >
                    <div className="truncate pr-2">
                      <span className="font-medium text-foreground">{d.name}</span>
                      {d.notes && (
                        <span className="text-[10px] text-gold block truncate" title={d.notes}>
                          {d.notes}
                        </span>
                      )}
                    </div>
                    <span className="text-gold font-bold tabular-nums text-sm">{d.days}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* No-Go Days (OOO) Management Card */}
          <div className="rounded-lg border border-gold/30 bg-card overflow-hidden shadow-sm">
            <div className="bg-navy/80 border-b border-gold/30 px-4 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-gold font-semibold flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-amber-400" />
                  No-Go Days / Time Off
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {officeName} · {monthLabel(year, month)}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openAddOooDialog()}
                className="h-7 px-2 text-[11px] border-gold/40 text-gold hover:bg-gold/10"
              >
                <Plus className="h-3 w-3 mr-1" /> Add No-Go
              </Button>
            </div>

            <div className="max-h-[300px] overflow-y-auto divide-y divide-border/40">
              {oooRanges.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No time off scheduled for this office in {monthLabel(year, month)}.
                </div>
              ) : (
                oooRanges.map((o: any, idx: number) => {
                  const range =
                    o.date_start === o.date_end
                      ? formatDate(o.date_start)
                      : `${formatDate(o.date_start)} – ${formatDate(o.date_end)}`;
                  return (
                    <div
                      key={o.id || idx}
                      className="px-3.5 py-2 hover:bg-gold/5 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5 truncate">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground truncate">
                            {o.agent_name}
                          </span>
                          <span className="text-amber-400 font-medium tabular-nums whitespace-nowrap text-[11px]">
                            {range}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          {o.reason && <span className="capitalize">{o.reason}</span>}
                          {o.note && (
                            <span className="italic truncate" title={o.note}>
                              · "{o.note}"
                            </span>
                          )}
                        </div>
                      </div>

                      {o.id && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Remove no-go day for ${o.agent_name} (${range})?`)) {
                              deleteOooMut.mutate(o.id);
                            }
                          }}
                          className="h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0"
                          title="Delete No-Go Day"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="bg-navy/30 p-2 text-[10px] text-muted-foreground text-center border-t border-border/30">
              Agents submitting via /availability autofill here.
            </div>
          </div>
        </aside>
      </div>

      {/* ───────────────── CLAUDE SCHEDULING ASSISTANT DIALOG ───────────────── */}
      <Dialog open={claudeOpen} onOpenChange={setClaudeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold" />
              Claude Duty Scheduling Assistant
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Generate optimal, balanced duty day assignments for {officeName} in {monthLabel(year, month)}.
            </p>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-navy/60 border border-gold/20 text-center">
              <div>
                <div className="text-xs text-muted-foreground">Office</div>
                <div className="text-sm font-semibold text-gold">{officeName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Active Agents</div>
                <div className="text-sm font-semibold text-foreground">
                  {agents.filter((a) => a.status === "active").length}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">No-Go Days</div>
                <div className="text-sm font-semibold text-amber-400">{oooRanges.length}</div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-gold" />
                  Custom Prompt Notes & Instructions for Claude
                </Label>
                <span className="text-[10px] text-muted-foreground">Optional</span>
              </div>
              <Textarea
                value={promptNotes}
                onChange={(e) => setPromptNotes(e.target.value)}
                placeholder="Give Claude special instructions for this specific month (e.g. 'Holiday weekend on the 15th, assign senior agents', 'Limit Joe to 2 shifts', 'Ensure Shawn works early in the month', 'Balance Saturdays evenly')..."
                className="min-h-[100px] mt-1.5 text-xs bg-card"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Claude strictly respects individual agent profile notes, avoids No-Go dates, skips Sundays, and balances workloads with the previous month.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setClaudeOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-navy hover:bg-gold/90 font-semibold"
              disabled={analyzeMut.isPending}
              onClick={() => analyzeMut.mutate(promptNotes)}
            >
              {analyzeMut.isPending ? "Generating with Claude…" : "Run Claude Scheduler"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────── DIRECT ADD NO-GO DAY DIALOG ───────────────── */}
      <Dialog open={addOooOpen} onOpenChange={setAddOooOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-400" />
              Add No-Go Day for {officeName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div>
              <Label className="text-xs">Agent</Label>
              <Select value={oooAgentId} onValueChange={setOooAgentId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                type="button"
                variant={oooMode === "single" ? "default" : "outline"}
                onClick={() => {
                  setOooMode("single");
                  setOooEndDate(oooStartDate);
                }}
                className={`h-7 px-2.5 text-xs ${oooMode === "single" ? "bg-gold text-navy" : ""}`}
              >
                Single Day
              </Button>
              <Button
                size="sm"
                type="button"
                variant={oooMode === "range" ? "default" : "outline"}
                onClick={() => setOooMode("range")}
                className={`h-7 px-2.5 text-xs ${oooMode === "range" ? "bg-gold text-navy" : ""}`}
              >
                Date Range
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{oooMode === "single" ? "Date" : "Start Date"}</Label>
                <Input
                  type="date"
                  value={oooStartDate}
                  onChange={(e) => {
                    setOooStartDate(e.target.value);
                    if (oooMode === "single") setOooEndDate(e.target.value);
                  }}
                  className="mt-1 text-xs"
                />
              </div>

              {oooMode === "range" && (
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={oooEndDate}
                    onChange={(e) => setOooEndDate(e.target.value)}
                    min={oooStartDate}
                    className="mt-1 text-xs"
                  />
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Reason</Label>
              <Select value={oooReason} onValueChange={(v) => setOooReason(v as any)}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">Vacation / Travel</SelectItem>
                  <SelectItem value="personal">Personal / Family</SelectItem>
                  <SelectItem value="sick">Medical / Sick</SelectItem>
                  <SelectItem value="other">Duty Conflict / Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Optional Note</Label>
              <Input
                value={oooNote}
                onChange={(e) => setOooNote(e.target.value)}
                placeholder="e.g. morning closing, out of town"
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button variant="outline" onClick={() => setAddOooOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-navy hover:bg-gold/90 font-medium"
              disabled={!oooAgentId || !oooStartDate || addOooMut.isPending}
              onClick={() => addOooMut.mutate()}
            >
              {addOooMut.isPending ? "Saving…" : "Save No-Go Day"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────── ASSIGN DUTY DAY DIALOG ───────────────── */}
      <Dialog open={editDay !== null} onOpenChange={(o) => !o && setEditDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Assign Duty — {monthLabel(year, month)} {editDay}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Show agents marked No-Go on this day */}
            {(() => {
              const cell = grid.find((c: any) => c.day === editDay);
              const oooAgentIds: string[] = cell?.ooo_agent_ids ?? [];
              if (oooAgentIds.length === 0) return null;
              const oooNames = agents
                .filter((a) => oooAgentIds.includes(a.id))
                .map((a) => a.name);
              return (
                <div className="p-3 rounded-md bg-amber-400/10 border border-amber-400/30 text-xs text-amber-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" /> Unavailable on this day:
                  </div>
                  <div>{oooNames.join(", ")}</div>
                </div>
              );
            })()}

            <div>
              <Label className="text-xs">Assigned Agent</Label>
              <Select value={editAgent} onValueChange={setEditAgent}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {agents.map((a) => {
                    const cell = grid.find((c: any) => c.day === editDay);
                    const isOoo = (cell?.ooo_agent_ids ?? []).includes(a.id);
                    const inactive = a.status !== "active";
                    return (
                      <SelectItem key={a.id} value={a.id} disabled={isOoo || inactive}>
                        {a.name}
                        {isOoo ? " — No-Go (OOO)" : inactive ? " — inactive" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-border/30">
              <span className="text-xs text-muted-foreground">Need to mark someone out?</span>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-gold hover:bg-gold/10 h-7 px-2"
                onClick={() => {
                  setEditDay(null);
                  openAddOooDialog(editDay ?? undefined);
                }}
              >
                + Mark No-Go on Day {editDay}
              </Button>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setEditDay(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-navy hover:bg-gold/90 font-medium"
              onClick={() =>
                assignMut.mutate({
                  day: editDay!,
                  agent_id: editAgent === "none" ? null : editAgent,
                })
              }
              disabled={assignMut.isPending}
            >
              {assignMut.isPending ? "Saving…" : "Save Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────── SUGGESTIONS PREVIEW DIALOG ───────────────── */}
      <Dialog open={!!suggestions} onOpenChange={(o) => !o && setSuggestions(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold" />
              Claude's Suggested Duty Assignments
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Review Claude's generated schedule for {officeName} — {monthLabel(year, month)}.
              Accept to apply these assignments to the live duty calendar.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto border border-gold/20 rounded-md divide-y divide-border/40 max-h-[420px] mt-2">
            {(suggestions ?? []).map((s) => (
              <div key={s.day} className="px-3.5 py-2 flex items-center justify-between text-xs hover:bg-gold/5">
                <span className="font-semibold text-muted-foreground">
                  Day {s.day} ({WEEKDAYS[new Date(Date.UTC(year, month - 1, s.day)).getUTCDay()]})
                </span>
                <span className={s.agent_id ? "text-gold font-bold text-sm" : "text-destructive font-medium"}>
                  {s.agent_id ? s.agent_name : `${s.agent_name} (unmatched)`}
                </span>
              </div>
            ))}
            {(suggestions ?? []).length === 0 && (
              <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                No suggestions returned.
              </div>
            )}
          </div>

          <DialogFooter className="mt-3 pt-3 border-t border-border/40 flex justify-between">
            <Button variant="outline" onClick={() => setSuggestions(null)}>
              Reject
            </Button>
            <Button
              className="bg-gold text-navy hover:bg-gold/90 font-semibold"
              onClick={() =>
                applyMut.mutate(
                  (suggestions ?? [])
                    .filter((s) => s.agent_id)
                    .map((s) => ({ day: s.day, agent_id: s.agent_id })),
                )
              }
              disabled={applyMut.isPending}
            >
              {applyMut.isPending ? "Saving…" : "Accept & Apply to Calendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}