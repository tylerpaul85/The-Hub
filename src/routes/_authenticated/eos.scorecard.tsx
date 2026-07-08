import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, Trash2, Plus, Pencil, ChevronLeft, ChevronRight, Check, ArrowUp, ArrowDown, Upload, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { displayName, type Member, type GoalDirection, isGoalHit } from "@/lib/eos";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/eos/scorecard")({
  component: ScorecardPage,
  head: () => ({ meta: [{ title: "Scorecard — EOS — MSREG" }] }),
});

const sb = supabase as any;

const DEFAULT_SOURCES = [
  "FUB",
  "Mailchimp",
  "FB Advertising",
  "Google Ads",
  "Google Analytics",
  "YouTube",
  "Organic Content",
];

type Measurable = {
  id: string;
  label: string;
  weekly_target: string;
  sort_order: number;
  source: string | null;
  owner_id: string | null;
  goal_direction: GoalDirection;
};

type WeeklyEntry = {
  id: string;
  measurable_id: string;
  week_start: string;
  actual_value: number;
  submitted_by: string | null;
};

// Monday-anchored week start (local time)
function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  return x;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekLabel(monday: Date): string {
  const sun = new Date(monday); sun.setDate(monday.getDate() + 6);
  return `${monday.getMonth() + 1}/${monday.getDate()}–${sun.getMonth() + 1}/${sun.getDate()}`;
}

// All Mondays for the 2026 plan year (Mon containing Jan 1 2026 → last Mon ≤ Dec 31 2026)
function buildWeeks2026(): Date[] {
  const out: Date[] = [];
  let m = mondayOf(new Date(2026, 0, 1));
  const end = new Date(2027, 0, 1);
  while (m < end) {
    out.push(new Date(m));
    const n = new Date(m); n.setDate(m.getDate() + 7); m = n;
  }
  return out;
}

