import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarOff, Pencil, Trash2, Plus, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  listAllActiveAgents,
  listAvailabilityForAgent,
  submitAvailability,
  deleteAvailability,
} from "@/lib/duty-calendar.functions";

export const Route = createFileRoute("/_authenticated/my-availability")({
  component: MyAvailabilityPage,
  head: () => ({ meta: [{ title: "My Availability — MSREG" }] }),
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

const STORAGE_KEY = "duty.selectedAgentId";

function MyAvailabilityPage() {
  const qc = useQueryClient();
  const allAgents = useServerFn(listAllActiveAgents);
  const listForAgent = useServerFn(listAvailabilityForAgent);
  const save = useServerFn(submitAvailability);
  const remove = useServerFn(deleteAvailability);

  const agentsQ = useQuery({ queryKey: ["duty-all-agents"], queryFn: () => allAgents() });

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
    queryKey: ["duty-availability-for", selectedAgent],
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
      if (!selectedAgent) throw new Error("Select your profile first");
      if (!start || !end) throw new Error("Date range is required");
      return save({
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
      toast.success(editing ? "Time off updated" : "Time off submitted");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["duty-availability-for", selectedAgent] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["duty-availability-for", selectedAgent] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const me = (agentsQ.data ?? []).find((a: any) => a.id === selectedAgent);

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CalendarOff className="h-6 w-6 text-gold" />
            My Availability
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick your profile and submit out-of-office dates.
          </p>
        </div>
        <Button
          onClick={openNew}
          disabled={!selectedAgent}
          className="bg-gold text-navy hover:bg-gold/90"
        >
          <Plus className="h-4 w-4 mr-1" /> Submit Time Off
        </Button>
      </div>

      <div className="rounded-md border border-gold/30 bg-card p-4 mb-4 grid gap-3 sm:grid-cols-[180px_1fr]">
        <div>
          <Label className="text-xs text-muted-foreground">Office</Label>
          <Select value={officeFilter} onValueChange={setOfficeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OFFICES.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <UserCircle className="h-3.5 w-3.5 text-gold" /> Your Profile
          </Label>
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger>
              <SelectValue placeholder="Select your profile" />
            </SelectTrigger>
            <SelectContent>
              {filteredAgents.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">No agents in this office</div>
              ) : (
                filteredAgents.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.office === "str" ? "St. Robert" : a.office === "loz" ? "LOZ" : "Rolla"})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedAgent && (
        <div className="rounded-md border border-gold/30 bg-gold/5 p-4 text-sm text-muted-foreground">
          Select your profile above to view and submit your out-of-office dates.
        </div>
      )}

      {selectedAgent && (
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-navy/40 text-sm text-gold">
            Viewing time off for <span className="font-medium">{me?.name}</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Range</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-muted-foreground">Loading…</TableCell></TableRow>
              ) : (listQ.data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-muted-foreground">No time off submitted.</TableCell></TableRow>
              ) : (
                (listQ.data ?? []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {format(new Date(r.date_start + "T00:00"), "MMM d, yyyy")} — {format(new Date(r.date_end + "T00:00"), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="capitalize">{r.reason ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Delete this time off entry?")) delMut.mutate(r.id);
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
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Time Off" : "Submit Time Off"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              For <span className="text-gold font-medium">{me?.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No reason</SelectItem>
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
              className="bg-gold text-navy hover:bg-gold/90"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
            >
              {saveMut.isPending ? "Saving…" : editing ? "Save" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
