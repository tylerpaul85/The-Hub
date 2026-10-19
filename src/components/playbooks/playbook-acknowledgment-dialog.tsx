import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Copy,
  Users,
  Mail,
  Phone,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import {
  getPlaybookAcknowledgmentReport,
  type AcknowledgmentReport,
  type PlaybookRecord,
} from "@/lib/playbooks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PlaybookAcknowledgmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playbook: PlaybookRecord | null;
}

export function PlaybookAcknowledgmentDialog({
  open,
  onOpenChange,
  playbook,
}: PlaybookAcknowledgmentDialogProps) {
  const getReportFn = useServerFn(getPlaybookAcknowledgmentReport);
  const [filterTab, setFilterTab] = useState<"all" | "acknowledged" | "pending">("all");
  const [search, setSearch] = useState("");

  const { data: report, isLoading } = useQuery({
    queryKey: ["playbook-ack-report", playbook?.id],
    queryFn: () => (playbook ? getReportFn({ data: playbook.id }) : Promise.resolve(null)),
    enabled: !!playbook && open,
  });

  const handleCopyPendingEmails = () => {
    if (!report || report.pending_agents.length === 0) {
      toast.info("No pending agents to copy");
      return;
    }
    const emails = report.pending_agents.map((a) => a.email).filter(Boolean).join(", ");
    navigator.clipboard.writeText(emails);
    toast.success(`Copied ${report.pending_agents.length} pending email addresses!`);
  };

  const filteredAcknowledged = (report?.acknowledged_agents || []).filter(
    (a) =>
      a.full_name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPending = (report?.pending_agents || []).filter(
    (a) =>
      a.full_name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] max-h-[85vh] p-0 flex flex-col bg-surface-1 border border-border shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-2/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Acknowledgment Report: {playbook?.title}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Track team compliance and see which agents in assigned groups have read and acknowledged this playbook.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs border-border hover:bg-surface-2"
          >
            Close
          </Button>
        </div>

        {/* Report Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="h-7 w-7 animate-spin text-accent mx-auto" />
              <p className="text-xs text-muted-foreground">Generating compliance report...</p>
            </div>
          ) : report ? (
            <>
              {/* Compliance Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-border bg-surface-2/50 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Total Assigned Agents</span>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-extrabold text-foreground">{report.total_assigned}</div>
                  <p className="text-[11px] text-muted-foreground">
                    Across {playbook?.assigned_groups?.length || 0} assigned groups
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-emerald-400">
                    <span>Acknowledged</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-400">
                    {report.acknowledged_count}
                    <span className="text-xs font-semibold text-muted-foreground ml-2">
                      ({report.compliance_percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden mt-1">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${report.compliance_percent}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-amber-400">
                    <span>Pending Acknowledgment</span>
                    <Clock className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-amber-400">{report.pending_count}</div>
                  <p className="text-[11px] text-muted-foreground">Action required from agents</p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search agents by name or email..."
                    className="pl-9 h-9 text-xs bg-surface-2 border-border"
                  />
                </div>

                {/* Filter Tabs & Reminder button */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center rounded-lg bg-surface-2 p-0.5 border border-border">
                    <button
                      type="button"
                      onClick={() => setFilterTab("all")}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                        filterTab === "all" ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      All ({report.total_assigned})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab("acknowledged")}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                        filterTab === "acknowledged" ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Signed ({report.acknowledged_count})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab("pending")}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                        filterTab === "pending" ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Pending ({report.pending_count})
                    </button>
                  </div>

                  {report.pending_count > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyPendingEmails}
                      className="text-xs border-border hover:bg-surface-2 h-8"
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy Pending Emails
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Agent Roster Tables */}
              <div className="space-y-4">
                {/* Acknowledged List */}
                {(filterTab === "all" || filterTab === "acknowledged") && filteredAcknowledged.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Acknowledged Agents
                    </h4>
                    <div className="rounded-xl border border-border bg-surface-2/40 overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-surface-3/60 text-muted-foreground font-bold border-b border-border uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="p-3">Agent</th>
                            <th className="p-3">Email</th>
                            <th className="p-3">Phone</th>
                            <th className="p-3">Version</th>
                            <th className="p-3 text-right">Date Acknowledged</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {filteredAcknowledged.map((a) => (
                            <tr key={a.agent_id} className="hover:bg-surface-2/80 transition-colors">
                              <td className="p-3 font-semibold text-foreground">{a.full_name}</td>
                              <td className="p-3 text-muted-foreground">{a.email}</td>
                              <td className="p-3 text-muted-foreground">{a.phone || "—"}</td>
                              <td className="p-3 font-mono text-gold">v{a.version_acknowledged}</td>
                              <td className="p-3 text-right text-emerald-400 font-medium">
                                {new Date(a.acknowledged_at).toLocaleDateString()} at{" "}
                                {new Date(a.acknowledged_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {/* Pending List */}
                {(filterTab === "all" || filterTab === "pending") && filteredPending.length > 0 ? (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                      <Clock className="h-3.5 w-3.5 text-amber-400" /> Pending Acknowledgment
                    </h4>
                    <div className="rounded-xl border border-border bg-surface-2/40 overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-surface-3/60 text-muted-foreground font-bold border-b border-border uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="p-3">Agent</th>
                            <th className="p-3">Email</th>
                            <th className="p-3">Phone</th>
                            <th className="p-3">Assigned Groups</th>
                            <th className="p-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {filteredPending.map((a) => (
                            <tr key={a.agent_id} className="hover:bg-surface-2/80 transition-colors">
                              <td className="p-3 font-semibold text-foreground">{a.full_name}</td>
                              <td className="p-3 text-muted-foreground">{a.email}</td>
                              <td className="p-3 text-muted-foreground">{a.phone || "—"}</td>
                              <td className="p-3">
                                <div className="flex flex-wrap gap-1">
                                  {a.assigned_group_names.map((g, i) => (
                                    <span key={i} className="px-1.5 py-0.5 rounded bg-surface-3 text-[10px] text-muted-foreground">
                                      {g}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  Pending
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {filteredAcknowledged.length === 0 && filteredPending.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No matching agents found.
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Unable to load report.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
