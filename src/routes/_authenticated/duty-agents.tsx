import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Sparkles,
  CalendarDays,
  CalendarClock,
  Search,
  CheckCircle2,
  FileText,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  listDutyAgents,
  upsertDutyAgent,
  deleteDutyAgent,
  bulkImportDutyAgents,
  listToolboxAgentsForDuty,
  importToolboxAgentsToDuty,
  submitAvailability,
  deleteAvailability,
  listAvailabilityForAgent,
} from "@/lib/duty-calendar.functions";

export const Route = createFileRoute("/_authenticated/duty-agents")({
  component: DutyAgentsPage,
  head: () => ({ meta: [{ title: "Duty Agents — MSREG Hub" }] }),
});

const OFFICES = [
  { value: "rolla", label: "Rolla" },
  { value: "str", label: "St. Robert" },
  { value: "loz", label: "Lake of the Ozarks" },
] as const;

function officeLabel(v: string) {
  return OFFICES.find((o) => o.value === v)?.label ?? v;
}

function parseOffice(raw: string): "rolla" | "str" | "loz" | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s === "rolla") return "rolla";
  if (s === "lake" || s.includes("lake") || s === "loz" || s.includes("ozark")) return "loz";
  if (s.includes("robert") || s === "str" || s === "st robert" || s === "st. robert") return "str";
  return null;
}

