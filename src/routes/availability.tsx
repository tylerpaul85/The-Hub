import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import logo from "@/assets/msreg-logo.png";
import {
  publicListActiveAgents,
  publicListAvailability,
  publicSubmitAvailability,
  publicDeleteAvailability,
} from "@/lib/agent-availability.functions";

export const Route = createFileRoute("/availability")({
  ssr: false,
  component: PublicAvailabilityPage,
  head: () => ({
    meta: [
      { title: "Submit Availability — MSREG" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const REASONS = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" },
] as const;

const OFFICES = [
  { value: "all", label: "All Offices" },
  { value: "rolla", label: "Rolla" },
  { value: "str", label: "St. Robert" },
  { value: "loz", label: "Lake of the Ozarks" },
] as const;

const STORAGE_KEY = "msreg-availability-selected-agent";

function PublicAvailabilityPage() {
  const qc = useQueryClient();
  const allAgents = useServerFn(publicListActiveAgents);
  const listForAgent = useServerFn(publicListAvailability);
  const save = useServerFn(publicSubmitAvailability);
  const remove = useServerFn(publicDeleteAvailability);

  const agentsQ = useQuery({ queryKey: ["pub-duty-agents"], queryFn: () => allAgents() });

  const [officeFilter, setOfficeFilter] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) setSelectedAgent(saved);
  }, []);
  useEffect(() => {
    if (selectedAgent && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, selectedAgent);
    }
  }, [selectedAgent]);

  const filteredAgents = useMemo(
    () =>
      (agentsQ.data ?? []).filter((a: any) =>
        officeFilter === "all" ? true : a.office === officeFilter,
      ),
    [agentsQ.data, officeFilter],
  );

  const listQ = useQuery({
    queryKey: ["pub-availability-for", selectedAgent],
    queryFn: () => listForAgent({ data: { agent_id: selectedAgent } }),
    enabled: !!selectedAgent,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState<string>("none");

  function openNew() {
    setEditing(null);
    setStart("");
    setEnd("");
    setReason("none");
    setOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setStart(row.date_start);
    setEnd(row.date_end);
    setReason(row.reason ?? "none");
    setOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selectedAgent) throw new Error("Select your name first");
      if (!start || !end) throw new Error("Start and end dates are required");
      await save({
        data: {
          id: editing?.id,
          agent_id: selectedAgent,
          date_start: start,
          date_end: end,
          reason: reason === "none" ? null : (reason as any),
        },
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Updated" : "Submitted");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["pub-availability-for", selectedAgent] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["pub-availability-for", selectedAgent] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  return (
    <div className="min-h-screen bg-background px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <Link to="/agents" className="inline-flex items-center gap-1 text-xs text-gold hover:underline">
            <ChevronLeft className="h-3.5 w-3.5" /> Back to Agent Hub
          </Link>
        </div>
        <header className="text-center mb-8">
          <img src={logo} alt="MSREG" className="h-20 w-auto mx-auto" />
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 mt-3">Agent Hub</p>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-2">Submit Availability</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Let us know when you're unavailable for duty.
          </p>
        </header>

        <div className="rounded-2xl border border-gold/30 bg-card p-6 shadow-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Office</Label>
              <Select value={officeFilter} onValueChange={setOfficeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OFFICES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Select your name</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger>
                  <SelectValue placeholder={agentsQ.isLoading ? "Loading…" : "Select your name"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredAgents.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} {a.office ? `· ${a.office.toUpperCase()}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-base font-semibold">My Time Off</h2>
            <Button
              onClick={openNew}
              disabled={!selectedAgent}
              className="bg-gold text-navy hover:bg-gold/90"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Time Off
            </Button>
          </div>

          <div className="mt-3 rounded-lg border border-gold/20 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!selectedAgent ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                      Select your name to view and add time off.
                    </TableCell>
                  </TableRow>
                ) : listQ.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : (listQ.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                      No time off submitted yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (listQ.data ?? []).map((row: any) => {
                    const s = new Date(row.date_start + "T00:00:00");
                    const e = new Date(row.date_end + "T00:00:00");
                    return (
                      <TableRow key={row.id}>
                        <TableCell>{format(s, "MMM d, yyyy")} – {format(e, "MMM d, yyyy")}</TableCell>
                        <TableCell className="capitalize">{row.reason ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Delete this entry?")) delMut.mutate(row.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <footer className="mt-8 text-center text-[11px] text-muted-foreground">
          © Matt Smith Real Estate Group
        </footer>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-gold" />
              {editing ? "Edit Time Off" : "Add Time Off"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="bg-gold text-navy hover:bg-gold/90"
            >
              {saveMut.isPending ? "Saving…" : editing ? "Update" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
