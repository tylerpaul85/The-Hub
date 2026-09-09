import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn, getGoogleDrivePreviewUrl } from "@/lib/utils";
import {
  Home,
  Plus,
  QrCode as QrIcon,
  Download,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Users,
  Search,
  X,
  FileSpreadsheet,
  Printer,
  Smartphone,
  ExternalLink,
  Sparkles,
  Archive,
  ArchiveRestore,
  Trash2,
  Image as ImageIcon,
  AlertTriangle,
  ClipboardCheck,
  BarChart3,
  Layers,
  ArrowUpDown,
  FileText,
  Copy,
} from "lucide-react";
import { QrCode } from "@/components/qr-code";
import logo from "@/assets/msreg-logo.png";
import {
  getOpenHouseSignins,
  getOpenHouseChecklist,
  toggleOpenHouseChecklistItem,
  getChecklistTemplates,
  updateChecklistTemplates,
  cloneListingAssetsToOpenHouse,
  getOpenHousesAnalytics,
} from "@/lib/open-houses.functions";

export const Route = createFileRoute("/_authenticated/open-houses")({
  component: OpenHousesPage,
  head: () => ({
    meta: [{ title: "Open Houses Hub — Matt Smith Real Estate Group" }],
  }),
});

const sb = supabase as any;

type OpenHouseItem = {
  id: string;
  address: string;
  agent_name: string | null;
  host_agent_id?: string | null;
  listing_id?: string | null;
  status: string;
  open_house_at: string | null;
  start_time?: string | null;
  end_time?: string | null;
  description: string | null;
  created_at: string;
  archived?: boolean;
  is_completed?: boolean;
  completed_at?: string | null;
};

type ListingOption = {
  id: string;
  address: string;
  agent_name: string | null;
  status: string;
  description: string | null;
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function isThisWeekend(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  
  // Calculate upcoming Friday and Sunday
  const day = now.getDay();
  const diffToFriday = (5 - day + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() + diffToFriday);
  friday.setHours(0, 0, 0, 0);

  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);
  sunday.setHours(23, 59, 59, 999);

  return d >= friday && d <= sunday;
}

