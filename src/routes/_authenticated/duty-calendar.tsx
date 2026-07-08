import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles, Plus, Trash2, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  getDutyCalendar,
  assignDutyDay,
  analyzeDutyAssignments,
  createDutyCalendar,
  deleteDutyCalendarMonth,
} from "@/lib/duty-calendar.functions";

export const Route = createFileRoute("/_authenticated/duty-calendar")({
  component: DutyCalendarPage,
  head: () => ({ meta: [{ title: "Duty Calendar — MSREG" }] }),
});

const OFFICES = [
  { value: "rolla", label: "Rolla" },
  { value: "str", label: "St. Robert" },
  { value: "loz", label: "Lake of the Ozarks" },
] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function monthLabel(y: number, m: number) {
  return `${MONTH_NAMES[m - 1]} ${y}`;
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
  const [editDay, setEditDay] = useState<number | null>(null);
  const [editAgent, setEditAgent] = useState<string>("none");
  const [suggestions, setSuggestions] = useState<Array<{ day: number; agent_id: string | null; agent_name: string }> | null>(null);

  const qc = useQueryClient();
  const getCal = useServerFn(getDutyCalendar);
  const assign = useServerFn(assignDutyDay);
  const analyze = useServerFn(analyzeDutyAssignments);
  const createCal = useServerFn(createDutyCalendar);
  const delMonth = useServerFn(deleteDutyCalendarMonth);

  const key = ["duty-calendar", year, month, office] as const;
  const calQ = useQuery({
    queryKey: key,
    queryFn: () => getCal({ data: { year, month, office } }),
    enabled: canManage,
  });

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1);
  };

  const assignMut = useMutation({
    mutationFn: (vars: { day: number; agent_id: string | null }) =>
      assign({ data: { year, month, office, day: vars.day, agent_id: vars.agent_id } }),
    onSuccess: () => {
      toast.success("Assignment saved");
      setEditDay(null);
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const analyzeMut = useMutation({
    mutationFn: () => analyze({ data: { year, month, office } }),
    onSuccess: (res: any) => {
      setSuggestions(res.suggestions);
      toast.success("Claude generated suggestions");
    },
    onError: (e: any) => toast.error(e?.message ?? "Analysis failed"),
  });

  const applyMut = useMutation({
    mutationFn: (assignments: Array<{ day: number; agent_id: string | null }>) =>
      createCal({ data: { year, month, office, assignments } }),
    onSuccess: () => {
      toast.success("Calendar saved");
      setSuggestions(null);
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const createNextMonth = () => {
    const ny = month === 12 ? year + 1 : year;
    const nm = month === 12 ? 1 : month + 1;
    setYear(ny); setMonth(nm);
    toast.info(`Switched to ${monthLabel(ny, nm)} — assign agents or click Analyze`);
  };

  const deleteMonthMut = useMutation({
    mutationFn: () => delMonth({ data: { year, month, office } }),
    onSuccess: () => {
      toast.success("Month cleared");
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const grid = calQ.data?.grid ?? [];
  const agents: any[] = calQ.data?.agents ?? [];
  const officeName = OFFICES.find((o) => o.value === office)?.label ?? office;

  // distribution per agent for sidebar
  const distribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cell of grid) {
      if (cell.agent_id) counts.set(cell.agent_id, (counts.get(cell.agent_id) ?? 0) + 1);
    }
    return agents
      .filter((a) => a.status === "active")
      .map((a) => ({ id: a.id, name: a.name, days: counts.get(a.id) ?? 0 }))
      .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name));
  }, [grid, agents]);

  // 7-column grid with leading blanks
  const leadingBlanks = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    return first.getDay(); // 0=Sun
  }, [year, month]);

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
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-gold" />
            Duty Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Assign duty days per office.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => analyzeMut.mutate()} disabled={analyzeMut.isPending}>
            <Sparkles className="h-4 w-4 mr-1 text-gold" />
            {analyzeMut.isPending ? "Analyzing…" : "Analyze"}
          </Button>
          <Button size="sm" variant="outline" onClick={createNextMonth}>
            <Plus className="h-4 w-4 mr-1" /> Create Next Month
          </Button>
          <Button size="sm" variant="outline" onClick={exportPdf}>
            <Download className="h-4 w-4 mr-1 text-gold" /> Export Calendar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("Clear all duty assignments for this month and office?")) deleteMonthMut.mutate();
            }}
          >
            <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Clear Month
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Button size="icon" variant="outline" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 6 }, (_, i) => today.getFullYear() - 1 + i).map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="icon" variant="outline" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <Tabs value={office} onValueChange={(v) => setOffice(v as any)}>
        <TabsList className="bg-navy border border-gold/20">
          {OFFICES.map((o) => (
            <TabsTrigger key={o.value} value={o.value} className="data-[state=active]:bg-gold data-[state=active]:text-navy">
              {o.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Calendar grid */}
        <div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-xs font-semibold text-gold uppercase tracking-wider py-2 bg-navy/70 rounded">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`b${i}`} className="min-h-[92px] rounded border border-border/40 bg-card/30" />
            ))}
            {grid.map((cell: any) => {
              const isOoo = !!cell.agent_id && (cell.ooo_agent_ids ?? []).includes(cell.agent_id);
              return (
                <button
                  key={cell.day}
                  onClick={() => {
                    setEditDay(cell.day);
                    setEditAgent(cell.agent_id ?? "none");
                  }}
                  className={`rounded border ${isOoo ? "border-destructive/60" : "border-gold/20"} bg-card hover:bg-gold/5 p-2 text-left transition-colors min-h-[92px] flex flex-col`}
                >
                  <div className="text-xs text-muted-foreground">{cell.day}</div>
                  <div className={`mt-auto text-center text-sm font-medium leading-tight ${cell.agent_name ? "text-gold" : "text-muted-foreground/60"} ${isOoo ? "line-through opacity-70" : ""}`}>
                    {cell.agent_name ?? "—"}
                  </div>
                  {isOoo && (
                    <div className="flex items-center justify-center gap-1 text-[10px] text-destructive mt-1">
                      <AlertTriangle className="h-3 w-3" /> OOO
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right sidebar — distribution */}
        <aside className="rounded-lg border border-gold/30 bg-card overflow-hidden h-fit">
          <div className="bg-navy/70 border-b border-gold/30 px-4 py-2">
            <div className="text-xs uppercase tracking-wider text-gold font-semibold">Distribution</div>
            <div className="text-[11px] text-muted-foreground">{officeName} · {monthLabel(year, month)}</div>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {distribution.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">No active agents.</div>
            ) : (
              distribution.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-4 py-2 border-b border-border/40 last:border-0 text-sm">
                  <span className="truncate">{d.name}</span>
                  <span className="text-gold font-semibold tabular-nums">{d.days}</span>
                </div>
              ))
            )}
          </div>

          {/* Time off requests */}
          <div className="mt-4 rounded-lg border border-gold/30 bg-card overflow-hidden">
            <div className="bg-navy/70 border-b border-gold/30 px-4 py-2">
              <div className="text-xs uppercase tracking-wider text-gold font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Time Off Requests
              </div>
              <div className="text-[11px] text-muted-foreground">{officeName} · {monthLabel(year, month)}</div>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {((calQ.data as any)?.ooo_ranges ?? []).length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">No time off this month.</div>
              ) : (
                ((calQ.data as any)?.ooo_ranges ?? []).map((o: any, idx: number) => {
                  const fmt = (s: string) => {
                    const [, m, d] = s.split("-").map(Number);
                    return `${m}/${d}`;
                  };
                  const range = o.date_start === o.date_end ? fmt(o.date_start) : `${fmt(o.date_start)} – ${fmt(o.date_end)}`;
                  return (
                    <div key={idx} className="px-4 py-2 border-b border-border/40 last:border-0 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{o.agent_name}</span>
                        <span className="text-gold tabular-nums text-xs whitespace-nowrap">{range}</span>
                      </div>
                      {o.reason && (
                        <div className="text-[11px] text-muted-foreground capitalize mt-0.5">{o.reason}</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Assign dialog */}
      <Dialog open={editDay !== null} onOpenChange={(o) => !o && setEditDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Duty — {monthLabel(year, month)} {editDay}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={editAgent} onValueChange={setEditAgent}>
              <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {agents.map((a) => {
                  const cell = grid.find((c: any) => c.day === editDay);
                  const isOoo = (cell?.ooo_agent_ids ?? []).includes(a.id);
                  const inactive = a.status !== "active";
                  return (
                    <SelectItem key={a.id} value={a.id} disabled={isOoo || inactive}>
                      {a.name}{isOoo ? " — Out of Office" : inactive ? " — inactive" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDay(null)}>Cancel</Button>
            <Button
              className="bg-gold text-navy hover:bg-gold/90"
              onClick={() =>
                assignMut.mutate({ day: editDay!, agent_id: editAgent === "none" ? null : editAgent })
              }
              disabled={assignMut.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suggestions preview */}
      <Dialog open={!!suggestions} onOpenChange={(o) => !o && setSuggestions(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Claude's Suggested Assignments</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto rounded border border-gold/20 divide-y divide-border">
            {(suggestions ?? []).map((s) => (
              <div key={s.day} className="px-3 py-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Day {s.day}</span>
                <span className={s.agent_id ? "text-gold font-medium" : "text-destructive"}>
                  {s.agent_id ? s.agent_name : `${s.agent_name} (unmatched)`}
                </span>
              </div>
            ))}
            {(suggestions ?? []).length === 0 && (
              <div className="px-3 py-6 text-sm text-muted-foreground">No suggestions returned.</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuggestions(null)}>Reject</Button>
            <Button
              className="bg-gold text-navy hover:bg-gold/90"
              onClick={() =>
                applyMut.mutate(
                  (suggestions ?? [])
                    .filter((s) => s.agent_id)
                    .map((s) => ({ day: s.day, agent_id: s.agent_id })),
                )
              }
              disabled={applyMut.isPending}
            >
              {applyMut.isPending ? "Saving…" : "Accept & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
