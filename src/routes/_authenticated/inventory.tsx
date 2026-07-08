import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Boxes, Plus, Pencil, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  addOrUpdateInventory,
  deleteInventoryRow,
  markRequestCompleted,
} from "@/lib/closing-gift.functions";

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
    // Final RLS gate happens server-side; this is a UX redirect for non-eligible users
    return {};
  },
  component: InventoryPage,
  head: () => ({ meta: [{ title: "Closing Gift Inventory — MSREG" }] }),
});

const sb = supabase as any;

function InventoryPage() {
  const { isAdmin, roles } = useAuth();
  const isClientCare = roles?.includes("client_care");
  const canAccess = isAdmin || isClientCare;

  if (!canAccess) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-xl font-semibold">Not Authorized</h1>
        <p className="text-muted-foreground mt-2">This page is for Admin and Client Care users only.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <header className="mb-6 flex items-center gap-3">
        <Boxes className="h-7 w-7 text-gold" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Closing Gift Inventory</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage shirt stock and fulfill requests.</p>
        </div>
      </header>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="requests">Request History</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory" className="mt-4">
          <InventoryTab canEdit={!!isAdmin || !!isClientCare} />
        </TabsContent>
        <TabsContent value="requests" className="mt-4">
          <RequestsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============== INVENTORY TAB ==============

function InventoryTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [adding, setAdding] = useState(false);

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["closing-gift-inventory-admin"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("closing_gift_inventory")
        .select("id,size,color,color_hex,quantity_available")
        .order("size")
        .order("color");
      if (error) throw error;
      return data as InventoryRow[];
    },
  });

  const colors = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of inventory) set.set(r.color, r.color_hex);
    return Array.from(set.entries()).map(([color, hex]) => ({ color, hex }));
  }, [inventory]);

  const sizeOrder = (s: string) => SIZES.indexOf(s as any);
  const rows = inventory
    .filter((r) => colorFilter === "all" || r.color === colorFilter)
    .sort((a, b) => sizeOrder(a.size) - sizeOrder(b.size) || a.color.localeCompare(b.color));

  const deleteFn = useServerFn(deleteInventoryRow);
  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed from inventory");
      qc.invalidateQueries({ queryKey: ["closing-gift-inventory-admin"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not delete"),
  });

  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Filter by color:</Label>
        <Select value={colorFilter} onValueChange={setColorFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All colors</SelectItem>
            {colors.map((c) => (
              <SelectItem key={c.color} value={c.color}>{c.color}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {canEdit && (
          <Button onClick={() => setAdding(true)} className="bg-gold text-navy hover:bg-gold/90">
            <Plus className="h-4 w-4 mr-1" /> Add Inventory
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Size</TableHead>
            <TableHead>Color</TableHead>
            <TableHead className="text-right">Quantity Available</TableHead>
            <TableHead className="w-32 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
          )}
          {!isLoading && rows.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No inventory yet.</TableCell></TableRow>
          )}
          {rows.map((r) => {
            const low = r.quantity_available <= LOW_STOCK;
            return (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.size}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: r.color_hex }} />
                    <span>{r.color}</span>
                    <span className="text-xs text-muted-foreground">{r.color_hex}</span>
                  </div>
                </TableCell>
                <TableCell className={"text-right font-mono " + (low ? "text-destructive font-semibold" : "")}>
                  <div className="inline-flex items-center gap-1.5">
                    {low && <AlertTriangle className="h-3.5 w-3.5" />}
                    {r.quantity_available}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {canEdit ? (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete ${r.size} / ${r.color}?`)) delMut.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["closing-gift-inventory-admin"] })}
        />
      )}
    </div>
  );
}

function InventoryDialog({
  row, onClose, onSaved,
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
  const upsertFn = useServerFn(addOrUpdateInventory);

  async function handleSave() {
    if (!color.trim()) { toast.error("Color name is required"); return; }
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) { toast.error("Hex must be like #001F3F"); return; }
    setBusy(true);
    try {
      await upsertFn({
        data: {
          size,
          color: color.trim(),
          color_hex: hex.trim(),
          quantity: Number(qty) || 0,
        },
      });
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
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? "Edit Inventory" : "Add Inventory"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1 block">Size</Label>
            <Select value={size} onValueChange={setSize} disabled={!!row}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="color" className="mb-1 block">Color Name</Label>
            <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Navy Blue" disabled={!!row} />
          </div>
          <div>
            <Label htmlFor="hex" className="mb-1 block">Color Hex</Label>
            <div className="flex items-center gap-2">
              <Input id="hex" value={hex} onChange={(e) => setHex(e.target.value)} placeholder="#001F3F" />
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#001F3F"}
                onChange={(e) => setHex(e.target.value)}
                className="h-10 w-12 rounded border border-border bg-background cursor-pointer"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="qty" className="mb-1 block">Quantity Available</Label>
            <Input id="qty" type="number" min={0} value={qty} onChange={(e) => setQty(parseInt(e.target.value, 10) || 0)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy} className="bg-gold text-navy hover:bg-gold/90">
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== REQUESTS TAB ==============

function RequestsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "fulfilled" | "completed">("all");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["closing-gift-requests-admin"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("closing_gift_requests")
        .select("id,agent_name,client_first_name,client_last_name,shirts,status,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RequestRow[];
    },
  });

  const filtered = requests.filter((r) => statusFilter === "all" || r.status === statusFilter);

  const markFn = useServerFn(markRequestCompleted);
  const markMut = useMutation({
    mutationFn: (vars: { id: string; status: "fulfilled" | "completed" }) =>
      markFn({ data: { request_id: vars.id, status: vars.status } }),
    onSuccess: () => {
      toast.success("Request updated");
      qc.invalidateQueries({ queryKey: ["closing-gift-requests-admin"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not update"),
  });

  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status:</Label>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="fulfilled">Fulfilled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <div className="text-xs text-muted-foreground">{filtered.length} request{filtered.length === 1 ? "" : "s"}</div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Shirts</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
          )}
          {!isLoading && filtered.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No requests.</TableCell></TableRow>
          )}
          {filtered.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.agent_name}</TableCell>
              <TableCell>{r.client_first_name} {r.client_last_name}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {(r.shirts ?? []).map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <span className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: s.color_hex }} />
                      <span className="font-mono">{s.size}</span>
                      <span className="text-muted-foreground">· {s.color}</span>
                    </div>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={r.status} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {format(new Date(r.created_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {r.status === "pending" && (
                    <Button size="sm" variant="outline"
                      onClick={() => markMut.mutate({ id: r.id, status: "fulfilled" })}>
                      Mark Fulfilled
                    </Button>
                  )}
                  {r.status !== "completed" && (
                    <Button size="sm" className="bg-gold text-navy hover:bg-gold/90"
                      onClick={() => markMut.mutate({ id: r.id, status: "completed" })}>
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
  const cls = status === "completed"
    ? "bg-green-500/15 text-green-600 border-green-500/30"
    : status === "fulfilled"
    ? "bg-blue-500/15 text-blue-600 border-blue-500/30"
    : "bg-amber-500/15 text-amber-600 border-amber-500/30";
  return <span className={"text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border " + cls}>{status}</span>;
}

// satisfy unused import (redirect) — keep for future RLS-side redirect use
void redirect;
