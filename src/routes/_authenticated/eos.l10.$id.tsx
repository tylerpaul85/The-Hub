import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ChevronLeft, ArrowUp, ArrowDown, Star, Plus, X, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ROCK_STATUS_CLASS,
  ROCK_STATUS_LABEL,
  currentQuarter,
  displayName,
  type Issue,
  type IssueNote,
  type IssuePriority,
  type Meeting,
  type MeetingRating,
  type Measurable,
  isGoalHit,
  type Member,
  type Rock,
  type RockStatus,
  type Todo,
} from "@/lib/eos";
import { HeadlinesSection } from "@/components/headlines-section";
import { ReclassifyIssueMenu } from "@/components/reclassify-issue-menu";

export const Route = createFileRoute("/_authenticated/eos/l10/$id")({
  component: L10DetailPage,
  head: () => ({ meta: [{ title: "L10 Meeting — MSREG" }] }),
});

const sb = supabase as any;

function L10DetailPage() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: meeting } = useQuery({
    queryKey: ["meeting", id],
    queryFn: async () => {
      const { data, error } = await sb.from("l10_meetings").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Meeting;
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

  const updateMeeting = useMutation({
    mutationFn: async (patch: Partial<Meeting>) => {
      const { error } = await sb.from("l10_meetings").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMeeting = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("l10_meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meeting deleted");
      qc.invalidateQueries({ queryKey: ["meetings"] });
      navigate({ to: "/eos/l10" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!meeting) return <div className="p-8 text-muted-foreground">Loading...</div>;

  const isCompleted = meeting.status === "completed";
  const canEdit = isAdmin || !isCompleted;

  const completeMeeting = () => {
    if (!user) return;
    updateMeeting.mutate(
      {
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: user.id,
      } as Partial<Meeting>,
      {
        onSuccess: () => {
          setConfirmComplete(false);
          toast.success("Meeting completed");
        },
      },
    );
  };
  const reopenMeeting = () => {
    updateMeeting.mutate({ status: "in_progress", completed_at: null, completed_by: null } as Partial<Meeting>);
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <Link to="/eos/l10" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to meetings
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3 justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            L10 · {format(new Date(meeting.meeting_date + "T00:00:00"), "EEEE, MMMM d, yyyy")}
          </h1>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs px-2 py-1 rounded border",
              isCompleted
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-blue-500/15 text-blue-400 border-blue-500/30",
            )}>
              {isCompleted ? "Completed · Locked" : "In progress"}
            </span>
            {!isCompleted && (
              <Button size="sm" onClick={() => setConfirmComplete(true)}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Complete Meeting
              </Button>
            )}
            {isCompleted && isAdmin && (
              <Button size="sm" variant="outline" onClick={reopenMeeting}>Reopen (admin)</Button>
            )}
            {isAdmin && (
              <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            )}
          </div>
        </div>
        {isCompleted && !isAdmin && (
          <div className="mt-3 text-xs text-muted-foreground border border-border rounded p-3 bg-muted/30">
            This meeting has been submitted and is locked. Only admins can make changes. You can still mark your to-dos complete.
          </div>
        )}
      </div>

      <Dialog open={confirmComplete} onOpenChange={setConfirmComplete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete this meeting?</DialogTitle>
            <DialogDescription>
              This finalizes the meeting and locks it from further edits by non-admins. To-dos can still be marked complete afterward. Admins can reopen it later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmComplete(false)}>Cancel</Button>
            <Button onClick={completeMeeting} disabled={updateMeeting.isPending}>Yes, complete meeting</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this meeting?</DialogTitle>
            <DialogDescription>
              This permanently removes the meeting record, its scorecard entries, rock reviews, ratings, and issue priorities. Any to-dos and issues created during this meeting are preserved but detached from it. This action is logged in the audit log and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMeeting.mutate()} disabled={deleteMeeting.isPending}>
              Yes, delete meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Section title="Attendees">
        <AttendeesEditor meeting={meeting} members={members} canEdit={canEdit}
          onSave={(attendees) => updateMeeting.mutate({ attendees })} />
      </Section>

      <Section title="Segue">
        <TextBlock value={meeting.segue ?? ""} canEdit={canEdit} placeholder="Opening notes, personal & business bests..."
          onSave={(v) => updateMeeting.mutate({ segue: v })} />
      </Section>

      <Section title="Scorecard Review">
        <ScorecardSection meetingDate={meeting.meeting_date} members={members} />
      </Section>

      <Section title="Rock Review">
        <RockReviewSection meetingId={id} canEdit={canEdit} members={members} />
      </Section>

      <Section title="Headlines">
        <HeadlinesSection meetingId={id} canEdit={canEdit} isAdmin={isAdmin} members={members} userId={user?.id ?? null} />
      </Section>

      <Section title="To-Do Review">
        <TodosSection meetingId={id} canEdit={canEdit} members={members} />
      </Section>


      <Section title="IDS — Issues">
        <IdsSection meetingId={id} canEdit={canEdit} isAdmin={isAdmin} members={members} userId={user?.id ?? null} />
      </Section>

      <Section title="Conclude">
        <ConcludeSection meeting={meeting} canEdit={canEdit} members={members} userId={user?.id ?? null}
          onSave={(patch) => updateMeeting.mutate(patch)} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-xl">
      <div className="px-5 py-3 border-b border-border font-semibold">{title}</div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function TextBlock({ value, canEdit, placeholder, onSave }: { value: string; canEdit: boolean; placeholder?: string; onSave: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div className="space-y-2">
      <Textarea rows={4} value={local} disabled={!canEdit} onChange={(e) => setLocal(e.target.value)} placeholder={placeholder} />
      {canEdit && local !== value && (
        <Button size="sm" onClick={() => onSave(local)}>Save</Button>
      )}
    </div>
  );
}

// Emails excluded from the L10 attendee picker (kept in profiles for history/mentions).
const L10_ATTENDEE_EXCLUDE_EMAILS = new Set(["nancy@mattsmithrealestategroup.com"]);

function AttendeesEditor({ meeting, members, canEdit, onSave }: { meeting: Meeting; members: Member[]; canEdit: boolean; onSave: (ids: string[]) => void }) {
  const selected = new Set(meeting.attendees ?? []);
  const visible = members.filter((m) => !L10_ATTENDEE_EXCLUDE_EMAILS.has(m.email.toLowerCase()));
  const toggle = (id: string) => {
    if (!canEdit) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSave(Array.from(next));
  };
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {visible.map((m) => (
        <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={selected.has(m.id)} disabled={!canEdit} onCheckedChange={() => toggle(m.id)} />
          <span>{displayName(m)}</span>
        </label>
      ))}
    </div>
  );
}

function ScorecardSection({ meetingDate, members }: { meetingDate: string; members: Member[] }) {
  // Compute the most recently completed Mon–Sun week relative to the meeting date.
  const { wk, rangeLabel } = (() => {
    const d = new Date(meetingDate + "T00:00:00");
    d.setHours(0, 0, 0, 0);
    const day = (d.getDay() + 6) % 7; // Mon=0
    const thisMon = new Date(d);
    thisMon.setDate(d.getDate() - day);
    const prevMon = new Date(thisMon);
    prevMon.setDate(thisMon.getDate() - 7);
    const sun = new Date(prevMon);
    sun.setDate(prevMon.getDate() + 6);
    const y = prevMon.getFullYear();
    const m = String(prevMon.getMonth() + 1).padStart(2, "0");
    const dd = String(prevMon.getDate()).padStart(2, "0");
    return {
      wk: `${y}-${m}-${dd}`,
      rangeLabel: `${prevMon.getMonth() + 1}/${prevMon.getDate()}–${sun.getMonth() + 1}/${sun.getDate()}/${sun.getFullYear()}`,
    };
  })();

  type FullMeasurable = Measurable & { source: string | null; owner_id: string | null };

  const { data: measurables = [] } = useQuery({
    queryKey: ["l10-scorecard-measurables"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("scorecard_measurables")
        .select("*")
        .order("source")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as FullMeasurable[];
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["l10-scorecard-week", wk],
    queryFn: async () => {
      const { data, error } = await sb
        .from("scorecard_weekly_entries")
        .select("measurable_id, week_start, actual_value")
        .eq("week_start", wk);
      if (error) throw error;
      return (data ?? []) as { measurable_id: string; week_start: string; actual_value: number }[];
    },
  });

  const nameOf = (id: string | null) => {
    if (!id) return "—";
    const m = members.find((x) => x.id === id);
    return m ? displayName(m) : "—";
  };

  if (measurables.length === 0) {
    return <div className="text-sm text-muted-foreground">No measurables defined. <Link to="/eos/scorecard" className="text-gold underline">Set them up</Link>.</div>;
  }

  // Group by source
  const groups: Record<string, FullMeasurable[]> = {};
  for (const m of measurables) (groups[m.source || "Uncategorized"] ??= []).push(m);
  const groupNames = Object.keys(groups).sort();

  const entryMap = new Map<string, number>();
  for (const e of entries) entryMap.set(e.measurable_id, Number(e.actual_value));

  const submitted = entries.length;
  const total = measurables.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Reviewing week of </span>
          <span className="font-semibold">{rangeLabel}</span>
        </div>
        <div className="text-xs text-muted-foreground">{submitted}/{total} numbers submitted · pulled from Scorecard</div>
      </div>

      <div className="space-y-5">
        {groupNames.map((g) => (
          <div key={g}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{g}</div>
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[44%]" />
                <col className="w-[26%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left pb-2 pr-2 font-normal">Measurable</th>
                  <th className="text-left pb-2 pr-2 font-normal">Owner</th>
                  <th className="text-right pb-2 pr-2 font-normal">Goal</th>
                  <th className="text-right pb-2 font-normal">Actual</th>
                </tr>
              </thead>
              <tbody>
                {groups[g].map((m) => {
                  const has = entryMap.has(m.id);
                  const actual = entryMap.get(m.id);
                  const hitResult = has ? isGoalHit(actual as number, m.weekly_target, m.goal_direction) : null;
                  const comparable = hitResult !== null;
                  const hit = hitResult === true;
                  return (
                    <tr key={m.id} className="border-t border-border">
                      <td className="py-2 pr-2 truncate">{m.label}</td>
                      <td className="py-2 pr-2 text-muted-foreground truncate">{nameOf(m.owner_id)}</td>
                      <td className="py-2 pr-2 text-right text-muted-foreground tabular-nums">{m.weekly_target}</td>
                      <td className={cn(
                        "py-2 text-right font-medium tabular-nums",
                        !has && "text-muted-foreground italic font-normal",
                        has && comparable && hit && "text-emerald-400",
                        has && comparable && !hit && "text-destructive",
                      )}>
                        {has ? actual : "not entered"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function RockReviewSection({ meetingId, canEdit, members }: { meetingId: string; canEdit: boolean; members: Member[] }) {
  const qc = useQueryClient();
  const quarter = currentQuarter();

  const { data: rocks = [] } = useQuery({
    queryKey: ["rocks", quarter],
    queryFn: async () => {
      const { data, error } = await sb.from("rocks").select("*").eq("quarter", quarter);
      if (error) throw error;
      return (data ?? []) as Rock[];
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["rock-reviews", meetingId],
    queryFn: async () => {
      const { data, error } = await sb.from("l10_rock_reviews").select("*").eq("meeting_id", meetingId);
      if (error) throw error;
      return (data ?? []) as { id: string; meeting_id: string; rock_id: string; status: RockStatus }[];
    },
  });

  const upsert = useMutation({
    mutationFn: async ({ rock_id, status }: { rock_id: string; status: RockStatus }) => {
      const { error } = await sb.from("l10_rock_reviews").upsert(
        { meeting_id: meetingId, rock_id, status },
        { onConflict: "meeting_id,rock_id" },
      );
      if (error) throw error;
      const { error: e2 } = await sb.from("rocks").update({ status }).eq("id", rock_id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rock-reviews", meetingId] });
      qc.invalidateQueries({ queryKey: ["rocks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (rocks.length === 0) return <div className="text-sm text-muted-foreground">No rocks for {quarter}.</div>;

  return (
    <div className="space-y-2">
      {rocks.map((r) => {
        const review = reviews.find((rv) => rv.rock_id === r.id);
        const status = review?.status ?? r.status;
        return (
          <div key={r.id} className="flex items-center gap-3 p-2 border border-border rounded">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{r.title}</div>
              <div className="text-xs text-muted-foreground">{displayName(members.find((m) => m.id === r.owner))}</div>
            </div>
            <Select value={status} disabled={!canEdit} onValueChange={(v) => upsert.mutate({ rock_id: r.id, status: v as RockStatus })}>
              <SelectTrigger className={cn("w-36 text-xs", ROCK_STATUS_CLASS[status])}><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["on_track", "off_track", "complete"] as RockStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{ROCK_STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}

function TodosSection({ meetingId, canEdit, members }: { meetingId: string; canEdit: boolean; members: Member[] }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));

  const { data: todos = [] } = useQuery({
    queryKey: ["todos", meetingId],
    queryFn: async () => {
      const { data, error } = await sb.from("todos").select("*").or(`completed.eq.false,meeting_id.eq.${meetingId}`).order("due_date");
      if (error) throw error;
      return (data ?? []) as Todo[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await sb.from("todos").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !owner) throw new Error("Title & owner required");
      const { error } = await sb.from("todos").insert({
        title: title.trim(), owner, due_date: due, meeting_id: meetingId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todos"] });
      setTitle(""); setOwner(""); setShowAdd(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date().toISOString().slice(0, 10);

  const carryover = todos.filter((t) => t.meeting_id !== meetingId);
  const thisMeeting = todos.filter((t) => t.meeting_id === meetingId);

  const renderTodo = (t: Todo) => {
    const overdue = !t.completed && t.due_date < today;
    return (
      <div key={t.id} className="flex items-center gap-3 p-2 border border-border rounded">
        <Checkbox checked={t.completed} onCheckedChange={(v) => toggle.mutate({ id: t.id, completed: !!v })} />
        <div className="flex-1 min-w-0">
          <div className={cn("text-sm", t.completed && "line-through text-muted-foreground")}>{t.title}</div>
          <div className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
            {displayName(members.find((m) => m.id === t.owner))} · Due {t.due_date}{overdue ? " · overdue" : ""}{t.completed ? " · done" : ""}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Carried over from previous meetings {carryover.length > 0 && `(${carryover.length})`}
        </div>
        <div className="space-y-2">
          {carryover.length === 0 && <div className="text-sm text-muted-foreground italic">Nothing to carry over.</div>}
          {carryover.map(renderTodo)}
        </div>
        {carryover.length > 0 && (
          <div className="text-[11px] text-muted-foreground mt-2">Tip: check off completed to-dos to clear them from next week's review.</div>
        )}
      </div>

      {thisMeeting.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">New this meeting</div>
          <div className="space-y-2">{thisMeeting.map(renderTodo)}</div>
        </div>
      )}

      {canEdit && !showAdd && (
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>+ Add To-Do</Button>
      )}
      {canEdit && showAdd && (
        <div className="border border-border rounded p-3 space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="To-do title" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger><SelectValue placeholder="Owner" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{displayName(m)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => add.mutate()}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function IdsSection({ meetingId, canEdit, isAdmin, members, userId }: { meetingId: string; canEdit: boolean; isAdmin: boolean; members: Member[]; userId: string | null }) {
  const qc = useQueryClient();
  const [openIssue, setOpenIssue] = useState<Issue | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Issue | null>(null);

  const { data: issues = [] } = useQuery({
    queryKey: ["issues", meetingId],
    queryFn: async () => {
      const { data, error } = await sb.from("issues").select("*").neq("status", "pending").or(`status.eq.open,meeting_id.eq.${meetingId}`).order("created_at");
      if (error) throw error;
      return (data ?? []) as Issue[];
    },
  });

  const quickResolve = useMutation({
    mutationFn: async (issue_id: string) => {
      const { error } = await sb.from("issues").update({ status: "solved", meeting_id: meetingId }).eq("id", issue_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.invalidateQueries({ queryKey: ["issue-priorities", meetingId] });
      toast.success("Issue resolved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteIssue = useMutation({
    mutationFn: async (issue_id: string) => {
      const { error } = await sb.from("issues").delete().eq("id", issue_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.invalidateQueries({ queryKey: ["issue-priorities", meetingId] });
      setConfirmDel(null);
      toast.success("Issue deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const { data: priorities = [] } = useQuery({
    queryKey: ["issue-priorities", meetingId],
    queryFn: async () => {
      const { data, error } = await sb.from("l10_meeting_issue_priorities").select("*").eq("meeting_id", meetingId).order("rank");
      if (error) throw error;
      return (data ?? []) as IssuePriority[];
    },
  });

  const addIssue = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim() || !userId) throw new Error("Title required");
      const { error } = await sb.from("issues").insert({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        submitted_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      setNewTitle(""); setNewDesc(""); setShowAdd(false);
      toast.success("Issue added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const prioritize = useMutation({
    mutationFn: async (issue_id: string) => {
      if (priorities.find((p) => p.issue_id === issue_id)) {
        const { error } = await sb.from("l10_meeting_issue_priorities").delete()
          .eq("meeting_id", meetingId).eq("issue_id", issue_id);
        if (error) throw error;
      } else {
        const nextRank = (priorities[priorities.length - 1]?.rank ?? 0) + 1;
        const { error } = await sb.from("l10_meeting_issue_priorities").insert({
          meeting_id: meetingId, issue_id, rank: nextRank,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["issue-priorities", meetingId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: async ({ issue_id, dir }: { issue_id: string; dir: -1 | 1 }) => {
      const idx = priorities.findIndex((p) => p.issue_id === issue_id);
      const swapIdx = idx + dir;
      if (idx < 0 || swapIdx < 0 || swapIdx >= priorities.length) return;
      const a = priorities[idx], b = priorities[swapIdx];
      // swap ranks via two updates; use large temp to avoid PK collision
      await sb.from("l10_meeting_issue_priorities").update({ rank: -999 }).eq("meeting_id", meetingId).eq("issue_id", a.issue_id);
      await sb.from("l10_meeting_issue_priorities").update({ rank: a.rank }).eq("meeting_id", meetingId).eq("issue_id", b.issue_id);
      await sb.from("l10_meeting_issue_priorities").update({ rank: b.rank }).eq("meeting_id", meetingId).eq("issue_id", a.issue_id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["issue-priorities", meetingId] }),
  });

  const prioritized = priorities
    .map((p) => issues.find((i) => i.id === p.issue_id))
    .filter((x): x is Issue => !!x);
  const prioritizedIds = new Set(prioritized.map((i) => i.id));
  const unprioritized = issues.filter((i) => !prioritizedIds.has(i.id));

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Top Issues to Discuss {prioritized.length > 0 && `(${prioritized.length})`}
        </div>
        {prioritized.length === 0 && (
          <div className="text-sm text-muted-foreground italic">Star issues below to bring them up to the top.</div>
        )}
        <div className="space-y-2">
          {prioritized.map((i, idx) => (
            <IssueRow
              key={i.id}
              issue={i}
              members={members}
              rank={idx + 1}
              canEdit={canEdit}
              isAdmin={isAdmin}
              isPrioritized
              canMoveUp={idx > 0}
              canMoveDown={idx < prioritized.length - 1}
              meetingId={meetingId}
              onOpen={() => setOpenIssue(i)}
              onStar={() => prioritize.mutate(i.id)}
              onMove={(dir) => reorder.mutate({ issue_id: i.id, dir })}
              onResolve={() => quickResolve.mutate(i.id)}
              onDelete={() => setConfirmDel(i)}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">All Open Issues</div>
        <div className="space-y-2">
          {unprioritized.length === 0 && <div className="text-sm text-muted-foreground italic">No other open issues.</div>}
          {unprioritized.map((i) => (
            <IssueRow
              key={i.id}
              issue={i}
              members={members}
              canEdit={canEdit}
              isAdmin={isAdmin}
              isPrioritized={false}
              meetingId={meetingId}
              onOpen={() => setOpenIssue(i)}
              onStar={() => prioritize.mutate(i.id)}
              onResolve={() => quickResolve.mutate(i.id)}
              onDelete={() => setConfirmDel(i)}
            />
          ))}
        </div>
      </div>

      {!showAdd && (
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Issue
        </Button>
      )}
      {showAdd && (
        <div className="border border-border rounded p-3 space-y-2">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Issue title" />
          <Textarea rows={3} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addIssue.mutate()} disabled={addIssue.isPending}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setNewTitle(""); setNewDesc(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      <IssueDetailDialog
        issue={openIssue}
        meetingId={meetingId}
        members={members}
        userId={userId}
        canEdit={canEdit}
        isAdmin={isAdmin}
        onClose={() => setOpenIssue(null)}
        onDeleted={() => { setOpenIssue(null); qc.invalidateQueries({ queryKey: ["issues"] }); qc.invalidateQueries({ queryKey: ["issue-priorities", meetingId] }); }}
      />

      <Dialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this issue?</DialogTitle>
            <DialogDescription>
              "{confirmDel?.title}" will be permanently removed. Use this for duplicates or mistakes. To keep a record, mark it Resolved instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDel && deleteIssue.mutate(confirmDel.id)} disabled={deleteIssue.isPending}>
              Yes, delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IssueRow({
  issue, members, rank, canEdit, isAdmin, isPrioritized, canMoveUp, canMoveDown, meetingId, onOpen, onStar, onMove, onResolve, onDelete,
}: {
  issue: Issue;
  members: Member[];
  rank?: number;
  canEdit: boolean;
  isAdmin: boolean;
  isPrioritized: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  meetingId?: string | null;
  onOpen: () => void;
  onStar: () => void;
  onMove?: (dir: -1 | 1) => void;
  onResolve?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="border border-border rounded p-3 flex items-start gap-3">
      {rank && (
        <div className="h-6 w-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
          {rank}
        </div>
      )}
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">

        <div className="text-sm font-medium">{issue.title}</div>
        {issue.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{issue.description}</div>}
        <div className="text-[10px] text-muted-foreground mt-1">
          from {displayName(members.find((m) => m.id === issue.submitted_by)) ?? "—"} · {format(new Date(issue.created_at), "MMM d")}
          {issue.status !== "open" && <span className="ml-2 px-1.5 py-0.5 bg-muted rounded uppercase">{issue.status}</span>}
        </div>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        {isPrioritized && onMove && (
          <>
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!canEdit || !canMoveUp} onClick={() => onMove(-1)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!canEdit || !canMoveDown} onClick={() => onMove(1)}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {canEdit && issue.status === "open" && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onStar} title={isPrioritized ? "Remove from top" : "Move to top"}>
            {isPrioritized ? <X className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
          </Button>
        )}
        {canEdit && issue.status === "open" && (
          <ReclassifyIssueMenu issue={issue} meetingId={meetingId} iconOnly />
        )}
        {canEdit && issue.status === "open" && onResolve && (
          <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-400 hover:text-emerald-300" onClick={onResolve} title="Mark resolved">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {isAdmin && onDelete && (
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Delete issue">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function IssueDetailDialog({
  issue, meetingId, members, userId, canEdit, isAdmin, onClose, onDeleted,
}: {
  issue: Issue | null;
  meetingId: string;
  members: Member[];
  userId: string | null;
  canEdit: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const [noteBody, setNoteBody] = useState("");
  const [action, setAction] = useState<"solved" | "tabled" | "converted">("solved");
  const [outcome, setOutcome] = useState("");
  const [convertOwner, setConvertOwner] = useState("");
  const [convertQuarter, setConvertQuarter] = useState(currentQuarter());
  const [showActionForm, setShowActionForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskOwner, setTaskOwner] = useState("");
  const [taskDue, setTaskDue] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [showTaskForm, setShowTaskForm] = useState(false);

  useEffect(() => {
    if (issue) {
      setNoteBody(""); setOutcome(""); setAction("solved");
      setShowActionForm(false); setShowTaskForm(false);
      setTaskTitle("");
    }
  }, [issue?.id]);

  const { data: notes = [] } = useQuery({
    queryKey: ["issue-notes", issue?.id],
    enabled: !!issue,
    queryFn: async () => {
      const { data, error } = await sb.from("issue_notes").select("*").eq("issue_id", issue!.id).order("created_at");
      if (error) throw error;
      return (data ?? []) as IssueNote[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["issue-tasks", issue?.id],
    enabled: !!issue,
    queryFn: async () => {
      const { data, error } = await sb.from("todos").select("*").eq("issue_id", issue!.id).order("created_at");
      if (error) throw error;
      return (data ?? []) as Todo[];
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!noteBody.trim() || !issue || !userId) return;
      const { error } = await sb.from("issue_notes").insert({
        issue_id: issue.id, author_id: userId, body: noteBody.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteBody("");
      qc.invalidateQueries({ queryKey: ["issue-notes", issue?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTask = useMutation({
    mutationFn: async () => {
      if (!taskTitle.trim() || !taskOwner || !issue) throw new Error("Title & owner required");
      const { error } = await sb.from("todos").insert({
        title: taskTitle.trim(),
        owner: taskOwner,
        due_date: taskDue,
        meeting_id: meetingId,
        issue_id: issue.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTaskTitle(""); setTaskOwner(""); setShowTaskForm(false);
      qc.invalidateQueries({ queryKey: ["issue-tasks", issue?.id] });
      qc.invalidateQueries({ queryKey: ["todos"] });
      toast.success("Task created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!issue) return;
      if (action === "converted") {
        if (!convertOwner) throw new Error("Pick an owner for the new rock");
        const { data: rock, error: rerr } = await sb.from("rocks").insert({
          title: issue.title, description: issue.description,
          owner: convertOwner, quarter: convertQuarter, status: "on_track",
        }).select().single();
        if (rerr) throw rerr;
        const { error } = await sb.from("issues").update({
          status: "converted", meeting_id: meetingId, converted_rock_id: rock.id, outcome_note: outcome || null,
        }).eq("id", issue.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("issues").update({
          status: action,
          meeting_id: action === "solved" ? meetingId : null,
          outcome_note: outcome || null,
        }).eq("id", issue.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.invalidateQueries({ queryKey: ["rocks"] });
      qc.invalidateQueries({ queryKey: ["issue-priorities", meetingId] });
      toast.success("Issue updated");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!issue} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {issue && (
          <>
            <DialogHeader>
              <DialogTitle>{issue.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              {issue.description && (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap border border-border rounded p-3">
                  {issue.description}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Submitted by {displayName(members.find((m) => m.id === issue.submitted_by)) ?? "—"} on {format(new Date(issue.created_at), "MMM d, yyyy")}
                {issue.status !== "open" && <> · <span className="uppercase font-semibold">{issue.status}</span></>}
              </div>
              {issue.outcome_note && (
                <div className="text-sm bg-muted/40 p-3 rounded">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Outcome</div>
                  {issue.outcome_note}
                </div>
              )}

              {/* Notes */}
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Notes</div>
                <div className="space-y-2">
                  {notes.length === 0 && <div className="text-xs text-muted-foreground italic">No notes yet.</div>}
                  {notes.map((n) => (
                    <div key={n.id} className="border border-border rounded p-2">
                      <div className="text-xs text-muted-foreground mb-1">
                        {displayName(members.find((m) => m.id === n.author_id)) ?? "—"} · {format(new Date(n.created_at), "MMM d, h:mm a")}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{n.body}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Textarea rows={2} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Add a note..." />
                  <Button size="sm" onClick={() => addNote.mutate()} disabled={!noteBody.trim() || addNote.isPending}>Post</Button>
                </div>
              </div>

              {/* Tasks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Tasks</div>
                  {!showTaskForm && (
                    <Button size="sm" variant="outline" onClick={() => setShowTaskForm(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> New Task
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {tasks.length === 0 && !showTaskForm && <div className="text-xs text-muted-foreground italic">No tasks yet.</div>}
                  {tasks.map((t) => (
                    <div key={t.id} className="text-sm border border-border rounded p-2 flex items-center gap-2">
                      <Checkbox checked={t.completed} disabled />
                      <div className="flex-1">
                        <div className={cn(t.completed && "line-through text-muted-foreground")}>{t.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {displayName(members.find((m) => m.id === t.owner))} · Due {t.due_date}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {showTaskForm && (
                  <div className="border border-border rounded p-3 space-y-2 mt-2">
                    <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title" />
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={taskOwner} onValueChange={setTaskOwner}>
                        <SelectTrigger><SelectValue placeholder="Owner" /></SelectTrigger>
                        <SelectContent>
                          {members.map((m) => <SelectItem key={m.id} value={m.id}>{displayName(m)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => addTask.mutate()} disabled={addTask.isPending}>Add Task</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowTaskForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Resolve / Action */}
              {canEdit && issue.status === "open" && (
                <div>
                  {!showActionForm ? (
                    <Button size="sm" variant="outline" onClick={() => setShowActionForm(true)}>Resolve Issue</Button>
                  ) : (
                    <div className="border border-border rounded p-3 space-y-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Resolve</div>
                      <Select value={action} onValueChange={(v) => setAction(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solved">Solved</SelectItem>
                          <SelectItem value="tabled">Table to next meeting</SelectItem>
                          <SelectItem value="converted">Convert to Rock</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea rows={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Outcome note (optional)" />
                      {action === "converted" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={convertOwner} onValueChange={setConvertOwner}>
                            <SelectTrigger><SelectValue placeholder="Rock owner" /></SelectTrigger>
                            <SelectContent>
                              {members.map((m) => <SelectItem key={m.id} value={m.id}>{displayName(m)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input value={convertQuarter} onChange={(e) => setConvertQuarter(e.target.value)} placeholder="Q3 2026" />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => apply.mutate()} disabled={apply.isPending}>Apply</Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowActionForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="sm:justify-between gap-2">
              {isAdmin ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (!issue) return;
                    if (!confirm(`Delete "${issue.title}"? This cannot be undone.`)) return;
                    const { error } = await sb.from("issues").delete().eq("id", issue.id);
                    if (error) { toast.error(error.message); return; }
                    toast.success("Issue deleted");
                    qc.invalidateQueries({ queryKey: ["issues"] });
                    onDeleted();
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              ) : <span />}
              <Button variant="ghost" onClick={onClose}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConcludeSection({
  meeting, canEdit, members, userId, onSave,
}: {
  meeting: Meeting;
  canEdit: boolean;
  members: Member[];
  userId: string | null;
  onSave: (patch: Partial<Meeting>) => void;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(meeting.conclude_notes ?? "");
  useEffect(() => setNotes(meeting.conclude_notes ?? ""), [meeting.conclude_notes]);

  const { data: ratings = [] } = useQuery({
    queryKey: ["meeting-ratings", meeting.id],
    queryFn: async () => {
      const { data, error } = await sb.from("l10_meeting_ratings").select("*").eq("meeting_id", meeting.id);
      if (error) throw error;
      return (data ?? []) as MeetingRating[];
    },
  });

  const setRating = useMutation({
    mutationFn: async ({ targetId, rating }: { targetId: string; rating: number }) => {
      if (!userId) throw new Error("Sign in required");
      const { error } = await sb.from("l10_meeting_ratings").upsert(
        { meeting_id: meeting.id, user_id: targetId, rating },
        { onConflict: "meeting_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting-ratings", meeting.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const avg = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
    : null;

  // Show ratings for all attendees of this meeting
  const attendeeIds = meeting.attendees ?? [];
  const attendees = members.filter((m) => attendeeIds.includes(m.id));

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Attendee ratings (1–10) {avg && <span className="text-foreground font-semibold">· Avg {avg}</span>}
        </div>
        {attendees.length === 0 && <div className="text-sm text-muted-foreground italic">No attendees set.</div>}
        <div className="space-y-2">
          {attendees.map((a) => {
            const r = ratings.find((x) => x.user_id === a.id);
            const editable = canEdit || a.id === userId;
            return (
              <div key={a.id} className="border border-border rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">{displayName(a)}{a.id === userId && <span className="text-muted-foreground text-xs ml-2">(you)</span>}</div>
                  <div className={cn("text-sm font-semibold", r ? "text-foreground" : "text-muted-foreground")}>
                    {r ? `${r.rating}/10` : "—"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setRating.mutate({ targetId: a.id, rating: n })}
                      disabled={!editable || setRating.isPending}
                      className={cn(
                        "h-8 w-8 rounded border text-sm font-medium transition-colors",
                        r?.rating === n
                          ? "bg-gold text-background border-gold"
                          : "bg-card border-border hover:bg-accent",
                        !editable && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wide text-muted-foreground">Closing notes</label>
        <Textarea rows={4} value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} className="mt-2" />
        {canEdit && notes !== (meeting.conclude_notes ?? "") && (
          <Button size="sm" className="mt-2" onClick={() => onSave({ conclude_notes: notes || null })}>
            Save notes
          </Button>
        )}
      </div>
    </div>
  );
}
