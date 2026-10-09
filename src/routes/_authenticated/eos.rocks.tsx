import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ROCK_STATUS_CLASS,
  ROCK_STATUS_LABEL,
  currentQuarter,
  displayName,
  type Member,
  type Rock,
  type RockStatus,
} from "@/lib/eos";
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  User,
} from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/eos/rocks")({
  component: RocksPage,
  head: () => ({ meta: [{ title: "Rocks — EOS — MSREG Hub" }] }),
});

const sb = supabase as any;

type Milestone = {
  id: string;
  rock_id: string;
  note: string;
  created_by: string;
  created_at: string;
};

function RocksPage() {
  const { user, isAdmin, roles } = useAuth();
  const isOperations =
    isAdmin || roles.includes("marketing_coordinator") || roles.includes("client_care");
  const qc = useQueryClient();
  const [view, setView] = useState<"mine" | "team">(isOperations ? "team" : "mine");
  const [quarter, setQuarter] = useState(currentQuarter());
  const [editing, setEditing] = useState<Rock | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Rock | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: rocks = [] } = useQuery({
    queryKey: ["rocks", quarter],
    queryFn: async () => {
      const { data, error } = await sb
        .from("rocks")
        .select("*")
        .eq("quarter", quarter)
        .order("owner");
      if (error) throw error;
      return (data ?? []) as Rock[];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_team_members");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const nameOf = (id: string) => {
    const m = members.find((m) => m.id === id);
    return m ? displayName(m) : "—";
  };

  const visible = useMemo(
    () => (view === "mine" ? rocks.filter((r) => r.owner === user?.id) : rocks),
    [rocks, view, user],
  );

  const grouped = useMemo(() => {
    const g: Record<string, Rock[]> = {};
    for (const r of visible) (g[r.owner] ??= []).push(r);
    return g;
  }, [visible]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RockStatus }) => {
      const { error } = await sb.from("rocks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rocks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("rocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rock deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["rocks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // KPI Metrics
  const onTrackCount = visible.filter((r) => r.status === "on_track").length;
  const offTrackCount = visible.filter((r) => r.status === "off_track").length;
  const completeCount = visible.filter((r) => r.status === "complete").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="EOS Quarterly Rocks"
        description="90-day SMART company and individual priorities. Track accountability, milestone check-ins, and on-track status."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-surface-2 border border-border/80 rounded-lg px-2.5 py-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase font-bold">
                Qtr:
              </span>
              <Input
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                className="w-24 h-7 text-xs font-mono bg-transparent border-0 p-0 focus-visible:ring-0 text-foreground font-semibold"
              />
            </div>

            <div className="flex rounded-lg border border-border/80 p-0.5 bg-surface-2">
              <button
                onClick={() => setView("team")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  view === "team"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Team ({rocks.length})
              </button>
              <button
                onClick={() => setView("mine")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  view === "mine"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                My Rocks ({rocks.filter((r) => r.owner === user?.id).length})
              </button>
            </div>

            <Button
              size="sm"
              onClick={() => setCreating(true)}
              className="h-9 bg-gold text-navy font-semibold hover:bg-gold/90 shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" /> New Rock
            </Button>
          </div>
        }
      />

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Total Priorities
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-foreground">
              {visible.length}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-2 text-gold border border-border/60">
            <Target className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              On Track
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-emerald-400">
              {onTrackCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Off Track / At Risk
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-amber-400">
              {offTrackCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Completed
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-sky-400">
              {completeCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="p-12 text-center text-muted-foreground bg-card border border-border/80 rounded-xl space-y-3 shadow-2xs">
          <Target className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
          <div className="font-semibold text-foreground">No rocks recorded for {quarter}</div>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Click "New Rock" to define a 90-day priority and assign an owner for this quarter.
          </p>
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="bg-gold text-navy font-semibold hover:bg-gold/90 text-xs h-8"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Create First Rock
          </Button>
        </div>
      )}

      <div className="space-y-5">
        {Object.entries(grouped).map(([ownerId, list]) => (
          <section
            key={ownerId}
            className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-2xs"
          >
            <div className="px-5 py-3 border-b border-border/80 bg-surface-2/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-gold/15 text-gold font-bold flex items-center justify-center text-[10px] border border-gold/30">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="font-bold text-sm text-foreground">{nameOf(ownerId)}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  · {list.length} rock{list.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="divide-y divide-border/60">
              {list.map((r) => {
                const canEdit = isOperations || r.owner === user?.id;
                const canStatus = isOperations || r.owner === user?.id;
                const isExpanded = expanded === r.id;

                return (
                  <div key={r.id} className="p-4 hover:bg-accent/30 transition-colors">
                    <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => setExpanded(isExpanded ? null : r.id)}
                          className="text-left w-full group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground group-hover:text-gold transition-colors">
                              {r.title}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          {r.due_date && (
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-mono">
                              <Clock className="h-3 w-3" /> Due {r.due_date}
                            </div>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Select
                          value={r.status}
                          disabled={!canStatus}
                          onValueChange={(v) =>
                            updateStatus.mutate({ id: r.id, status: v as RockStatus })
                          }
                        >
                          <SelectTrigger className={cn("w-36 text-xs h-8", ROCK_STATUS_CLASS[r.status])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(["on_track", "off_track", "complete"] as RockStatus[]).map((s) => (
                              <SelectItem key={s} value={s}>
                                {ROCK_STATUS_LABEL[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(r)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="Edit Rock"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleting(r)}
                            className="h-8 w-8 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            title="Delete Rock"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {isExpanded && <RockDetail rock={r} />}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {(creating || editing) && (
        <RockFormDialog
          rock={editing}
          members={members}
          defaultQuarter={quarter}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["rocks"] })}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rock?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `"${deleting.title}" will be permanently removed along with its milestones and check-ins.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteRock.mutate(deleting.id);
              }}
              disabled={deleteRock.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRock.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RockDetail({ rock }: { rock: Rock }) {
  const { user, isAdmin, roles } = useAuth();
  const isOperations =
    isAdmin || roles.includes("marketing_coordinator") || roles.includes("client_care");
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones", rock.id],
    queryFn: async () => {
      const { data, error } = await sb
        .from("rock_milestones")
        .select("*")
        .eq("rock_id", rock.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!note.trim()) throw new Error("Note required");
      const { error } = await sb.from("rock_milestones").insert({
        rock_id: rock.id,
        note: note.trim(),
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["milestones", rock.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canAdd = isOperations || rock.owner === user?.id;

  return (
    <div className="mt-3.5 pt-3.5 border-t border-border/60 space-y-3">
      {rock.description && (
        <div className="p-3 bg-surface-2/60 rounded-lg border border-border/60 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
          {rock.description}
        </div>
      )}
      <div>
        <div className="text-[10px] font-bold mb-2 uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3 text-gold" />
          Milestones &amp; Check-ins ({milestones.length})
        </div>
        <div className="space-y-2">
          {milestones.length === 0 && (
            <div className="text-xs text-muted-foreground/70 py-2">
              No milestone updates posted yet.
            </div>
          )}
          {milestones.map((m) => (
            <div key={m.id} className="bg-surface-2 rounded-lg p-2.5 text-xs border border-border/50">
              <div className="whitespace-pre-wrap text-foreground">{m.note}</div>
              <div className="text-[10px] text-muted-foreground font-mono mt-1">
                {format(new Date(m.created_at), "MMM d, yyyy · h:mm a")}
              </div>
            </div>
          ))}
        </div>
        {canAdd && (
          <div className="mt-3 flex gap-2">
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Post milestone or weekly check-in note…"
              className="text-xs bg-surface-2 border-border/80"
            />
            <Button
              size="sm"
              onClick={() => add.mutate()}
              disabled={add.isPending || !note.trim()}
              className="bg-gold text-navy font-semibold hover:bg-gold/90 text-xs shrink-0 self-end"
            >
              Post Note
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RockFormDialog({
  rock,
  members,
  defaultQuarter,
  onClose,
  onSaved,
}: {
  rock: Rock | null;
  members: Member[];
  defaultQuarter: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(rock?.title ?? "");
  const [owner, setOwner] = useState(rock?.owner ?? user?.id ?? "");
  const [quarter, setQuarter] = useState(rock?.quarter ?? defaultQuarter);
  const [dueDate, setDueDate] = useState(rock?.due_date ?? "");
  const [status, setStatus] = useState<RockStatus>(rock?.status ?? "on_track");
  const [description, setDescription] = useState(rock?.description ?? "");

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !owner || !quarter) throw new Error("Title, owner, quarter required");
      const payload: any = {
        title: title.trim(),
        owner,
        quarter,
        due_date: dueDate || null,
        status,
        description: description.trim() || null,
      };
      if (rock) {
        const { error } = await sb.from("rocks").update(payload).eq("id", rock.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await sb.from("rocks").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(rock ? "Rock updated" : "Rock created");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-gold" />
            {rock ? "Edit Rock" : "New Quarterly Rock"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 pt-1">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Standardize video editing workflow across channels"
              className="mt-1 bg-surface-2 border-border/80"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Owner *</label>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger className="mt-1 bg-surface-2 border-border/80">
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {displayName(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Quarter *</label>
              <Input
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                placeholder="Q4 2026"
                className="mt-1 bg-surface-2 border-border/80 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Target Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 bg-surface-2 border-border/80"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Initial Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as RockStatus)}>
                <SelectTrigger className="mt-1 bg-surface-2 border-border/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["on_track", "off_track", "complete"] as RockStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {ROCK_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              SMART Criteria &amp; Description
            </label>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specific, measurable details and definition of done..."
              className="mt-1 bg-surface-2 border-border/80 text-xs"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !title.trim()}
            className="bg-gold text-navy font-semibold hover:bg-gold/90"
          >
            {save.isPending ? "Saving..." : "Save Rock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