export function OpenHousesPage() {
  const qc = useQueryClient();
  const { user, profile, roles, isAdmin } = useAuth();
  const searchParams = useRouterState({ select: (s) => s.location.search }) as Record<string, any>;
  const initialSelectedId = searchParams?.id || null;

  const [timeFilter, setTimeFilter] = useState<"weekend" | "upcoming" | "all" | "archived">("upcoming");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"hub" | "analytics" | "templates">("hub");

  // Open House Management State
  const [selectedOpenHouseId, setSelectedOpenHouseId] = useState<string | null>(initialSelectedId);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Load all open houses
  const { data: allOpenHouses = [], isLoading } = useQuery<OpenHouseItem[]>({
    queryKey: ["all-open-houses"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("toolbox_open_houses")
        .select("*")
        .order("open_house_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as OpenHouseItem[];
    },
  });

  // Load thumbnails and assets count
  const { data: counts = {} } = useQuery<Record<string, { assets: number; thumb: string | null }>>({
    queryKey: ["open-houses-counts", allOpenHouses.map((l) => l.id).join(",")],
    enabled: allOpenHouses.length > 0,
    queryFn: async () => {
      const { data } = await sb
        .from("toolbox_open_house_assets")
        .select("open_house_id,thumbnail_url,file_url,asset_type,category");
      const isImg = (u: string | null | undefined) =>
        !!u && /\.(png|jpe?g|gif|webp|svg|avif|heic)(\?|#|$)/i.test(String(u).split("?")[0]);
      const out: Record<string, { assets: number; thumb: string | null }> = {};
      for (const l of allOpenHouses) out[l.id] = { assets: 0, thumb: null };
      for (const a of (data ?? []) as any[]) {
        if (!out[a.open_house_id]) continue;
        out[a.open_house_id].assets++;
      }
      for (const a of (data ?? []) as any[]) {
        if (!out[a.open_house_id]) continue;
        if (out[a.open_house_id].thumb) continue;
        const c = a.thumbnail_url || a.file_url;
        if (isImg(c)) out[a.open_house_id].thumb = c;
      }
      return out;
    },
  });

  // Load signins counts for badges
  const { data: signinCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["open-houses-signin-counts", allOpenHouses.map((l) => l.id).join(",")],
    enabled: allOpenHouses.length > 0,
    queryFn: async () => {
      const { data } = await sb.from("open_house_signins").select("open_house_id");
      const out: Record<string, number> = {};
      for (const l of allOpenHouses) out[l.id] = 0;
      for (const s of (data ?? []) as any[]) {
        if (!out[s.open_house_id]) out[s.open_house_id] = 0;
        out[s.open_house_id] += 1;
      }
      return out;
    },
  });

  // Load checklist completion counts
  const { data: checklistStats = {} } = useQuery<Record<string, { total: number; completed: number }>>({
    queryKey: ["open-houses-checklist-stats", allOpenHouses.map((l) => l.id).join(",")],
    enabled: allOpenHouses.length > 0,
    queryFn: async () => {
      const { data } = await sb.from("open_house_checklist_items").select("open_house_id, completed");
      const out: Record<string, { total: number; completed: number }> = {};
      for (const l of allOpenHouses) out[l.id] = { total: 0, completed: 0 };
      for (const i of (data ?? []) as any[]) {
        if (!out[i.open_house_id]) out[i.open_house_id] = { total: 0, completed: 0 };
        out[i.open_house_id].total += 1;
        if (i.completed) out[i.open_house_id].completed += 1;
      }
      return out;
    },
  });

  // Available agent names for filtering
  const agentNames = useMemo(() => {
    const set = new Set<string>();
    for (const oh of allOpenHouses) {
      if (oh.agent_name) set.add(oh.agent_name.trim());
    }
    return Array.from(set).sort();
  }, [allOpenHouses]);

  // Filter open houses
  const filteredOpenHouses = useMemo(() => {
    return allOpenHouses.filter((oh) => {
      // 1. Time / Status Filter
      if (timeFilter === "archived") {
        if (!oh.archived) return false;
      } else {
        if (oh.archived) return false;
        if (timeFilter === "weekend" && !isThisWeekend(oh.open_house_at)) return false;
        if (timeFilter === "upcoming") {
          if (oh.open_house_at && new Date(oh.open_house_at) < new Date(Date.now() - 24 * 3600 * 1000)) {
            return false;
          }
        }
      }

      // 2. Agent Filter
      if (agentFilter !== "all" && (oh.agent_name || "").toLowerCase() !== agentFilter.toLowerCase()) {
        return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          (oh.address || "").toLowerCase().includes(q) ||
          (oh.agent_name || "").toLowerCase().includes(q) ||
          (oh.description || "").toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [allOpenHouses, timeFilter, agentFilter, searchQuery]);

  const weekendCount = allOpenHouses.filter((oh) => !oh.archived && isThisWeekend(oh.open_house_at)).length;
  const upcomingCount = allOpenHouses.filter(
    (oh) => !oh.archived && (!oh.open_house_at || new Date(oh.open_house_at) >= new Date(Date.now() - 24 * 3600 * 1000))
  ).length;
  const archivedCount = allOpenHouses.filter((oh) => oh.archived).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground tracking-tight">
              Open Houses Hub
            </h1>
            <Badge className="bg-gold/15 text-gold border-gold/30 text-xs">
              Team Workspace
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule, manage, and execute open houses end-to-end with live visitor sign-in, Follow Up Boss exports, and 5-phase process checklists.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="inline-flex rounded-md border border-border overflow-hidden shrink-0 mr-1">
              <button
                type="button"
                onClick={() => setActiveTab("hub")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  activeTab === "hub" ? "bg-gold text-navy" : "hover:bg-accent/40 text-foreground"
                )}
              >
                Open Houses
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("analytics")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium border-l border-border transition-colors",
                  activeTab === "analytics" ? "bg-gold text-navy" : "hover:bg-accent/40 text-foreground"
                )}
              >
                Lead Analytics
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("templates")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium border-l border-border transition-colors",
                  activeTab === "templates" ? "bg-gold text-navy" : "hover:bg-accent/40 text-foreground"
                )}
              >
                Checklist Template
              </button>
            </div>
          )}

          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-gold text-navy hover:bg-gold/90 font-semibold shadow-md shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Schedule Open House
          </Button>
        </div>
      </div>

      {activeTab === "analytics" ? (
        <OpenHousesAnalyticsView />
      ) : activeTab === "templates" ? (
        <ChecklistTemplateManager />
      ) : (
        /* Main Hub View */
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/80 shadow-sm">
            {/* Time Filter Pills */}
            <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setTimeFilter("weekend")}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md font-medium transition-colors whitespace-nowrap",
                  timeFilter === "weekend" ? "bg-gold text-navy shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                This Weekend ({weekendCount})
              </button>
              <button
                type="button"
                onClick={() => setTimeFilter("upcoming")}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md font-medium transition-colors whitespace-nowrap",
                  timeFilter === "upcoming" ? "bg-gold text-navy shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Upcoming ({upcomingCount})
              </button>
              <button
                type="button"
                onClick={() => setTimeFilter("all")}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md font-medium transition-colors whitespace-nowrap",
                  timeFilter === "all" ? "bg-gold text-navy shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Active ({allOpenHouses.filter((o) => !o.archived).length})
              </button>
              <button
                type="button"
                onClick={() => setTimeFilter("archived")}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md font-medium transition-colors whitespace-nowrap",
                  timeFilter === "archived" ? "bg-gold text-navy shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Archived ({archivedCount})
              </button>
            </div>

            {/* Agent Dropdown & Search */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0 max-w-2xl">
              {agentNames.length > 0 && (
                <Select value={agentFilter} onValueChange={setAgentFilter}>
                  <SelectTrigger className="w-44 text-xs h-9 shrink-0">
                    <SelectValue placeholder="Filter by Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Hosting Agents</SelectItem>
                    {agentNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search address or agent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold border-t-transparent mx-auto mb-3" />
              Loading open houses...
            </div>
          ) : filteredOpenHouses.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground border-dashed">
              <Home className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <div className="font-medium text-foreground">No open houses match your filters</div>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {timeFilter === "weekend"
                  ? "There are no open houses scheduled for this upcoming weekend. Schedule one to start prepping!"
                  : "Schedule a new open house or adjust your search filter above."}
              </p>
              <Button
                onClick={() => setCreateModalOpen(true)}
                variant="outline"
                className="mt-4 text-xs border-gold/50 text-gold hover:bg-gold/10"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Schedule New Open House
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredOpenHouses.map((oh) => {
                const c = counts[oh.id] ?? { assets: 0, thumb: null };
                const signinsCount = signinCounts[oh.id] ?? 0;
                const stats = checklistStats[oh.id] ?? { total: 0, completed: 0 };
                const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                const isArchived = !!oh.archived;

                return (
                  <Card
                    key={oh.id}
                    className={cn(
                      "overflow-hidden flex flex-col border border-border/80 hover:border-gold/50 transition-all duration-300 group shadow-sm bg-card",
                      isArchived && "opacity-80"
                    )}
                  >
                    {/* Thumbnail banner */}
                    <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                      {c.thumb ? (
                        <img
                          src={c.thumb}
                          alt={oh.address}
                          className={cn(
                            "w-full h-full object-cover transition-transform duration-500 group-hover:scale-105",
                            isArchived && "grayscale"
                          )}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 bg-gradient-to-br from-muted/80 to-muted">
                          <Home className="h-10 w-10" />
                        </div>
                      )}

                      {/* Overlays & Badges */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <Badge className="bg-background/90 text-foreground border border-border/60 text-xs backdrop-blur-sm shadow-sm font-medium">
                          {oh.status === "upcoming" ? "Upcoming" : "Past"}
                        </Badge>
                        {isThisWeekend(oh.open_house_at) && !isArchived && (
                          <Badge className="bg-gold text-navy font-bold text-xs shadow-sm">
                            This Weekend
                          </Badge>
                        )}
                      </div>

                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                        {signinsCount > 0 && (
                          <Badge className="bg-emerald-600 text-white font-semibold text-xs shadow-sm flex items-center gap-1">
                            <Users className="h-3 w-3" /> {signinsCount} Lead{signinsCount === 1 ? "" : "s"}
                          </Badge>
                        )}
                        {isArchived && (
                          <Badge className="bg-navy/90 text-gold border border-gold/40 text-xs">
                            Archived
                          </Badge>
                        )}
                      </div>

                      {/* Bottom banner with date */}
                      {oh.open_house_at && (
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 pt-6 text-white text-xs flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-gold shrink-0" />
                          <span className="font-medium truncate">{fmtDateTime(oh.open_house_at)}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        <h3 className="font-serif font-semibold text-lg text-foreground line-clamp-1 group-hover:text-gold transition-colors">
                          {oh.address}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3.5 w-3.5 text-gold/80 shrink-0" />
                          <span className="truncate">{oh.agent_name || "Unassigned"}</span>
                        </div>
                      </div>

                      {/* Checklist progress */}
                      <div className="space-y-1 bg-muted/30 p-2.5 rounded-lg border border-border/50">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-medium flex items-center gap-1">
                            <ClipboardCheck className="h-3.5 w-3.5 text-gold" /> Process Checklist
                          </span>
                          <span className="font-semibold text-foreground">
                            {stats.completed}/{stats.total > 0 ? stats.total : 21} ({pct}%)
                          </span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2 flex items-center gap-2 border-t border-border/60">
                        <Button
                          onClick={() => setSelectedOpenHouseId(oh.id)}
                          className="flex-1 bg-gold text-navy hover:bg-gold/90 font-semibold text-xs h-8"
                        >
                          Manage Open House
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-foreground hover:text-gold shrink-0"
                          onClick={() => setSelectedOpenHouseId(oh.id)}
                          title="View QR Code & Placard"
                        >
                          <QrIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Schedule / Create Open House Dialog */}
      <ScheduleOpenHouseModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        userId={user?.id || null}
        onCreated={(id) => {
          qc.invalidateQueries({ queryKey: ["all-open-houses"] });
          setSelectedOpenHouseId(id);
        }}
      />

      {/* Standalone Open House Management Workspace Drawer / Sheet */}
      {selectedOpenHouseId && (
        <OpenHouseManagementSheet
          openHouseId={selectedOpenHouseId}
          onClose={() => setSelectedOpenHouseId(null)}
          userId={user?.id || null}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------
 * SCHEDULE OPEN HOUSE MODAL (Agent Toolbox creation with auto-attach)
 * ------------------------------------------------------------- */

function ScheduleOpenHouseModal({
  open,
  onOpenChange,
  userId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const cloneAssets = useServerFn(cloneListingAssetsToOpenHouse);

  const [selectedListingId, setSelectedListingId] = useState<string>("none");
  const [form, setForm] = useState({
    address: "",
    agent_name: profile?.full_name || "",
    status: "upcoming",
    open_house_at: "",
    description: "",
  });

  // Fetch active listings for selection
  const { data: listings = [] } = useQuery<ListingOption[]>({
    queryKey: ["toolbox-listings-for-oh"],
    enabled: open,
    queryFn: async () => {
      const { data } = await sb
        .from("toolbox_listings")
        .select("id, address, agent_name, status, description")
        .eq("archived", false)
        .order("created_at", { ascending: false });
      return (data ?? []) as ListingOption[];
    },
  });

  // Team users for host agent selection
  const { data: teamProfiles = [] } = useQuery<{ id: string; full_name: string }[]>({
    queryKey: ["team-profiles-for-oh"],
    enabled: open,
    queryFn: async () => {
      const { data } = await sb.from("profiles").select("id, full_name").order("full_name", { ascending: true });
      return (data ?? []) as { id: string; full_name: string }[];
    },
  });

  // When a listing is picked, autofill address & agent if available
  const handleListingSelect = (listingId: string) => {
    setSelectedListingId(listingId);
    if (listingId === "none") return;
    const l = listings.find((x) => x.id === listingId);
    if (l) {
      setForm((prev) => ({
        ...prev,
        address: l.address || prev.address,
        agent_name: l.agent_name || prev.agent_name,
        description: l.description || prev.description,
      }));
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.address.trim()) throw new Error("Property address is required.");
      if (!form.open_house_at) throw new Error("Open house date and time is required.");

      // 1. Create open house
      const { data: newOH, error } = await sb
        .from("toolbox_open_houses")
        .insert({
          address: form.address.trim(),
          agent_name: form.agent_name.trim() || null,
          listing_id: selectedListingId !== "none" ? selectedListingId : null,
          status: form.status,
          open_house_at: form.open_house_at ? new Date(form.open_house_at).toISOString() : null,
          description: form.description.trim() || null,
          created_by: userId,
        })
        .select("id")
        .single();

      if (error) throw error;
      const ohId = newOH.id;

      // 2. Auto-attach listing assets & captions if listing was chosen
      if (selectedListingId && selectedListingId !== "none") {
        try {
          await cloneAssets({ data: { listingId: selectedListingId, openHouseId: ohId } });
        } catch (cloneErr) {
          console.error("Warning: asset clone error:", cloneErr);
        }
      }

      // 3. Seed default checklist items for this open house
      const { data: templates } = await sb
        .from("open_house_checklist_templates")
        .select("*")
        .order("phase_order", { ascending: true })
        .order("task_order", { ascending: true });

      if (templates && templates.length > 0) {
        const items = templates.map((t: any) => ({
          open_house_id: ohId,
          phase: t.phase,
          phase_order: t.phase_order,
          task_text: t.task_text,
          task_order: t.task_order,
          completed: false,
        }));
        await sb.from("open_house_checklist_items").insert(items);
      }

      return ohId;
    },
    onSuccess: (id) => {
      toast.success("Open house scheduled! Marketing assets and checklist have been initialized.");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["all-open-houses"] });
      onCreated(id);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to schedule open house.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Schedule Open House</DialogTitle>
          <DialogDescription>
            Create an open house record. Select an existing listing to automatically pull photos, flyers, and marketing materials.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Listing Selector */}
          <div className="space-y-1.5 bg-muted/40 p-3 rounded-lg border border-border">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-gold" /> Select from Existing Listing (Auto-Attaches Materials)
            </Label>
            <Select value={selectedListingId} onValueChange={handleListingSelect}>
              <SelectTrigger className="text-xs bg-card">
                <SelectValue placeholder="Choose a listing..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Enter Manually (No Listing Link) --</SelectItem>
                {listings.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.address} {l.agent_name ? `(${l.agent_name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Property Address *</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. 123 Maple Street, Rolla, MO"
              className="text-xs"
            />
          </div>

          {/* Hosting Agent */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Hosting Agent Name</Label>
              <Input
                value={form.agent_name}
                onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
                placeholder="Agent Name"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date &amp; Time *</Label>
              <Input
                type="datetime-local"
                value={form.open_house_at}
                onChange={(e) => setForm({ ...form, open_house_at: e.target.value })}
                className="text-xs"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Special Notes / Description (Optional)</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Refreshments provided, neighborhood preview at 12:30pm"
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="bg-gold text-navy hover:bg-gold/90 font-semibold text-xs"
          >
            {createMutation.isPending ? "Scheduling..." : "Schedule & Open Management"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------
 * OPEN HOUSE MANAGEMENT WORKSPACE (Sheet with live signins, QR, FUB CSV, Checklist)
 * ------------------------------------------------------------- */

function OpenHouseManagementSheet({
  openHouseId,
  onClose,
  userId,
}: {
  openHouseId: string;
  onClose: () => void;
  userId: string | null;
}) {
  const qc = useQueryClient();
  const fetchSignins = useServerFn(getOpenHouseSignins);
  const fetchChecklist = useServerFn(getOpenHouseChecklist);
  const toggleItem = useServerFn(toggleOpenHouseChecklistItem);

  const [activeSubTab, setActiveSubTab] = useState<"leads" | "qrcode" | "checklist" | "marketing" | "settings">("leads");
  const [fullscreenKioskOpen, setFullscreenKioskOpen] = useState(false);

  // Load Open House Record
  const { data: oh, isLoading: ohLoading } = useQuery<OpenHouseItem | null>({
    queryKey: ["open-house-detail", openHouseId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("toolbox_open_houses")
        .select("*")
        .eq("id", openHouseId)
        .maybeSingle();
      if (error) throw error;
      return data as OpenHouseItem | null;
    },
  });

  // Load Signins
  const { data: signinsData, isLoading: signinsLoading, refetch: refetchSignins } = useQuery({
    queryKey: ["open-house-signins", openHouseId],
    queryFn: () => fetchSignins({ data: { openHouseId } }),
    refetchInterval: 10_000, // live poll during open house
  });
  const signins = signinsData?.signins ?? [];

  // Load Checklist
  const { data: checklistData, isLoading: checklistLoading, refetch: refetchChecklist } = useQuery({
    queryKey: ["open-house-checklist", openHouseId],
    queryFn: () => fetchChecklist({ data: { openHouseId } }),
  });
  const checklistItems = (checklistData?.items ?? []) as any[];

  // Load Marketing Assets
  const { data: assets = [] } = useQuery({
    queryKey: ["open-house-assets", openHouseId],
    queryFn: async () => {
      const { data } = await sb
        .from("toolbox_open_house_assets")
        .select("*")
        .eq("open_house_id", openHouseId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Public Signin URL for this Open House
  const signinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/open-house-signin/${openHouseId}`
    : `https://thehub.mattsmithrealestate.com/open-house-signin/${openHouseId}`;

  // Toggle checklist item mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string; completed: boolean }) => {
      await toggleItem({ data: { itemId, completed } });
    },
    onSuccess: () => {
      refetchChecklist();
      qc.invalidateQueries({ queryKey: ["open-houses-checklist-stats"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update item"),
  });

  // Archive / Restore mutation
  const archiveMutation = useMutation({
    mutationFn: async (archived: boolean) => {
      const { error } = await sb.from("toolbox_open_houses").update({ archived }).eq("id", openHouseId);
      if (error) throw error;
    },
    onSuccess: (_d, archived) => {
      toast.success(archived ? "Open house archived" : "Open house restored");
      qc.invalidateQueries({ queryKey: ["all-open-houses"] });
      qc.invalidateQueries({ queryKey: ["open-house-detail", openHouseId] });
    },
  });

  // Export to CSV for Follow Up Boss
  const exportFollowUpBossCsv = () => {
    if (signins.length === 0) {
      toast.error("No visitor sign-ins to export yet.");
      return;
    }

    const headers = [
      "First Name",
      "Last Name",
      "Emails",
      "Phones",
      "Stage",
      "Source",
      "Tags",
      "Background",
      "Collaborators",
      "Created At",
    ];

    const rows = signins.map((s: any) => {
      const tags = ["Open House"];
      if (s.working_with_agent) tags.push("Has Agent");
      if (s.buying_or_selling === "buying") tags.push("Buyer Lead");
      if (s.buying_or_selling === "selling") tags.push("Seller Lead");
      if (s.buying_or_selling === "both") tags.push("Buyer & Seller Lead");

      const backgroundNotes = [
        `Open House: ${oh?.address || "Event"}`,
        `Working with Agent: ${s.working_with_agent ? `Yes (${s.agent_name || "Unspecified"})` : "No"}`,
        `Intent: ${s.buying_or_selling || "Just browsing"}`,
        `Timeframe: ${s.timeframe || "Just browsing"}`,
        s.notes ? `Visitor Notes: ${s.notes}` : "",
      ].filter(Boolean).join(" | ");

      return [
        `"${(s.first_name || "").replace(/"/g, '""')}"`,
        `"${(s.last_name || "").replace(/"/g, '""')}"`,
        `"${(s.email || "").replace(/"/g, '""')}"`,
        `"${(s.phone || "").replace(/"/g, '""')}"`,
        `"Lead"`,
        `"Open House - ${(oh?.address || "").replace(/"/g, '""')}"`,
        `"${tags.join(",")}"`,
        `"${backgroundNotes.replace(/"/g, '""')}"`,
        `"${(oh?.agent_name || "").replace(/"/g, '""')}"`,
        `"${new Date(s.created_at).toLocaleString()}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeAddress = (oh?.address || "OpenHouse").replace(/[^a-zA-Z0-9_-]/g, "_");
    link.setAttribute("href", url);
    link.setAttribute("download", `FUB_OpenHouse_${safeAddress}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${signins.length} leads in Follow Up Boss CSV format!`);
  };

  // Group checklist items by phase
  const phases = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const item of checklistItems) {
      if (!map[item.phase]) map[item.phase] = [];
      map[item.phase].push(item);
    }
    return Object.entries(map).map(([phaseName, items]) => ({
      phaseName,
      phaseOrder: items[0]?.phase_order || 1,
      items: items.sort((a, b) => a.task_order - b.task_order),
    })).sort((a, b) => a.phaseOrder - b.phaseOrder);
  }, [checklistItems]);

  const totalChecklist = checklistItems.length;
  const completedChecklist = checklistItems.filter((i) => i.completed).length;
  const checklistPct = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  return (
    <Sheet open={true} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto p-0 flex flex-col bg-background">
        {/* Workspace Top Header */}
        <SheetHeader className="p-5 border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="font-serif text-xl font-bold truncate text-foreground">
                  {oh?.address || "Open House Management"}
                </SheetTitle>
                {oh?.archived && (
                  <Badge className="bg-navy/90 text-gold border border-gold/40 text-xs">
                    Archived
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {oh?.agent_name && (
                  <span className="flex items-center gap-1 text-foreground font-medium">
                    <User className="h-3.5 w-3.5 text-gold" /> {oh.agent_name}
                  </span>
                )}
                {oh?.open_house_at && (
                  <span className="flex items-center gap-1 text-gold">
                    <Calendar className="h-3.5 w-3.5" /> {fmtDateTime(oh.open_house_at)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => setFullscreenKioskOpen(true)}
                className="bg-gold text-navy hover:bg-gold/90 font-semibold text-xs h-8"
              >
                <Smartphone className="h-3.5 w-3.5 mr-1" /> On-Screen Kiosk
              </Button>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-1 border-b border-border/80 pt-4 overflow-x-auto">
            <button
              onClick={() => setActiveSubTab("leads")}
              className={cn(
                "px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5",
                activeSubTab === "leads"
                  ? "border-gold text-gold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-3.5 w-3.5" /> Live Sign-Ins ({signins.length})
            </button>
            <button
              onClick={() => setActiveSubTab("qrcode")}
              className={cn(
                "px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5",
                activeSubTab === "qrcode"
                  ? "border-gold text-gold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <QrIcon className="h-3.5 w-3.5" /> QR Code &amp; Placard
            </button>
            <button
              onClick={() => setActiveSubTab("checklist")}
              className={cn(
                "px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5",
                activeSubTab === "checklist"
                  ? "border-gold text-gold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <ClipboardCheck className="h-3.5 w-3.5" /> Process Checklist ({completedChecklist}/{totalChecklist})
            </button>
            <button
              onClick={() => setActiveSubTab("marketing")}
              className={cn(
                "px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5",
                activeSubTab === "marketing"
                  ? "border-gold text-gold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <ImageIcon className="h-3.5 w-3.5" /> Marketing Materials ({assets.length})
            </button>
            <button
              onClick={() => setActiveSubTab("settings")}
              className={cn(
                "px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5",
                activeSubTab === "settings"
                  ? "border-gold text-gold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Settings &amp; Archive
            </button>
          </div>
        </SheetHeader>

        {/* Workspace Body */}
        <div className="p-5 flex-1 space-y-6">
          {/* TAB 1: LIVE SIGN-INS & FOLLOW UP BOSS EXPORT */}
          {activeSubTab === "leads" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-4 rounded-xl border border-border">
                <div>
                  <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    Live Sign-In Feed ({signins.length} Total Attendees)
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Visitors who scan the QR code appear here in real-time. Export directly to Follow Up Boss.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refetchSignins()}
                    className="text-xs h-8"
                  >
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={exportFollowUpBossCsv}
                    disabled={signins.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Export to Follow Up Boss CSV
                  </Button>
                </div>
              </div>

              {signinsLoading ? (
                <div className="text-center py-8 text-xs text-muted-foreground">Loading visitor sign-ins...</div>
              ) : signins.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground border-dashed">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <div className="font-medium text-sm text-foreground">No visitors have signed in yet</div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Display the QR Code placard or open the On-Screen Kiosk mode on your phone/tablet for visitors to register.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setActiveSubTab("qrcode")}
                    variant="outline"
                    className="mt-3 text-xs border-gold/50 text-gold hover:bg-gold/10"
                  >
                    View QR Code &amp; Printable Placard
                  </Button>
                </Card>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/80 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                        <tr>
                          <th className="p-3">Visitor Name</th>
                          <th className="p-3">Contact</th>
                          <th className="p-3">Agent Status</th>
                          <th className="p-3">Intent &amp; Timeframe</th>
                          <th className="p-3">Comments</th>
                          <th className="p-3">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {signins.map((s: any) => (
                          <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-semibold text-foreground">
                              {s.first_name} {s.last_name}
                            </td>
                            <td className="p-3 space-y-0.5">
                              <div className="font-medium">{s.phone}</div>
                              {s.email && <div className="text-muted-foreground text-[11px]">{s.email}</div>}
                            </td>
                            <td className="p-3">
                              {s.working_with_agent ? (
                                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30">
                                  Has Agent: {s.agent_name || "Yes"}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                                  Unrepresented
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 space-y-0.5">
                              <div className="capitalize font-medium">{s.buying_or_selling?.replace(/_/g, " ") || "Browsing"}</div>
                              <div className="text-muted-foreground text-[11px] capitalize">{s.timeframe?.replace(/_/g, " ")}</div>
                            </td>
                            <td className="p-3 text-muted-foreground max-w-xs truncate">
                              {s.notes || "—"}
                            </td>
                            <td className="p-3 text-muted-foreground whitespace-nowrap">
                              {new Date(s.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: QR CODE & PRINTABLE PLACARD */}
          {activeSubTab === "qrcode" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Printable Placard Preview Card */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif font-bold text-base text-foreground">
                      Printable Sign-In Table Placard
                    </h3>
                    <Button
                      size="sm"
                      onClick={() => window.print()}
                      className="bg-gold text-navy hover:bg-gold/90 font-semibold text-xs h-8"
                    >
                      <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Placard (8.5×11)
                    </Button>
                  </div>

                  <div className="p-6 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 shadow-md text-center space-y-4 print:border-none print:shadow-none">
                    <img src={logo} alt="MSREG Logo" className="h-10 w-auto mx-auto" />
                    <div className="space-y-1">
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                        Welcome to Our Open House
                      </div>
                      <h2 className="text-xl font-serif font-bold text-slate-900 leading-tight">
                        {oh?.address || "Open House"}
                      </h2>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl inline-block mx-auto">
                      <QrCode value={signinUrl} size={160} />
                    </div>

                    <div className="space-y-1 text-slate-700">
                      <div className="font-bold text-sm">Please Scan to Sign In</div>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">
                        Point your phone's camera at the QR code above to access the digital guest sign-in.
                      </p>
                    </div>

                    {oh?.agent_name && (
                      <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 font-medium">
                        Hosted by {oh.agent_name} &bull; Matt Smith Real Estate Group
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct Link & On-Screen Display */}
                <div className="space-y-4">
                  <h3 className="font-serif font-bold text-base text-foreground">
                    Digital Access Modes
                  </h3>

                  <Card className="p-4 space-y-3 bg-muted/20 border-border">
                    <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 text-gold" /> On-Screen Kiosk Mode (No Printing Required)
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Hand your phone or iPad to visitors as they arrive. Shows full-screen QR code and direct sign-in button.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setFullscreenKioskOpen(true)}
                      className="w-full bg-gold text-navy hover:bg-gold/90 font-semibold text-xs h-9"
                    >
                      Launch Full-Screen Kiosk
                    </Button>
                  </Card>

                  <Card className="p-4 space-y-3 bg-muted/20 border-border">
                    <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <ExternalLink className="h-4 w-4 text-gold" /> Public Sign-In Web Link
                    </div>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={signinUrl} className="text-xs h-8 bg-card font-mono text-muted-foreground" />
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(signinUrl);
                          toast.success("Link copied to clipboard!");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 shrink-0"
                        onClick={() => window.open(signinUrl, "_blank")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 5-PHASE PROCESS CHECKLIST */}
          {activeSubTab === "checklist" && (
            <div className="space-y-5">
              {/* Progress Banner */}
              <div className="bg-card p-4 rounded-xl border border-border space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <ClipboardCheck className="h-4 w-4 text-gold" /> Open House Execution Progress
                  </span>
                  <span className="font-bold text-gold">
                    {completedChecklist} of {totalChecklist} Tasks Complete ({checklistPct}%)
                  </span>
                </div>
                <Progress value={checklistPct} className="h-2" />
              </div>

              {checklistLoading ? (
                <div className="text-center py-8 text-xs text-muted-foreground">Loading checklist...</div>
              ) : phases.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">No checklist items configured.</div>
              ) : (
                <div className="space-y-4">
                  {phases.map((phase) => {
                    const phaseTotal = phase.items.length;
                    const phaseCompleted = phase.items.filter((i: any) => i.completed).length;

                    return (
                      <Card key={phase.phaseName} className="overflow-hidden border border-border">
                        <CardHeader className="bg-muted/40 py-3 px-4 flex flex-row items-center justify-between border-b border-border">
                          <div className="font-semibold text-xs text-foreground uppercase tracking-wide">
                            {phase.phaseName}
                          </div>
                          <Badge variant="outline" className="text-[10px] font-medium">
                            {phaseCompleted}/{phaseTotal} done
                          </Badge>
                        </CardHeader>
                        <CardContent className="p-3 divide-y divide-border/60">
                          {phase.items.map((item: any) => (
                            <div
                              key={item.id}
                              onClick={() => toggleMutation.mutate({ itemId: item.id, completed: !item.completed })}
                              className="py-2.5 px-2 flex items-start gap-3 hover:bg-muted/30 rounded-lg cursor-pointer transition-colors"
                            >
                              <Checkbox
                                checked={item.completed}
                                onCheckedChange={(c) => toggleMutation.mutate({ itemId: item.id, completed: !!c })}
                                className="mt-0.5 border-gold data-[state=checked]:bg-gold data-[state=checked]:text-navy"
                              />
                              <div className="flex-1 min-w-0">
                                <span
                                  className={cn(
                                    "text-xs leading-relaxed select-none transition-colors",
                                    item.completed ? "line-through text-muted-foreground" : "text-foreground font-medium"
                                  )}
                                >
                                  {item.task_text}
                                </span>
                                {item.completed && item.completed_at && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    Done {new Date(item.completed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MARKETING MATERIALS */}
          {activeSubTab === "marketing" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base text-foreground">
                    Attached Marketing Materials
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Flyers, branded graphics, and photos auto-attached from the listing.
                  </p>
                </div>
              </div>

              {assets.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground border-dashed">
                  <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <div className="font-medium text-sm text-foreground">No marketing assets attached</div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Upload flyers, photos, and social graphics in the Agent Toolbox under this Open House record.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {assets.map((a: any) => {
                    const u = a.file_url || a.thumbnail_url || a.drive_url;
                    return (
                      <Card key={a.id} className="overflow-hidden border border-border group bg-card">
                        <div className="aspect-square bg-muted relative">
                          {u ? (
                            <img src={u} alt={a.name || "Asset"} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <FileText className="h-8 w-8" />
                            </div>
                          )}
                          <Badge className="absolute top-2 left-2 text-[10px] bg-background/80 backdrop-blur-sm border">
                            {a.category || a.asset_type}
                          </Badge>
                        </div>
                        <div className="p-2.5 flex items-center justify-between">
                          <span className="text-xs font-medium truncate flex-1">{a.name || "Marketing Asset"}</span>
                          {u && (
                            <a
                              href={u}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="p-1 text-muted-foreground hover:text-gold"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SETTINGS & ARCHIVE */}
          {activeSubTab === "settings" && (
            <div className="space-y-4">
              <Card className="p-5 border-border space-y-4">
                <h3 className="font-serif font-bold text-base text-foreground">
                  Open House Status &amp; Archive Management
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  When the open house has concluded, archive it to remove it from the active upcoming calendar while preserving all visitor sign-in leads and checklist logs.
                </p>

                <div className="pt-2 flex items-center gap-3">
                  {oh?.archived ? (
                    <Button
                      variant="outline"
                      onClick={() => archiveMutation.mutate(false)}
                      disabled={archiveMutation.isPending}
                      className="border-gold/50 text-gold hover:bg-gold/10 text-xs"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" /> Restore to Active
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      onClick={() => archiveMutation.mutate(true)}
                      disabled={archiveMutation.isPending}
                      className="bg-gold text-navy hover:bg-gold/90 font-semibold text-xs"
                    >
                      <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive Open House
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </SheetContent>

      {/* FULL-SCREEN TABLET / PHONE KIOSK MODAL */}
      {fullscreenKioskOpen && (
        <Dialog open={fullscreenKioskOpen} onOpenChange={setFullscreenKioskOpen}>
          <DialogContent className="max-w-md w-full bg-slate-950 text-white border-slate-800 p-8 text-center space-y-6">
            <img src={logo} alt="MSREG Logo" className="h-10 w-auto mx-auto" />
            <div className="space-y-1">
              <Badge className="bg-gold/15 text-gold border-gold/30 text-xs">Welcome to our Open House</Badge>
              <h2 className="text-xl font-serif font-bold text-white">{oh?.address}</h2>
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block mx-auto shadow-2xl">
              <QrCode value={signinUrl} size={220} />
            </div>

            <div className="space-y-1">
              <div className="text-base font-bold text-white">Scan with your camera to sign in</div>
              <p className="text-xs text-slate-400">Quick 30-second digital registration</p>
            </div>

            <Button
              onClick={() => window.open(signinUrl, "_blank")}
              className="w-full bg-gold hover:bg-gold/90 text-navy font-bold text-xs py-5 rounded-xl"
            >
              Or Tap to Sign In on this Device
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </Sheet>
  );
}

/* -------------------------------------------------------------
 * ADMIN OPS: CHECKLIST TEMPLATE MANAGER
 * ------------------------------------------------------------- */

function ChecklistTemplateManager() {
  const qc = useQueryClient();
  const fetchTemplates = useServerFn(getChecklistTemplates);
  const saveTemplates = useServerFn(updateChecklistTemplates);

  const { data, isLoading } = useQuery({
    queryKey: ["checklist-templates"],
    queryFn: () => fetchTemplates(),
  });

  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (data?.templates) setItems(data.templates);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await saveTemplates({ data: { templates: items } });
    },
    onSuccess: () => {
      toast.success("Checklist template saved! New open houses will use this updated process.");
      qc.invalidateQueries({ queryKey: ["checklist-templates"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to save template"),
  });

  const handleTaskTextChange = (idx: number, text: string) => {
    const next = [...items];
    next[idx].task_text = text;
    setItems(next);
  };

  const handleAddTask = (phaseName: string, phaseOrder: number) => {
    const next = [...items];
    next.push({
      phase: phaseName,
      phase_order: phaseOrder,
      task_text: "New task item",
      task_order: next.length + 1,
      is_required: true,
    });
    setItems(next);
  };

  const handleDeleteTask = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
  };

  if (isLoading) return <div className="text-center py-10 text-xs text-muted-foreground">Loading template...</div>;

  return (
    <Card className="p-6 space-y-6 border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="font-serif font-bold text-lg text-foreground">
            Default Open House Process Checklist Template
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ops-managed standard process. Edits here update the template for all newly created open houses.
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-gold text-navy hover:bg-gold/90 font-semibold text-xs"
        >
          {saveMutation.isPending ? "Saving..." : "Save Template Changes"}
        </Button>
      </div>

      <div className="space-y-6">
        {[
          { name: "After signing up / initial Open House email", order: 1 },
          { name: "3-4 Days Before", order: 2 },
          { name: "1-2 Days Before", order: 3 },
          { name: "1 Hour Before", order: 4 },
          { name: "After the Open House", order: 5 },
        ].map((phase) => {
          const phaseTasks = items
            .map((item, originalIndex) => ({ ...item, originalIndex }))
            .filter((item) => item.phase_order === phase.order || item.phase === phase.name);

          return (
            <div key={phase.name} className="space-y-2.5 p-4 rounded-xl bg-muted/20 border border-border">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-xs uppercase tracking-wider text-foreground">
                  Phase {phase.order}: {phase.name}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAddTask(phase.name, phase.order)}
                  className="text-xs text-gold hover:text-gold/80 h-7"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Task
                </Button>
              </div>

              <div className="space-y-2">
                {phaseTasks.map((t) => (
                  <div key={t.originalIndex} className="flex items-center gap-2">
                    <Input
                      value={t.task_text}
                      onChange={(e) => handleTaskTextChange(t.originalIndex, e.target.value)}
                      className="text-xs h-8 bg-card"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteTask(t.originalIndex)}
                      className="h-8 w-8 text-muted-foreground hover:text-rose-400 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------
 * ADMIN OPS: CROSS-TEAM LEAD & COACHING ANALYTICS
 * ------------------------------------------------------------- */

function OpenHousesAnalyticsView() {
  const fetchAnalytics = useServerFn(getOpenHousesAnalytics);
  const { data, isLoading } = useQuery({
    queryKey: ["open-houses-analytics"],
    queryFn: () => fetchAnalytics(),
  });

  if (isLoading || !data) {
    return <div className="text-center py-10 text-xs text-muted-foreground">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-border">
          <div className="text-xs font-semibold text-muted-foreground">Total Open Houses</div>
          <div className="text-2xl font-serif font-bold text-foreground mt-1">{data.totalOpenHouses}</div>
        </Card>
        <Card className="p-4 bg-card border-border">
          <div className="text-xs font-semibold text-muted-foreground">Total Leads Captured</div>
          <div className="text-2xl font-serif font-bold text-gold mt-1">{data.totalSignins}</div>
        </Card>
        <Card className="p-4 bg-card border-border">
          <div className="text-xs font-semibold text-muted-foreground">Unrepresented Leads</div>
          <div className="text-2xl font-serif font-bold text-emerald-500 mt-1">{data.unrepresentedLeads}</div>
        </Card>
        <Card className="p-4 bg-card border-border">
          <div className="text-xs font-semibold text-muted-foreground">Buyer / Seller Leads</div>
          <div className="text-2xl font-serif font-bold text-foreground mt-1">
            {data.totalBuyers}B / {data.totalSellers}S
          </div>
        </Card>
      </div>

      {/* Leads by Agent Leaderboard */}
      <Card className="p-5 border-border space-y-4">
        <h3 className="font-serif font-bold text-base text-foreground">
          Lead Capture Leaderboard by Hosting Agent
        </h3>
        <div className="divide-y divide-border">
          {data.leadsByAgent.map((agent: any) => (
            <div key={agent.name} className="py-2.5 flex items-center justify-between text-xs">
              <div className="font-semibold text-foreground">{agent.name}</div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span>{agent.openHouses} Open Houses</span>
                <Badge className="bg-gold/15 text-gold border-gold/30 text-xs font-bold">
                  {agent.count} Leads
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
