import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Search, Pencil, Trash2, FileText, History, ListChecks, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/processes")({
  component: ProcessesPage,
  head: () => ({ meta: [{ title: "Internal Processes — MSREG Content Hub" }] }),
});

type Category = { id: string; name: string };
type Process = {
  id: string;
  title: string;
  category_id: string | null;
  content: string;
  steps: string[];
  checklist_mode: boolean;
  last_updated_by: string | null;
  updated_at: string;
};

const sb = supabase as any;

function ProcessesPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Process | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["process-categories"],
    queryFn: async () => {
      const { data, error } = await sb.from("process_categories").select("id, name").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: processes = [] } = useQuery<Process[]>({
    queryKey: ["processes"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("processes")
        .select("id, title, category_id, content, steps, checklist_mode, last_updated_by, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({ ...p, steps: Array.isArray(p.steps) ? p.steps : [] }));
    },
  });

  const { data: editorEmails = {} } = useQuery<Record<string, string>>({
    queryKey: ["process-editor-emails", processes.map((p) => p.last_updated_by).filter(Boolean).join(",")],
    enabled: processes.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(processes.map((p) => p.last_updated_by).filter(Boolean) as string[]));
      if (ids.length === 0) return {};
      const { data } = await sb.from("profiles").select("id, email").in("id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.email; });
      return map;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return processes.filter((p) => {
      if (activeCategory !== "all" && p.category_id !== activeCategory) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.steps.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [processes, search, activeCategory]);

  const selected = processes.find((p) => p.id === selectedId) ?? filtered[0] ?? null;

  const saveProcess = useMutation({
    mutationFn: async (input: Partial<Process> & { id?: string }) => {
      const payload: any = {
        title: input.title,
        category_id: input.category_id ?? null,
        content: input.content ?? "",
        steps: input.steps ?? [],
        checklist_mode: input.checklist_mode ?? false,
        last_updated_by: user?.id,
      };
      if (input.id) {
        const { error } = await sb.from("processes").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("processes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["processes"] });
      setEditorOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const deleteProcess = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("processes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["processes"] });
      setSelectedId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addCategory = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await sb.from("process_categories").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category added");
      qc.invalidateQueries({ queryKey: ["process-categories"] });
      setNewCategoryName("");
      setNewCategoryOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)]">
      {/* Categories sidebar */}
      <aside className="w-56 border-r border-border bg-sidebar/40 p-3 hidden md:flex flex-col gap-1">
        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Categories</div>
        <button
          onClick={() => setActiveCategory("all")}
          className={`text-left text-sm px-2 py-1.5 rounded-md ${activeCategory === "all" ? "bg-gold/15 text-gold" : "hover:bg-sidebar-accent"}`}
        >
          All processes
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`text-left text-sm px-2 py-1.5 rounded-md ${activeCategory === c.id ? "bg-gold/15 text-gold" : "hover:bg-sidebar-accent"}`}
          >
            {c.name}
          </button>
        ))}
        {isAdmin && (
          <Button variant="ghost" size="sm" className="mt-2 justify-start" onClick={() => setNewCategoryOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New category
          </Button>
        )}
      </aside>

      {/* List */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-gold" /> Processes</h1>
            {isAdmin && (
              <Button size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => { setEditing(null); setEditorOpen(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-7 h-8 text-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-auto divide-y divide-border">
          {filtered.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">No processes yet.</div>
          )}
          {filtered.map((p) => {
            const cat = categories.find((c) => c.id === p.category_id);
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left p-3 hover:bg-sidebar-accent/40 ${selected?.id === p.id ? "bg-sidebar-accent/60" : ""}`}
              >
                <div className="font-medium text-sm truncate">{p.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  {cat && <Badge variant="outline" className="text-[10px]">{cat.name}</Badge>}
                  {p.checklist_mode && <Badge variant="outline" className="text-[10px] border-gold/40 text-gold"><ListChecks className="h-3 w-3 mr-1" />Checklist</Badge>}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Updated {format(new Date(p.updated_at), "MMM d, yyyy")}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-auto">
        {selected ? (
          <ProcessDetail
            process={selected}
            categoryName={categories.find((c) => c.id === selected.category_id)?.name}
            lastEditorEmail={selected.last_updated_by ? editorEmails[selected.last_updated_by] : undefined}
            isAdmin={isAdmin}
            currentUserId={user?.id}
            onEdit={() => { setEditing(selected); setEditorOpen(true); }}
            onDelete={() => { if (confirm("Delete this process?")) deleteProcess.mutate(selected.id); }}
            onHistory={() => setHistoryOpen(true)}
          />
        ) : (
          <div className="p-12 text-center text-muted-foreground text-sm">Select a process to view</div>
        )}
      </div>

      <ProcessEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        process={editing}
        categories={categories}
        onSave={(p) => saveProcess.mutate(p)}
        saving={saveProcess.isPending}
      />

      <Dialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
          <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Category name" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewCategoryOpen(false)}>Cancel</Button>
            <Button className="bg-gold text-gold-foreground hover:bg-gold/90" disabled={!newCategoryName.trim()} onClick={() => addCategory.mutate(newCategoryName.trim())}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selected && (
        <RunHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} processId={selected.id} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function linkify(text: string) {
  const re = /(https?:\/\/[^\s)]+)/g;
  const out: (string | { url: string })[] = [];
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ url: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.map((p, i) =>
    typeof p === "string"
      ? <span key={i}>{p}</span>
      : <a key={i} href={p.url} target="_blank" rel="noreferrer" className="text-gold underline break-all">{p.url}</a>
  );
}

function ProcessDetail({
  process: p,
  categoryName,
  lastEditorEmail,
  isAdmin,
  currentUserId,
  onEdit,
  onDelete,
  onHistory,
}: {
  process: Process;
  categoryName?: string;
  lastEditorEmail?: string;
  isAdmin: boolean;
  currentUserId?: string;
  onEdit: () => void;
  onDelete: () => void;
  onHistory: () => void;
}) {
  const qc = useQueryClient();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const { data: activeRun } = useQuery({
    queryKey: ["process-active-run", activeRunId],
    enabled: !!activeRunId,
    queryFn: async () => {
      const { data: run } = await sb.from("process_runs").select("*").eq("id", activeRunId).maybeSingle();
      const { data: steps } = await sb.from("process_run_steps").select("*").eq("run_id", activeRunId).order("step_index");
      return { run, steps: steps ?? [] };
    },
  });

  const startRun = useMutation({
    mutationFn: async () => {
      const { data: run, error } = await sb.from("process_runs").insert({ process_id: p.id, started_by: currentUserId }).select().single();
      if (error) throw error;
      const stepsRows = p.steps.map((label, i) => ({ run_id: run.id, step_index: i, label }));
      if (stepsRows.length) {
        const { error: e2 } = await sb.from("process_run_steps").insert(stepsRows);
        if (e2) throw e2;
      }
      return run.id as string;
    },
    onSuccess: (id) => { setActiveRunId(id); toast.success("Checklist started"); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStep = useMutation({
    mutationFn: async ({ stepId, checked }: { stepId: string; checked: boolean }) => {
      const { error } = await sb.from("process_run_steps").update({
        checked_at: checked ? new Date().toISOString() : null,
        checked_by: checked ? currentUserId : null,
      }).eq("id", stepId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["process-active-run", activeRunId] }),
  });

  const finishRun = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("process_runs").update({ completed_at: new Date().toISOString() }).eq("id", activeRunId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Checklist completed"); setActiveRunId(null); },
  });

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {categoryName && <Badge variant="outline">{categoryName}</Badge>}
            {p.checklist_mode && <Badge variant="outline" className="border-gold/40 text-gold"><ListChecks className="h-3 w-3 mr-1" />Checklist mode</Badge>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{p.title}</h1>
          <div className="text-xs text-muted-foreground mt-1">
            Last updated {format(new Date(p.updated_at), "MMM d, yyyy h:mm a")}
            {lastEditorEmail && <> by <span className="text-foreground/70">{lastEditorEmail}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button size="sm" variant="ghost" onClick={onHistory}><History className="h-4 w-4 mr-1" />History</Button>
          )}
          {isAdmin && (
            <>
              <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      </div>

      {p.content && (
        <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap text-foreground/90 bg-card border border-border rounded-lg p-4 mb-6">
          {linkify(p.content)}
        </div>
      )}

      {p.steps.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Steps</h2>
            {p.checklist_mode && !activeRunId && (
              <Button size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => startRun.mutate()} disabled={startRun.isPending}>
                <Play className="h-3.5 w-3.5 mr-1" /> Start checklist
              </Button>
            )}
            {activeRunId && !activeRun?.run?.completed_at && (
              <Button size="sm" variant="outline" onClick={() => finishRun.mutate()}>Finish</Button>
            )}
          </div>

          {!activeRunId ? (
            <ol className="space-y-2 list-decimal list-inside text-sm">
              {p.steps.map((s, i) => <li key={i} className="text-foreground/90">{linkify(s)}</li>)}
            </ol>
          ) : (
            <ul className="space-y-2 text-sm">
              {(activeRun?.steps ?? []).map((s: any) => (
                <li key={s.id} className="flex items-start gap-2">
                  <Checkbox
                    checked={!!s.checked_at}
                    onCheckedChange={(v) => toggleStep.mutate({ stepId: s.id, checked: !!v })}
                    className="mt-0.5"
                  />
                  <div>
                    <div className={s.checked_at ? "line-through text-muted-foreground" : ""}>{linkify(s.label)}</div>
                    {s.checked_at && (
                      <div className="text-[10px] text-muted-foreground">
                        Checked {format(new Date(s.checked_at), "MMM d, h:mm a")}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function ProcessEditor({
  open, onOpenChange, process, categories, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  process: Process | null;
  categories: Category[];
  onSave: (p: Partial<Process> & { id?: string }) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [content, setContent] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [checklistMode, setChecklistMode] = useState(false);

  // Reset when opened/changed
  useMemo(() => {
    if (open) {
      setTitle(process?.title ?? "");
      setCategoryId(process?.category_id ?? "");
      setContent(process?.content ?? "");
      setStepsText((process?.steps ?? []).join("\n"));
      setChecklistMode(process?.checklist_mode ?? false);
    }
  }, [open, process]);

  const handleSave = () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    onSave({
      id: process?.id,
      title: title.trim(),
      category_id: categoryId || null,
      content,
      steps: stepsText.split("\n").map((s) => s.trim()).filter(Boolean),
      checklist_mode: checklistMode,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>{process ? "Edit Process" : "New Process"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description / Notes</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="mt-1.5"
              placeholder="Paste links (https://…) and notes. URLs become clickable."
            />
          </div>
          <div>
            <Label>Steps (one per line)</Label>
            <Textarea
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              rows={8}
              className="mt-1.5 font-mono text-xs"
              placeholder={"1. Open the listing\n2. Upload photos\n…"}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Checklist mode</div>
              <div className="text-xs text-muted-foreground">Steps become checkable items users can run.</div>
            </div>
            <Switch checked={checklistMode} onCheckedChange={setChecklistMode} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunHistoryDialog({ open, onOpenChange, processId, isAdmin }: { open: boolean; onOpenChange: (v: boolean) => void; processId: string; isAdmin: boolean; }) {
  const { data: runs = [] } = useQuery({
    queryKey: ["process-runs", processId],
    enabled: open && isAdmin,
    queryFn: async () => {
      const { data: runs } = await sb.from("process_runs").select("id, started_by, started_at, completed_at").eq("process_id", processId).order("started_at", { ascending: false });
      const ids = Array.from(new Set((runs ?? []).map((r: any) => r.started_by)));
      const { data: profs } = ids.length ? await sb.from("profiles").select("id, email").in("id", ids) : { data: [] };
      const map = new Map<string, string>();
      (profs ?? []).forEach((p: any) => map.set(p.id, p.email));
      return (runs ?? []).map((r: any) => ({ ...r, email: map.get(r.started_by) ?? "Unknown" }));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Checklist Run History</DialogTitle></DialogHeader>
        {runs.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">No runs yet.</div>
        ) : (
          <div className="divide-y divide-border max-h-[60vh] overflow-auto">
            {runs.map((r: any) => (
              <div key={r.id} className="py-3">
                <div className="text-sm font-medium">{r.email}</div>
                <div className="text-xs text-muted-foreground">
                  Started {format(new Date(r.started_at), "MMM d, yyyy h:mm a")}
                  {r.completed_at ? <> · Completed {format(new Date(r.completed_at), "MMM d, h:mm a")}</> : <> · In progress</>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
