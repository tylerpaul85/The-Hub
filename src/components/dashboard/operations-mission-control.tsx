import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MyRocksWidget } from "@/components/my-rocks-widget";
import { MyTasksWidget } from "@/components/my-tasks-widget";
import { ClientCareClosingGifts } from "@/components/client-care-closing-gifts";
import { format } from "date-fns";
import {
  Boxes,
  Layers,
  Send,
  Calendar,
  Calculator,
  Target,
  ShoppingBag,
  ListTodo,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  Sparkles,
  ClipboardCheck,
  Video,
  Inbox,
  CalendarDays,
  Users,
  BookOpen,
  CircleAlert,
  BarChart3,
  Clock,
  ShieldCheck,
  Shirt,
  DollarSign,
  User,
  Check,
  Search,
  Eye,
  FileText,
  MapPin,
  Mail,
  Loader2,
} from "lucide-react";

interface PendingMarketingReq {
  id: string;
  agent_name: string;
  agent_email: string;
  request_types: string[];
  property_address: string | null;
  priority: string;
  deadline: string | null;
  description: string;
  created_at: string;
}

interface ClosingGiftPendingReq {
  id: string;
  agent_name: string;
  client_first_name: string;
  client_last_name: string;
  closing_date: string | null;
  closing_location: string | null;
  shirts: any;
  status: string;
  created_at: string;
}

interface OutboundReferralRow {
  id: string;
  agent_name: string;
  client_name: string;
  transaction_type: string;
  timeline: string;
  status: string;
  created_at: string;
}

interface RecentNetSheetRow {
  id: string;
  agent_name: string;
  property_address: string;
  sale_price: number;
  estimated_net: number;
  created_at: string;
}

