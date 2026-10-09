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
      { title: "Submit Availability — MSREG Hub" },
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
    <div className="relative min-h-screen bg-background text-foreground px-4 py-8 sm:py-12 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] overflow-x-hidden selection:bg-gold/30 selection:text-white">
      {/* Ambient Top Spotlight Halo */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.16),transparent)] pointer-events-none -z-10" />

      {/* Subtle Brand Emblem Watermark in Background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[600px] h-[420px] sm:h-[600px] pointer-events-none opacity-[0.035] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      <div className="max-w-3xl mx-auto relative z-10 space-y-6">
        <div>
          <Link
            to="/agents"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-surface-2/70 hover:bg-surface-2 hover:border-gold/50 text-xs text-muted-foreground hover:text-foreground transition-all shadow-2xs backdrop-blur-md"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to Agent Hub
          </Link>
        </div>

        <header className="text-center space-y-2">
          <img src={logo} alt="MSREG" className="h-20 sm:h-22 w-auto mx-auto drop-shadow-sm" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Submit Availability &amp; Time Off
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Let the operations team know when you are unavailable for floor, phone, or weekend duty.
            </p>
          </div>
        </header>

        <div className="rounded-3xl border border-border/80 bg-surface-1/90 backdrop-blur-md p-6 sm:p-8 shadow-2xl ring-1 ring-inset ring-white/[0.04] space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Office Filter</Label>
              <Select value={officeFilter} onValueChange={setOfficeFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground">
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
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Select Your Name *</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground">
                  <SelectValue placeholder={agentsQ.isLoading ? "Loading agents…" : "Choose your name"} />
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

          <div className="pt-2 border-t border-border/60 flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-foreground">My Upcoming Time Off</h2>
              <p className="text-[11px] text-muted-foreground">Blackout dates recorded for scheduling</p>
            </div>
            <Button
              onClick={openNew}
              disabled={!selectedAgent}
              className="h-10 px-4 rounded-xl bg-gold text-navy hover:bg-gold/90 font-bold text-xs shadow-md shadow-gold/20 active:scale-[0.985] transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add Time Off
            </Button>
          </div>

          <div className="rounded-2xl border border-border/80 overflow-hidden bg-surface-2/40">
            <Table>
              <TableHeader className="bg-surface-2/80">
                <TableRow className="border-border/60">
                  <TableHead className="text-xs font-semibold text-foreground">Date Range</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground">Reason</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!selectedAgent ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-xs text-muted-foreground py-8"
                    >
                      Select your name above to view and submit time off.
                    </TableCell>
                  </TableRow>
                ) : listQ.isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-xs text-muted-foreground py-8"
                    >
                      Loading your schedule…
                    </TableCell>
                  </TableRow>
                ) : (listQ.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-xs text-muted-foreground py-8"
                    >
                      No time off submitted yet. Click "Add Time Off" to request blackout days.
                    </TableCell>
                  </TableRow>
                ) : (
                  (listQ.data ?? []).map((row: any) => {
                    const s = new Date(row.date_start + "T00:00:00");
                    const e = new Date(row.date_end + "T00:00:00");
                    return (
                      <TableRow key={row.id} className="border-border/50 hover:bg-surface-2/60">
                        <TableCell className="text-xs font-medium text-foreground">
                          {format(s, "MMM d, yyyy")} – {format(e, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground border border-border/60 capitalize">
                            {row.reason ?? "Unavailable"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(row)} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Delete this entry?")) delMut.mutate(row.id);
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

        <footer className="text-center text-xs text-muted-foreground pt-4">
          © {new Date().getFullYear()} Matt Smith Real Estate Group · All Rights Reserved
        </footer>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl border border-border/80 bg-surface-1/95 p-6 sm:p-7 shadow-2xl backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <CalendarClock className="h-5 w-5 text-gold" />
              {editing ? "Edit Time Off" : "Add Time Off Request"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">End Date</Label>
                <Input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Reason (Optional)</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-11 rounded-xl bg-surface-2/80 border-border/80 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Specified</SelectItem>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t border-border/60">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl border-border text-xs h-10">
              Cancel
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="bg-gold text-navy hover:bg-gold/90 font-bold rounded-xl text-xs h-10 px-5 shadow-md shadow-gold/20"
            >
              {saveMut.isPending ? "Saving…" : editing ? "Update" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
