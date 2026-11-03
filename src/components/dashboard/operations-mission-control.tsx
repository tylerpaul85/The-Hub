import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MyRocksWidget } from "@/components/my-rocks-widget";
import { MyTasksWidget } from "@/components/my-tasks-widget";
import { ClientCareClosingGifts } from "@/components/client-care-closing-gifts";
import { format } from "date-fns";
import {
  Boxes,
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
} from "lucide-react";

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
  const [triageTab, setTriageTab] = useState<"closing-gifts" | "referrals" | "net-sheets" | "content">("closing-gifts");

  const isMarketing = isAdmin || roles?.includes("marketing_coordinator");
  const isClientCare = roles?.includes("client_care");

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

  // Active Open Houses
  const { data: openHousesCount = 0 } = useQuery({
    queryKey: ["ops-pulse-open-houses-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("toolbox_open_houses")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      if (error) return 0;
      return count || 0;
    },
  });

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
          {/* Beacon 1: Closing Gifts */}
          <Link
            to="/inventory"
            className="p-3.5 rounded-2xl border border-border bg-surface-1/90 hover:bg-surface-2/90 hover:border-amber-500/40 transition-all shadow-sm space-y-1 block group"
          >
            <div className="flex items-center justify-between">
              <Boxes className="h-4 w-4 text-amber-400" />
              <Badge
                variant="outline"
                className={`text-[10px] font-bold ${
                  pendingClosingGifts.length > 0
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "bg-surface-2 text-muted-foreground border-border"
                }`}
              >
                {pendingClosingGifts.length} Pending
              </Badge>
            </div>
            <div className="text-lg font-extrabold font-mono text-foreground group-hover:text-amber-400 transition-colors">
              {pendingClosingGifts.length}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">Closing Gifts Queue</div>
          </Link>

          {/* Beacon 2: Outbound Referrals */}
          <Link
            to="/admin/referrals"
            className="p-3.5 rounded-2xl border border-border bg-surface-1/90 hover:bg-surface-2/90 hover:border-purple-500/40 transition-all shadow-sm space-y-1 block group"
          >
            <div className="flex items-center justify-between">
              <Send className="h-4 w-4 text-purple-400" />
              <Badge
                variant="outline"
                className="text-[10px] font-bold bg-purple-500/15 text-purple-400 border-purple-500/30"
              >
                Active Desk
              </Badge>
            </div>
            <div className="text-lg font-extrabold font-mono text-foreground group-hover:text-purple-400 transition-colors">
              {activeReferrals.length}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">Outbound Deals</div>
          </Link>

          {/* Beacon 3: Weekend Open Houses */}
          <Link
            to="/open-houses"
            className="p-3.5 rounded-2xl border border-border bg-surface-1/90 hover:bg-surface-2/90 hover:border-blue-500/40 transition-all shadow-sm space-y-1 block group"
          >
            <div className="flex items-center justify-between">
              <Calendar className="h-4 w-4 text-blue-400" />
              <Badge
                variant="outline"
                className="text-[10px] font-bold bg-blue-500/15 text-blue-400 border-blue-500/30"
              >
                Kiosks
              </Badge>
            </div>
            <div className="text-lg font-extrabold font-mono text-foreground group-hover:text-blue-400 transition-colors">
              {openHousesCount}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">Open Houses Active</div>
          </Link>

          {/* Beacon 4: Swag Store Balances in Field */}
          <Link
            to="/admin/swag-credits"
            className="p-3.5 rounded-2xl border border-border bg-surface-1/90 hover:bg-surface-2/90 hover:border-emerald-500/40 transition-all shadow-sm space-y-1 block group"
          >
            <div className="flex items-center justify-between">
              <ShoppingBag className="h-4 w-4 text-emerald-400" />
              <Badge
                variant="outline"
                className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
              >
                {swagStats.count} Cards
              </Badge>
            </div>
            <div className="text-lg font-extrabold font-mono text-foreground group-hover:text-emerald-400 transition-colors">
              ${swagStats.totalBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">Unspent Swag Credit</div>
          </Link>

          {/* Beacon 5: Agent Net Sheets */}
          <Link
            to="/admin-net-sheets"
            className="p-3.5 rounded-2xl border border-border bg-surface-1/90 hover:bg-surface-2/90 hover:border-amber-500/40 transition-all shadow-sm space-y-1 block group"
          >
            <div className="flex items-center justify-between">
              <Calculator className="h-4 w-4 text-amber-400" />
              <Badge
                variant="outline"
                className="text-[10px] font-bold bg-surface-2 text-muted-foreground border-border"
              >
                Archived
              </Badge>
            </div>
            <div className="text-lg font-extrabold font-mono text-foreground group-hover:text-amber-400 transition-colors">
              {recentNetSheets.length}+
            </div>
            <div className="text-[11px] text-muted-foreground truncate">Agent Net Sheets</div>
          </Link>

          {/* Beacon 6: Content Approvals */}
          <Link
            to="/calendar"
            search={() => ({})}
            className="p-3.5 rounded-2xl border border-border bg-surface-1/90 hover:bg-surface-2/90 hover:border-rose-500/40 transition-all shadow-sm space-y-1 block group"
          >
            <div className="flex items-center justify-between">
              <ListTodo className="h-4 w-4 text-rose-400" />
              <Badge
                variant="outline"
                className={`text-[10px] font-bold ${
                  contentReviewItems.length > 0
                    ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                    : "bg-surface-2 text-muted-foreground border-border"
                }`}
              >
                Review
              </Badge>
            </div>
            <div className="text-lg font-extrabold font-mono text-foreground group-hover:text-rose-400 transition-colors">
              {contentReviewItems.length}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">Marketing Reviews</div>
          </Link>
        </div>
      </section>

      {/* ─── Operations Live Triage Stream (Interactive Feed) ─── */}
      <section className="bg-surface-1 border border-border/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-bold text-foreground">Operational Triage Stream</h4>
            <p className="text-xs text-muted-foreground">Actionable queues for client fulfillment, outbound referrals, and deal documents</p>
          </div>

          <Tabs value={triageTab} onValueChange={(v) => setTriageTab(v as any)} className="w-auto">
            <TabsList className="bg-surface-2 h-8 p-0.5 border border-border">
              <TabsTrigger value="closing-gifts" className="text-xs h-7 px-3 flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5" />
                <span>Closing Gifts</span>
                {pendingClosingGifts.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                    {pendingClosingGifts.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="referrals" className="text-xs h-7 px-3 flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5" />
                <span>Referral Desk</span>
                <span className="px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold">
                  {activeReferrals.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="net-sheets" className="text-xs h-7 px-3 flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5" />
                <span>Net Sheets</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="p-0">
          {triageTab === "closing-gifts" && (
            <div className="divide-y divide-border/40">
              {pendingClosingGifts.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground space-y-1">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                  <div className="font-semibold text-foreground">All Closing Gifts Fulfilled!</div>
                  <p>No client gift requests currently waiting for courier delivery.</p>
                </div>
              ) : (
                pendingClosingGifts.slice(0, 5).map((req) => (
                  <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-2/40 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {req.client_first_name} {req.client_last_name}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                          Pending Delivery
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>Agent: <strong className="text-slate-200">{req.agent_name}</strong></span>
                        {req.closing_date && <span>• Closing: {format(new Date(req.closing_date), "MMM d, yyyy")}</span>}
                        {req.closing_location && <span className="capitalize">• Office: {req.closing_location}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <Link
                        to="/inventory"
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors shadow-sm"
                      >
                        <Boxes className="h-3.5 w-3.5" />
                        <span>Fulfill in Inventory</span>
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
      </section>

      {/* ─── EOS Quarterly Execution & Task Velocity ─── */}
      <section className="space-y-4">
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
      </section>

      {/* ─── Operations & Marketing Tool Matrix ─── */}
      <section className="space-y-3">
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
    </div>
  );
}
