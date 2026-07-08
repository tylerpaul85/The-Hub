import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChatThread } from "@/components/chat-thread";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ClipboardCheck, Plus, FileText, ExternalLink, Upload, Send, Trash2, Link as LinkIcon, Paperclip,
  Repeat, Pause, Play, Pencil, FolderKanban, ChevronDown, ChevronRight, User as UserIcon,
  Star, GripVertical, Ticket, ChevronDown as ChevronDownIcon,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewEventDialog, EventDetailSheet } from "@/components/event-dialogs";
import type { EventRow, EventType } from "@/lib/events";
import { EVENT_TYPE_CLASS } from "@/lib/events";

const sb = supabase as any;

type TaskStatus = "todo" | "in_progress" | "needs_review" | "revision_needed" | "complete";
type TaskPriority = "low" | "normal" | "high";

type Task = {
  id: string;
  title: string;
  owner: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  description: string | null;
  originating_request_id: string | null;
  agent_name: string | null;
  agent_email: string | null;
  attached_request_files: string[];
  deliverable_sent_at: string | null;
  created_by: string | null;
  created_at: string;
  recurring_template_id: string | null;
  project_id: string | null;
  requested_by_user_id: string | null;
  requested_by_name: string | null;
  starred: boolean;
  sort_order: number | null;
  event_id: string | null;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  archived: boolean;
  owner: string | null;
  created_by: string | null;
  created_at: string;
};

type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "custom";

type RecurringTemplate = {
  id: string;
  title: string;
  description: string | null;
  owner: string | null;
  priority: TaskPriority;
  frequency: Frequency;
  day_of_week: number | null;
  day_of_month: number | null;
  interval_days: number | null;
  next_due_on: string;
  last_generated_on: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
};

const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  custom: "Custom interval",
};

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function describeSchedule(t: Pick<RecurringTemplate, "frequency" | "day_of_week" | "day_of_month" | "interval_days">) {
  switch (t.frequency) {
    case "daily": return "Every day";
    case "weekly": return `Every ${DAYS_OF_WEEK[t.day_of_week ?? 1]}`;
    case "biweekly": return `Every other ${DAYS_OF_WEEK[t.day_of_week ?? 1]}`;
    case "monthly": return `Day ${t.day_of_month ?? 1} of each month`;
    case "custom": return `Every ${t.interval_days ?? 1} days`;
  }
}

// Compute the first occurrence on or after today.
function computeInitialNextDue(freq: Frequency, dow: number | null, dom: number | null): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let d = new Date(today);
  if (freq === "weekly" || freq === "biweekly") {
    const target = dow ?? 1;
    const diff = (target - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
  } else if (freq === "monthly") {
    const target = dom ?? 1;
    if (d.getDate() > target) d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(target, monthEnd));
  }
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60_000).toISOString().slice(0, 10);
}


type Deliverable = {
  id: string;
  task_id: string;
  file_url: string | null;
  link_url: string | null;
  label: string | null;
  uploaded_by: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  needs_review: "Needs Review",
  revision_needed: "Revision Needed",
  complete: "Complete",
};
const STATUS_CLASS: Record<TaskStatus, string> = {
  todo: "bg-muted text-foreground border-border",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  needs_review: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  revision_needed: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  complete: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};
const PRIORITY_CLASS: Record<TaskPriority, string> = {
  high: "bg-destructive/20 text-destructive border-destructive/30",
  normal: "bg-muted text-foreground border-border",
  low: "bg-muted/50 text-muted-foreground border-border",
};

type Search = { open?: string };

export const Route = createFileRoute("/_authenticated/tasks")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    open: typeof s.open === "string" ? s.open : undefined,
  }),
  component: TasksPage,
  head: () => ({ meta: [{ title: "Tasks — MSREG Marketing" }] }),
});

function nameOf(u: any) {
  if (!u) return "Unknown";
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return full || u.email;
}

function TasksPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const qc = useQueryClient();

  const [view, setView] = useState<"active" | "archive" | "recurring">("active");
  const [grouping, setGrouping] = useState<"list" | "project" | "source">("list");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<"all" | "mine" | string>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [projectFilter, setProjectFilter] = useState<"all" | "none" | string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [projectsPanelOpen, setProjectsPanelOpen] = useState(true);
  const [eventsPanelOpen, setEventsPanelOpen] = useState(true);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const [topFiveOnly, setTopFiveOnly] = useState(false);

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await sb.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const toggleStar = useMutation({
    mutationFn: async ({ id, starred }: { id: string; starred: boolean }) => {
      const { error } = await sb.from("tasks").update({ starred }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, starred }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueryData<Task[]>(["tasks"]);
      qc.setQueryData<Task[]>(["tasks"], (old) => (old ?? []).map((t) => t.id === id ? { ...t, starred } : t));
      return { prev };
    },
    onError: (e: any, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["tasks"], ctx.prev); toast.error(e.message); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const { data: todos = [] } = useQuery({
    queryKey: ["todos-in-tasks"],
    queryFn: async () => {
      const { data, error } = await sb.from("todos").select("*").order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleTodo = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await sb.from("todos").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["todos-in-tasks"] }); qc.invalidateQueries({ queryKey: ["my-todos-widget"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_team_members");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: templates = [] } = useQuery<RecurringTemplate[]>({
    queryKey: ["recurring-templates"],
    queryFn: async () => {
      const { data, error } = await sb.from("recurring_task_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as RecurringTemplate[];
    },
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await sb.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });

  const { data: events = [] } = useQuery<EventRow[]>({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await sb.from("events").select("*").order("event_date");
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });



  const quickAdd = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await sb.from("tasks").insert({
        title: title.trim(),
        owner: user?.id ?? null,
        priority: "normal",
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { setQuickTitle(""); qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const profileById = (id: string | null) => (id ? (profiles as any[]).find((p) => p.id === id) : null);
  const projectById = (id: string | null) => (id ? projects.find((p) => p.id === id) : null);
  const eventById = (id: string | null) => (id ? events.find((e) => e.id === id) : null);
  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const list = tasks.filter((t) => {
      const isComplete = t.status === "complete";
      if (view === "active" && isComplete) return false;
      if (view === "archive" && !isComplete) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (assigneeFilter === "mine" && t.owner !== user?.id) return false;
      if (assigneeFilter !== "all" && assigneeFilter !== "mine" && t.owner !== assigneeFilter) return false;
      if (projectFilter === "none" && t.project_id) return false;
      if (projectFilter !== "all" && projectFilter !== "none" && t.project_id !== projectFilter) return false;
      if (topFiveOnly && !t.starred) return false;
      return true;
    });
    if (topFiveOnly) {
      return list
        .slice()
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
        .slice(0, 5);
    }
    return list;
  }, [tasks, view, statusFilter, priorityFilter, assigneeFilter, projectFilter, user?.id, topFiveOnly]);

  const filteredTodos = useMemo(() => {
    if (topFiveOnly) return [];
    return (todos as any[]).filter((t) => {
      if (view === "active" && t.completed) return false;
      if (view === "archive" && !t.completed) return false;
      const eqStatus: TaskStatus = t.completed ? "complete" : "todo";
      if (statusFilter !== "all" && statusFilter !== eqStatus) return false;
      if (priorityFilter !== "all" && priorityFilter !== "normal") return false;
      if (assigneeFilter === "mine" && t.owner !== user?.id) return false;
      if (assigneeFilter !== "all" && assigneeFilter !== "mine" && t.owner !== assigneeFilter) return false;
      if (projectFilter !== "all") return false; // L10 todos don't have projects
      return true;
    });
  }, [todos, view, statusFilter, priorityFilter, assigneeFilter, projectFilter, user?.id, topFiveOnly]);

  // Project progress (counts include all visible tasks, not filtered)
  const projectProgress = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      if (!t.project_id) continue;
      const cur = map.get(t.project_id) ?? { total: 0, done: 0 };
      cur.total++;
      if (t.status === "complete") cur.done++;
      map.set(t.project_id, cur);
    }
    return map;
  }, [tasks]);

  const selected = search.open ? tasks.find((t) => t.id === search.open) ?? null : null;
  const openTask = (id: string | null) => navigate({ to: "/tasks", search: id ? { open: id } : {} });

  const renderTaskRow = (t: Task) => {
    const overdue = t.due_date && t.due_date < today && t.status !== "complete";
    const owner = profileById(t.owner);
    const proj = projectById(t.project_id);
    const evt = eventById(t.event_id);
    const requester = profileById(t.requested_by_user_id);
    const requesterLabel = requester ? nameOf(requester) : t.requested_by_name || (t.agent_name ?? null);
    return (
      <div
        key={t.id}
        onClick={() => openTask(t.id)}
        className="w-full text-left bg-card border border-border rounded-lg p-4 hover:border-gold/50 transition-colors cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {t.recurring_template_id && (
                <span title="Recurring task" className="inline-flex items-center text-gold">
                  <Repeat className="h-3.5 w-3.5" />
                </span>
              )}
              <span className="font-medium truncate">{t.title}</span>
              <Badge variant="outline" className={STATUS_CLASS[t.status]}>{STATUS_LABEL[t.status]}</Badge>
              <Badge variant="outline" className={PRIORITY_CLASS[t.priority]}>{t.priority}</Badge>
              {t.recurring_template_id && (
                <Badge variant="outline" className="text-[10px] bg-gold/10 text-gold border-gold/30">Recurring</Badge>
              )}
              {proj && (
                <Badge variant="outline" className="text-[10px] bg-navy-700/40 text-gold border-gold/30 flex items-center gap-1">
                  <FolderKanban className="h-3 w-3" />{proj.name}
                </Badge>
              )}
              {evt && (
                <Badge variant="outline" className={cn("text-[10px] flex items-center gap-1", EVENT_TYPE_CLASS[evt.type as EventType] ?? "")}>
                  <Ticket className="h-3 w-3" />{evt.name}
                </Badge>
              )}
              {requesterLabel && <Badge variant="secondary" className="text-[10px]">From: {requesterLabel}</Badge>}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {owner ? `Owner: ${nameOf(owner)}` : "Unassigned"}
              {t.due_date && (
                <>
                  {" · "}
                  <span className={overdue ? "text-destructive font-medium" : ""}>
                    Due {t.due_date}{overdue ? " (overdue)" : ""}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            title={t.starred ? "Remove from Top 5" : "Star (Top 5)"}
            onClick={(e) => { e.stopPropagation(); toggleStar.mutate({ id: t.id, starred: !t.starred }); }}
            className={cn(
              "shrink-0 p-1 rounded hover:bg-muted transition-colors",
              t.starred ? "text-gold" : "text-muted-foreground hover:text-gold",
            )}
          >
            <Star className={cn("h-4 w-4", t.starred && "fill-current")} />
          </button>
        </div>
      </div>
    );
  };

  const renderTodoRow = (t: any) => {
    const overdue = t.due_date && t.due_date < today && !t.completed;
    const owner = profileById(t.owner);
    return (
      <div
        key={`todo-${t.id}`}
        className="w-full text-left bg-card border border-border rounded-lg p-4 flex items-start gap-3"
      >
        <input
          type="checkbox"
          checked={t.completed}
          onChange={(e) => toggleTodo.mutate({ id: t.id, completed: e.target.checked })}
          className="mt-1 h-4 w-4 accent-gold"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("font-medium truncate", t.completed && "line-through text-muted-foreground")}>{t.title}</span>
            <Badge variant="outline" className={t.completed ? STATUS_CLASS.complete : STATUS_CLASS.todo}>
              {t.completed ? "Complete" : "To Do"}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">L10 to-do</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {owner ? `Owner: ${nameOf(owner)}` : "Unassigned"}
            {t.due_date && (
              <>
                {" · "}
                <span className={overdue ? "text-destructive font-medium" : ""}>
                  Due {t.due_date}{overdue ? " (overdue)" : ""}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Group filtered tasks
  const groupedByProject = useMemo(() => {
    const groups = new Map<string, Task[]>();
    for (const t of filtered) {
      const k = t.project_id ?? "__none__";
      const arr = groups.get(k) ?? [];
      arr.push(t);
      groups.set(k, arr);
    }
    return groups;
  }, [filtered]);

  const groupedBySource = useMemo(() => {
    const groups = new Map<string, Task[]>();
    for (const t of filtered) {
      const k = t.requested_by_user_id
        ? `u:${t.requested_by_user_id}`
        : t.requested_by_name
        ? `n:${t.requested_by_name.toLowerCase()}`
        : t.agent_name
        ? `a:${t.agent_name.toLowerCase()}`
        : "__none__";
      const arr = groups.get(k) ?? [];
      arr.push(t);
      groups.set(k, arr);
    }
    return groups;
  }, [filtered]);

  const sourceLabel = (key: string): string => {
    if (key === "__none__") return "No source";
    if (key.startsWith("u:")) {
      const p = profileById(key.slice(2));
      return p ? nameOf(p) : "Unknown user";
    }
    return key.slice(2);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-gold" />
          <h1 className="text-xl font-semibold">Tasks, Projects &amp; Events</h1>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Plus className="h-4 w-4 mr-1" /> New <ChevronDownIcon className="h-3.5 w-3.5 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setCreateOpen(true)}>
              <ClipboardCheck className="h-4 w-4 mr-2 text-gold" /> New Task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setNewProjectOpen(true)}>
              <FolderKanban className="h-4 w-4 mr-2 text-gold" /> New Project
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={() => setNewEventOpen(true)}>
                <Ticket className="h-4 w-4 mr-2 text-gold" /> New Event
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quick capture */}
      {view === "active" && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (quickTitle.trim()) quickAdd.mutate(quickTitle); }}
          className="flex gap-2 mb-4"
        >
          <Input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Quick add a task… (press Enter)"
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={!quickTitle.trim() || quickAdd.isPending}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </form>
      )}

      {/* Projects panel */}
      {view !== "recurring" && (
        <div className="bg-card border border-border rounded-lg mb-4">
          <button
            onClick={() => setProjectsPanelOpen((o) => !o)}
            className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors rounded-t-lg"
          >
            <div className="flex items-center gap-2">
              {projectsPanelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <FolderKanban className="h-4 w-4 text-gold" />
              <span className="font-medium text-sm">Projects</span>
              <span className="text-xs text-muted-foreground">({projects.filter((p) => !p.archived).length})</span>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setNewProjectOpen(true); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setNewProjectOpen(true); } }}
              className="text-xs text-gold hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="h-3 w-3" /> New project
            </span>
          </button>
          {projectsPanelOpen && (
            <div className="p-3 pt-0 border-t border-border">
              {projects.filter((p) => !p.archived).length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No projects yet. Create one to group related tasks.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                  {projects.filter((p) => !p.archived).map((p) => {
                    const prog = projectProgress.get(p.id) ?? { total: 0, done: 0 };
                    return (
                      <button
                        key={p.id}
                        onClick={() => setOpenProjectId(p.id)}
                        className="text-left bg-muted/30 hover:bg-muted/50 border border-border hover:border-gold/40 rounded-md p-3 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium text-sm truncate">{p.name}</span>
                          <span className="text-[10px] text-gold whitespace-nowrap">{prog.done} of {prog.total}</span>
                        </div>
                        {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Events panel */}
      {view !== "recurring" && (
        <div className="bg-card border border-border rounded-lg mb-4">
          <button
            onClick={() => setEventsPanelOpen((o) => !o)}
            className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors rounded-t-lg"
          >
            <div className="flex items-center gap-2">
              {eventsPanelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Ticket className="h-4 w-4 text-gold" />
              <span className="font-medium text-sm">Events</span>
              <span className="text-xs text-muted-foreground">({events.filter((e) => e.event_date >= today).length} upcoming)</span>
            </div>
            {isAdmin && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setNewEventOpen(true); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setNewEventOpen(true); } }}
                className="text-xs text-gold hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> New event
              </span>
            )}
          </button>
          {eventsPanelOpen && (
            <div className="p-3 pt-0 border-t border-border">
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No events yet. Create one to plan and track its tasks.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                  {events
                    .slice()
                    .sort((a, b) => {
                      const aUpcoming = a.event_date >= today;
                      const bUpcoming = b.event_date >= today;
                      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
                      return aUpcoming
                        ? a.event_date.localeCompare(b.event_date)
                        : b.event_date.localeCompare(a.event_date);
                    })
                    .slice(0, 9)
                    .map((e) => {
                      const evTasks = tasks.filter((t) => t.event_id === e.id);
                      const evDone = evTasks.filter((t) => t.status === "complete").length;
                      const past = e.event_date < today;
                      return (
                        <button
                          key={e.id}
                          onClick={() => setOpenEventId(e.id)}
                          className={cn(
                            "text-left bg-muted/30 hover:bg-muted/50 border border-border hover:border-gold/40 rounded-md p-3 transition-colors",
                            past && "opacity-70",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium text-sm truncate">{e.name}</span>
                            <Badge variant="outline" className={cn("text-[10px] shrink-0", EVENT_TYPE_CLASS[e.type as EventType] ?? "")}>{e.type}</Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {e.event_date}{e.event_time ? ` · ${e.event_time.slice(0,5)}` : ""}
                            {e.location ? ` · ${e.location}` : ""}
                          </div>
                          {evTasks.length > 0 && (
                            <div className="text-[10px] text-gold mt-1">{evDone} of {evTasks.length} tasks done</div>
                          )}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>
      )}



      <div className="inline-flex rounded-lg border border-border bg-card p-1 mb-4">
        {(["active", "archive", "recurring"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "px-4 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5",
              view === v ? "bg-gold text-gold-foreground font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v === "recurring" && <Repeat className="h-3.5 w-3.5" />}
            {v === "active" ? "Active" : v === "archive" ? "Archive" : "Recurring"}
            <span className="ml-1 text-xs opacity-75">
              {v === "active"
                ? tasks.filter((t) => t.status !== "complete").length + (todos as any[]).filter((t) => !t.completed).length
                : v === "archive"
                ? tasks.filter((t) => t.status === "complete").length + (todos as any[]).filter((t) => t.completed).length
                : templates.length}
            </span>
          </button>
        ))}
      </div>

      {/* View / grouping switcher */}
      {view !== "recurring" && (
        <div className="inline-flex rounded-lg border border-border bg-card p-1 mb-4 ml-2">
          {([
            { k: "list", label: "List" },
            { k: "project", label: "By Project" },
            { k: "source", label: "By Source" },
          ] as const).map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setGrouping(k)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                grouping === k ? "bg-navy-700 text-gold font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {view !== "recurring" && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Select value={assigneeFilter} onValueChange={(v) => setAssigneeFilter(v)}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Assignee" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All people</SelectItem>
                <SelectItem value="mine">Just me</SelectItem>
                {(profiles as any[]).filter((p) => p.id !== user?.id).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{nameOf(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={(v) => setProjectFilter(v)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              <SelectItem value="none">Uncategorized</SelectItem>
              {projects.filter((p) => !p.archived).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={topFiveOnly ? "default" : "outline"}
            onClick={() => setTopFiveOnly((v) => !v)}
            className={cn(topFiveOnly && "bg-gold text-gold-foreground hover:bg-gold/90")}
            title="Show only your starred Top 5"
          >
            <Star className={cn("h-4 w-4 mr-1", topFiveOnly && "fill-current")} />
            Top 5
          </Button>
        </div>
      )}

      {view === "recurring" ? (
        <RecurringTemplatesList
          templates={templates}
          profiles={profiles as any[]}
          isAdmin={isAdmin}
          currentUserId={user?.id}
          onChanged={() => { qc.invalidateQueries({ queryKey: ["recurring-templates"] }); qc.invalidateQueries({ queryKey: ["tasks"] }); }}
        />
      ) : filtered.length === 0 && filteredTodos.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-12 border border-dashed border-border rounded-lg">
          {view === "archive" ? "No completed tasks yet." : "No tasks in this view."}
        </div>
      ) : grouping === "list" ? (
        <div className="space-y-2">
          {filtered.map(renderTaskRow)}
          {filteredTodos.map(renderTodoRow)}
        </div>
      ) : grouping === "project" ? (
        <div className="space-y-5">
          {projects.filter((p) => !p.archived).map((p) => {
            const ts = groupedByProject.get(p.id) ?? [];
            if (ts.length === 0) return null;
            const done = ts.filter((t) => t.status === "complete").length;
            return (
              <section key={p.id}>
                <div className="flex items-center gap-2 mb-2">
                  <FolderKanban className="h-4 w-4 text-gold" />
                  <h2 className="font-semibold text-sm">{p.name}</h2>
                  <span className="text-xs text-gold">{done} of {ts.length} done</span>
                </div>
                <div className="space-y-2">{ts.map(renderTaskRow)}</div>
              </section>
            );
          })}
          {(() => {
            const ts = groupedByProject.get("__none__") ?? [];
            if (ts.length === 0 && filteredTodos.length === 0) return null;
            return (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-sm text-muted-foreground">Uncategorized</h2>
                  <span className="text-xs text-muted-foreground">{ts.length} task{ts.length === 1 ? "" : "s"}</span>
                </div>
                <div className="space-y-2">
                  {ts.map(renderTaskRow)}
                  {filteredTodos.map(renderTodoRow)}
                </div>
              </section>
            );
          })()}
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(groupedBySource.entries())
            .sort(([a], [b]) => (a === "__none__" ? 1 : b === "__none__" ? -1 : sourceLabel(a).localeCompare(sourceLabel(b))))
            .map(([key, ts]) => (
              <section key={key}>
                <div className="flex items-center gap-2 mb-2">
                  <UserIcon className="h-4 w-4 text-gold" />
                  <h2 className="font-semibold text-sm">{sourceLabel(key)}</h2>
                  <span className="text-xs text-muted-foreground">{ts.length} task{ts.length === 1 ? "" : "s"}</span>
                </div>
                <div className="space-y-2">{ts.map(renderTaskRow)}</div>
              </section>
            ))}
          {filteredTodos.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm text-muted-foreground">L10 to-dos</h2>
              </div>
              <div className="space-y-2">{filteredTodos.map(renderTodoRow)}</div>
            </section>
          )}
        </div>
      )}

      <ProjectDetailDialog
        projectId={openProjectId}
        onClose={() => setOpenProjectId(null)}
        projects={projects}
        tasks={tasks}
        profiles={profiles as any[]}
        onOpenTask={(id: string) => { setOpenProjectId(null); openTask(id); }}
        isAdmin={isAdmin}
        currentUserId={user?.id}
        onChanged={() => { qc.invalidateQueries({ queryKey: ["projects"] }); qc.invalidateQueries({ queryKey: ["tasks"] }); }}
      />

      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        currentUserId={user?.id}
        onCreated={() => qc.invalidateQueries({ queryKey: ["projects"] })}
      />

      {newEventOpen && (
        <NewEventDialog
          open={newEventOpen}
          onClose={() => setNewEventOpen(false)}
          members={profiles as any[]}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["events"] });
            qc.invalidateQueries({ queryKey: ["event-checklist-all"] });
          }}
        />
      )}

      <EventDetailSheet
        event={openEventId ? events.find((e) => e.id === openEventId) ?? null : null}
        members={profiles as any[]}
        onClose={() => setOpenEventId(null)}
        isAdmin={isAdmin}
        onOpenTask={(id: string) => { setOpenEventId(null); openTask(id); }}
      />




      <TaskDetailDialog
        task={selected}
        onClose={() => openTask(null)}
        profiles={profiles as any[]}
        projects={projects}
        currentUserId={user?.id}
        isAdmin={isAdmin}
        onChanged={() => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["my-tasks"] }); }}
      />

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        profiles={profiles as any[]}
        projects={projects}
        currentUserId={user?.id}
        isAdmin={isAdmin}
        onCreated={() => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["recurring-templates"] }); }}
      />
    </div>
  );
}

function TaskDetailDialog({
  task, onClose, profiles, projects, currentUserId, isAdmin, onChanged,
}: {
  task: Task | null;
  onClose: () => void;
  profiles: any[];
  projects: Project[];
  currentUserId?: string;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const qc = useQueryClient();

  const { data: deliverables = [] } = useQuery<Deliverable[]>({
    queryKey: ["task-deliverables", task?.id],
    enabled: !!task,
    queryFn: async () => {
      const { data, error } = await sb.from("task_deliverables").select("*").eq("task_id", task!.id).order("created_at");
      if (error) throw error;
      return data as Deliverable[];
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<Task>) => {
      const { error } = await sb.from("tasks").update(patch).eq("id", task!.id);
      if (error) throw error;
    },
    onSuccess: () => { onChanged(); qc.invalidateQueries({ queryKey: ["tasks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("tasks").delete().eq("id", task!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Task deleted"); onChanged(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [uploading, setUploading] = useState(false);

  const addLink = useMutation({
    mutationFn: async () => {
      if (!linkUrl.trim()) return;
      const { error } = await sb.from("task_deliverables").insert({
        task_id: task!.id, link_url: linkUrl.trim(), label: linkLabel.trim() || null, uploaded_by: currentUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => { setLinkUrl(""); setLinkLabel(""); qc.invalidateQueries({ queryKey: ["task-deliverables", task!.id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeDeliv = useMutation({
    mutationFn: async (id: string) => {
      const d = deliverables.find((x) => x.id === id);
      if (d?.file_url) await supabase.storage.from("task-deliverables").remove([d.file_url]);
      const { error } = await sb.from("task_deliverables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-deliverables", task!.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const key = `${task!.id}/${Date.now()}-${f.name.replace(/[^A-Za-z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("task-deliverables").upload(key, f);
        if (upErr) throw upErr;
        const { error: insErr } = await sb.from("task_deliverables").insert({
          task_id: task!.id, file_url: key, label: f.name, uploaded_by: currentUserId,
        });
        if (insErr) throw insErr;
      }
      qc.invalidateQueries({ queryKey: ["task-deliverables", task!.id] });
      toast.success("Uploaded");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const openFile = async (key: string) => {
    const { data, error } = await supabase.storage.from("task-deliverables").createSignedUrl(key, 3600);
    if (error || !data) { toast.error("Could not open"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const openRequestFile = async (key: string) => {
    const { data, error } = await supabase.storage.from("marketing-request-uploads").createSignedUrl(key, 600);
    if (error || !data) { toast.error("Could not open"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const sendToAgent = async () => {
    if (!task?.agent_email) { toast.error("No agent email on this task"); return; }
    if (deliverables.length === 0) { toast.error("Add at least one deliverable first"); return; }
    if (task.status !== "complete") { toast.error("Mark task Complete before sending"); return; }

    // Build signed URLs for files; pass-through link URLs
    const lines: string[] = [];
    for (const d of deliverables) {
      if (d.file_url) {
        const { data } = await supabase.storage.from("task-deliverables").createSignedUrl(d.file_url, 60 * 60 * 24 * 7);
        if (data) lines.push(`• ${d.label || "File"}: ${data.signedUrl}`);
      } else if (d.link_url) {
        lines.push(`• ${d.label || "Link"}: ${d.link_url}`);
      }
    }
    const subject = `Your marketing request is ready — ${task.title}`;
    const body = `Hi ${task.agent_name || "there"},\n\nYour marketing request is complete. Here are the deliverables:\n\n${lines.join("\n")}\n\n(Links are valid for 7 days.)\n\nLet us know if you need anything tweaked.\n\n— MSREG Marketing`;
    const mailto = `mailto:${task.agent_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    await sb.from("tasks").update({ deliverable_sent_at: new Date().toISOString(), deliverable_sent_by: currentUserId }).eq("id", task.id);
    onChanged();
    toast.success("Email drafted — your mail app should open");
  };

  if (!task) return null;

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <Input
              defaultValue={task.title}
              onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && update.mutate({ title: e.target.value.trim() })}
              className="text-lg font-semibold border-0 px-0 focus-visible:ring-0"
            />
          </DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div>
            <Label>Status</Label>
            <Select value={task.status} onValueChange={(v) => update.mutate({ status: v as TaskStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Owner</Label>
            {isAdmin ? (
              <Select value={task.owner ?? "none"} onValueChange={(v) => update.mutate({ owner: v === "none" ? null : v } as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{nameOf(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-muted-foreground border border-border rounded-md px-3 py-2">
                {task.owner ? nameOf(profiles.find((p) => p.id === task.owner)) : "Unassigned"}
              </div>
            )}
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={task.priority} onValueChange={(v) => update.mutate({ priority: v as TaskPriority })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" defaultValue={task.due_date ?? ""} onBlur={(e) => {
              const v = e.target.value || null;
              if (v !== task.due_date) update.mutate({ due_date: v } as any);
            }} />
          </div>
          <div>
            <Label>Project</Label>
            <Select
              value={task.project_id ?? "none"}
              onValueChange={(v) => update.mutate({ project_id: v === "none" ? null : v } as any)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {projects.filter((p) => !p.archived).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Requested by (system user)</Label>
            <Select
              value={task.requested_by_user_id ?? "none"}
              onValueChange={(v) => update.mutate({ requested_by_user_id: v === "none" ? null : v } as any)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{nameOf(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Requested by (other)</Label>
            <Input
              defaultValue={task.requested_by_name ?? ""}
              placeholder="Name (if not a system user)"
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== (task.requested_by_name ?? null)) update.mutate({ requested_by_name: v } as any);
              }}
            />
          </div>
          {task.agent_name && (
            <div className="sm:col-span-2">
              <Label>From agent</Label>
              <div className="text-sm py-2">{task.agent_name} {task.agent_email && <a href={`mailto:${task.agent_email}`} className="text-gold underline ml-1">{task.agent_email}</a>}</div>
            </div>
          )}
        </div>

        <div className="mb-4">
          <Label>Description</Label>
          <Textarea
            defaultValue={task.description ?? ""}
            rows={4}
            onBlur={(e) => { if (e.target.value !== (task.description ?? "")) update.mutate({ description: e.target.value }); }}
          />
        </div>

        {task.attached_request_files.length > 0 && (
          <div className="mb-4">
            <Label>Files from agent</Label>
            <div className="space-y-1 mt-1">
              {task.attached_request_files.map((k) => {
                const name = k.split("-").slice(1).join("-") || k;
                return (
                  <button key={k} onClick={() => openRequestFile(k)} className="flex items-center gap-2 text-gold hover:underline text-sm">
                    <Paperclip className="h-4 w-4" /> {name} <ExternalLink className="h-3 w-3" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <section className="pt-4 border-t border-border mb-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Upload className="h-4 w-4" /> Deliverables for the agent</h3>
          <div className="space-y-2 mb-3">
            {deliverables.length === 0 && <p className="text-xs text-muted-foreground">No deliverables yet.</p>}
            {deliverables.map((d) => (
              <div key={d.id} className="flex items-center gap-2 bg-muted/30 rounded px-3 py-2">
                {d.file_url ? (
                  <button onClick={() => openFile(d.file_url!)} className="flex items-center gap-2 text-gold hover:underline text-sm flex-1 min-w-0 truncate">
                    <FileText className="h-4 w-4 shrink-0" /> {d.label || d.file_url} <ExternalLink className="h-3 w-3" />
                  </button>
                ) : (
                  <a href={d.link_url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gold hover:underline text-sm flex-1 min-w-0 truncate">
                    <LinkIcon className="h-4 w-4 shrink-0" /> {d.label || d.link_url} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button onClick={() => removeDeliv.mutate(d.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 mb-2">
            <Input placeholder="Paste a link (Drive, Dropbox, etc.)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
            <Input placeholder="Label (optional)" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
            <Button variant="outline" disabled={!linkUrl.trim() || addLink.isPending} onClick={() => addLink.mutate()}>Add link</Button>
          </div>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer text-gold hover:underline">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload files"}
            <input type="file" multiple className="hidden" onChange={onFile} disabled={uploading} />
          </label>

          {task.agent_email && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <Button onClick={sendToAgent} className="bg-gold text-gold-foreground hover:bg-gold/90">
                <Send className="h-4 w-4 mr-1" /> Send to agent
              </Button>
              {task.deliverable_sent_at && (
                <span className="text-xs text-muted-foreground">
                  Sent {format(new Date(task.deliverable_sent_at), "PPP p")}
                </span>
              )}
            </div>
          )}
        </section>

        <ChatThread parentId={task.id} kind="task" />

        {isAdmin && (
          <DialogFooter className="pt-4 border-t border-border mt-4">
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this task?")) del.mutate(); }}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete task
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateTaskDialog({
  open, onOpenChange, profiles, projects, currentUserId, isAdmin, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profiles: any[];
  projects: Project[];
  currentUserId?: string;
  isAdmin: boolean;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<string>(isAdmin ? "none" : (currentUserId ?? "none"));
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [requestedByUser, setRequestedByUser] = useState<string>("none");
  const [requestedByName, setRequestedByName] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [intervalDays, setIntervalDays] = useState<number>(3);

  const reset = () => {
    setTitle(""); setOwner(isAdmin ? "none" : (currentUserId ?? "none"));
    setDueDate(""); setPriority("normal"); setDescription("");
    setProjectId("none"); setRequestedByUser("none"); setRequestedByName("");
    setRecurring(false); setFrequency("weekly"); setDayOfWeek(1);
    setDayOfMonth(1); setIntervalDays(3);
  };

  const create = useMutation({
    mutationFn: async () => {
      const resolvedOwner = owner === "none" ? null : owner;
      const resolvedProject = projectId === "none" ? null : projectId;
      const resolvedReqUser = requestedByUser === "none" ? null : requestedByUser;
      const resolvedReqName = requestedByName.trim() || null;
      if (recurring) {
        const dow = frequency === "weekly" || frequency === "biweekly" ? dayOfWeek : null;
        const dom = frequency === "monthly" ? dayOfMonth : null;
        const interval = frequency === "custom" ? intervalDays : null;
        const nextDue = computeInitialNextDue(frequency, dow, dom);
        const { error } = await sb.from("recurring_task_templates").insert({
          title: title.trim(),
          description: description.trim() || null,
          owner: resolvedOwner,
          priority,
          frequency,
          day_of_week: dow,
          day_of_month: dom,
          interval_days: interval,
          next_due_on: nextDue,
          active: true,
          created_by: currentUserId,
        });
        if (error) throw error;
      } else {
        const { error } = await sb.from("tasks").insert({
          title: title.trim(),
          owner: resolvedOwner,
          due_date: dueDate || null,
          priority,
          description: description.trim() || null,
          created_by: currentUserId,
          project_id: resolvedProject,
          requested_by_user_id: resolvedReqUser,
          requested_by_name: resolvedReqName,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(recurring ? "Recurring task created" : "Task created");
      onCreated();
      onOpenChange(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{recurring ? "New Recurring Task" : "New Task"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Owner</Label>
              {isAdmin ? (
                <Select value={owner} onValueChange={setOwner}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{nameOf(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground border border-border rounded-md px-3 py-2">
                  Assigned to you
                </div>
              )}
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1 select-none">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="h-4 w-4 accent-gold"
            />
            <span className="text-sm font-medium flex items-center gap-1.5">
              <Repeat className="h-4 w-4 text-gold" /> Make this a recurring task
            </span>
          </label>

          {recurring ? (
            <div className="space-y-3 p-3 border border-gold/30 bg-gold/5 rounded-md">
              <div>
                <Label>Repeat</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
                      <SelectItem key={f} value={f}>{FREQUENCY_LABEL[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(frequency === "weekly" || frequency === "biweekly") && (
                <div>
                  <Label>Day of week</Label>
                  <Select value={String(dayOfWeek)} onValueChange={(v) => setDayOfWeek(parseInt(v, 10))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {frequency === "monthly" && (
                <div>
                  <Label>Day of month</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))}
                  />
                </div>
              )}
              {frequency === "custom" && (
                <div>
                  <Label>Every N days</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1)))}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                A new task will be generated each {describeSchedule({ frequency, day_of_week: dayOfWeek, day_of_month: dayOfMonth, interval_days: intervalDays }).toLowerCase()}, starting {computeInitialNextDue(frequency, frequency === "weekly" || frequency === "biweekly" ? dayOfWeek : null, frequency === "monthly" ? dayOfMonth : null)}.
              </p>
            </div>
          ) : (
            <div>
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          )}

          {!recurring && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Project</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Uncategorized</SelectItem>
                      {projects.filter((p) => !p.archived).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Requested by (system user)</Label>
                  <Select value={requestedByUser} onValueChange={setRequestedByUser}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{nameOf(p)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Or requested by (other)</Label>
                <Input
                  value={requestedByName}
                  onChange={(e) => setRequestedByName(e.target.value)}
                  placeholder="Name (use if not a system user)"
                />
              </div>
            </>
          )}

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate()} className="bg-gold text-gold-foreground hover:bg-gold/90">
            {recurring ? "Create recurring task" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecurringTemplatesList({
  templates, profiles, isAdmin, currentUserId, onChanged,
}: {
  templates: RecurringTemplate[];
  profiles: any[];
  isAdmin: boolean;
  currentUserId?: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<RecurringTemplate | null>(null);
  const profileById = (id: string | null) => (id ? profiles.find((p) => p.id === id) : null);

  const visible = templates.filter((t) =>
    isAdmin || t.owner === currentUserId || t.created_by === currentUserId,
  );

  const toggleActive = useMutation({
    mutationFn: async (t: RecurringTemplate) => {
      const { error } = await sb.from("recurring_task_templates").update({ active: !t.active }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => { onChanged(); toast.success("Updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("recurring_task_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { onChanged(); toast.success("Recurring task stopped"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (visible.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-12 border border-dashed border-border rounded-lg">
        No recurring tasks yet. Use New Task and toggle "Make this a recurring task".
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {visible.map((t) => {
          const owner = profileById(t.owner);
          return (
            <div key={t.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Repeat className="h-3.5 w-3.5 text-gold" />
                    <span className="font-medium truncate">{t.title}</span>
                    <Badge variant="outline" className={PRIORITY_CLASS[t.priority]}>{t.priority}</Badge>
                    <Badge variant="outline" className={t.active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground border-border"}>
                      {t.active ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {describeSchedule(t)} · {owner ? `Owner: ${nameOf(owner)}` : "Unassigned"}
                    {t.active && (<> · Next: {t.next_due_on}</>)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => toggleActive.mutate(t)} title={t.active ? "Pause" : "Resume"}>
                    {t.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(t)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => { if (confirm("Stop this recurring task? Past instances will remain.")) del.mutate(t.id); }}
                    title="Stop"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <EditTemplateDialog
          template={editing}
          profiles={profiles}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
    </>
  );
}

function EditTemplateDialog({
  template, profiles, isAdmin, onClose, onSaved,
}: {
  template: RecurringTemplate;
  profiles: any[];
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(template.title);
  const [description, setDescription] = useState(template.description ?? "");
  const [owner, setOwner] = useState<string>(template.owner ?? "none");
  const [priority, setPriority] = useState<TaskPriority>(template.priority);
  const [frequency, setFrequency] = useState<Frequency>(template.frequency);
  const [dayOfWeek, setDayOfWeek] = useState<number>(template.day_of_week ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState<number>(template.day_of_month ?? 1);
  const [intervalDays, setIntervalDays] = useState<number>(template.interval_days ?? 3);

  const save = useMutation({
    mutationFn: async () => {
      const dow = frequency === "weekly" || frequency === "biweekly" ? dayOfWeek : null;
      const dom = frequency === "monthly" ? dayOfMonth : null;
      const interval = frequency === "custom" ? intervalDays : null;
      // Recompute next_due_on only if the schedule changed
      const scheduleChanged = frequency !== template.frequency
        || dow !== template.day_of_week
        || dom !== template.day_of_month
        || interval !== template.interval_days;
      const patch: any = {
        title: title.trim(),
        description: description.trim() || null,
        owner: owner === "none" ? null : owner,
        priority,
        frequency,
        day_of_week: dow,
        day_of_month: dom,
        interval_days: interval,
      };
      if (scheduleChanged) patch.next_due_on = computeInitialNextDue(frequency, dow, dom);
      const { error } = await sb.from("recurring_task_templates").update(patch).eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit recurring task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Owner</Label>
              {isAdmin ? (
                <Select value={owner} onValueChange={setOwner}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{nameOf(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground border border-border rounded-md px-3 py-2">
                  {template.owner ? nameOf(profiles.find((p) => p.id === template.owner)) : "Unassigned"}
                </div>
              )}
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-3 border border-gold/30 bg-gold/5 rounded-md space-y-3">
            <div>
              <Label>Repeat</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
                    <SelectItem key={f} value={f}>{FREQUENCY_LABEL[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(frequency === "weekly" || frequency === "biweekly") && (
              <div>
                <Label>Day of week</Label>
                <Select value={String(dayOfWeek)} onValueChange={(v) => setDayOfWeek(parseInt(v, 10))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {frequency === "monthly" && (
              <div>
                <Label>Day of month</Label>
                <Input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))} />
              </div>
            )}
            {frequency === "custom" && (
              <div>
                <Label>Every N days</Label>
                <Input type="number" min={1} max={365} value={intervalDays} onChange={(e) => setIntervalDays(Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1)))} />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Edits apply to future instances only. Past completed tasks are preserved.
            </p>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!title.trim() || save.isPending} onClick={() => save.mutate()} className="bg-gold text-gold-foreground hover:bg-gold/90">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewProjectDialog({
  open, onOpenChange, currentUserId, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentUserId?: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("projects").insert({
        name: name.trim(),
        description: description.trim() || null,
        owner: currentUserId ?? null,
        created_by: currentUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project created");
      onCreated();
      onOpenChange(false);
      setName(""); setDescription("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Matt — misc, Fall campaign" />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDetailDialog({
  projectId, onClose, projects, tasks, profiles, onOpenTask, isAdmin, currentUserId, onChanged,
}: {
  projectId: string | null;
  onClose: () => void;
  projects: Project[];
  tasks: Task[];
  profiles: any[];
  onOpenTask: (id: string) => void;
  isAdmin: boolean;
  currentUserId?: string;
  onChanged: () => void;
}) {
  const project = projectId ? projects.find((p) => p.id === projectId) ?? null : null;
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [qTitle, setQTitle] = useState("");
  const [qOwner, setQOwner] = useState<string>("__me__");
  const [qNote, setQNote] = useState("");

  const [privNotes, setPrivNotes] = useState("");
  const [privNotesLoaded, setPrivNotesLoaded] = useState(false);
  const [privNotesDirty, setPrivNotesDirty] = useState(false);

  useEffect(() => {
    if (project) { setName(project.name); setDescription(project.description ?? ""); setEditing(false); }
  }, [project?.id]);

  useEffect(() => {
    let cancelled = false;
    setPrivNotesLoaded(false);
    setPrivNotesDirty(false);
    setPrivNotes("");
    if (!project || !currentUserId) return;
    (async () => {
      const { data } = await sb
        .from("project_private_notes")
        .select("notes")
        .eq("project_id", project.id)
        .eq("user_id", currentUserId)
        .maybeSingle();
      if (cancelled) return;
      setPrivNotes(data?.notes ?? "");
      setPrivNotesLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [project?.id, currentUserId]);

  const quickAdd = useMutation({
    mutationFn: async () => {
      const owner = qOwner === "__me__" ? currentUserId : qOwner;
      const { error } = await sb.from("tasks").insert({
        title: qTitle.trim(),
        owner,
        priority: "normal",
        status: "todo",
        description: qNote.trim() || null,
        created_by: currentUserId,
        project_id: project!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(qOwner === "__me__" ? "Task added" : "Task delegated");
      setQTitle(""); setQNote(""); setQOwner("__me__");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const savePrivNotes = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("project_private_notes").upsert({
        project_id: project!.id,
        user_id: currentUserId,
        notes: privNotes,
      }, { onConflict: "project_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Private notes saved"); setPrivNotesDirty(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const projectTasks = useMemo(
    () => {
      if (!project) return [];
      const list = tasks.filter((t) => t.project_id === project.id);
      return list.slice().sort((a, b) => {
        const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return (a.created_at ?? "").localeCompare(b.created_at ?? "");
      });
    },
    [tasks, project?.id],
  );

  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  useEffect(() => { setLocalOrder(null); }, [project?.id, projectTasks.length]);
  const orderedTasks = useMemo(() => {
    if (!localOrder) return projectTasks;
    const byId = new Map(projectTasks.map((t) => [t.id, t]));
    return localOrder.map((id) => byId.get(id)).filter(Boolean) as Task[];
  }, [localOrder, projectTasks]);

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id, idx) => sb.from("tasks").update({ sort_order: idx }).eq("id", id)),
      );
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = orderedTasks.map((t) => t.id);
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(ids, oldIdx, newIdx);
    setLocalOrder(next);
    reorder.mutate(next);
  };

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("projects").update({
        name: name.trim(),
        description: description.trim() || null,
      }).eq("id", project!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Project updated"); setEditing(false); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("projects").update({ archived: !project!.archived }).eq("id", project!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(project!.archived ? "Project restored" : "Project archived"); onChanged(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("projects").delete().eq("id", project!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Project deleted"); onChanged(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!project) return null;

  const done = projectTasks.filter((t) => t.status === "complete").length;
  const today = new Date().toISOString().slice(0, 10);
  const profileById = (id: string | null) => (id ? profiles.find((p) => p.id === id) : null);

  const canEdit = isAdmin || project.owner === currentUserId || project.created_by === currentUserId;

  return (
    <Dialog open={!!project} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-gold" />
            {editing ? (
              <Input value={name} onChange={(e) => setName(e.target.value)} className="text-lg font-semibold" />
            ) : (
              <span>{project.name}</span>
            )}
            <span className="text-xs text-gold ml-2">{done} of {projectTasks.length} done</span>
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4">
          {editing ? (
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Description" />
          ) : (
            project.description && <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>

        <div className="mb-4">
          {orderedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
              No tasks in this project yet.
            </p>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Drag <GripVertical className="h-3 w-3 inline" /> to reorder
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {orderedTasks.map((t) => (
                      <SortableProjectTaskRow
                        key={t.id}
                        task={t}
                        owner={profileById(t.owner)}
                        today={today}
                        onOpen={() => onOpenTask(t.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>


        {/* Quick add task to this project */}
        <div className="mb-4 rounded-md border border-border bg-muted/20 p-3 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add task to this project
          </div>
          <Input
            value={qTitle}
            onChange={(e) => setQTitle(e.target.value)}
            placeholder="Task title…"
          />
          <div className="flex gap-2 flex-wrap">
            <Select value={qOwner} onValueChange={setQOwner}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Assign to…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__me__">Me (keep)</SelectItem>
                {profiles
                  .filter((p) => p.id !== currentUserId)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>Delegate to {nameOf(p)}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!qTitle.trim() || quickAdd.isPending}
              onClick={() => quickAdd.mutate()}
              className="bg-gold text-gold-foreground hover:bg-gold/90"
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <Textarea
            value={qNote}
            onChange={(e) => setQNote(e.target.value)}
            rows={2}
            placeholder={qOwner === "__me__" ? "Optional notes…" : "Notes / context for the person you're delegating to…"}
          />
        </div>

        {/* Private notes (only this user can see) */}
        <div className="mb-4 rounded-md border border-gold/30 bg-gold/5 p-3 space-y-2">
          <div className="text-xs uppercase tracking-wider text-gold flex items-center justify-between">
            <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> My private notes</span>
            <span className="text-[10px] normal-case tracking-normal text-muted-foreground">Only you can see this</span>
          </div>
          <Textarea
            value={privNotes}
            onChange={(e) => { setPrivNotes(e.target.value); setPrivNotesDirty(true); }}
            rows={4}
            placeholder={privNotesLoaded ? "Jot down anything just for you about this project…" : "Loading…"}
            disabled={!privNotesLoaded}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!privNotesDirty || savePrivNotes.isPending}
              onClick={() => savePrivNotes.mutate()}
            >
              {savePrivNotes.isPending ? "Saving…" : privNotesDirty ? "Save notes" : "Saved"}
            </Button>
          </div>
        </div>


        {canEdit && (
          <DialogFooter className="pt-4 border-t border-border gap-2 flex-wrap">
            {editing ? (
              <>
                <Button variant="outline" onClick={() => { setEditing(false); setName(project.name); setDescription(project.description ?? ""); }}>Cancel</Button>
                <Button disabled={!name.trim() || update.isPending} onClick={() => update.mutate()} className="bg-gold text-gold-foreground hover:bg-gold/90">Save</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
                <Button variant="outline" onClick={() => archive.mutate()}>
                  {project.archived ? "Restore" : "Archive"}
                </Button>
                {isAdmin && (
                  <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this project? Tasks will be uncategorized.")) del.mutate(); }}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SortableProjectTaskRow({
  task, owner, today, onOpen,
}: {
  task: Task;
  owner: any;
  today: string;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const overdue = task.due_date && task.due_date < today && task.status !== "complete";
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-stretch gap-2 bg-muted/30 hover:bg-muted/50 border border-border hover:border-gold/40 rounded-md transition-colors"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="px-2 flex items-center text-muted-foreground hover:text-gold cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" onClick={onOpen} className="flex-1 text-left py-3 pr-3 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{task.title}</span>
          <Badge variant="outline" className={STATUS_CLASS[task.status]}>{STATUS_LABEL[task.status]}</Badge>
          <Badge variant="outline" className={PRIORITY_CLASS[task.priority]}>{task.priority}</Badge>
          {task.starred && <Star className="h-3.5 w-3.5 text-gold fill-current" />}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {owner ? `Owner: ${nameOf(owner)}` : "Unassigned"}
          {task.due_date && (
            <> · <span className={overdue ? "text-destructive font-medium" : ""}>Due {task.due_date}{overdue ? " (overdue)" : ""}</span></>
          )}
        </div>
      </button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}
