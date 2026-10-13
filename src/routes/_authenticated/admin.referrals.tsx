import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Send,
  Search,
  ExternalLink,
  Copy,
  Check,
  User,
  Phone,
  Mail,
  Home,
  MapPin,
  DollarSign,
  Building2,
  Calendar,
  Clock,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  Edit,
  Share2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listOutboundReferrals,
  updateOutboundReferral,
  deleteOutboundReferral,
} from "@/lib/referrals.functions";
import { publicUrl } from "@/lib/public-url";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/referrals")({
  ssr: false,
  component: AdminReferralsPage,
  head: () => ({
    meta: [{ title: "Outbound Referrals — MSREG Hub" }],
  }),
});

type ReferralRecord = {
  id: string;
  agent_name: string;
  agent_email: string | null;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  transaction_type: string;
  timeline: string;
  buying_area: string | null;
  buying_budget: string | null;
  buying_criteria: string | null;
  selling_address: string | null;
  assigned_agent: string | null;
  broker_address: string | null;
  broker_email: string | null;
  broker_phone: string | null;
  notes: string | null;
  status: string;
  assigned_to: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  pending: {
    label: "Pending Review",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  in_progress: {
    label: "In Progress",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    dotClass: "bg-blue-400",
  },
  placed: {
    label: "Placed",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  closed: {
    label: "Closed",
    badgeClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    dotClass: "bg-purple-400",
  },
  archived: {
    label: "Archived",
    badgeClass: "bg-muted text-muted-foreground border-border",
    dotClass: "bg-muted-foreground",
  },
};

function AdminReferralsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOutboundReferrals);
  const updateFn = useServerFn(updateOutboundReferral);
  const deleteFn = useServerFn(deleteOutboundReferral);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedReferral, setSelectedReferral] = useState<ReferralRecord | null>(null);
  const [editStatus, setEditStatus] = useState<string>("pending");
  const [editAssignedTo, setEditAssignedTo] = useState<string>("");
  const [editInternalNotes, setEditInternalNotes] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch referrals
  const { data: referrals = [], isLoading, isRefetching, refetch } = useQuery<ReferralRecord[]>({
    queryKey: ["outbound-referrals", statusFilter, search],
    queryFn: async () => {
      const res = await listFn({
        data: {
          status: statusFilter === "all" ? undefined : (statusFilter as any),
          search: search.trim() || undefined,
        },
      });
      return res as ReferralRecord[];
    },
    refetchInterval: 30_000,
  });

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = referrals.length;
    let pending = 0;
    let inProgress = 0;
    let placedOrClosed = 0;

    for (const r of referrals) {
      if (r.status === "pending") pending++;
      else if (r.status === "in_progress") inProgress++;
      else if (r.status === "placed" || r.status === "closed") placedOrClosed++;
    }
    return { total, pending, inProgress, placedOrClosed };
  }, [referrals]);

  // Open detail modal
  const openDetail = (item: ReferralRecord) => {
    setSelectedReferral(item);
    setEditStatus(item.status);
    setEditAssignedTo(item.assigned_to || "");
    setEditInternalNotes(item.internal_notes || "");
  };

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReferral) return;
      await updateFn({
        data: {
          id: selectedReferral.id,
          status: editStatus as any,
          assigned_to: editAssignedTo.trim() || null,
          internal_notes: editInternalNotes.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Referral updated successfully");
      qc.invalidateQueries({ queryKey: ["outbound-referrals"] });
      if (selectedReferral) {
        setSelectedReferral({
          ...selectedReferral,
          status: editStatus,
          assigned_to: editAssignedTo.trim() || null,
          internal_notes: editInternalNotes.trim() || null,
        });
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update referral");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Referral removed");
      setSelectedReferral(null);
      qc.invalidateQueries({ queryKey: ["outbound-referrals"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete referral");
    },
  });

  // Copy agent form link
  const formUrl = publicUrl("/referral-form");
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopiedLink(true);
      toast.success("Agent form link copied to clipboard");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  // Copy formatted referral summary
  const handleCopySummary = async (r: ReferralRecord) => {
    const text = [
      `OUTBOUND REFERRAL: ${r.client_name}`,
      `Referring Agent: ${r.agent_name} (${r.agent_email || "N/A"})`,
      `Client Phone: ${r.client_phone}`,
      `Client Email: ${r.client_email || "N/A"}`,
      `Type: ${r.transaction_type.toUpperCase()}`,
      `Timeline: ${r.timeline}`,
      r.buying_area ? `Target Area: ${r.buying_area}` : null,
      r.buying_budget ? `Budget: ${r.buying_budget}` : null,
      r.buying_criteria ? `Wishlist: ${r.buying_criteria}` : null,
      r.selling_address ? `Selling Address: ${r.selling_address}` : null,
      r.assigned_agent ? `Assigned Agent: ${r.assigned_agent}` : null,
      r.broker_address ? `Broker Address: ${r.broker_address}` : null,
      r.broker_email ? `Broker Email: ${r.broker_email}` : null,
      r.broker_phone ? `Broker Phone: ${r.broker_phone}` : null,
      r.notes ? `Notes: ${r.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Full referral summary copied to clipboard");
    } catch {
      toast.error("Could not copy summary");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <PageHeader
        category="Operations"
        categoryTo="/requests"
        title="Outbound Referrals"
        description="Client Care processing desk for reviewing, tracking, and executing agent-submitted outbound client referrals."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="gap-1.5 text-xs border-border"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>Copy Form Link</span>
          </Button>

          <Link to="/referral-form" target="_blank">
            <Button size="sm" className="gap-1.5 text-xs bg-gold hover:bg-gold/90 text-navy font-semibold">
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Agent Form</span>
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Submissions
          </p>
          <p className="text-2xl font-extrabold text-foreground">{metrics.total}</p>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Pending Review
          </p>
          <p className="text-2xl font-extrabold text-amber-400">{metrics.pending}</p>
        </div>

        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-1">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
            In Progress
          </p>
          <p className="text-2xl font-extrabold text-blue-400">{metrics.inProgress}</p>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-1">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Placed / Closed
          </p>
          <p className="text-2xl font-extrabold text-emerald-400">{metrics.placedOrClosed}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client, agent, phone, area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-background/80"
          />
        </div>

        {/* Status Filter & Refresh */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/50 text-xs">
            {["all", "pending", "in_progress", "placed", "closed"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-2.5 py-1 rounded-md capitalize transition-colors font-medium",
                  statusFilter === st
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
            title="Refresh referrals"
          >
            <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Referrals Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead className="text-xs font-semibold">Client Name</TableHead>
              <TableHead className="text-xs font-semibold">Referring Agent</TableHead>
              <TableHead className="text-xs font-semibold">Type & Timeline</TableHead>
              <TableHead className="text-xs font-semibold">Market / Details</TableHead>
              <TableHead className="text-xs font-semibold">Submitted</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                  Loading outbound referrals...
                </TableCell>
              </TableRow>
            ) : referrals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground space-y-2">
                  <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                    <FileText className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No outbound referrals found</p>
                  <p className="text-xs text-muted-foreground">
                    {search || statusFilter !== "all"
                      ? "Try adjusting your search terms or status filter."
                      : "When agents submit the Outbound Referral Sheet, submissions will show up here."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              referrals.map((r) => {
                const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                return (
                  <TableRow
                    key={r.id}
                    onClick={() => openDetail(r)}
                    className="border-border/60 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    {/* Client Name */}
                    <TableCell className="py-3">
                      <div className="font-semibold text-sm text-foreground">{r.client_name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        <span>{r.client_phone}</span>
                      </div>
                    </TableCell>

                    {/* Agent */}
                    <TableCell className="py-3">
                      <div className="text-xs font-medium text-foreground">{r.agent_name}</div>
                      {r.agent_email && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                          {r.agent_email}
                        </div>
                      )}
                    </TableCell>

                    {/* Type & Timeline */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                            r.transaction_type === "buying"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : r.transaction_type === "selling"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          )}
                        >
                          {r.transaction_type === "both" ? "Buy & Sell" : r.transaction_type}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{r.timeline}</div>
                    </TableCell>

                    {/* Market / Details */}
                    <TableCell className="py-3 max-w-[180px]">
                      {r.buying_area && (
                        <div className="text-xs text-foreground truncate flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{r.buying_area}</span>
                        </div>
                      )}
                      {r.selling_address && (
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <Home className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{r.selling_address}</span>
                        </div>
                      )}
                      {!r.buying_area && !r.selling_address && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Date */}
                    <TableCell className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(r.created_at), "MMM d, yyyy")}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border",
                          cfg.badgeClass
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dotClass)} />
                        <span>{cfg.label}</span>
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetail(r)}
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          <span>Review</span>
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

      {/* Referral Detail Modal */}
      {selectedReferral && (
        <Dialog open={!!selectedReferral} onOpenChange={(open) => !open && setSelectedReferral(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <span>{selectedReferral.client_name}</span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        selectedReferral.transaction_type === "buying"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : selectedReferral.transaction_type === "selling"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      )}
                    >
                      {selectedReferral.transaction_type === "both"
                        ? "Buying & Selling"
                        : selectedReferral.transaction_type}
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-1">
                    Submitted by{" "}
                    <strong className="text-foreground">{selectedReferral.agent_name}</strong> on{" "}
                    {format(new Date(selectedReferral.created_at), "MMMM d, yyyy 'at' h:mm a")}
                  </DialogDescription>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopySummary(selectedReferral)}
                  className="gap-1.5 text-xs shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Summary</span>
                </Button>
              </div>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Client & Referring Agent Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border border-border/60">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Client Contact
                  </p>
                  <p className="text-sm font-bold text-foreground">{selectedReferral.client_name}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <a
                      href={`tel:${selectedReferral.client_phone}`}
                      className="text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <Phone className="h-3 w-3" />
                      <span>{selectedReferral.client_phone}</span>
                    </a>
                  </div>
                  {selectedReferral.client_email && (
                    <div className="flex items-center gap-2 text-xs">
                      <a
                        href={`mailto:${selectedReferral.client_email}`}
                        className="text-primary hover:underline flex items-center gap-1 truncate"
                      >
                        <Mail className="h-3 w-3" />
                        <span>{selectedReferral.client_email}</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Referring Agent
                  </p>
                  <p className="text-sm font-bold text-foreground">{selectedReferral.agent_name}</p>
                  {selectedReferral.agent_email && (
                    <div className="flex items-center gap-2 text-xs">
                      <a
                        href={`mailto:${selectedReferral.agent_email}`}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        <span>{selectedReferral.agent_email}</span>
                      </a>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Timeline:</span> {selectedReferral.timeline}
                  </div>
                </div>
              </div>

              {/* Buying Info */}
              {(selectedReferral.transaction_type === "buying" ||
                selectedReferral.transaction_type === "both") && (
                <div className="space-y-2 border border-blue-500/20 bg-blue-500/5 p-4 rounded-xl">
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Buying Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Target Area:</span>{" "}
                      <span className="font-semibold text-foreground">
                        {selectedReferral.buying_area || "Not specified"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Budget:</span>{" "}
                      <span className="font-semibold text-foreground">
                        {selectedReferral.buying_budget || "Not specified"}
                      </span>
                    </div>
                    {selectedReferral.buying_criteria && (
                      <div className="sm:col-span-2 space-y-1">
                        <span className="text-muted-foreground">Property Wishlist:</span>
                        <p className="text-foreground bg-background/60 p-2.5 rounded-md border border-border/50 text-xs leading-relaxed whitespace-pre-wrap">
                          {selectedReferral.buying_criteria}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Selling Info */}
              {(selectedReferral.transaction_type === "selling" ||
                selectedReferral.transaction_type === "both") && (
                <div className="space-y-2 border border-amber-500/20 bg-amber-500/5 p-4 rounded-xl">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Selling Details</p>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Address Being Sold:</span>{" "}
                    <span className="font-semibold text-foreground">
                      {selectedReferral.selling_address || "Not specified"}
                    </span>
                  </div>
                </div>
              )}

              {/* Brokerage & Destination Agent */}
              {(selectedReferral.assigned_agent ||
                selectedReferral.broker_address ||
                selectedReferral.broker_email ||
                selectedReferral.broker_phone) && (
                <div className="space-y-2 border border-purple-500/20 bg-purple-500/5 p-4 rounded-xl">
                  <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                    Brokerage & Assigned Agent
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {selectedReferral.assigned_agent && (
                      <div>
                        <span className="text-muted-foreground">Assigned Agent:</span>{" "}
                        <span className="font-semibold text-foreground">
                          {selectedReferral.assigned_agent}
                        </span>
                      </div>
                    )}
                    {selectedReferral.broker_address && (
                      <div>
                        <span className="text-muted-foreground">Broker Address:</span>{" "}
                        <span className="text-foreground">{selectedReferral.broker_address}</span>
                      </div>
                    )}
                    {selectedReferral.broker_email && (
                      <div>
                        <span className="text-muted-foreground">Broker Email:</span>{" "}
                        <a
                          href={`mailto:${selectedReferral.broker_email}`}
                          className="text-primary hover:underline"
                        >
                          {selectedReferral.broker_email}
                        </a>
                      </div>
                    )}
                    {selectedReferral.broker_phone && (
                      <div>
                        <span className="text-muted-foreground">Broker Phone:</span>{" "}
                        <a
                          href={`tel:${selectedReferral.broker_phone}`}
                          className="text-primary hover:underline"
                        >
                          {selectedReferral.broker_phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Submitter Notes */}
              {selectedReferral.notes && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Agent Notes
                  </p>
                  <div className="p-3 bg-muted/40 rounded-lg border border-border text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedReferral.notes}
                  </div>
                </div>
              )}

              {/* Nancy & Admin Controls */}
              <div className="border-t border-border pt-4 space-y-4">
                <p className="text-xs font-bold text-gold uppercase tracking-wider">
                  Client Care Management Controls
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Status Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Status</Label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger className="bg-background text-xs">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending Review</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="placed">Placed</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assigned Specialist */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Assigned Specialist</Label>
                    <Input
                      placeholder="e.g. Nancy"
                      value={editAssignedTo}
                      onChange={(e) => setEditAssignedTo(e.target.value)}
                      className="bg-background text-xs"
                    />
                  </div>
                </div>

                {/* Internal Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Internal Processing Notes (Client Care Only)
                  </Label>
                  <Textarea
                    rows={3}
                    placeholder="e.g. Sent referral agreement on 10/12 to KW agent, 25% fee agreed. Waiting on client signed paperwork..."
                    value={editInternalNotes}
                    onChange={(e) => setEditInternalNotes(e.target.value)}
                    className="bg-background text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border/60 pt-3 flex items-center justify-between">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this referral record?")) {
                    deleteMutation.mutate(selectedReferral.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="gap-1.5 text-xs mr-auto"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedReferral(null)}>
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  className="bg-gold hover:bg-gold/90 text-navy font-semibold text-xs"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