function ScorecardPage() {
  const { user, isAdmin } = useAuth();
  const [tab, setTab] = useState("submit");

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-gold" /> Scorecard
        </h1>
        <p className="text-muted-foreground mt-1">Submit your weekly numbers and see how the team is tracking against its goals.</p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="submit">My Numbers</TabsTrigger>
          <TabsTrigger value="history">Full History</TabsTrigger>
          {isAdmin && <TabsTrigger value="settings">Settings</TabsTrigger>}
          {isAdmin && <TabsTrigger value="import">Bulk Import</TabsTrigger>}
        </TabsList>

        <TabsContent value="submit" className="mt-6">
          <SubmitSection userId={user?.id ?? ""} />
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <HistorySection />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="settings" className="mt-6">
            <SettingsSection />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="import" className="mt-6">
            <ImportSection />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ===== My Numbers =====
function SubmitSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const weeks = useMemo(buildWeeks2026, []);
  const currentMonday = useMemo(() => mondayOf(new Date()), []);
  const defaultIdx = useMemo(() => {
    const t = ymd(currentMonday);
    const i = weeks.findIndex((w) => ymd(w) === t);
    return i >= 0 ? i : 0;
  }, [weeks, currentMonday]);
  const [weekIdx, setWeekIdx] = useState(defaultIdx);
  const monday = weeks[weekIdx];
  const wk = ymd(monday);

  const { data: mine = [] } = useQuery({
    queryKey: ["my-measurables", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await sb
        .from("scorecard_measurables")
        .select("*")
        .eq("owner_id", userId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Measurable[];
    },
    enabled: !!userId,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["my-week-entries", userId, wk],
    queryFn: async () => {
      if (!userId || mine.length === 0) return [];
      const { data, error } = await sb
        .from("scorecard_weekly_entries")
        .select("*")
        .eq("week_start", wk)
        .in("measurable_id", mine.map((m) => m.id));
      if (error) throw error;
      return (data ?? []) as WeeklyEntry[];
    },
    enabled: mine.length > 0,
  });

  const upsert = useMutation({
    mutationFn: async ({ measurable_id, actual_value }: { measurable_id: string; actual_value: number }) => {
      const { error } = await sb
        .from("scorecard_weekly_entries")
        .upsert(
          { measurable_id, week_start: wk, actual_value, submitted_by: userId },
          { onConflict: "measurable_id,week_start" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-week-entries", userId, wk] });
      qc.invalidateQueries({ queryKey: ["all-weekly-entries"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isCurrent = ymd(monday) === ymd(currentMonday);
  const filled = entries.length;
  const total = mine.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
        <Button size="sm" variant="ghost" onClick={() => setWeekIdx((i) => Math.max(0, i - 1))} disabled={weekIdx === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Week of</div>
          <div className="font-semibold">
            {format(monday, "MMM d")} – {format(new Date(monday.getTime() + 6 * 86400000), "MMM d, yyyy")}
            {isCurrent && <span className="ml-2 text-xs text-gold">(current)</span>}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setWeekIdx((i) => Math.min(weeks.length - 1, i + 1))} disabled={weekIdx === weeks.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => setWeekIdx(defaultIdx)} disabled={isCurrent}>
          This week
        </Button>
      </div>

      {mine.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          You're not assigned to any scorecard metrics. An admin can assign metrics to you from Settings.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="font-semibold">My metrics for this week</div>
            <div className="text-xs text-muted-foreground">{filled}/{total} submitted</div>
          </div>
          <div className="divide-y divide-border">
            {mine.map((m) => {
              const e = entries.find((x) => x.measurable_id === m.id);
              const hitResult = e ? isGoalHit(Number(e.actual_value), m.weekly_target, m.goal_direction) : null;
              const comparable = hitResult !== null;
              const hit = hitResult === true;
              return (
                <div key={m.id} className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{m.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.source || "Uncategorized"} · Goal {m.weekly_target} · {m.goal_direction === "lower_is_better" ? "lower is better" : "higher is better"}
                    </div>
                  </div>
                  {e ? (
                    comparable ? (
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border", hit ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30")}>
                        {hit ? "Goal hit" : "Off goal"}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">Submitted</span>
                    )
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">Needs entry</span>
                  )}
                  <Input
                    type="number"
                    className={cn("w-28 text-right", e && comparable && (hit ? "text-emerald-400 border-emerald-500/40" : "text-destructive border-destructive/40"))}
                    defaultValue={e?.actual_value ?? ""}
                    placeholder="—"
                    onBlur={(ev) => {
                      const raw = ev.target.value;
                      if (raw === "") return;
                      const v = Number(raw);
                      if (Number.isNaN(v)) return;
                      if (e && v === Number(e.actual_value)) return;
                      upsert.mutate({ measurable_id: m.id, actual_value: v });
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Full History grid =====
function HistorySection() {
  const weeks = useMemo(buildWeeks2026, []);
  const currentMonday = useMemo(() => mondayOf(new Date()), []);
  const currentIdx = Math.max(0, weeks.findIndex((w) => ymd(w) === ymd(currentMonday)));
  // Show 12 weeks ending at currentIdx by default
  const [endIdx, setEndIdx] = useState(currentIdx);
  const startIdx = Math.max(0, endIdx - 11);
  const visibleWeeks = weeks.slice(startIdx, endIdx + 1);

  const { data: measurables = [] } = useQuery({
    queryKey: ["all-measurables"],
    queryFn: async () => {
      const { data, error } = await sb.from("scorecard_measurables").select("*").order("source").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Measurable[];
    },
  });
  const { data: members = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => (await sb.rpc("get_team_members")).data as Member[],
  });
  const { data: entries = [] } = useQuery({
    queryKey: ["all-weekly-entries", ymd(visibleWeeks[0]!), ymd(visibleWeeks[visibleWeeks.length - 1]!)],
    queryFn: async () => {
      const { data, error } = await sb
        .from("scorecard_weekly_entries")
        .select("measurable_id, week_start, actual_value")
        .gte("week_start", ymd(visibleWeeks[0]!))
        .lte("week_start", ymd(visibleWeeks[visibleWeeks.length - 1]!));
      if (error) throw error;
      return (data ?? []) as { measurable_id: string; week_start: string; actual_value: number }[];
    },
  });

  const grouped = useMemo(() => {
    const g: Record<string, Measurable[]> = {};
    for (const m of measurables) (g[m.source || "Uncategorized"] ??= []).push(m);
    return g;
  }, [measurables]);

  const entryMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(`${e.measurable_id}|${e.week_start}`, Number(e.actual_value));
    return m;
  }, [entries]);

  const nameOf = (id: string | null) => {
    if (!id) return "—";
    const m = members.find((x) => x.id === id);
    return m ? displayName(m) : "—";
  };

  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="font-semibold">Weekly history</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setEndIdx((i) => Math.max(11, i - 12))} disabled={startIdx === 0}>
            <ChevronLeft className="h-4 w-4" /> Older
          </Button>
          <div className="text-xs text-muted-foreground">
            {weekLabel(visibleWeeks[0]!)} → {weekLabel(visibleWeeks[visibleWeeks.length - 1]!)}
          </div>
          <Button size="sm" variant="outline" onClick={() => setEndIdx((i) => Math.min(weeks.length - 1, i + 12))} disabled={endIdx >= weeks.length - 1}>
            Newer <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEndIdx(currentIdx)} disabled={endIdx === currentIdx}>
            Current
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm min-w-full border-collapse">
          <thead className="bg-muted/30 sticky top-0">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left p-2 pl-5 sticky left-0 bg-muted/30 z-10 min-w-[220px]">Metric</th>
              <th className="text-left p-2 min-w-[120px]">Owner</th>
              <th className="text-right p-2">Goal</th>
              {visibleWeeks.map((w) => (
                <th key={ymd(w)} className="text-right p-2 whitespace-nowrap font-medium">
                  {weekLabel(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([source, list]) => (
              <FragmentGroup key={source} source={source} list={list} visibleWeeks={visibleWeeks} entryMap={entryMap} nameOf={nameOf} />
            ))}
            {measurables.length === 0 && (
              <tr><td colSpan={3 + visibleWeeks.length} className="p-8 text-center text-muted-foreground">No measurables yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentGroup({ source, list, visibleWeeks, entryMap, nameOf }: {
  source: string;
  list: Measurable[];
  visibleWeeks: Date[];
  entryMap: Map<string, number>;
  nameOf: (id: string | null) => string;
}) {
  return (
    <>
      <tr className="bg-navy-deep/40">
        <td colSpan={3 + visibleWeeks.length} className="px-5 py-2 text-xs uppercase tracking-wider text-gold font-semibold border-t border-b border-border">
          {source}
        </td>
      </tr>
      {list.map((m) => (
        <tr key={m.id} className="border-b border-border/60 hover:bg-muted/20">
          <td className="p-2 pl-5 sticky left-0 bg-card z-10">{m.label}</td>
          <td className="p-2 text-muted-foreground">{nameOf(m.owner_id)}</td>
          <td className="p-2 text-right text-muted-foreground">{m.weekly_target}</td>
          {visibleWeeks.map((w) => {
            const v = entryMap.get(`${m.id}|${ymd(w)}`);
            if (v === undefined) return <td key={ymd(w)} className="p-2 text-right text-muted-foreground">—</td>;
            const hitResult = isGoalHit(v, m.weekly_target, m.goal_direction);
            const comparable = hitResult !== null;
            const hit = hitResult === true;
            return (
              <td key={ymd(w)} className={cn("p-2 text-right font-medium", comparable ? (hit ? "text-emerald-400" : "text-destructive") : "text-foreground")}>
                {v}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

// ===== Settings (admin) =====
function SettingsSection() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Measurable | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Measurable | null>(null);

  const { data: measurables = [] } = useQuery({
    queryKey: ["all-measurables"],
    queryFn: async () => {
      const { data, error } = await sb.from("scorecard_measurables").select("*").order("source").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Measurable[];
    },
  });
  const { data: members = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => (await sb.rpc("get_team_members")).data as Member[],
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("scorecard_measurables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-measurables"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const idx = measurables.findIndex((m) => m.id === id);
      const target = measurables[idx + dir];
      if (!target) return;
      const a = measurables[idx];
      await sb.from("scorecard_measurables").update({ sort_order: target.sort_order }).eq("id", a.id);
      await sb.from("scorecard_measurables").update({ sort_order: a.sort_order }).eq("id", target.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-measurables"] }),
  });

  const grouped = useMemo(() => {
    const g: Record<string, Measurable[]> = {};
    for (const m of measurables) (g[m.source || "Uncategorized"] ??= []).push(m);
    return g;
  }, [measurables]);

  const nameOf = (id: string | null) => {
    if (!id) return <span className="text-destructive">Unassigned</span>;
    const m = members.find((x) => x.id === id);
    return m ? displayName(m) : "—";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Define metrics, group by source, and assign the owner who submits each weekly number.</p>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1.5" /> Add measurable</Button>
      </div>

      {Object.entries(grouped).map(([source, list]) => (
        <div key={source} className="bg-card border border-border rounded-xl">
          <div className="px-5 py-3 border-b border-border text-xs uppercase tracking-wider text-gold font-semibold">{source}</div>
          <div className="divide-y divide-border">
            {list.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.label}</div>
                  <div className="text-xs text-muted-foreground">Goal {m.weekly_target} · Owner: {nameOf(m.owner_id)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => reorder.mutate({ id: m.id, dir: -1 })}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => reorder.mutate({ id: m.id, dir: 1 })}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleting(m)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {measurables.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          No measurables yet. Click "Add measurable" to create your first one.
        </div>
      )}

      {(editing || creating) && (
        <MeasurableEditor
          existing={editing}
          members={members}
          allSources={Array.from(new Set([...DEFAULT_SOURCES, ...measurables.map((m) => m.source).filter(Boolean) as string[]]))}
          sortFallback={measurables.length}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["all-measurables"] }); setEditing(null); setCreating(false); }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this measurable?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.label}" and all of its weekly entries will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleting) { remove.mutate(deleting.id); setDeleting(null); } }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MeasurableEditor({ existing, members, allSources, sortFallback, onClose, onSaved }: {
  existing: Measurable | null;
  members: Member[];
  allSources: string[];
  sortFallback: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(existing?.label ?? "");
  const [target, setTarget] = useState(String(existing?.weekly_target ?? ""));
  const [source, setSource] = useState<string>(existing?.source ?? "");
  const [customSource, setCustomSource] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [ownerId, setOwnerId] = useState<string>(existing?.owner_id ?? "");
  const [goalDirection, setGoalDirection] = useState<GoalDirection>(existing?.goal_direction ?? "higher_is_better");

  const save = useMutation({
    mutationFn: async () => {
      const finalSource = (useCustom ? customSource.trim() : source.trim()) || null;
      const payload: any = {
        label: label.trim(),
        weekly_target: target.trim(),
        source: finalSource,
        owner_id: ownerId || null,
        goal_direction: goalDirection,
      };
      if (!payload.label) throw new Error("Label required");
      if (existing) {
        const { error } = await sb.from("scorecard_measurables").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        payload.sort_order = sortFallback;
        const { error } = await sb.from("scorecard_measurables").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: onSaved,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit measurable" : "New measurable"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Leads generated" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Source / category</label>
            {useCustom ? (
              <div className="flex gap-2">
                <Input value={customSource} onChange={(e) => setCustomSource(e.target.value)} placeholder="New source name" />
                <Button variant="ghost" size="sm" onClick={() => setUseCustom(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {allSources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setUseCustom(true)}>+ New</Button>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Owner</label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger><SelectValue placeholder="Assign owner" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{displayName(m)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Weekly goal</label>
            <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 50, 80%, Yes" />
            <p className="text-[10px] text-muted-foreground mt-1">Can be a number, percentage, or word (e.g. Yes/No).</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Goal direction</label>
            <Select value={goalDirection} onValueChange={(v) => setGoalDirection(v as GoalDirection)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="higher_is_better">Higher is better (green when actual ≥ goal)</SelectItem>
                <SelectItem value="lower_is_better">Lower is better (green when actual ≤ goal)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Check className="h-4 w-4 mr-1.5" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Bulk Import (admin) =====
type ParsedRow = {
  source: string;
  metric: string;
  ownerName: string;
  ownerId: string | null;
  goal: number;
  values: { weekStart: string; value: number }[];
  warnings: string[];
};

type ParseResult = {
  weekHeaders: { raw: string; weekStart: string | null }[];
  rows: ParsedRow[];
  rowErrors: { line: number; raw: string; reason: string }[];
  unparsedWeeks: string[];
};

// Simple CSV row splitter that handles quoted fields
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseNumberCell(raw: string): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/[,$%]/g, "");
  if (s === "" || s === "-" || s === "—") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// "6/1-6/7" or "6/1–6/7" → Monday yyyy-mm-dd given a starting year that advances on rollover
function parseWeekHeader(raw: string, year: number): { weekStart: string; year: number } | null {
  const cleaned = raw.replace(/[–—]/g, "-").trim();
  const m = cleaned.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  const mon = mondayOf(d);
  return { weekStart: ymd(mon), year };
}

function parseImportText(text: string, startYear: number, members: Member[]): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
  const result: ParseResult = { weekHeaders: [], rows: [], rowErrors: [], unparsedWeeks: [] };
  if (lines.length === 0) return result;

  const header = splitCsvLine(lines[0]);
  const lower = header.map((h) => h.toLowerCase());
  const idxSource = lower.findIndex((h) => h === "source");
  const idxMetric = lower.findIndex((h) => h === "metric" || h === "measurable" || h === "name");
  const idxOwner = lower.findIndex((h) => h === "owner");
  const idxGoal = lower.findIndex((h) => h === "goal" || h === "target");
  if (idxSource < 0 || idxMetric < 0 || idxOwner < 0 || idxGoal < 0) {
    result.rowErrors.push({ line: 1, raw: lines[0], reason: "Header must include Source, Metric, Owner, Goal columns" });
    return result;
  }
  const fixedIdxs = new Set([idxSource, idxMetric, idxOwner, idxGoal]);

  let year = startYear;
  let prevMonth = 0;
  const weekCols: { col: number; raw: string; weekStart: string | null }[] = [];
  for (let i = 0; i < header.length; i++) {
    if (fixedIdxs.has(i)) continue;
    const raw = header[i];
    if (!raw) continue;
    const parsed = parseWeekHeader(raw, year);
    if (!parsed) {
      result.unparsedWeeks.push(raw);
      weekCols.push({ col: i, raw, weekStart: null });
      continue;
    }
    const month = Number(raw.replace(/[–—]/g, "-").match(/^(\d{1,2})/)?.[1] ?? 0);
    if (prevMonth && month < prevMonth - 6) {
      year += 1;
      const reparsed = parseWeekHeader(raw, year);
      if (reparsed) parsed.weekStart = reparsed.weekStart;
    }
    prevMonth = month;
    weekCols.push({ col: i, raw, weekStart: parsed.weekStart });
    result.weekHeaders.push({ raw, weekStart: parsed.weekStart });
  }

  const findOwner = (name: string): string | null => {
    const n = name.trim().toLowerCase();
    if (!n) return null;
    const m = members.find((mem) => {
      const full = [mem.first_name, mem.last_name].filter(Boolean).join(" ").toLowerCase();
      const first = (mem.first_name ?? "").toLowerCase();
      const email = (mem.email ?? "").toLowerCase();
      return full === n || first === n || email === n || email.split("@")[0] === n;
    });
    return m?.id ?? null;
  };

  for (let li = 1; li < lines.length; li++) {
    const cells = splitCsvLine(lines[li]);
    const source = (cells[idxSource] ?? "").trim();
    const metric = (cells[idxMetric] ?? "").trim();
    const ownerName = (cells[idxOwner] ?? "").trim();
    const goalRaw = (cells[idxGoal] ?? "").trim();

    // Skip blank separator rows
    if (!source && !metric && !ownerName && !goalRaw) continue;
    if (!metric) {
      // treat as separator if only source/category present
      if (source && !ownerName && !goalRaw) continue;
      result.rowErrors.push({ line: li + 1, raw: lines[li], reason: "Missing Metric name" });
      continue;
    }
    const goal = parseNumberCell(goalRaw);
    if (goal === null) {
      result.rowErrors.push({ line: li + 1, raw: lines[li], reason: `Could not parse Goal "${goalRaw}"` });
      continue;
    }

    const warnings: string[] = [];
    const ownerId = findOwner(ownerName);
    if (ownerName && !ownerId) warnings.push(`Owner "${ownerName}" not found — will be created unassigned`);

    const values: { weekStart: string; value: number }[] = [];
    for (const wc of weekCols) {
      if (!wc.weekStart) continue;
      const raw = (cells[wc.col] ?? "").trim();
      if (raw === "") continue;
      const v = parseNumberCell(raw);
      if (v === null) {
        warnings.push(`Week ${wc.raw}: could not parse "${raw}"`);
        continue;
      }
      values.push({ weekStart: wc.weekStart, value: v });
    }

    result.rows.push({ source, metric, ownerName, ownerId, goal, values, warnings });
  }

  return result;
}

function ImportSection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [mode, setMode] = useState<"update" | "skip">("update");
  const [parsed, setParsed] = useState<ParseResult | null>(null);

  const { data: members = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => (await sb.rpc("get_team_members")).data as Member[],
  });
  const { data: measurables = [] } = useQuery({
    queryKey: ["all-measurables"],
    queryFn: async () => {
      const { data, error } = await sb.from("scorecard_measurables").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Measurable[];
    },
  });

  const totalValues = useMemo(() => (parsed ? parsed.rows.reduce((a, r) => a + r.values.length, 0) : 0), [parsed]);

  const handleFile = async (f: File) => {
    const t = await f.text();
    setText(t);
    setParsed(null);
  };

  const doParse = () => {
    const r = parseImportText(text, year, members);
    setParsed(r);
    if (r.rows.length === 0 && r.rowErrors.length === 0) toast.error("Nothing to import — check the header row");
  };

  const commit = useMutation({
    mutationFn: async () => {
      if (!parsed) return { created: 0, updated: 0, skipped: 0, measurablesCreated: 0 };
      let created = 0, updated = 0, skipped = 0, measurablesCreated = 0;
      const nextSort = measurables.length;
      const existing = [...measurables];

      for (const row of parsed.rows) {
        // Find existing measurable: source + label + owner + goal match (loose: source+label+owner)
        let m = existing.find((x) =>
          (x.label ?? "").trim().toLowerCase() === row.metric.toLowerCase()
          && (x.source ?? "").trim().toLowerCase() === row.source.toLowerCase()
          && (x.owner_id ?? null) === (row.ownerId ?? null),
        );
        if (!m) {
          const { data, error } = await sb
            .from("scorecard_measurables")
            .insert({
              label: row.metric,
              source: row.source || null,
              owner_id: row.ownerId,
              weekly_target: String(row.goal),
              sort_order: nextSort + measurablesCreated,
            })
            .select()
            .single();
          if (error) throw error;
          m = data as Measurable;
          existing.push(m);
          measurablesCreated++;
        } else if (Number(m.weekly_target) !== row.goal) {
          await sb.from("scorecard_measurables").update({ weekly_target: String(row.goal) }).eq("id", m.id);
        }

        for (const v of row.values) {
          // Check existing entry
          const { data: ex } = await sb
            .from("scorecard_weekly_entries")
            .select("id, actual_value")
            .eq("measurable_id", m.id)
            .eq("week_start", v.weekStart)
            .maybeSingle();
          if (ex) {
            if (mode === "skip") { skipped++; continue; }
            if (Number(ex.actual_value) === v.value) { skipped++; continue; }
            const { error } = await sb
              .from("scorecard_weekly_entries")
              .update({ actual_value: v.value, submitted_by: user?.id ?? null })
              .eq("id", ex.id);
            if (error) throw error;
            updated++;
          } else {
            const { error } = await sb
              .from("scorecard_weekly_entries")
              .insert({ measurable_id: m.id, week_start: v.weekStart, actual_value: v.value, submitted_by: user?.id ?? null });
            if (error) throw error;
            created++;
          }
        }
      }
      return { created, updated, skipped, measurablesCreated };
    },
    onSuccess: (r) => {
      toast.success(`Imported: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped · ${r.measurablesCreated} new metric(s)`);
      qc.invalidateQueries({ queryKey: ["all-measurables"] });
      qc.invalidateQueries({ queryKey: ["all-weekly-entries"] });
      qc.invalidateQueries({ queryKey: ["my-measurables"] });
      qc.invalidateQueries({ queryKey: ["my-week-entries"] });
      setParsed(null);
      setText("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Upload className="h-5 w-5 text-gold mt-0.5" />
          <div>
            <div className="font-semibold">Bulk import / backfill</div>
            <p className="text-sm text-muted-foreground mt-1">
              Paste CSV or upload a file matching your scorecard layout. Required columns: <span className="text-foreground">Source, Metric, Owner, Goal</span>, then one column per week with a header like <span className="text-foreground">6/1-6/7</span>. Re-running is safe — existing weeks update in place.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Starting year</label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} />
            <p className="text-[11px] text-muted-foreground mt-1">Year for the first week column; rolls over automatically.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">On existing values</label>
            <Select value={mode} onValueChange={(v) => setMode(v as "update" | "skip")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="update">Update to new value</SelectItem>
                <SelectItem value="skip">Skip (keep existing)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Upload CSV</label>
            <Input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Or paste data</label>
          <Textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setParsed(null); }}
            placeholder={"Source,Metric,Owner,Goal,6/1-6/7,6/8-6/14\nFUB,Leads,Sarah,50,42,55\nMailchimp,Opens,John,2000,\"2,820\",1980"}
            className="font-mono text-xs h-40"
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={doParse} disabled={!text.trim()} variant="outline">Preview</Button>
          {parsed && parsed.rows.length > 0 && (
            <Button onClick={() => commit.mutate()} disabled={commit.isPending}>
              <Check className="h-4 w-4 mr-1.5" /> Import {totalValues} value{totalValues === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </div>

      {parsed && (
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-4 text-sm">
            <div><span className="text-muted-foreground">Metrics:</span> <span className="font-semibold">{parsed.rows.length}</span></div>
            <div><span className="text-muted-foreground">Weeks:</span> <span className="font-semibold">{parsed.weekHeaders.length}</span></div>
            <div><span className="text-muted-foreground">Total values:</span> <span className="font-semibold">{totalValues}</span></div>
            {parsed.rowErrors.length > 0 && (
              <div className="text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> {parsed.rowErrors.length} row error{parsed.rowErrors.length === 1 ? "" : "s"}</div>
            )}
            {parsed.unparsedWeeks.length > 0 && (
              <div className="text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> {parsed.unparsedWeeks.length} unrecognized week header{parsed.unparsedWeeks.length === 1 ? "" : "s"}</div>
            )}
          </div>

          {parsed.unparsedWeeks.length > 0 && (
            <div className="px-5 py-3 border-b border-border bg-destructive/5 text-xs">
              <div className="font-semibold text-destructive mb-1">Unrecognized week headers (skipped):</div>
              <div className="text-muted-foreground">{parsed.unparsedWeeks.join(", ")}</div>
            </div>
          )}

          {parsed.rowErrors.length > 0 && (
            <div className="px-5 py-3 border-b border-border bg-destructive/5 text-xs space-y-1">
              <div className="font-semibold text-destructive">Row errors (skipped):</div>
              {parsed.rowErrors.map((e, i) => (
                <div key={i} className="text-muted-foreground"><span className="text-foreground">Line {e.line}:</span> {e.reason}</div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="text-xs min-w-full">
              <thead className="bg-muted/30">
                <tr className="text-left text-muted-foreground">
                  <th className="p-2 pl-5">Source</th>
                  <th className="p-2">Metric</th>
                  <th className="p-2">Owner</th>
                  <th className="p-2 text-right">Goal</th>
                  <th className="p-2 text-right">Values</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((r, i) => {
                  const existing = measurables.find((x) =>
                    (x.label ?? "").trim().toLowerCase() === r.metric.toLowerCase()
                    && (x.source ?? "").trim().toLowerCase() === r.source.toLowerCase()
                    && (x.owner_id ?? null) === (r.ownerId ?? null),
                  );
                  return (
                    <tr key={i} className="border-t border-border/60">
                      <td className="p-2 pl-5 text-gold">{r.source || "—"}</td>
                      <td className="p-2 font-medium">{r.metric}</td>
                      <td className="p-2 text-muted-foreground">{r.ownerName || "—"}{r.ownerName && !r.ownerId && <span className="text-destructive"> (unmatched)</span>}</td>
                      <td className="p-2 text-right">{r.goal}</td>
                      <td className="p-2 text-right">{r.values.length}</td>
                      <td className="p-2">
                        <span className={cn("px-2 py-0.5 rounded-full border text-[11px]", existing ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-gold/10 text-gold border-gold/30")}>
                          {existing ? "Existing metric" : "New metric"}
                        </span>
                        {r.warnings.length > 0 && (
                          <div className="text-[11px] text-destructive mt-1">{r.warnings.join("; ")}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