export function OperationsMissionControl() {
  const { user, isAdmin, roles } = useAuth();
  const qc = useQueryClient();
  const [triageTab, setTriageTab] = useState<"requests" | "closing-gifts" | "referrals" | "net-sheets">("requests");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequestModal, setSelectedRequestModal] = useState<PendingMarketingReq | null>(null);

  const isMarketing = isAdmin || roles?.includes("marketing_coordinator");
  const isClientCare = roles?.includes("client_care");

  // Quick Inline Mutations for Operations Staff
  const quickApproveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("marketing_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request approved and moved to creative queue");
      qc.invalidateQueries({ queryKey: ["ops-pulse-pending-marketing-requests"] });
      qc.invalidateQueries({ queryKey: ["ops-pulse-pending-requests-count"] });
      qc.invalidateQueries({ queryKey: ["shell-pending-marketing-count"] });
      setSelectedRequestModal(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Could not approve request");
    },
  });

  const quickFulfillGiftMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("closing_gift_requests")
        .update({ status: "fulfilled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Closing gift marked as fulfilled");
      qc.invalidateQueries({ queryKey: ["ops-pulse-closing-gifts"] });
      qc.invalidateQueries({ queryKey: ["shell-pending-gifts-count"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Could not update gift request");
    },
  });

  // 1. Live Operations Pulse Queries
  // Closing Gift Requests (Pending)
  const { data: pendingClosingGifts = [], isLoading: isGiftsLoading } = useQuery({
    queryKey: ["ops-pulse-closing-gifts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("closing_gift_requests")
        .select("id, agent_name, client_first_name, client_last_name, closing_date, closing_location, shirts, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []) as ClosingGiftPendingReq[];
    },
  });

  // Outbound Referrals (Pending / Assigned)
  const { data: activeReferrals = [], isLoading: isReferralsLoading } = useQuery({
    queryKey: ["ops-pulse-outbound-referrals"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("outbound_referrals")
        .select("id, agent_name, client_name, transaction_type, timeline, status, created_at")
        .in("status", ["pending", "assigned"])
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return (data ?? []) as OutboundReferralRow[];
    },
  });

  // Pending Marketing Requests
  const { data: pendingRequestsCount = 0 } = useQuery({
    queryKey: ["ops-pulse-pending-requests-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("marketing_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count || 0;
    },
  });

  const { data: pendingMarketingRequests = [], isLoading: isRequestsLoading } = useQuery({
    queryKey: ["ops-pulse-pending-marketing-requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("marketing_requests")
        .select("id, agent_name, agent_email, request_types, property_address, priority, deadline, description, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) return [];
      return (data ?? []) as PendingMarketingReq[];
    },
  });

  const filteredMarketingRequests = useMemo(() => {
    if (!searchQuery.trim()) return pendingMarketingRequests;
    const q = searchQuery.toLowerCase();
    return pendingMarketingRequests.filter(
      (r) =>
        (r.agent_name && r.agent_name.toLowerCase().includes(q)) ||
        (r.property_address && r.property_address.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        r.request_types?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [pendingMarketingRequests, searchQuery]);

  const filteredClosingGifts = useMemo(() => {
    if (!searchQuery.trim()) return pendingClosingGifts;
    const q = searchQuery.toLowerCase();
    return pendingClosingGifts.filter(
      (g) =>
        (g.agent_name && g.agent_name.toLowerCase().includes(q)) ||
        (g.client_first_name && g.client_first_name.toLowerCase().includes(q)) ||
        (g.client_last_name && g.client_last_name.toLowerCase().includes(q)),
    );
  }, [pendingClosingGifts, searchQuery]);

  // Active Swag Credits & Total Unspent Balance
  const { data: swagStats = { count: 0, totalBalance: 0 } } = useQuery({
    queryKey: ["ops-pulse-swag-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("shopify_swag_credits")
        .select("balance, status")
        .eq("status", "active");
      if (error || !data) return { count: 0, totalBalance: 0 };
      const totalBalance = data.reduce((acc: number, c: any) => acc + (Number(c.balance) || 0), 0);
      return { count: data.length, totalBalance };
    },
  });

  // Recent Agent Net Sheets
  const { data: recentNetSheets = [], isLoading: isNetSheetsLoading } = useQuery({
    queryKey: ["ops-pulse-recent-net-sheets"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("seller_net_sheets")
        .select("id, agent_name, property_address, sale_price, estimated_net, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) return [];
      return (data ?? []) as RecentNetSheetRow[];
    },
  });

  // Marketing Content Items Needing Review
  const { data: contentReviewItems = [], isLoading: isContentLoading } = useQuery({
    queryKey: ["ops-pulse-content-review"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_items")
        .select("id, title, status, scheduled_at")
        .in("status", ["pending_re_approval", "in_review", "needs_revision"])
        .order("scheduled_at", { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* ─── Real-Time Operations Pulse Bar (Triage HUD) ─── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              Operations Live Pulse &amp; Triage HUD
            </h3>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            Live Database Sync
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Beacon 1: Marketing Requests Inbox */}
          <Link
            to="/requests"
            className="p-3.5 rounded-2xl border border-border/80 bg-surface-1/90 hover:bg-surface-2 hover:border-blue-500/40 transition-all duration-150 shadow-2xs space-y-2 block group relative ring-1 ring-inset ring-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <Inbox className="h-4 w-4 text-blue-400" />
              <Badge
                variant="outline"
                className={`text-[10px] font-mono font-bold ${
                  pendingRequestsCount > 0
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    : "bg-surface-2 text-muted-foreground border-border/80"
                }`}
              >
                {pendingRequestsCount > 0 ? `${pendingRequestsCount} Pending` : "Clear"}
              </Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-foreground group-hover:text-blue-400 transition-colors">
              {pendingRequestsCount}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
              Marketing Requests
            </div>
          </Link>

          {/* Beacon 2: Closing Gifts Queue */}
          <Link
            to="/inventory"
            className="p-3.5 rounded-2xl border border-border/80 bg-surface-1/90 hover:bg-surface-2 hover:border-amber-500/40 transition-all duration-150 shadow-2xs space-y-2 block group relative ring-1 ring-inset ring-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <Boxes className="h-4 w-4 text-amber-400" />
              <Badge
                variant="outline"
                className={`text-[10px] font-mono font-bold ${
                  pendingClosingGifts.length > 0
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "bg-surface-2 text-muted-foreground border-border/80"
                }`}
              >
                {pendingClosingGifts.length} Queue
              </Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-foreground group-hover:text-amber-400 transition-colors">
              {pendingClosingGifts.length}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
              Closing Gifts
            </div>
          </Link>

          {/* Beacon 3: Outbound Referrals */}
          <Link
            to="/admin/referrals"
            className="p-3.5 rounded-2xl border border-border/80 bg-surface-1/90 hover:bg-surface-2 hover:border-purple-500/40 transition-all duration-150 shadow-2xs space-y-2 block group relative ring-1 ring-inset ring-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <Send className="h-4 w-4 text-purple-400" />
              <Badge
                variant="outline"
                className="text-[10px] font-mono font-bold bg-purple-500/15 text-purple-400 border-purple-500/30"
              >
                Active Desk
              </Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-foreground group-hover:text-purple-400 transition-colors">
              {activeReferrals.length}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
              Outbound Deals
            </div>
          </Link>

          {/* Beacon 4: Swag Store Balances in Field */}
          <Link
            to="/admin/swag-credits"
            className="p-3.5 rounded-2xl border border-border/80 bg-surface-1/90 hover:bg-surface-2 hover:border-emerald-500/40 transition-all duration-150 shadow-2xs space-y-2 block group relative ring-1 ring-inset ring-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <ShoppingBag className="h-4 w-4 text-emerald-400" />
              <Badge
                variant="outline"
                className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
              >
                {swagStats.count} Cards
              </Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-foreground group-hover:text-emerald-400 transition-colors">
              ${swagStats.totalBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
              Unspent Swag Credit
            </div>
          </Link>

          {/* Beacon 5: Agent Net Sheets */}
          <Link
            to="/admin-net-sheets"
            className="p-3.5 rounded-2xl border border-border/80 bg-surface-1/90 hover:bg-surface-2 hover:border-amber-500/40 transition-all duration-150 shadow-2xs space-y-2 block group relative ring-1 ring-inset ring-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <Calculator className="h-4 w-4 text-amber-400" />
              <Badge
                variant="outline"
                className="text-[10px] font-mono font-bold bg-surface-2 text-muted-foreground border-border/80"
              >
                Ledger
              </Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-foreground group-hover:text-amber-400 transition-colors">
              {recentNetSheets.length}+
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
              Agent Net Sheets
            </div>
          </Link>

          {/* Beacon 6: Content Pipeline */}
          <Link
            to="/calendar"
            search={() => ({})}
            className="p-3.5 rounded-2xl border border-border/80 bg-surface-1/90 hover:bg-surface-2 hover:border-rose-500/40 transition-all duration-150 shadow-2xs space-y-2 block group relative ring-1 ring-inset ring-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <ListTodo className="h-4 w-4 text-rose-400" />
              <Badge
                variant="outline"
                className={`text-[10px] font-mono font-bold ${
                  contentReviewItems.length > 0
                    ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                    : "bg-surface-2 text-muted-foreground border-border/80"
                }`}
              >
                Review
              </Badge>
            </div>
            <div className="text-2xl font-bold font-mono text-foreground group-hover:text-rose-400 transition-colors">
              {contentReviewItems.length}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
              Content Pipeline
            </div>
          </Link>
        </div>
      </section>

      {/* ─── Operations Live Triage Stream (Interactive Feed) ─── */}
      <section className="bg-surface-1 border border-border/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-bold text-foreground font-sans">Operational Triage Stream</h4>
            <p className="text-xs text-muted-foreground">Actionable queues for client fulfillment, outbound referrals, and deal documents</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="relative w-full sm:w-52">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter queue..."
                className="pl-8 h-8 text-xs bg-surface-2 border-border/80 rounded-xl"
              />
            </div>

            <Tabs value={triageTab} onValueChange={(v) => setTriageTab(v as any)} className="w-auto">
              <TabsList className="bg-surface-2 h-8 p-0.5 border border-border">
                <TabsTrigger value="requests" className="text-xs h-7 px-3 flex items-center gap-1.5 font-medium">
                  <Inbox className="h-3.5 w-3.5" />
                  <span>Marketing Requests</span>
                  {pendingRequestsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold font-mono">
                      {pendingRequestsCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="closing-gifts" className="text-xs h-7 px-3 flex items-center gap-1.5 font-medium">
                  <Boxes className="h-3.5 w-3.5" />
                  <span>Closing Gifts</span>
                  {pendingClosingGifts.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold font-mono">
                      {pendingClosingGifts.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="referrals" className="text-xs h-7 px-3 flex items-center gap-1.5 font-medium">
                  <Send className="h-3.5 w-3.5" />
                  <span>Referrals</span>
                  {activeReferrals.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold font-mono">
                      {activeReferrals.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="net-sheets" className="text-xs h-7 px-3 flex items-center gap-1.5 font-medium">
                  <Calculator className="h-3.5 w-3.5" />
                  <span>Net Sheets</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="p-0">
          {triageTab === "requests" && (
            <div className="divide-y divide-border/40">
              {filteredMarketingRequests.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground space-y-1">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                  <div className="font-semibold text-foreground">Marketing Requests Clear</div>
                  <p>
                    {searchQuery
                      ? "No pending marketing requests matching your filter."
                      : "No incoming creative, flyer, or listing requests currently awaiting review."}
                  </p>
                </div>
              ) : (
                filteredMarketingRequests.map((req) => (
                  <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-2/40 transition-colors">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">
                          {req.agent_name || "Agent Request"}
                        </span>
                        {req.priority === "high" ? (
                          <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20 font-bold font-mono uppercase tracking-wider">
                            Rush / High Priority
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20 capitalize font-mono">
                            {req.priority || "Normal"}
                          </Badge>
                        )}
                        {req.property_address && (
                          <span className="text-xs text-slate-300 font-medium truncate max-w-xs flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{req.property_address}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        {req.request_types?.map((t: string) => (
                          <span key={t} className="px-2 py-0.5 rounded-md bg-surface-2 border border-border/80 text-[11px] font-medium text-slate-300">
                            {t}
                          </span>
                        ))}
                        {req.deadline && (
                          <span className="text-amber-400 font-mono text-[11px]">
                            Due: {format(new Date(req.deadline), "MMM d")}
                          </span>
                        )}
                        <span className="text-muted-foreground/60 text-[11px] font-mono">
                          Submitted {format(new Date(req.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedRequestModal(req)}
                        className="h-8 px-2.5 text-xs border-border bg-surface-2/80 hover:bg-surface-3 hover:text-foreground gap-1.5 font-semibold rounded-xl"
                        title="View request details and description"
                      >
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Details</span>
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => quickApproveMutation.mutate(req.id)}
                        disabled={quickApproveMutation.isPending}
                        className="h-8 px-3 text-xs bg-emerald-600/90 hover:bg-emerald-600 text-white gap-1.5 font-semibold rounded-xl shadow-2xs"
                        title="Quick approve and queue for creative production"
                      >
                        {quickApproveMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span>Approve</span>
                      </Button>

                      <Link
                        to="/requests"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-muted-foreground hover:text-foreground transition-colors"
                        title="Open full Requests Desk"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {triageTab === "closing-gifts" && (
            <div className="divide-y divide-border/40">
              {filteredClosingGifts.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground space-y-1">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                  <div className="font-semibold text-foreground">All Closing Gifts Fulfilled!</div>
                  <p>
                    {searchQuery
                      ? "No pending closing gift requests matching your filter."
                      : "No client gift requests currently waiting for courier delivery."}
                  </p>
                </div>
              ) : (
                filteredClosingGifts.slice(0, 6).map((req) => (
                  <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-2/40 transition-colors">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">
                          {req.client_first_name} {req.client_last_name}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border-amber-500/20">
                          Pending Packaging
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>Agent: <strong className="text-slate-200">{req.agent_name}</strong></span>
                        {req.closing_date && <span>• Closing: {format(new Date(req.closing_date), "MMM d, yyyy")}</span>}
                        {req.closing_location && <span className="capitalize">• Office: {req.closing_location}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <Button
                        size="sm"
                        onClick={() => quickFulfillGiftMutation.mutate(req.id)}
                        disabled={quickFulfillGiftMutation.isPending}
                        className="h-8 px-3 text-xs bg-amber-600/90 hover:bg-amber-600 text-white gap-1.5 font-semibold rounded-xl shadow-2xs"
                        title="Mark packaged and dispatched"
                      >
                        {quickFulfillGiftMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span>Mark Fulfilled</span>
                      </Button>

                      <Link
                        to="/inventory"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-muted-foreground hover:text-foreground transition-colors"
                        title="Open full Inventory Desk"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {triageTab === "referrals" && (
            <div className="divide-y divide-border/40">
              {activeReferrals.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No active outbound referrals requiring attention.
                </div>
              ) : (
                activeReferrals.map((ref) => (
                  <div key={ref.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-2/40 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{ref.client_name}</span>
                        <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20 capitalize">
                          {ref.transaction_type} • {ref.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Referring Agent: <strong className="text-slate-200">{ref.agent_name}</strong> • Timeline: {ref.timeline || "Immediate"}
                      </div>
                    </div>

                    <Link
                      to="/admin/referrals"
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-surface-2 border border-border text-foreground hover:bg-surface-3 text-xs font-semibold transition-colors"
                    >
                      <span>Open Desk</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}

          {triageTab === "net-sheets" && (
            <div className="divide-y divide-border/40">
              {recentNetSheets.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No agent net sheets found.
                </div>
              ) : (
                recentNetSheets.map((sheet) => (
                  <div key={sheet.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-2/40 transition-colors">
                    <div className="space-y-1">
                      <div className="font-bold text-sm text-foreground">{sheet.property_address || "Listing"}</div>
                      <div className="text-xs text-muted-foreground">
                        Agent: <strong className="text-slate-200">{sheet.agent_name}</strong> • Sale Price: <span className="font-mono text-slate-300">${sheet.sale_price?.toLocaleString()}</span> • Est. Net: <span className="font-mono text-emerald-400 font-bold">${sheet.estimated_net?.toLocaleString()}</span>
                      </div>
                    </div>

                    <Link
                      to="/admin-net-sheets"
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-surface-2 border border-border text-foreground hover:bg-surface-3 text-xs font-semibold transition-colors"
                    >
                      <span>Inspect Sheet</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section >

    {/* ─── EOS Quarterly Execution & Task Velocity ─── */ }
    < section className = "space-y-4" >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" />
              <span>EOS Quarterly Execution &amp; Deliverables</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Quarterly Rocks accountability, operational tasks, and L10 meeting cadence.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/eos/rocks"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent/10 hover:bg-accent/20 text-accent border border-accent/25 transition-colors"
            >
              <Target className="h-3.5 w-3.5" />
              <span>View Rocks</span>
            </Link>
            <Link
              to="/tasks"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-2 hover:bg-surface-3 border border-border text-foreground transition-colors"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span>All Tasks</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MyRocksWidget />
          <MyTasksWidget />
        </div>
      </section >

    {/* ─── Operations & Marketing Tool Matrix ─── */ }
    < section className = "space-y-3" >
        <div className="border-b border-border/60 pb-2">
          <h3 className="text-base font-bold text-foreground tracking-tight">
            Operations &amp; Admin Suite
          </h3>
          <p className="text-xs text-muted-foreground">
            Inventory stock, agent net sheets oversight, duty schedules, and internal operating procedures.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Link
            to="/toolbox"
            className="p-4 rounded-xl border border-border bg-surface-1 hover:bg-surface-2 hover:border-accent/40 transition-all flex items-start gap-3 group"
          >
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border text-accent group-hover:scale-105 transition-transform shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h5 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                  Agent Marketing Toolbox
                </h5>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-accent/15 text-accent font-semibold uppercase">
                  Suite
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Manage listing assets, video walkthroughs, open house media, brand assets, and marketing materials.
              </p>
            </div>
          </Link>

          <Link
            to="/inventory"
            className="p-4 rounded-xl border border-border bg-surface-1 hover:bg-surface-2 hover:border-accent/40 transition-all flex items-start gap-3 group"
          >
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border text-accent group-hover:scale-105 transition-transform shrink-0">
              <Boxes className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                Closing Gifts &amp; Inventory
              </h5>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Track client move-in shirts stock, color variations, and fulfillment logs.
              </p>
            </div>
          </Link>

          <Link
            to="/admin-net-sheets"
            className="p-4 rounded-xl border border-border bg-surface-1 hover:bg-surface-2 hover:border-accent/40 transition-all flex items-start gap-3 group"
          >
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border text-accent group-hover:scale-105 transition-transform shrink-0">
              <Calculator className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                Agent Net Sheets
              </h5>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Review and inspect seller net sheets created across the entire agent roster.
              </p>
            </div>
          </Link>

          <Link
            to="/admin/swag-credits"
            className="p-4 rounded-xl border border-border bg-surface-1 hover:bg-surface-2 hover:border-accent/40 transition-all flex items-start gap-3 group"
          >
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border text-accent group-hover:scale-105 transition-transform shrink-0">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                Swag Credits &amp; Reminders
              </h5>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Issue Shopify gift cards and blast balance reminder emails to agents.
              </p>
            </div>
          </Link>

          <Link
            to="/duty-calendar"
            className="p-4 rounded-xl border border-border bg-surface-1 hover:bg-surface-2 hover:border-accent/40 transition-all flex items-start gap-3 group"
          >
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border text-accent group-hover:scale-105 transition-transform shrink-0">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                Duty Calendar &amp; Shifts
              </h5>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Manage monthly floor duty schedules, agent assignments, and shift trades.
              </p>
            </div>
          </Link>

          <Link
            to="/processes"
            className="p-4 rounded-xl border border-border bg-surface-1 hover:bg-surface-2 hover:border-accent/40 transition-all flex items-start gap-3 group"
          >
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border text-accent group-hover:scale-105 transition-transform shrink-0">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                Internal SOPs &amp; Processes
              </h5>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Documented standard operating procedures and core operational checklists.
              </p>
            </div>
          </Link>

          <Link
            to="/users"
            className="p-4 rounded-xl border border-border bg-surface-1 hover:bg-surface-2 hover:border-accent/40 transition-all flex items-start gap-3 group"
          >
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border text-accent group-hover:scale-105 transition-transform shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                Team Roles &amp; Approvals
              </h5>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Manage staff permissions, review pending accounts, and role assignments.
              </p>
            </div>
          </Link>

          <Link
            to="/calendar"
            search={() => ({})}
            className="p-4 rounded-xl border border-border bg-surface-1 hover:bg-surface-2 hover:border-accent/40 transition-all flex items-start gap-3 group"
          >
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border text-accent group-hover:scale-105 transition-transform shrink-0">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                Content Publishing Calendar
              </h5>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Sequence and review brand social media posts across Instagram and Facebook.
              </p>
            </div>
          </Link>

          <Link
            to="/videos"
            className="p-4 rounded-xl border border-border bg-surface-1 hover:bg-surface-2 hover:border-accent/40 transition-all flex items-start gap-3 group"
          >
            <div className="p-2.5 rounded-lg bg-surface-2 border border-border text-accent group-hover:scale-105 transition-transform shrink-0">
              <Video className="h-4 w-4" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                Video Pipeline Kanban
              </h5>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Track listing walkthroughs, agent reels, and edits from raw footage to publish.
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* Quick View Request Details Modal */}
      <Dialog open={!!selectedRequestModal} onOpenChange={(open) => !open && setSelectedRequestModal(null)}>
        <DialogContent className="max-w-lg bg-surface-1 border-border text-foreground">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono uppercase bg-surface-2">
                {selectedRequestModal?.priority || "Normal"}
              </Badge>
              <DialogTitle className="text-base font-bold text-foreground">
                {selectedRequestModal?.agent_name}&apos;s Request
              </DialogTitle>
            </div>
          </DialogHeader>

          {selectedRequestModal && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface-2/60 border border-border">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono tracking-wider">Agent</span>
                  <div className="font-semibold text-foreground mt-0.5">{selectedRequestModal.agent_name}</div>
                  <div className="text-muted-foreground text-[11px] truncate">{selectedRequestModal.agent_email}</div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono tracking-wider">Deadline</span>
                  <div className="font-semibold text-foreground mt-0.5">
                    {selectedRequestModal.deadline
                      ? format(new Date(selectedRequestModal.deadline), "EEEE, MMM d, yyyy")
                      : "No deadline specified"}
                  </div>
                </div>
              </div>

              {selectedRequestModal.property_address && (
                <div className="p-3 rounded-xl bg-surface-2/60 border border-border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono tracking-wider">Property Address</span>
                  <div className="font-semibold text-foreground mt-0.5">{selectedRequestModal.property_address}</div>
                </div>
              )}

              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-mono tracking-wider mb-1.5">Request Types</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRequestModal.request_types?.map((type) => (
                    <span key={type} className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-xs text-foreground font-medium">
                      {type}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-mono tracking-wider mb-1">Description / Notes</span>
                <div className="p-3 rounded-xl bg-surface-2/80 border border-border text-xs leading-relaxed text-slate-200 whitespace-pre-wrap">
                  {selectedRequestModal.description || "No additional description provided."}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedRequestModal(null)}
              className="text-xs h-9 border-border bg-surface-2 hover:bg-surface-3"
            >
              Close
            </Button>
            {selectedRequestModal && (
              <Button
                type="button"
                onClick={() => quickApproveMutation.mutate(selectedRequestModal.id)}
                disabled={quickApproveMutation.isPending}
                className="text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 shadow-sm"
              >
                {quickApproveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>Approve &amp; Move to In Progress</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
