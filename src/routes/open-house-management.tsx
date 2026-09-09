import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
  Lock,
  Loader2,
  Copy,
  ArrowLeft,
  Store,
  Layers,
  Star,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { QrCode } from "@/components/qr-code";
import logo from "@/assets/msreg-logo.png";
import { verifyToolboxCode, listPublicListings } from "@/lib/toolbox-public.functions";
import {
  listAgentOpenHouses,
  getAgentOpenHouseManagement,
  createAgentOpenHouse,
  toggleAgentChecklistItem,
  archiveAgentOpenHouse,
  setAgentOpenHouseCoverPhoto,
} from "@/lib/open-houses.functions";

export const Route = createFileRoute("/open-house-management")({
  ssr: false,
  component: AgentOpenHouseManagementPage,
  head: () => ({
    meta: [
      { title: "Open House Management — MSREG Agent Hub" },
      { name: "description", content: "End-to-end Open House management for MSREG agents: QR sign-ins, FUB exports, checklists & marketing." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const STORAGE_KEY = "msreg-toolbox-token";

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

export function AgentOpenHouseManagementPage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem(STORAGE_KEY);
      if (t) setToken(t);
    } catch {}
  }, []);

  if (!token) {
    return (
      <Gate
        onUnlock={(t) => {
          try {
            localStorage.setItem(STORAGE_KEY, t);
          } catch {}
          setToken(t);
        }}
      />
    );
  }

  return (
    <OpenHouseManagerMain
      token={token}
      onLock={() => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
        setToken(null);
      }}
    />
  );
}

/* -------------------------------------------------------------
 * PASSCODE GATE
 * ------------------------------------------------------------- */
function Gate({ onUnlock }: { onUnlock: (token: string) => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const verifyFn = useServerFn(verifyToolboxCode);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await verifyFn({ data: { code: code.trim() } });
      if (res?.token) {
        onUnlock(res.token);
      } else {
        setErr("Incorrect passcode");
      }
    } catch (error: any) {
      setErr(error.message || "Incorrect passcode");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground">
      <Card className="max-w-md w-full p-6 sm:p-8 space-y-6 text-center border-border shadow-2xl">
        <img src={logo} alt="MSREG Logo" className="h-16 w-auto mx-auto" />
        <div className="space-y-1">
          <h1 className="text-xl font-serif font-bold">Open House Management</h1>
          <p className="text-xs text-muted-foreground">
            Enter the agent team passcode to access open house tools, live visitor sign-in, and checklists.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1 text-left">
            <Label className="text-xs font-semibold">Passcode</Label>
            <Input
              type="password"
              autoFocus
              placeholder="Enter passcode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center font-mono tracking-widest text-base h-11"
            />
          </div>

          {err && <div className="text-xs text-rose-500 font-medium">{err}</div>}

          <Button
            type="submit"
            disabled={busy || !code}
            className="w-full bg-gold text-navy hover:bg-gold/90 font-bold h-11"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Unlock Open House Hub"}
          </Button>
        </form>

        <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
          <Link to="/agents" className="text-gold hover:underline">
            &larr; Back to Agent Hub Home
          </Link>
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------
 * MAIN AGENT OPEN HOUSE MANAGER
 * ------------------------------------------------------------- */
function OpenHouseManagerMain({ token, onLock }: { token: string; onLock: () => void }) {
  const qc = useQueryClient();
  const fetchOpenHouses = useServerFn(listAgentOpenHouses);

  const [timeFilter, setTimeFilter] = useState<"weekend" | "upcoming" | "all" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");

  const [selectedOHId, setSelectedOHId] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  // Load Open Houses
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["agent-open-houses", token],
    queryFn: () => fetchOpenHouses({ data: { token } }),
  });
  const openHouses = (data?.openHouses ?? []) as any[];

  // Agent Names for filter
  const agentNames = useMemo(() => {
    const s = new Set<string>();
    for (const oh of openHouses) {
      if (oh.agent_name) s.add(oh.agent_name.trim());
    }
    return Array.from(s).sort();
  }, [openHouses]);

  // Filtered Open Houses
  const filtered = useMemo(() => {
    return openHouses.filter((oh) => {
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

      if (agentFilter !== "all" && (oh.agent_name || "").toLowerCase() !== agentFilter.toLowerCase()) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const m =
          (oh.address || "").toLowerCase().includes(q) ||
          (oh.agent_name || "").toLowerCase().includes(q) ||
          (oh.description || "").toLowerCase().includes(q);
        if (!m) return false;
      }

      return true;
    });
  }, [openHouses, timeFilter, agentFilter, searchQuery]);

  const weekendCount = openHouses.filter((oh) => !oh.archived && isThisWeekend(oh.open_house_at)).length;
  const upcomingCount = openHouses.filter(
    (oh) => !oh.archived && (!oh.open_house_at || new Date(oh.open_house_at) >= new Date(Date.now() - 24 * 3600 * 1000))
  ).length;
  const archivedCount = openHouses.filter((oh) => oh.archived).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-sidebar/95 backdrop-blur border-b border-border pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/agents" className="shrink-0 hover:opacity-80 transition-opacity">
              <img src={logo} alt="MSREG Logo" className="h-9 w-auto" />
            </Link>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate flex items-center gap-2">
                Open House Management
                <Badge className="bg-gold/15 text-gold border-gold/30 text-[10px] hidden sm:inline-flex">
                  Agent Hub
                </Badge>
              </div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-gold/80 truncate">
                Matt Smith Real Estate Group
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/agents"
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Hub Home</span>
            </Link>
            <Button variant="ghost" size="sm" onClick={onLock} className="text-xs h-8">
              Lock
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6 pb-20">
        {/* Banner Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-card via-card/90 to-card border border-border/80 p-5 rounded-2xl shadow-sm">
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-foreground">
              Open House Management
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Launch instant QR code sign-ins, printable table placards, track live leads for Follow Up Boss, and follow the 5-phase execution checklist.
            </p>
          </div>
          <Button
            onClick={() => setScheduleModalOpen(true)}
            className="bg-gold text-navy hover:bg-gold/90 font-bold text-xs h-10 px-4 rounded-xl shadow-md shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Schedule Open House
          </Button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
          {/* Time Filter Pills */}
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40 overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => setTimeFilter("weekend")}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md font-medium transition-colors whitespace-nowrap",
                timeFilter === "weekend" ? "bg-gold text-navy font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              This Weekend ({weekendCount})
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter("upcoming")}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md font-medium transition-colors whitespace-nowrap",
                timeFilter === "upcoming" ? "bg-gold text-navy font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Upcoming ({upcomingCount})
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter("all")}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md font-medium transition-colors whitespace-nowrap",
                timeFilter === "all" ? "bg-gold text-navy font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Active ({openHouses.filter((o) => !o.archived).length})
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter("archived")}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md font-medium transition-colors whitespace-nowrap",
                timeFilter === "archived" ? "bg-gold text-navy font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Archived ({archivedCount})
            </button>
          </div>

          {/* Search & Agent Filter */}
          <div className="flex items-center gap-2 flex-1 max-w-xl">
            {agentNames.length > 0 && (
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-40 text-xs h-9 shrink-0">
                  <SelectValue placeholder="Agent Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
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
                placeholder="Search address..."
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
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-gold mb-3" />
            Loading open houses...
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground border-dashed">
            <Home className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <div className="font-semibold text-foreground text-base">No open houses found</div>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {timeFilter === "weekend"
                ? "No open houses scheduled for this upcoming weekend yet."
                : "Schedule your open house or adjust your search filter above."}
            </p>
            <Button
              onClick={() => setScheduleModalOpen(true)}
              variant="outline"
              className="mt-4 text-xs border-gold/50 text-gold hover:bg-gold/10"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Schedule an Open House
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((oh) => {
              const signins = oh.signinCount || 0;
              const totalTasks = oh.checklistTotal || 21;
              const doneTasks = oh.checklistCompleted || 0;
              const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
              const isArchived = !!oh.archived;

              return (
                <Card
                  key={oh.id}
                  className={cn(
                    "overflow-hidden flex flex-col border border-border/80 hover:border-gold/60 transition-all duration-300 shadow-sm bg-card group",
                    isArchived && "opacity-80"
                  )}
                >
                  {/* Image Hero Banner */}
                  <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                    {oh.thumbnail ? (
                      <img
                        src={oh.thumbnail}
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
                      {signins > 0 && (
                        <Badge className="bg-emerald-600 text-white font-semibold text-xs shadow-sm flex items-center gap-1">
                          <Users className="h-3 w-3" /> {signins} Lead{signins === 1 ? "" : "s"}
                        </Badge>
                      )}
                      {isArchived && (
                        <Badge className="bg-navy/90 text-gold border border-gold/40 text-xs">
                          Archived
                        </Badge>
                      )}
                    </div>

                    {oh.open_house_at && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 pt-6 text-white text-xs flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-gold shrink-0" />
                        <span className="font-medium truncate">{fmtDateTime(oh.open_house_at)}</span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <h3 className="font-serif font-semibold text-lg text-foreground line-clamp-1 group-hover:text-gold transition-colors">
                        {oh.address}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="h-3.5 w-3.5 text-gold/80 shrink-0" />
                        <span className="truncate">{oh.agent_name || "Unassigned"}</span>
                      </div>
                    </div>

                    {/* Checklist progress tracker */}
                    <div className="space-y-1 bg-muted/30 p-2.5 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium flex items-center gap-1">
                          <ClipboardCheck className="h-3.5 w-3.5 text-gold" /> Process Checklist
                        </span>
                        <span className="font-semibold text-foreground">
                          {doneTasks}/{totalTasks} ({pct}%)
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>

                    {/* Card Actions */}
                    <div className="pt-2 flex items-center gap-2 border-t border-border/60">
                      <Button
                        onClick={() => setSelectedOHId(oh.id)}
                        className="flex-1 bg-gold text-navy hover:bg-gold/90 font-semibold text-xs h-8"
                      >
                        Manage Open House
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setSelectedOHId(oh.id)}
                        className="h-8 w-8 text-foreground hover:text-gold shrink-0"
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
      </main>

      {/* Schedule Open House Modal */}
      <ScheduleModal
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        token={token}
        onCreated={(id) => {
          qc.invalidateQueries({ queryKey: ["agent-open-houses"] });
          setSelectedOHId(id);
        }}
      />

      {/* Open House Management Workspace Drawer */}
      {selectedOHId && (
        <AgentOpenHouseWorkspace
          token={token}
          openHouseId={selectedOHId}
          onClose={() => setSelectedOHId(null)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------
 * SCHEDULE OPEN HOUSE MODAL (Agent Facing)
 * ------------------------------------------------------------- */
function ScheduleModal({
  open,
  onOpenChange,
  token,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const fetchListings = useServerFn(listPublicListings);
  const createOHFn = useServerFn(createAgentOpenHouse);

  const [selectedListingId, setSelectedListingId] = useState("none");
  const [form, setForm] = useState({
    address: "",
    agent_name: "",
    open_house_at: "",
    description: "",
  });

  // Fetch active listings
  const { data: listingsData } = useQuery({
    queryKey: ["agent-public-listings", token],
    enabled: open,
    queryFn: () => fetchListings({ data: { token } }),
  });
  const listings = (listingsData?.listings ?? []) as any[];

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
      if (!form.open_house_at) throw new Error("Date & time is required.");
      return await createOHFn({
        data: {
          token,
          address: form.address.trim(),
          agent_name: form.agent_name.trim() || undefined,
          listing_id: selectedListingId !== "none" ? selectedListingId : undefined,
          open_house_at: form.open_house_at,
          description: form.description.trim() || undefined,
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Open house scheduled! Marketing materials & checklist initialized.");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["agent-open-houses"] });
      onCreated(res.id);
    },
    onError: (err: any) => toast.error(err.message || "Failed to schedule open house"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Schedule Open House</DialogTitle>
          <DialogDescription>
            Select an existing listing to automatically pull photos, flyers, and marketing materials.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5 bg-muted/40 p-3 rounded-lg border border-border">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-gold" /> Select from Existing Listing (Auto-Attaches Materials)
            </Label>
            <Select value={selectedListingId} onValueChange={handleListingSelect}>
              <SelectTrigger className="text-xs bg-card">
                <SelectValue placeholder="Choose a listing..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Enter Manually --</SelectItem>
                {listings.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.address} {l.agent_name ? `(${l.agent_name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Property Address *</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. 123 Maple Street, Rolla, MO"
              className="text-xs"
            />
          </div>

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

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Special Notes / Description (Optional)</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Snacks and refreshments available"
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
            {createMutation.isPending ? "Scheduling..." : "Schedule & Open Hub"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------
 * AGENT OPEN HOUSE WORKSPACE DRAWER
 * ------------------------------------------------------------- */
function AgentOpenHouseWorkspace({
  token,
  openHouseId,
  onClose,
}: {
  token: string;
  openHouseId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getAgentOpenHouseManagement);
  const toggleItemFn = useServerFn(toggleAgentChecklistItem);
  const archiveFn = useServerFn(archiveAgentOpenHouse);
  const setCoverPhotoFn = useServerFn(setAgentOpenHouseCoverPhoto);

  const [activeTab, setActiveTab] = useState<"leads" | "qrcode" | "checklist" | "marketing" | "settings">("leads");
  const [kioskOpen, setKioskOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["agent-oh-management", openHouseId, token],
    queryFn: () => fetchDetail({ data: { token, openHouseId } }),
    refetchInterval: 10_000, // live poll for visitor sign-ins during event
  });

  const oh = data?.openHouse;
  const signins = data?.signins ?? [];
  const checklist = data?.checklist ?? [];
  const assets = data?.assets ?? [];

  const signinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/open-house-signin/${openHouseId}`
    : `https://thehub.mattsmithrealestate.com/open-house-signin/${openHouseId}`;

  const setCoverMutation = useMutation({
    mutationFn: async (coverUrl: string | null) => {
      await setCoverPhotoFn({ data: { token, openHouseId, coverPhotoUrl: coverUrl } });
    },
    onSuccess: () => {
      toast.success("Cover photo updated! This photo is now featured across all open house views.");
      refetch();
      qc.invalidateQueries({ queryKey: ["agent-open-houses"] });
      qc.invalidateQueries({ queryKey: ["public-toolbox-open-houses"] });
      qc.invalidateQueries({ queryKey: ["all-open-houses"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update cover photo"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string; completed: boolean }) => {
      await toggleItemFn({ data: { token, itemId, completed } });
    },
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ["agent-open-houses"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update item"),
  });

  const archiveMutation = useMutation({
    mutationFn: async (archived: boolean) => {
      await archiveFn({ data: { token, openHouseId, archived } });
    },
    onSuccess: (_d, vars) => {
      toast.success(vars ? "Open house archived" : "Open house restored");
      refetch();
      qc.invalidateQueries({ queryKey: ["agent-open-houses"] });
    },
  });

  // Follow Up Boss CSV Export
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
    for (const item of checklist) {
      if (!map[item.phase]) map[item.phase] = [];
      map[item.phase].push(item);
    }
    return Object.entries(map).map(([phaseName, items]) => ({
      phaseName,
      phaseOrder: items[0]?.phase_order || 1,
      items: items.sort((a, b) => a.task_order - b.task_order),
    })).sort((a, b) => a.phaseOrder - b.phaseOrder);
  }, [checklist]);

  const totalChecklist = checklist.length;
  const completedChecklist = checklist.filter((i: any) => i.completed).length;
  const checklistPct = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  return (
    <Sheet open={true} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto p-0 flex flex-col bg-background">
        {/* Sheet Header */}
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
                onClick={() => setKioskOpen(true)}
                className="bg-gold text-navy hover:bg-gold/90 font-semibold text-xs h-8"
              >
                <Smartphone className="h-3.5 w-3.5 mr-1" /> On-Screen Kiosk
              </Button>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center gap-1 border-b border-border/80 pt-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab("leads")}
              className={cn(
                "px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5",
                activeTab === "leads" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-3.5 w-3.5" /> Live Sign-Ins ({signins.length})
            </button>
            <button
              onClick={() => setActiveTab("qrcode")}
              className={cn(
                "px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5",
                activeTab === "qrcode" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <QrIcon className="h-3.5 w-3.5" /> QR Code &amp; Placard
            </button>
            <button
              onClick={() => setActiveTab("checklist")}
              className={cn(
                "px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5",
                activeTab === "checklist" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <ClipboardCheck className="h-3.5 w-3.5" /> Checklist ({completedChecklist}/{totalChecklist})
            </button>
            <button
              onClick={() => setActiveTab("marketing")}
              className={cn(
                "px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5",
                activeTab === "marketing" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <ImageIcon className="h-3.5 w-3.5" /> Marketing ({assets.length})
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={cn(
                "px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5",
                activeTab === "settings" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Archive
            </button>
          </div>
        </SheetHeader>

        {/* Sheet Content */}
        <div className="p-5 flex-1 space-y-6">
          {/* TAB 1: LIVE SIGN-INS */}
          {activeTab === "leads" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-4 rounded-xl border border-border">
                <div>
                  <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    Live Visitor Feed ({signins.length} Registered)
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Guests who scan your QR code or sign in on the tablet appear here in real time.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refetch()}
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
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Export FUB CSV
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-xs text-muted-foreground">Loading visitors...</div>
              ) : signins.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground border-dashed">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <div className="font-medium text-sm text-foreground">No visitors registered yet</div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Set up your printable table placard or hand your phone/tablet to guests using On-Screen Kiosk mode.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("qrcode")}
                    variant="outline"
                    className="mt-3 text-xs border-gold/50 text-gold hover:bg-gold/10"
                  >
                    View QR Placard
                  </Button>
                </Card>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/80 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                        <tr>
                          <th className="p-3">Visitor Name</th>
                          <th className="p-3">Contact Info</th>
                          <th className="p-3">Agent Status</th>
                          <th className="p-3">Intent &amp; Timeframe</th>
                          <th className="p-3">Notes</th>
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

          {/* TAB 2: QR CODE & PLACARD */}
          {activeTab === "qrcode" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Placard Preview */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif font-bold text-base text-foreground">
                      Printable Table Placard
                    </h3>
                    <Button
                      size="sm"
                      onClick={() => window.print()}
                      className="bg-gold text-navy hover:bg-gold/90 font-semibold text-xs h-8"
                    >
                      <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Sign (8.5×11)
                    </Button>
                  </div>

                  <div className="p-6 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 shadow-md text-center space-y-4">
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
                      <QrCode url={signinUrl} size={160} showModal={false} />
                    </div>

                    <div className="space-y-1 text-slate-700">
                      <div className="font-bold text-sm">Please Scan to Sign In</div>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">
                        Point your phone's camera at the QR code above to access the digital registration.
                      </p>
                    </div>

                    {oh?.agent_name && (
                      <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 font-medium">
                        Hosted by {oh.agent_name} &bull; Matt Smith Real Estate Group
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct Link & Kiosk Mode Card */}
                <div className="space-y-4">
                  <h3 className="font-serif font-bold text-base text-foreground">
                    Digital Access Modes
                  </h3>

                  <Card className="p-4 space-y-3 bg-muted/20 border-border">
                    <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 text-gold" /> On-Screen Kiosk Mode
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Hand your phone or iPad to visitors as they enter. Displays a full-screen QR code and a direct "Sign In on this Device" button.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setKioskOpen(true)}
                      className="w-full bg-gold text-navy hover:bg-gold/90 font-semibold text-xs h-9"
                    >
                      Launch Full-Screen Kiosk
                    </Button>
                  </Card>

                  <Card className="p-4 space-y-3 bg-muted/20 border-border">
                    <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <ExternalLink className="h-4 w-4 text-gold" /> Visitor Sign-In Link
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

          {/* TAB 3: 5-PHASE CHECKLIST */}
          {activeTab === "checklist" && (
            <div className="space-y-5">
              <div className="bg-card p-4 rounded-xl border border-border space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <ClipboardCheck className="h-4 w-4 text-gold" /> Process Checklist Progress
                  </span>
                  <span className="font-bold text-gold">
                    {completedChecklist} of {totalChecklist} Tasks Complete ({checklistPct}%)
                  </span>
                </div>
                <Progress value={checklistPct} className="h-2" />
              </div>

              <div className="space-y-4">
                {phases.map((phase) => {
                  const phaseTotal = phase.items.length;
                  const phaseDone = phase.items.filter((i: any) => i.completed).length;

                  return (
                    <Card key={phase.phaseName} className="overflow-hidden border border-border">
                      <CardHeader className="bg-muted/40 py-3 px-4 flex flex-row items-center justify-between border-b border-border">
                        <div className="font-semibold text-xs text-foreground uppercase tracking-wide">
                          {phase.phaseName}
                        </div>
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {phaseDone}/{phaseTotal} done
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
            </div>
          )}

          {/* TAB 4: MARKETING MATERIALS */}
          {activeTab === "marketing" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/30 p-3 rounded-xl border border-border">
                <div>
                  <h3 className="font-serif font-bold text-base text-foreground flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-gold" /> Attached Marketing Materials &amp; Cover Photo
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click the star <Star className="inline h-3 w-3 text-gold fill-gold" /> on any photo below to set it as the primary cover image across all open house listings &amp; sign-in pages.
                  </p>
                </div>
                {oh?.cover_photo_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCoverMutation.mutate(null)}
                    disabled={setCoverMutation.isPending}
                    className="text-[11px] h-7 shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    Reset to Auto
                  </Button>
                )}
              </div>

              {assets.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground border-dashed">
                  <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <div className="font-medium text-sm text-foreground">No marketing assets attached</div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Assets uploaded to the listing or open house appear here for instant download and cover photo selection.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {assets.map((a: any) => {
                    const u = a.file_url || a.thumbnail_url || a.drive_url;
                    const isImg = u && /\.(png|jpe?g|gif|webp|svg|avif|heic)(\?|#|$)/i.test(String(u).split("?")[0]);
                    const isStarredCover = oh?.cover_photo_url ? (oh.cover_photo_url === u) : false;

                    return (
                      <Card
                        key={a.id}
                        className={cn(
                          "overflow-hidden border transition-all duration-200 group bg-card flex flex-col justify-between",
                          isStarredCover ? "border-gold ring-1 ring-gold shadow-md" : "border-border hover:border-border/80"
                        )}
                      >
                        <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                          {u ? (
                            <img src={u} alt={a.name || "Asset"} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <ImageIcon className="h-8 w-8" />
                            </div>
                          )}

                          <Badge className="absolute top-2 left-2 text-[10px] bg-background/80 backdrop-blur-sm border">
                            {a.category || a.asset_type}
                          </Badge>

                          {isStarredCover && (
                            <Badge className="absolute top-2 right-2 text-[10px] bg-gold text-navy font-bold shadow-md flex items-center gap-1">
                              <Star className="h-3 w-3 fill-navy" /> Featured Cover
                            </Badge>
                          )}
                        </div>

                        <div className="p-2.5 flex items-center justify-between gap-2 border-t border-border/60">
                          <span className="text-xs font-medium truncate flex-1" title={a.name}>
                            {a.name || "Marketing Asset"}
                          </span>

                          <div className="flex items-center gap-1 shrink-0">
                            {isImg && (
                              <Button
                                size="sm"
                                variant={isStarredCover ? "default" : "outline"}
                                onClick={() => setCoverMutation.mutate(isStarredCover ? null : u)}
                                disabled={setCoverMutation.isPending}
                                className={cn(
                                  "h-7 px-2 text-[11px] gap-1 font-medium transition-colors",
                                  isStarredCover
                                    ? "bg-gold text-navy hover:bg-gold/90 font-bold"
                                    : "text-muted-foreground hover:text-gold border-border"
                                )}
                                title={isStarredCover ? "Remove as featured cover" : "Set as primary cover photo"}
                              >
                                <Star className={cn("h-3 w-3", isStarredCover && "fill-navy")} />
                                <span>{isStarredCover ? "Starred" : "Set Cover"}</span>
                              </Button>
                            )}

                            {u && (
                              <a
                                href={u}
                                target="_blank"
                                rel="noreferrer"
                                download
                                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-gold transition-colors"
                                title="Download Asset"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ARCHIVE / STATUS */}
          {activeTab === "settings" && (
            <Card className="p-5 border-border space-y-4">
              <h3 className="font-serif font-bold text-base text-foreground">
                Archive Open House
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When your open house event has ended, archive it to keep the upcoming calendar clean. All visitor sign-in data and checklist notes remain preserved.
              </p>

              <div className="pt-2">
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
          )}
        </div>
      </SheetContent>

      {/* FULL-SCREEN KIOSK MODAL */}
      {kioskOpen && (
        <Dialog open={kioskOpen} onOpenChange={setKioskOpen}>
          <DialogContent className="max-w-md w-full bg-slate-950 text-white border-slate-800 p-8 text-center space-y-6">
            <img src={logo} alt="MSREG Logo" className="h-10 w-auto mx-auto" />
            <div className="space-y-1">
              <Badge className="bg-gold/15 text-gold border-gold/30 text-xs">Welcome to our Open House</Badge>
              <h2 className="text-xl font-serif font-bold text-white">{oh?.address}</h2>
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block mx-auto shadow-2xl">
              <QrCode url={signinUrl} size={220} showModal={false} />
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
