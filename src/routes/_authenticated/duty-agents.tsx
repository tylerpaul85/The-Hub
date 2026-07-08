import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  listDutyAgents,
  upsertDutyAgent,
  deleteDutyAgent,
  bulkImportDutyAgents,
} from "@/lib/duty-calendar.functions";

export const Route = createFileRoute("/_authenticated/duty-agents")({
  component: DutyAgentsPage,
  head: () => ({ meta: [{ title: "Duty Agents — MSREG" }] }),
});

const OFFICES = [
  { value: "rolla", label: "Rolla" },
  { value: "str", label: "St. Robert" },
  { value: "loz", label: "Lake of the Ozarks" },
] as const;
function officeLabel(v: string) {
  return OFFICES.find((o) => o.value === v)?.label ?? v;
}

// Parse a free-text office tag into our enum.
function parseOffice(raw: string): "rolla" | "str" | "loz" | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s === "rolla") return "rolla";
  if (s === "lake" || s.includes("lake") || s === "loz" || s.includes("ozark")) return "loz";
  if (s.includes("robert") || s === "str" || s === "st robert" || s === "st. robert") return "str";
  return null;
}

function DutyAgentsPage() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [loading, isAdmin, navigate]);

  const qc = useQueryClient();
  const list = useServerFn(listDutyAgents);
  const save = useServerFn(upsertDutyAgent);
  const remove = useServerFn(deleteDutyAgent);
  const bulk = useServerFn(bulkImportDutyAgents);

  const agentsQ = useQuery({ queryKey: ["duty-agents"], queryFn: () => list(), enabled: isAdmin });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [office, setOffice] = useState<"rolla" | "str" | "loz">("rolla");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [sortBy, setSortBy] = useState<"office" | "name">("office");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  // Bulk import dialog state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  function openNew() {
    setEditing(null);
    setName("");
    setOffice("rolla");
    setStatus("active");
    setOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setName(row.name);
    setOffice(row.office);
    setStatus(row.status);
    setOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: editing?.id,
          name: name.trim(),
          office,
          status,
        },
      }),
    onSuccess: () => {
      toast.success(editing ? "Agent updated" : "Agent added");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["duty-agents"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Agent removed");
      qc.invalidateQueries({ queryKey: ["duty-agents"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
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
      toast.success(`Imported ${res.inserted} agent${res.inserted === 1 ? "" : "s"}${res.skipped ? ` (${res.skipped} skipped)` : ""}`);
      setBulkOpen(false);
      setBulkText("");
      qc.invalidateQueries({ queryKey: ["duty-agents"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const rows = useMemo(() => {
    const list = (agentsQ.data ?? []).filter((a: any) => filter === "all" || a.status === filter);
    list.sort((a: any, b: any) => {
      if (sortBy === "office") return a.office.localeCompare(b.office) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [agentsQ.data, sortBy, filter]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { rolla: 0, str: 0, loz: 0 };
    for (const a of agentsQ.data ?? []) if (a.status === "active") out[a.office] = (out[a.office] ?? 0) + 1;
    return out;
  }, [agentsQ.data]);

  if (!isAdmin) return null;

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6 text-gold" />
            Duty Agents
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rolla: {counts.rolla} agents · St. Robert: {counts.str} agents · LOZ: {counts.loz} agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Bulk Import
          </Button>
          <Button onClick={openNew} className="bg-gold text-navy hover:bg-gold/90">
            <Plus className="h-4 w-4 mr-1" /> Add Agent
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="text-sm text-muted-foreground">Sort:</div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="office">Office</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground ml-2">Status:</div>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent Name</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agentsQ.isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-muted-foreground">No agents yet.</TableCell></TableRow>
            ) : (
              rows.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{officeLabel(a.office)}</TableCell>
                  <TableCell>
                    <Badge variant={a.status === "active" ? "default" : "secondary"} className={a.status === "active" ? "bg-gold/20 text-gold border-gold/30" : ""}>
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Remove ${a.name} from the duty roster?`)) delMut.mutate(a.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Agent" : "Add Agent"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Agent Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                autoFocus
              />
            </div>
            <div>
              <Label>Office</Label>
              <Select value={office} onValueChange={(v) => setOffice(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OFFICES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="bg-gold text-navy hover:bg-gold/90"
              disabled={!name.trim() || saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              {saveMut.isPending ? "Saving…" : editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk import dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Agents</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Paste one agent per line as <code className="text-gold">Name, Office</code>. Office must be
              Rolla, St. Robert, or Lake. Existing names in the same office are skipped.
            </div>
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"Shawn McArthur, St. Robert\nJoseph Bahr, St. Robert\nTasha McBride, Rolla"}
              className="min-h-[200px] font-mono text-sm"
            />
            <div className="text-xs text-muted-foreground">
              {parsedRows.rows.length} valid row{parsedRows.rows.length === 1 ? "" : "s"} ready
              {parsedRows.errors.length > 0 && (
                <div className="text-destructive mt-1">
                  {parsedRows.errors.slice(0, 5).map((er, i) => <div key={i}>{er}</div>)}
                  {parsedRows.errors.length > 5 && <div>…and {parsedRows.errors.length - 5} more</div>}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
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
