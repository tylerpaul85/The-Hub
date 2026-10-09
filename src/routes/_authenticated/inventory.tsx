import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  Boxes,
  Plus,
  Pencil,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Gift,
  Clock,
  PackageCheck,
  Shirt,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;
const LOW_STOCK = 2;

type InventoryRow = {
  id: string;
  size: string;
  color: string;
  color_hex: string;
  quantity_available: number;
};

type RequestRow = {
  id: string;
  agent_name: string;
  client_first_name: string;
  client_last_name: string;
  shirts: Array<{ size: string; color: string; color_hex: string }>;
  status: "pending" | "fulfilled" | "completed";
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/inventory")({
  beforeLoad: () => {
    return {};
  },
  component: InventoryPage,
  head: () => ({ meta: [{ title: "Closing Gifts & Inventory — MSREG Hub" }] }),
});

const sb = supabase as any;

function InventoryPage() {
  const { isAdmin, roles } = useAuth();
  const isClientCare = roles?.includes("client_care");
  const isMarketing = roles?.includes("marketing_coordinator");
  const canAccess = isAdmin || isClientCare || isMarketing;

  const { data: inventory = [] } = useQuery({
    queryKey: ["closing-gift-inventory-admin"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("closing_gift_inventory")
        .select("id,size,color,color_hex,quantity_available")
        .order("size")
        .order("color");
      if (error) throw error;
      return (data ?? []) as InventoryRow[];
    },
    enabled: canAccess,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["closing-gift-requests-admin"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("closing_gift_requests")
        .select("id,agent_name,client_first_name,client_last_name,shirts,status,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RequestRow[];
    },
    enabled: canAccess,
  });

  const totalUnits = useMemo(
    () => inventory.reduce((sum, r) => sum + (r.quantity_available || 0), 0),
    [inventory],
  );
  const lowStockCount = useMemo(
    () => inventory.filter((r) => r.quantity_available <= LOW_STOCK).length,
    [inventory],
  );
  const pendingRequestsCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests],
  );
  const completedDeliveriesCount = useMemo(
    () => requests.filter((r) => r.status === "completed" || r.status === "fulfilled").length,
    [requests],
  );

  if (!canAccess) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 pt-16">
        <div className="p-3 w-12 h-12 rounded-full bg-gold/15 text-gold mx-auto flex items-center justify-center">
          <Gift className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Closing Gifts Access</h1>
        <p className="text-sm text-muted-foreground">
          The inventory and fulfillment management panel is restricted to Client Care and Operations
          staff. To order a closing gift package for your clients, please use the agent request form.
        </p>
        <div className="pt-2">
          <Link to="/closing-gift">
            <Button className="bg-gold text-navy font-semibold hover:bg-gold/90">
              Submit Closing Gift Request
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Closing Gifts & Inventory"
        description="Unified fulfillment dashboard for client gift packages and live apparel inventory stock levels across all offices."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/closing-gift">
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-border/80 hover:border-gold/60"
              >
                <Gift className="h-4 w-4 mr-1.5 text-gold" />
                New Gift Request
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Total In Stock
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-foreground">
              {totalUnits} <span className="text-xs font-normal text-muted-foreground">units</span>
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-2 text-gold border border-border/60">
            <Boxes className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Low Stock Alerts
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-amber-400">
              {lowStockCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Pending Requests
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-sky-400">
              {pendingRequestsCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Fulfilled Packages
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-emerald-400">
              {completedDeliveriesCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <PackageCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Unified Tabs */}
      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList className="bg-surface-2 p-1 rounded-xl border border-border/80">
          <TabsTrigger
            value="requests"
            className="data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-2xs rounded-lg px-4 py-1.5 text-xs font-semibold gap-2"
          >
            <Gift className="h-3.5 w-3.5 text-gold" />
            Gift Requests
            {pendingRequestsCount > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0 h-4">
                {pendingRequestsCount} new
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="inventory"
            className="data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-2xs rounded-lg px-4 py-1.5 text-xs font-semibold gap-2"
          >
            <Boxes className="h-3.5 w-3.5 text-gold" />
            Apparel Inventory
            {lowStockCount > 0 && (
              <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] px-1.5 py-0 h-4">
                {lowStockCount} low
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-0 space-y-4">
          <RequestsTab requests={requests} />
        </TabsContent>

        <TabsContent value="inventory" className="mt-0 space-y-4">
          <InventoryTab
            inventory={inventory}
            canEdit={!!isAdmin || !!isClientCare || !!isMarketing}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============== INVENTORY TAB ==============

function InventoryTab({
  inventory,
  canEdit,
}: {
  inventory: InventoryRow[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [adding, setAdding] = useState(false);

  const colors = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of inventory) set.set(r.color, r.color_hex);
    return Array.from(set.entries()).map(([color, hex]) => ({ color, hex }));
  }, [inventory]);

  const sizeOrder = (s: string) => SIZES.indexOf(s as any);
  const rows = inventory
    .filter((r) => colorFilter === "all" || r.color === colorFilter)
    .sort((a, b) => sizeOrder(a.size) - sizeOrder(b.size) || a.color.localeCompare(b.color));

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("closing_gift_inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed from inventory");
      qc.invalidateQueries({ queryKey: ["closing-gift-inventory-admin"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not delete"),
  });

  return (
    <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-border/80 bg-surface-2/40">
        <div className="flex items-center gap-2.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            Color Filter:
          </Label>
          <Select value={colorFilter} onValueChange={setColorFilter}>
            <SelectTrigger className="w-44 h-9 text-xs bg-surface-2 border-border/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Colors ({colors.length})</SelectItem>
              {colors.map((c) => (
                <SelectItem key={c.color} value={c.color}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-border/60"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span>{c.color}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canEdit && (
          <Button
            size="sm"
            onClick={() => setAdding(true)}
            className="bg-gold text-navy font-semibold hover:bg-gold/90 h-9 shadow-xs"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Stock Item
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-surface-2 border-b border-border/80">
            <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground pl-4">
              Size
            </TableHead>
            <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
              Color &amp; Swatch
            </TableHead>
            <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground text-center">
              Available Units
            </TableHead>
            <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground text-right pr-4">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border/60">
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                No inventory records found for this filter.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => {
            const low = r.quantity_available <= LOW_STOCK;
            const isZero = r.quantity_available === 0;
            return (
              <TableRow key={r.id} className="hover:bg-accent/40 transition-colors">
                <TableCell className="font-bold text-foreground pl-4">
                  <span className="inline-block px-2 py-0.5 rounded bg-surface-2 border border-border/70 text-xs font-mono font-bold">
                    {r.size}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-4 w-4 rounded-full border border-border/80 shadow-2xs shrink-0"
                      style={{ backgroundColor: r.color_hex }}
                    />
                    <div>
                      <span className="font-semibold text-foreground text-xs">{r.color}</span>
                      <span className="text-[10px] text-muted-foreground font-mono ml-2">
                        {r.color_hex}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center font-mono">
                  <div className="inline-flex items-center gap-2">
                    <span
                      className={cn(
                        "font-bold text-sm",
                        isZero
                          ? "text-destructive"
                          : low
                            ? "text-amber-400"
                            : "text-emerald-400",
                      )}
                    >
                      {r.quantity_available}
                    </span>
                    {isZero ? (
                      <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[9px] px-1.5 py-0">
                        Out of stock
                      </Badge>
                    ) : low ? (
                      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0 flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" /> Low
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] px-1.5 py-0">
                        Healthy
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right pr-4">
                  {canEdit ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(r)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        title="Edit Stock"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete ${r.size} / ${r.color}?`)) delMut.mutate(r.id);
                        }}
                        className="h-8 w-8 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        title="Delete Item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">View only</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {(adding || editing) && (
        <InventoryDialog
          row={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["closing-gift-inventory-admin"] })}
        />
      )}
    </div>
  );
}

function InventoryDialog({
  row,
  onClose,
  onSaved,
}: {
  row: InventoryRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [size, setSize] = useState(row?.size ?? "M");
  const [color, setColor] = useState(row?.color ?? "");
  const [hex, setHex] = useState(row?.color_hex ?? "#001F3F");
  const [qty, setQty] = useState<number>(row?.quantity_available ?? 0);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!color.trim()) {
      toast.error("Color name is required");
      return;
    }
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
      toast.error("Hex code must be formatted like #001F3F");
      return;
    }
    setBusy(true);
    try {
      if (row) {
        const { error } = await supabase
          .from("closing_gift_inventory")
          .update({
            color_hex: hex.trim(),
            quantity_available: Number(qty) || 0,
          })
          .eq("id", row.id);
        if (error) throw error;
      } else {
        const { data: existing, error: findErr } = await supabase
          .from("closing_gift_inventory")
          .select("id")
          .eq("size", size)
          .eq("color", color.trim())
          .maybeSingle();
        if (findErr) throw findErr;

        if (existing) {
          const { error } = await supabase
            .from("closing_gift_inventory")
            .update({
              color_hex: hex.trim(),
              quantity_available: Number(qty) || 0,
            })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("closing_gift_inventory").insert({
            size,
            color: color.trim(),
            color_hex: hex.trim(),
            quantity_available: Number(qty) || 0,
          });
          if (error) throw error;
        }
      }
      toast.success(row ? "Inventory updated" : "Inventory added");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shirt className="h-5 w-5 text-gold" />
            {row ? "Edit Inventory Item" : "Add Inventory Item"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Size</Label>
            <Select value={size} onValueChange={setSize} disabled={!!row}>
              <SelectTrigger className="bg-surface-2 border-border/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="color" className="mb-1.5 block text-xs font-semibold">
              Color Name
            </Label>
            <Input
              id="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="e.g. Navy Blue"
              disabled={!!row}
              className="bg-surface-2 border-border/80"
            />
          </div>
          <div>
            <Label htmlFor="hex" className="mb-1.5 block text-xs font-semibold">
              Color Hex Code
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="hex"
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                placeholder="#001F3F"
                className="bg-surface-2 border-border/80 font-mono"
              />
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#001F3F"}
                onChange={(e) => setHex(e.target.value)}
                className="h-9 w-12 rounded border border-border bg-surface-2 cursor-pointer p-0.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="qty" className="mb-1.5 block text-xs font-semibold">
              Available Units in Stock
            </Label>
            <Input
              id="qty"
              type="number"
              min={0}
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value, 10) || 0)}
              className="bg-surface-2 border-border/80 font-mono"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={busy}
            className="bg-gold text-navy font-semibold hover:bg-gold/90"
          >
            {busy ? "Saving…" : "Save Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== REQUESTS TAB ==============

function RequestsTab({ requests }: { requests: RequestRow[] }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "fulfilled" | "completed">(
    "all",
  );
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesAgent = (r.agent_name ?? "").toLowerCase().includes(q);
        const matchesClient = `${r.client_first_name ?? ""} ${r.client_last_name ?? ""}`
          .toLowerCase()
          .includes(q);
        if (!matchesAgent && !matchesClient) return false;
      }
      return true;
    });
  }, [requests, statusFilter, search]);

  const markMut = useMutation({
    mutationFn: async (vars: { id: string; status: "fulfilled" | "completed" }) => {
      const { error } = await supabase
        .from("closing_gift_requests")
        .update({ status: vars.status })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request updated");
      qc.invalidateQueries({ queryKey: ["closing-gift-requests-admin"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not update"),
  });

  return (
    <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-border/80 bg-surface-2/40">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agent or client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-surface-2 border-border/80"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              Status:
            </Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-36 h-9 text-xs bg-surface-2 border-border/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({requests.length})</SelectItem>
                <SelectItem value="pending">
                  Pending ({requests.filter((r) => r.status === "pending").length})
                </SelectItem>
                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-xs text-muted-foreground font-mono">
          {filtered.length} request{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-surface-2 border-b border-border/80">
            <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground pl-4">
              Agent
            </TableHead>
            <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
              Client Recipient
            </TableHead>
            <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
              Gift Package (Shirts)
            </TableHead>
            <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
              Submitted
            </TableHead>
            <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground text-right pr-4">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border/60">
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                No closing gift requests found.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((r) => (
            <TableRow key={r.id} className="hover:bg-accent/40 transition-colors">
              <TableCell className="font-semibold text-foreground pl-4 text-xs">
                {r.agent_name}
              </TableCell>
              <TableCell className="text-xs font-medium text-foreground">
                {r.client_first_name} {r.client_last_name}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1.5 py-1">
                  {(r.shirts ?? []).map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="h-3 w-3 rounded-full border border-border/80 shrink-0"
                        style={{ backgroundColor: s.color_hex }}
                      />
                      <span className="font-mono font-bold text-[11px] px-1 py-0.2 rounded bg-surface-2 border border-border/60">
                        {s.size}
                      </span>
                      <span className="text-muted-foreground text-[11px]">· {s.color}</span>
                    </div>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={r.status} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground font-mono">
                {format(new Date(r.created_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right pr-4">
                <div className="flex justify-end gap-1.5">
                  {r.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 border-border/80 hover:border-gold/60"
                      onClick={() => markMut.mutate({ id: r.id, status: "fulfilled" })}
                    >
                      Fulfill
                    </Button>
                  )}
                  {r.status !== "completed" && (
                    <Button
                      size="sm"
                      className="bg-gold text-navy font-semibold hover:bg-gold/90 text-xs h-8 shadow-xs"
                      onClick={() => markMut.mutate({ id: r.id, status: "completed" })}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusBadge({ status }: { status: RequestRow["status"] }) {
  const cls =
    status === "completed"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : status === "fulfilled"
        ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
        : "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return (
    <span
      className={
        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border " + cls
      }
    >
      {status}
    </span>
  );
}

// satisfy unused import (redirect)
void redirect;