function formatDate(iso: string) {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function DutyAgentsPage() {
  const navigate = useNavigate();
  const { isAdmin, roles, loading } = useAuth();
  const isAllowed = isAdmin || roles.includes("client_care");

  useEffect(() => {
    if (!loading && !isAllowed) navigate({ to: "/dashboard", replace: true });
  }, [loading, isAllowed, navigate]);

  const qc = useQueryClient();
  const list = useServerFn(listDutyAgents);
  const save = useServerFn(upsertDutyAgent);
  const remove = useServerFn(deleteDutyAgent);
  const bulk = useServerFn(bulkImportDutyAgents);
  const listToolbox = useServerFn(listToolboxAgentsForDuty);
  const importToolbox = useServerFn(importToolboxAgentsToDuty);
  const saveOoo = useServerFn(submitAvailability);
  const deleteOoo = useServerFn(deleteAvailability);
  const listOooForAgent = useServerFn(listAvailabilityForAgent);

  const agentsQ = useQuery({
    queryKey: ["duty-agents"],
    queryFn: () => list(),
    enabled: isAllowed,
  });

  // State for Add / Edit modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [office, setOffice] = useState<"rolla" | "str" | "loz">("rolla");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState<"all" | "rolla" | "str" | "loz">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"office" | "name" | "ooo">("office");

  // Bulk import dialog state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  // Marketing Toolbox pull dialog state
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const [toolboxSearch, setToolboxSearch] = useState("");
  const [toolboxFilter, setToolboxFilter] = useState<"not_in_duty" | "all" | "in_duty">("not_in_duty");
  const [selectedToolboxIds, setSelectedToolboxIds] = useState<string[]>([]);
  const [batchOffice, setBatchOffice] = useState<"rolla" | "str" | "loz">("rolla");

  // Manage No-Go Days modal state
  const [oooAgent, setOooAgent] = useState<any | null>(null);
  const [oooMode, setOooMode] = useState<"single" | "range">("single");
  const [oooStartDate, setOooStartDate] = useState("");
  const [oooEndDate, setOooEndDate] = useState("");
  const [oooReason, setOooReason] = useState<"vacation" | "sick" | "personal" | "other">("vacation");
  const [oooNote, setOooNote] = useState("");

  const toolboxQ = useQuery({
    queryKey: ["duty-toolbox-agents"],
    queryFn: () => listToolbox(),
    enabled: isAllowed && toolboxOpen,
  });

  const agentOooQ = useQuery({
    queryKey: ["agent-ooo-list", oooAgent?.id],
    queryFn: () => listOooForAgent({ data: { agent_id: oooAgent.id } }),
    enabled: !!oooAgent?.id,
  });

  function openNew() {
    setEditing(null);
    setName("");
    setOffice("rolla");
    setStatus("active");
    setEmail("");
    setNotes("");
    setOpen(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    setName(row.name);
    setOffice(row.office);
    setStatus(row.status);
    setEmail(row.email ?? "");
    setNotes(row.notes ?? "");
    setOpen(true);
  }

  function openManageOoo(agent: any) {
    setOooAgent(agent);
    const today = new Date().toISOString().slice(0, 10);
    setOooStartDate(today);
    setOooEndDate(today);
    setOooMode("single");
    setOooReason("vacation");
    setOooNote("");
  }

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: editing?.id,
          name: name.trim(),
          office,
          status,
          email: email.trim() || null,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(editing ? "Agent updated" : "Agent added to duty roster");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["duty-agents"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save agent"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Agent removed from duty roster");
      qc.invalidateQueries({ queryKey: ["duty-agents"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove agent"),
  });

  const addOooMut = useMutation({
    mutationFn: () => {
      if (!oooAgent) throw new Error("No agent selected");
      const end = oooMode === "single" ? oooStartDate : oooEndDate;
      if (end < oooStartDate) throw new Error("End date must be on or after start date");
      return saveOoo({
        data: {
          agent_id: oooAgent.id,
          date_start: oooStartDate,
          date_end: end,
          reason: oooReason,
          note: oooNote.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("No-go day recorded");
      setOooNote("");
      qc.invalidateQueries({ queryKey: ["agent-ooo-list", oooAgent?.id] });
      qc.invalidateQueries({ queryKey: ["duty-agents"] });
      qc.invalidateQueries({ queryKey: ["duty-calendar"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to record no-go day"),
  });

  const deleteOooMut = useMutation({
    mutationFn: (id: string) => deleteOoo({ data: { id } }),
    onSuccess: () => {
      toast.success("No-go day removed");
      qc.invalidateQueries({ queryKey: ["agent-ooo-list", oooAgent?.id] });
      qc.invalidateQueries({ queryKey: ["duty-agents"] });
      qc.invalidateQueries({ queryKey: ["duty-calendar"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete no-go day"),
  });

  const importToolboxMut = useMutation({
    mutationFn: (agentsToImport: Array<{
      toolbox_agent_id: string;
      name: string;
      email?: string | null;
      office: "rolla" | "str" | "loz";
      notes?: string | null;
    }>) => importToolbox({ data: { agents: agentsToImport } }),
    onSuccess: (res: any) => {
      toast.success(
        `Imported ${res.imported} agent(s)${res.updated ? `, updated ${res.updated}` : ""}`,
      );
      setSelectedToolboxIds([]);
      setToolboxOpen(false);
      qc.invalidateQueries({ queryKey: ["duty-agents"] });
      qc.invalidateQueries({ queryKey: ["duty-toolbox-agents"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to pull agents from toolbox"),
  });

  const parsedRows = useMemo(() => {
    const rows: Array<{ name: string; office: "rolla" | "str" | "loz" }> = [];
    const errors: string[] = [];
    bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line, idx) => {
        const parts = line.split(",");
        if (parts.length < 2) {
          errors.push(`Line ${idx + 1}: missing office`);
          return;
        }
        const nm = parts[0].trim();
        const off = parseOffice(parts.slice(1).join(",").trim());
        if (!nm) {
          errors.push(`Line ${idx + 1}: missing name`);
          return;
        }
        if (!off) {
          errors.push(`Line ${idx + 1}: office must be Rolla, St. Robert, or Lake`);
          return;
        }
        rows.push({ name: nm, office: off });
      });
    return { rows, errors };
  }, [bulkText]);

  const bulkMut = useMutation({
    mutationFn: () => bulk({ data: { rows: parsedRows.rows } }),
    onSuccess: (res: any) => {
      toast.success(
        `Imported ${res.inserted} agent${res.inserted === 1 ? "" : "s"}${res.skipped ? ` (${res.skipped} skipped)` : ""}`,
      );
      setBulkOpen(false);
      setBulkText("");
      qc.invalidateQueries({ queryKey: ["duty-agents"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  // Filtered and sorted duty agents
  const rows = useMemo(() => {
    let list = (agentsQ.data ?? []).slice();

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (a: any) =>
          a.name.toLowerCase().includes(q) ||
          (a.email && a.email.toLowerCase().includes(q)) ||
          (a.notes && a.notes.toLowerCase().includes(q)),
      );
    }

    if (officeFilter !== "all") {
      list = list.filter((a: any) => a.office === officeFilter);
    }

    if (statusFilter !== "all") {
      list = list.filter((a: any) => a.status === statusFilter);
    }

    list.sort((a: any, b: any) => {
      if (sortBy === "office") {
        return a.office.localeCompare(b.office) || a.name.localeCompare(b.name);
      }
      if (sortBy === "ooo") {
        return (b.upcoming_ooo_count ?? 0) - (a.upcoming_ooo_count ?? 0) || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [agentsQ.data, search, officeFilter, statusFilter, sortBy]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { rolla: 0, str: 0, loz: 0, totalActive: 0 };
    for (const a of agentsQ.data ?? []) {
      if (a.status === "active") {
        out[a.office] = (out[a.office] ?? 0) + 1;
        out.totalActive++;
      }
    }
    return out;
  }, [agentsQ.data]);

  // Filtered toolbox agents for the pull modal
  const filteredToolboxAgents = useMemo(() => {
    let list = (toolboxQ.data ?? []).slice();
    if (toolboxSearch.trim()) {
      const q = toolboxSearch.toLowerCase().trim();
      list = list.filter(
        (t: any) =>
          t.name.toLowerCase().includes(q) || (t.email && t.email.toLowerCase().includes(q)),
      );
    }
    if (toolboxFilter === "not_in_duty") {
      list = list.filter((t: any) => !t.is_in_duty);
    } else if (toolboxFilter === "in_duty") {
      list = list.filter((t: any) => t.is_in_duty);
    }
    return list;
  }, [toolboxQ.data, toolboxSearch, toolboxFilter]);

  if (!isAllowed) return null;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Banner / Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-border/40">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-gold" />
              Duty Agents Roster
            </h1>
            <Badge variant="outline" className="border-gold/30 text-gold bg-gold/10 font-medium">
              Internal Only
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span>Rolla: <strong className="text-foreground">{counts.rolla}</strong> active</span>
            <span>·</span>
            <span>St. Robert: <strong className="text-foreground">{counts.str}</strong> active</span>
            <span>·</span>
            <span>LOZ: <strong className="text-foreground">{counts.loz}</strong> active</span>
            <span>·</span>
            <span className="text-gold font-medium">Total: {counts.totalActive} active duty agents</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" asChild className="border-gold/30 hover:bg-gold/10">
            <Link to="/duty-calendar">
              <CalendarDays className="h-4 w-4 mr-1.5 text-gold" /> Duty Calendar
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => setToolboxOpen(true)}
            className="border-gold/40 text-gold hover:bg-gold/10"
          >
            <Sparkles className="h-4 w-4 mr-1.5" /> Pull from Marketing Toolbox
          </Button>
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Bulk Import
          </Button>
          <Button onClick={openNew} className="bg-gold text-navy hover:bg-gold/90 font-medium">
            <Plus className="h-4 w-4 mr-1.5" /> Add Agent
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents or AI notes..."
            className="pl-9 bg-card border-border/60"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Office:</Label>
          <Select value={officeFilter} onValueChange={(v) => setOfficeFilter(v as any)}>
            <SelectTrigger className="bg-card border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Offices</SelectItem>
              {OFFICES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Status:</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="bg-card border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Sort:</Label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="bg-card border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="office">Office Location</SelectItem>
              <SelectItem value="name">Agent Name</SelectItem>
              <SelectItem value="ooo">Most No-Go Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Roster Table */}
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-navy/60">
            <TableRow className="border-b border-border/40 hover:bg-transparent">
              <TableHead className="font-semibold text-foreground">Agent</TableHead>
              <TableHead className="font-semibold text-foreground">Office Location</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="font-semibold text-foreground">AI / Admin Notes</TableHead>
              <TableHead className="font-semibold text-foreground">No-Go Days (OOO)</TableHead>
              <TableHead className="w-40 text-right font-semibold text-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agentsQ.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Loading duty agents roster…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <div className="max-w-md mx-auto space-y-3">
                    <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                    <p className="font-medium text-foreground">No duty agents found.</p>
                    <p className="text-xs text-muted-foreground">
                      Pull agents directly from the Agent Marketing Toolbox or add them manually to get started.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setToolboxOpen(true)}
                      className="bg-gold text-navy hover:bg-gold/90 mt-2"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Pull from Marketing Toolbox
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((a: any) => {
                const oooCount = a.upcoming_ooo_count ?? 0;
                return (
                  <TableRow key={a.id} className="hover:bg-gold/5 border-b border-border/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-gold/30">
                          <AvatarFallback className="bg-navy text-gold text-xs font-semibold">
                            {a.name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-foreground leading-tight">{a.name}</div>
                          {a.email && (
                            <div className="text-xs text-muted-foreground">{a.email}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="border-gold/30 text-gold bg-gold/5 font-medium">
                        {officeLabel(a.office)}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={a.status === "active" ? "default" : "secondary"}
                        className={
                          a.status === "active"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {a.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="max-w-[240px]">
                      {a.notes?.trim() ? (
                        <div
                          className="flex items-start gap-1.5 text-xs text-muted-foreground line-clamp-2"
                          title={a.notes}
                        >
                          <FileText className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
                          <span className="truncate">{a.notes}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/40 italic">No notes</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openManageOoo(a)}
                        className={`h-7 px-2 text-xs flex items-center gap-1.5 ${
                          oooCount > 0
                            ? "text-amber-400 hover:text-amber-300 bg-amber-400/10 hover:bg-amber-400/20"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                        <span>
                          {oooCount === 0 ? "None logged" : `${oooCount} scheduled`}
                        </span>
                      </Button>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openManageOoo(a)}
                          title="Manage No-Go Days"
                          className="h-8 px-2 text-xs text-gold hover:bg-gold/10"
                        >
                          <CalendarClock className="h-4 w-4 mr-1" /> No-Go
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(a)}
                          title="Edit Agent & Notes"
                          className="h-8 w-8 hover:bg-gold/10"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Remove ${a.name} from the duty roster?`)) delMut.mutate(a.id);
                          }}
                          title="Remove Agent"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ───────────────── PULL FROM MARKETING TOOLBOX DIALOG ───────────────── */}
      <Dialog open={toolboxOpen} onOpenChange={setToolboxOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold" />
              Pull Agents from Marketing Toolbox
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Select agents from the Agent Marketing Toolbox and assign them to an office location.
              Not everyone participates in duty days, so choose only the agents you want in the rotation.
            </p>
          </DialogHeader>

          {/* Search & Tabs */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={toolboxSearch}
                  onChange={(e) => setToolboxSearch(e.target.value)}
                  placeholder="Search marketing toolbox agents..."
                  className="pl-9"
                />
              </div>

              <Tabs value={toolboxFilter} onValueChange={(v) => setToolboxFilter(v as any)}>
                <TabsList className="bg-navy/80 border border-gold/20">
                  <TabsTrigger value="not_in_duty">Not on Duty ({ (toolboxQ.data ?? []).filter((t: any) => !t.is_in_duty).length })</TabsTrigger>
                  <TabsTrigger value="all">All ({ (toolboxQ.data ?? []).length })</TabsTrigger>
                  <TabsTrigger value="in_duty">Already on Duty ({ (toolboxQ.data ?? []).filter((t: any) => t.is_in_duty).length })</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Batch actions bar */}
            {selectedToolboxIds.length > 0 && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-gold/10 border border-gold/30">
                <div className="text-xs font-medium text-gold">
                  {selectedToolboxIds.length} agent(s) selected
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Assign all to:</span>
                  <Select value={batchOffice} onValueChange={(v) => setBatchOffice(v as any)}>
                    <SelectTrigger className="w-36 h-8 text-xs bg-card">
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
                  <Button
                    size="sm"
                    className="h-8 bg-gold text-navy hover:bg-gold/90 font-medium"
                    disabled={importToolboxMut.isPending}
                    onClick={() => {
                      const targets = (toolboxQ.data ?? [])
                        .filter((t: any) => selectedToolboxIds.includes(t.id))
                        .map((t: any) => ({
                          toolbox_agent_id: t.id,
                          name: t.name,
                          email: t.email,
                          office: batchOffice,
                        }));
                      importToolboxMut.mutate(targets);
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    Pull Selected ({selectedToolboxIds.length})
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* List of toolbox agents */}
          <div className="flex-1 overflow-y-auto mt-3 border border-border/50 rounded-md divide-y divide-border/30 max-h-[420px]">
            {toolboxQ.isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading marketing toolbox agents…
              </div>
            ) : filteredToolboxAgents.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No matching agents found in marketing toolbox.
              </div>
            ) : (
              filteredToolboxAgents.map((agent: any) => {
                const isSelected = selectedToolboxIds.includes(agent.id);
                return (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between gap-3 p-3 hover:bg-gold/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {!agent.is_in_duty ? (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedToolboxIds((prev) => [...prev, agent.id]);
                            else setSelectedToolboxIds((prev) => prev.filter((id) => id !== agent.id));
                          }}
                        />
                      ) : (
                        <div className="w-4 h-4 flex items-center justify-center text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      )}

                      <Avatar className="h-9 w-9 border border-gold/30">
                        {agent.headshot_url && <AvatarImage src={agent.headshot_url} alt={agent.name} />}
                        <AvatarFallback className="bg-navy text-gold text-xs font-semibold">
                          {agent.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div>
                        <div className="text-sm font-medium text-foreground">{agent.name}</div>
                        {agent.email && (
                          <div className="text-xs text-muted-foreground">{agent.email}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {agent.is_in_duty ? (
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs"
                          >
                            <UserCheck className="h-3 w-3 mr-1" />
                            On Duty: {agent.assigned_offices.map(officeLabel).join(", ")}
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Select
                            defaultValue="rolla"
                            onValueChange={(val) => {
                              importToolboxMut.mutate([
                                {
                                  toolbox_agent_id: agent.id,
                                  name: agent.name,
                                  email: agent.email,
                                  office: val as any,
                                },
                              ]);
                            }}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs bg-card">
                              <SelectValue placeholder="Select Office" />
                            </SelectTrigger>
                            <SelectContent>
                              {OFFICES.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-gold/40 text-gold hover:bg-gold/10"
                            disabled={importToolboxMut.isPending}
                            onClick={() => {
                              importToolboxMut.mutate([
                                {
                                  toolbox_agent_id: agent.id,
                                  name: agent.name,
                                  email: agent.email,
                                  office: "rolla",
                                },
                              ]);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Pull in
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="mt-4 pt-3 border-t border-border/40 flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
              {filteredToolboxAgents.length} agents displayed
            </div>
            <Button variant="outline" onClick={() => setToolboxOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────── MANAGE NO-GO DAYS (OOO) MODAL ───────────────── */}
      <Dialog open={!!oooAgent} onOpenChange={(open) => !open && setOooAgent(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-amber-400" />
                No-Go Days: {oooAgent?.name}
              </span>
              {oooAgent && (
                <Badge variant="outline" className="border-gold/30 text-gold bg-gold/10 text-xs">
                  {officeLabel(oooAgent.office)}
                </Badge>
              )}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Manually add or remove days when this agent cannot work duty shifts.
              Claude will strictly skip these dates during automated scheduling.
              (If the agent fills out the upcoming availability sheet, it will automatically autofill here).
            </p>
          </DialogHeader>

          {/* Form to add a new No-Go day */}
          <div className="bg-navy/40 border border-gold/20 rounded-lg p-4 space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gold uppercase tracking-wider">
                Add Unavailable / No-Go Date
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  type="button"
                  variant={oooMode === "single" ? "default" : "ghost"}
                  onClick={() => {
                    setOooMode("single");
                    setOooEndDate(oooStartDate);
                  }}
                  className={`h-7 px-2.5 text-xs ${oooMode === "single" ? "bg-gold text-navy hover:bg-gold/90" : ""}`}
                >
                  Single Day
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={oooMode === "range" ? "default" : "ghost"}
                  onClick={() => setOooMode("range")}
                  className={`h-7 px-2.5 text-xs ${oooMode === "range" ? "bg-gold text-navy hover:bg-gold/90" : ""}`}
                >
                  Date Range
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">
                  {oooMode === "single" ? "Date" : "Start Date"}
                </Label>
                <Input
                  type="date"
                  value={oooStartDate}
                  onChange={(e) => {
                    setOooStartDate(e.target.value);
                    if (oooMode === "single") setOooEndDate(e.target.value);
                  }}
                  className="bg-card text-xs h-9 mt-1"
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
                    className="bg-card text-xs h-9 mt-1"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs">Reason</Label>
                <Select value={oooReason} onValueChange={(v) => setOooReason(v as any)}>
                  <SelectTrigger className="bg-card text-xs h-9 mt-1">
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
                <Label className="text-xs">Optional Note / Details</Label>
                <Input
                  value={oooNote}
                  onChange={(e) => setOooNote(e.target.value)}
                  placeholder="e.g. morning closing, surgery, out of town"
                  className="bg-card text-xs h-9 mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                className="bg-gold text-navy hover:bg-gold/90 text-xs font-semibold h-8"
                disabled={!oooStartDate || addOooMut.isPending}
                onClick={() => addOooMut.mutate()}
              >
                {addOooMut.isPending ? "Adding…" : "+ Record No-Go Days"}
              </Button>
            </div>
          </div>

          {/* List of currently recorded No-Go days */}
          <div className="flex-1 overflow-y-auto mt-4 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Scheduled No-Go Days ({ (agentOooQ.data ?? []).length })
            </div>

            {agentOooQ.isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Loading scheduled days…
              </div>
            ) : (agentOooQ.data ?? []).length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground bg-card/40 rounded-md border border-border/30">
                No unavailable days currently recorded for {oooAgent?.name}.
              </div>
            ) : (
              <div className="border border-border/40 rounded-md divide-y divide-border/30 max-h-[220px] overflow-y-auto">
                {(agentOooQ.data ?? []).map((item: any) => {
                  const isRange = item.date_start !== item.date_end;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-2.5 text-xs hover:bg-card/60 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>
                            {formatDate(item.date_start)}
                            {isRange && ` – ${formatDate(item.date_end)}`}
                          </span>
                          <Badge variant="outline" className="text-[10px] capitalize py-0 px-1.5 border-amber-400/30 text-amber-300 bg-amber-400/10">
                            {item.reason ?? "unavailable"}
                          </Badge>
                        </div>
                        {item.note && (
                          <div className="text-[11px] text-muted-foreground italic">
                            "{item.note}"
                          </div>
                        )}
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteOooMut.mutate(item.id)}
                        disabled={deleteOooMut.isPending}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        title="Remove this no-go entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="mt-3 pt-3 border-t border-border/40">
            <Button variant="outline" onClick={() => setOooAgent(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────── ADD / EDIT AGENT DIALOG ───────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Duty Agent" : "Add Agent to Duty Roster"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <Label className="text-xs">Agent Full Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shawn McArthur"
                autoFocus
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Office Location</Label>
                <Select value={office} onValueChange={(v) => setOffice(v as any)}>
                  <SelectTrigger className="mt-1">
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

              <div>
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active (On Schedule)</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Email Address (Optional)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@mattsmithrealestategroup.com"
                className="mt-1"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-gold" />
                  AI & Admin Scheduling Notes
                </Label>
                <span className="text-[10px] text-muted-foreground">Sent to Claude AI</span>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Specific context for Claude AI (e.g., 'Cannot work on Saturdays', 'Only available Tuesdays & Thursdays', 'New agent - limit to 1 shift per month', 'Prefers early month shifts')..."
                className="min-h-[85px] mt-1 text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Claude uses these notes when balancing and generating monthly duty day assignments.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-navy hover:bg-gold/90 font-medium"
              disabled={!name.trim() || saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              {saveMut.isPending ? "Saving…" : editing ? "Save Changes" : "Add Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────── BULK IMPORT DIALOG ───────────────── */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Duty Agents</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Paste one agent per line as <code className="text-gold">Name, Office</code>. Office
              must be Rolla, St. Robert, or Lake. Existing agents in the same office are skipped.
            </div>
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={
                "Shawn McArthur, St. Robert\nJoseph Bahr, St. Robert\nTasha McBride, Rolla"
              }
              className="min-h-[200px] font-mono text-sm"
            />
            <div className="text-xs text-muted-foreground">
              {parsedRows.rows.length} valid row{parsedRows.rows.length === 1 ? "" : "s"} ready
              {parsedRows.errors.length > 0 && (
                <div className="text-destructive mt-1">
                  {parsedRows.errors.slice(0, 5).map((er, i) => (
                    <div key={i}>{er}</div>
                  ))}
                  {parsedRows.errors.length > 5 && (
                    <div>…and {parsedRows.errors.length - 5} more</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-navy hover:bg-gold/90"
              disabled={parsedRows.rows.length === 0 || bulkMut.isPending}
              onClick={() => bulkMut.mutate()}
            >
              {bulkMut.isPending ? "Importing…" : `Import ${parsedRows.rows.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
