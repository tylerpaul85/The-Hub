import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ROCK_STATUS_CLASS, ROCK_STATUS_LABEL, currentQuarter, displayName, type Member, type Rock, type RockStatus } from "@/lib/eos";
import { Target, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/eos/rocks")({
  component: RocksPage,
  head: () => ({ meta: [{ title: "Rocks — EOS — MSREG" }] }),
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
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<"mine" | "team">(isAdmin ? "team" : "mine");
  const [quarter, setQuarter] = useState(currentQuarter());
  const [editing, setEditing] = useState<Rock | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Rock | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: rocks = [] } = useQuery({
    queryKey: ["rocks", quarter],
    queryFn: async () => {
      const { data, error } = await sb.from("rocks").select("*").eq("quarter", quarter).order("owner");
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

  const nameOf = (id: string) => { const m = members.find((m) => m.id === id); return m ? displayName(m) : "—"; };

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

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-7 w-7 text-gold" /> Rocks
          </h1>
          <p className="text-muted-foreground mt-1">Quarterly priorities for the team.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input value={quarter} onChange={(e) => setQuarter(e.target.value)} className="w-28" />
          {isAdmin && (
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setView("team")}
                className={cn("px-3 py-1.5 text-sm", view === "team" ? "bg-gold/15 text-gold" : "text-muted-foreground")}
              >Team</button>
              <button
                onClick={() => setView("mine")}
                className={cn("px-3 py-1.5 text-sm", view === "mine" ? "bg-gold/15 text-gold" : "text-muted-foreground")}
              >Mine</button>
            </div>
          )}
          {isAdmin && (
            <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> New Rock</Button>
          )}
        </div>
      </header>

      {Object.keys(grouped).length === 0 && (
        <div className="p-10 text-center text-muted-foreground bg-card border border-border rounded-xl">
          No rocks for {quarter}.
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(grouped).map(([ownerId, list]) => (
          <section key={ownerId} className="bg-card border border-border rounded-xl">
            <div className="px-5 py-3 border-b border-border font-semibold text-sm">
              {nameOf(ownerId)}
              <span className="text-muted-foreground font-normal ml-2">· {list.length} rock{list.length === 1 ? "" : "s"}</span>
            </div>
            <div className="divide-y divide-border">
              {list.map((r) => {
                const canEdit = isAdmin;
                const canStatus = isAdmin || r.owner === user?.id;
                return (
                  <div key={r.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-left">
                          <div className="font-medium">{r.title}</div>
                          {r.due_date && <div className="text-xs text-muted-foreground mt-0.5">Due {r.due_date}</div>}
                        </button>
                      </div>
                      <Select
                        value={r.status}
                        disabled={!canStatus}
                        onValueChange={(v) => updateStatus.mutate({ id: r.id, status: v as RockStatus })}
                      >
                        <SelectTrigger className={cn("w-36 text-xs", ROCK_STATUS_CLASS[r.status])}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["on_track", "off_track", "complete"] as RockStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{ROCK_STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {canEdit && (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canEdit && (
                        <Button size="sm" variant="ghost" onClick={() => setDeleting(r)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {expanded === r.id && <RockDetail rock={r} />}
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
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["rocks"] })}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rock?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `"${deleting.title}" will be permanently removed along with its milestones and check-ins.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleting) deleteRock.mutate(deleting.id); }}
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
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones", rock.id],
    queryFn: async () => {
      const { data, error } = await sb.from("rock_milestones").select("*").eq("rock_id", rock.id).order("created_at", { ascending: false });
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

  const canAdd = isAdmin || rock.owner === user?.id;

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      {rock.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{rock.description}</p>}
      <div>
        <div className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">Milestones / Check-ins</div>
        <div className="space-y-2">
          {milestones.length === 0 && <div className="text-xs text-muted-foreground">No notes yet.</div>}
          {milestones.map((m) => (
            <div key={m.id} className="bg-muted/40 rounded p-2 text-sm">
              <div className="whitespace-pre-wrap">{m.note}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{format(new Date(m.created_at), "MMM d, yyyy · h:mm a")}</div>
            </div>
          ))}
        </div>
        {canAdd && (
          <div className="mt-2 flex gap-2">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Weekly or monthly check-in note..." />
            <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>Add</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RockFormDialog({
  rock, members, defaultQuarter, onClose, onSaved,
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
        title: title.trim(), owner, quarter,
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
        <DialogHeader><DialogTitle>{rock ? "Edit Rock" : "New Rock"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Owner</label>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{displayName(m)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Quarter</label>
              <Input value={quarter} onChange={(e) => setQuarter(e.target.value)} placeholder="Q3 2026" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Due date</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as RockStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["on_track", "off_track", "complete"] as RockStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{ROCK_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
