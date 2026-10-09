import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calculator,
  Eye,
  FileText,
  Search,
  Download,
  Plus,
  Users,
  Building,
  DollarSign,
  Calendar,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { generateSellerNetPdf } from "@/lib/generate-seller-net-pdf";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin-net-sheets")({
  ssr: false,
  component: AdminNetSheetsPage,
  head: () => ({
    meta: [{ title: "Agent Net Sheets — MSREG Hub" }],
  }),
});

interface NetSheetRecord {
  id: string;
  agent_id: string;
  property_address: string;
  agent_name: string;
  agent_cell: string | null;
  agent_email: string | null;
  office_address: string | null;
  office_phone: string | null;
  num_scenarios: number;
  sheet_data: any;
  created_at: string;
  updated_at: string;
}

function formatCurrency(amount: number): string {
  if (isNaN(amount)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function AdminNetSheetsPage() {
  const { isAdmin, roles } = useAuth();
  const isOperations =
    roles.includes("marketing_coordinator") ||
    roles.includes("client_care") ||
    roles.includes("admin") ||
    isAdmin;
  const canAccess = isOperations;

  const [search, setSearch] = useState("");
  const [selectedSheet, setSelectedSheet] = useState<NetSheetRecord | null>(null);

  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ["admin-all-net-sheets"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("seller_net_sheets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as NetSheetRecord[];
    },
    enabled: canAccess,
  });

  const filteredSheets = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return sheets;
    return sheets.filter((s) => {
      return (
        (s.property_address ?? "").toLowerCase().includes(q) ||
        (s.agent_name ?? "").toLowerCase().includes(q) ||
        (s.agent_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [sheets, search]);

  const uniqueAgentsCount = useMemo(() => {
    const set = new Set<string>();
    sheets.forEach((s) => {
      if (s.agent_email) set.add(s.agent_email.toLowerCase());
      else if (s.agent_name) set.add(s.agent_name.toLowerCase());
    });
    return set.size;
  }, [sheets]);

  const multiScenarioCount = useMemo(() => {
    return sheets.filter((s) => (s.num_scenarios ?? 1) > 1).length;
  }, [sheets]);

  if (!canAccess) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 pt-16">
        <div className="p-3 w-12 h-12 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
          <Calculator className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Access Restricted</h1>
        <p className="text-sm text-muted-foreground">
          This operations view displays all agent worksheets across the brokerage and is reserved for
          Administrative, Marketing Operations, and Client Care team members.
        </p>
        <div className="pt-2">
          <Link to="/seller-net-proceeds">
            <Button className="bg-gold text-navy font-semibold hover:bg-gold/90">
              Open Public Net Sheet Calculator
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Agent Seller Net Sheets"
        description="Operations dashboard of all seller net proceeds worksheets generated across all agent accounts. Inspect calculations or export client PDFs on demand."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/seller-net-proceeds">
              <Button className="bg-gold text-navy font-semibold hover:bg-gold/90 h-9 shadow-xs">
                <Plus className="h-4 w-4 mr-1.5" /> New Net Sheet
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Total Worksheets
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-foreground">
              {sheets.length}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-2 text-gold border border-border/60">
            <FileText className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Active Agents
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-sky-400">
              {uniqueAgentsCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Multi-Scenario Sheets
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight mt-1 text-indigo-400">
              {multiScenarioCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Latest Creation
            </div>
            <div className="text-sm font-semibold font-mono tracking-tight mt-2 text-foreground truncate">
              {sheets[0]?.created_at
                ? new Date(sheets[0].created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Calendar className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-card border border-border/80 rounded-xl shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by agent name, email, or property address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs h-9 bg-surface-2 border-border/80"
          />
        </div>
        <div className="text-xs text-muted-foreground font-mono self-center sm:self-auto">
          Showing {filteredSheets.length} of {sheets.length} worksheets
        </div>
      </div>

      {isLoading ? (
        <div className="bg-card border border-border/80 rounded-xl p-12 text-center text-muted-foreground text-sm space-y-2">
          <div className="inline-block animate-spin h-6 w-6 border-2 border-gold border-t-transparent rounded-full mb-2" />
          <div>Loading agent net sheets…</div>
        </div>
      ) : filteredSheets.length === 0 ? (
        <div className="bg-card border border-border/80 rounded-xl p-12 text-center space-y-3 shadow-2xs">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
          <div className="font-semibold text-base text-foreground">No seller net sheets found</div>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {search
              ? `No worksheets match "${search}". Try checking for typos or searching a different term.`
              : "No agents have created and saved net sheets in the database yet."}
          </p>
          {search && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearch("")}
              className="text-xs h-8 mt-2"
            >
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-2 border-b border-border/80 text-muted-foreground uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="p-3.5 pl-4">Agent</th>
                  <th className="p-3.5">Property Address</th>
                  <th className="p-3.5">Date Created</th>
                  <th className="p-3.5">Price Scenarios</th>
                  <th className="p-3.5 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredSheets.map((sheet) => {
                  const data = sheet.sheet_data || {};
                  const dateStr = new Date(sheet.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  const p1 = data.scenario1_price ?? 0;
                  const p2 = data.num_scenarios >= 2 ? data.scenario2_price : null;
                  const p3 = data.num_scenarios >= 3 ? data.scenario3_price : null;

                  const initials = (sheet.agent_name || "A")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={sheet.id}
                      className="hover:bg-accent/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedSheet(sheet)}
                    >
                      <td className="p-3.5 pl-4 font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-gold/15 text-gold font-bold flex items-center justify-center text-[11px] border border-gold/30 shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground group-hover:text-gold transition-colors">
                              {sheet.agent_name || "Unknown Agent"}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {sheet.agent_email || "No email on file"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{sheet.property_address || "Untitled Property"}</span>
                        </div>
                        {sheet.office_address && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-xs mt-0.5">
                            {sheet.office_address}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-muted-foreground font-mono">
                        <div>{dateStr}</div>
                        <div className="text-[10px] text-muted-foreground/80">
                          {new Date(sheet.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-gold font-semibold">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="bg-gold/10 px-1.5 py-0.5 rounded border border-gold/20">
                            {formatCurrency(p1)}
                          </span>
                          {p2 !== null && (
                            <span className="bg-surface-2 text-foreground/80 px-1.5 py-0.5 rounded border border-border/60">
                              {formatCurrency(p2)}
                            </span>
                          )}
                          {p3 !== null && (
                            <span className="bg-surface-2 text-foreground/80 px-1.5 py-0.5 rounded border border-border/60">
                              {formatCurrency(p3)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-right pr-4">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedSheet(sheet)}
                            className="text-xs h-8 border-border/80 hover:border-gold/60"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1 text-gold" /> View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const toastId = toast.loading("Generating PDF…");
                              try {
                                await generateSellerNetPdf(sheet.sheet_data);
                                toast.success("PDF Downloaded!", { id: toastId });
                              } catch {
                                toast.error("Failed to generate PDF", { id: toastId });
                              }
                            }}
                            className="text-xs h-8 border-border/80 hover:bg-gold/10"
                            title="Export PDF"
                          >
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Read-Only Inspection Modal */}
      <Dialog open={!!selectedSheet} onOpenChange={(o) => !o && setSelectedSheet(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center justify-between pr-6">
              <span className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-gold" />
                Worksheet Inspection
              </span>
              {selectedSheet?.sheet_data && (
                <Button
                  size="sm"
                  onClick={async () => {
                    const toastId = toast.loading("Generating PDF…");
                    try {
                      await generateSellerNetPdf(selectedSheet.sheet_data);
                      toast.success("PDF Downloaded!", { id: toastId });
                    } catch {
                      toast.error("Failed to generate PDF", { id: toastId });
                    }
                  }}
                  className="bg-gold text-navy font-semibold hover:bg-gold/90 h-8 text-xs shadow-xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Export Client PDF
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedSheet && <ReadOnlySheetViewer sheet={selectedSheet} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReadOnlySheetViewer({ sheet }: { sheet: NetSheetRecord }) {
  const data = sheet.sheet_data || {};
  const num = data.num_scenarios || 1;

  const calculateScenario = (salesPrice: number) => {
    const isSub50k = salesPrice > 0 && salesPrice <= 50000;
    const listingComm =
      data.listing_comm_type === "flat" && isSub50k
        ? (data.listing_comm_flat_fee ?? 1500)
        : salesPrice * ((data.listing_comm_pct || 0) / 100);
    const sellingComm =
      data.selling_comm_type === "flat" && isSub50k
        ? (data.selling_comm_flat_fee ?? 1500)
        : salesPrice * ((data.selling_comm_pct || 0) / 100);
    const totalComm = listingComm + sellingComm;

    const fixedCosts =
      (data.mortgage_payoff_1 || 0) +
      (data.mortgage_payoff_2 || 0) +
      (data.closing_protection_letter || 0) +
      (data.seller_title_closing_fee || 0) +
      (data.title_search_fee || 0) +
      (data.warranty_deed_fee || 0) +
      (data.termite_letter || 0) +
      (data.inspections || 0) +
      (data.home_warranty || 0) +
      (data.transaction_fee || 0) +
      (data.estimated_taxes || 0) +
      (data.miscellaneous || 0) +
      (data.seller_concessions || 0);

    const totalSellingCosts = totalComm + fixedCosts;
    const cashToSeller = salesPrice - totalSellingCosts;

    return { salesPrice, listingComm, sellingComm, totalSellingCosts, cashToSeller };
  };

  const c1 = calculateScenario(data.scenario1_price || 0);
  const c2 = calculateScenario(data.scenario2_price || 0);
  const c3 = calculateScenario(data.scenario3_price || 0);

  const activeCalcs = [c1];
  if (num >= 2) activeCalcs.push(c2);
  if (num >= 3) activeCalcs.push(c3);

  const allProceedsNegative = activeCalcs.every((c) => c.cashToSeller < 0);
  const allProceedsPositive = activeCalcs.every((c) => c.cashToSeller >= 0);

  const rowProceedsClasses = allProceedsNegative
    ? "bg-destructive/15 font-extrabold border-t-2 border-destructive/60 text-destructive"
    : allProceedsPositive
    ? "bg-emerald-500/15 font-extrabold border-t-2 border-emerald-500/50 text-emerald-400"
    : "bg-surface-2 font-extrabold border-t-2 border-border text-foreground";

  const labelProceedsClasses = allProceedsNegative
    ? "p-3 uppercase text-destructive font-black"
    : allProceedsPositive
    ? "p-3 uppercase text-emerald-400 font-black"
    : "p-3 uppercase text-foreground font-black";

  const getProceedsCellClasses = (cash: number) => {
    if (cash < 0) {
      return "p-3 text-center font-mono text-sm border-l border-destructive/40 bg-destructive/10 text-destructive font-bold";
    }
    return "p-3 text-center font-mono text-sm border-l border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold";
  };

  const getCommLabel = (label: string, type?: "percent" | "flat", flatFee?: number, pct?: number) => {
    if (type === "flat") {
      const allSub50k = activeCalcs.every((c) => c.salesPrice > 0 && c.salesPrice <= 50000);
      const anySub50k = activeCalcs.some((c) => c.salesPrice > 0 && c.salesPrice <= 50000);
      const feeFormatted = `$${(flatFee ?? 1500).toLocaleString()}`;
      if (allSub50k) {
        return `${label} (${feeFormatted} Flat Fee)`;
      } else if (anySub50k) {
        return `${label} (${feeFormatted} Flat Fee on ≤$50k / ${pct}%)`;
      }
    }
    return `${label} (${pct}%)`;
  };

  return (
    <div className="space-y-5 text-xs text-foreground p-1">
      {/* Property & Agent Summary Card */}
      <div className="bg-surface-2 border border-border/80 p-4 rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row justify-between gap-2 border-b border-border/60 pb-3">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-gold">
              Property Address
            </div>
            <div className="text-base font-bold text-foreground">
              {sheet.property_address || "Untitled Property"}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              Date Created
            </div>
            <div className="text-xs font-mono text-foreground">
              {new Date(sheet.created_at).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Agent Name:</span>
            <div className="font-semibold text-foreground">{sheet.agent_name}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Agent Email:</span>
            <div className="font-semibold text-foreground truncate">{sheet.agent_email || "N/A"}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Cell Phone:</span>
            <div className="font-semibold text-foreground">{sheet.agent_cell || "N/A"}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Office:</span>
            <div className="font-semibold text-foreground truncate">{sheet.office_address || "N/A"}</div>
          </div>
        </div>
      </div>

      {/* Breakdown Statement Table */}
      <div className="overflow-x-auto border border-border/80 rounded-xl shadow-2xs">
        <table className="w-full text-xs text-left">
          <thead className="bg-surface-2 border-b border-border/80 text-foreground">
            <tr>
              <th className="p-3 font-bold uppercase text-[10px]">Expense Item</th>
              <th className="p-3 font-bold uppercase text-[10px] text-center border-l border-border/70">
                Scenario 1
              </th>
              {num >= 2 && (
                <th className="p-3 font-bold uppercase text-[10px] text-center border-l border-border/70">
                  Scenario 2
                </th>
              )}
              {num >= 3 && (
                <th className="p-3 font-bold uppercase text-[10px] text-center border-l border-border/70">
                  Scenario 3
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-card">
            <tr className="font-bold bg-surface-2/60">
              <td className="p-2.5 text-foreground">Sales Price</td>
              <td className="p-2.5 text-center font-mono text-gold border-l border-border/60">
                {formatCurrency(c1.salesPrice)}
              </td>
              {num >= 2 && (
                <td className="p-2.5 text-center font-mono text-gold border-l border-border/60">
                  {formatCurrency(c2.salesPrice)}
                </td>
              )}
              {num >= 3 && (
                <td className="p-2.5 text-center font-mono text-gold border-l border-border/60">
                  {formatCurrency(c3.salesPrice)}
                </td>
              )}
            </tr>
            <tr>
              <td className="p-2 text-muted-foreground">
                {getCommLabel(
                  "Listing Commission",
                  data.listing_comm_type,
                  data.listing_comm_flat_fee,
                  data.listing_comm_pct,
                )}
              </td>
              <td className="p-2 text-center font-mono border-l border-border/60">
                <div>{formatCurrency(c1.listingComm)}</div>
                {data.listing_comm_type === "flat" && c1.salesPrice > 0 && c1.salesPrice <= 50000 && (
                  <span className="text-[10px] text-gold font-semibold">Flat Fee</span>
                )}
              </td>
              {num >= 2 && (
                <td className="p-2 text-center font-mono border-l border-border/60">
                  <div>{formatCurrency(c2.listingComm)}</div>
                  {data.listing_comm_type === "flat" && c2.salesPrice > 0 && c2.salesPrice <= 50000 && (
                    <span className="text-[10px] text-gold font-semibold">Flat Fee</span>
                  )}
                </td>
              )}
              {num >= 3 && (
                <td className="p-2 text-center font-mono border-l border-border/60">
                  <div>{formatCurrency(c3.listingComm)}</div>
                  {data.listing_comm_type === "flat" && c3.salesPrice > 0 && c3.salesPrice <= 50000 && (
                    <span className="text-[10px] text-gold font-semibold">Flat Fee</span>
                  )}
                </td>
              )}
            </tr>
            <tr>
              <td className="p-2 text-muted-foreground">
                {getCommLabel(
                  "Selling Commission",
                  data.selling_comm_type,
                  data.selling_comm_flat_fee,
                  data.selling_comm_pct,
                )}
              </td>
              <td className="p-2 text-center font-mono border-l border-border/60">
                <div>{formatCurrency(c1.sellingComm)}</div>
                {data.selling_comm_type === "flat" && c1.salesPrice > 0 && c1.salesPrice <= 50000 && (
                  <span className="text-[10px] text-gold font-semibold">Flat Fee</span>
                )}
              </td>
              {num >= 2 && (
                <td className="p-2 text-center font-mono border-l border-border/60">
                  <div>{formatCurrency(c2.sellingComm)}</div>
                  {data.selling_comm_type === "flat" && c2.salesPrice > 0 && c2.salesPrice <= 50000 && (
                    <span className="text-[10px] text-gold font-semibold">Flat Fee</span>
                  )}
                </td>
              )}
              {num >= 3 && (
                <td className="p-2 text-center font-mono border-l border-border/60">
                  <div>{formatCurrency(c3.sellingComm)}</div>
                  {data.selling_comm_type === "flat" && c3.salesPrice > 0 && c3.salesPrice <= 50000 && (
                    <span className="text-[10px] text-gold font-semibold">Flat Fee</span>
                  )}
                </td>
              )}
            </tr>
            <tr>
              <td className="p-2 text-muted-foreground">Principal Mortgage Payoff</td>
              <td className="p-2 text-center font-mono border-l border-border/60" colSpan={num}>
                {formatCurrency(data.mortgage_payoff_1 || 0)}
              </td>
            </tr>
            <tr>
              <td className="p-2 text-muted-foreground">Second Mortgage Payoff</td>
              <td className="p-2 text-center font-mono border-l border-border/60" colSpan={num}>
                {formatCurrency(data.mortgage_payoff_2 || 0)}
              </td>
            </tr>
            <tr>
              <td className="p-2 text-muted-foreground">Title Closing Fee</td>
              <td className="p-2 text-center font-mono border-l border-border/60" colSpan={num}>
                {formatCurrency(data.seller_title_closing_fee || 0)}
              </td>
            </tr>
            <tr>
              <td className="p-2 text-muted-foreground">Title Search Fee</td>
              <td className="p-2 text-center font-mono border-l border-border/60" colSpan={num}>
                {formatCurrency(data.title_search_fee || 0)}
              </td>
            </tr>
            <tr>
              <td className="p-2 text-muted-foreground">Transaction Fee</td>
              <td className="p-2 text-center font-mono border-l border-border/60" colSpan={num}>
                {formatCurrency(data.transaction_fee || 0)}
              </td>
            </tr>
            <tr>
              <td className="p-2 text-muted-foreground">Estimated Taxes</td>
              <td className="p-2 text-center font-mono border-l border-border/60" colSpan={num}>
                {formatCurrency(data.estimated_taxes || 0)}
              </td>
            </tr>
            <tr>
              <td className="p-2 text-muted-foreground">Seller Concessions</td>
              <td className="p-2 text-center font-mono border-l border-border/60" colSpan={num}>
                {formatCurrency(data.seller_concessions || 0)}
              </td>
            </tr>

            <tr className="bg-surface-2 font-bold border-t-2 border-border text-foreground">
              <td className="p-2.5 text-gold font-bold">TOTAL SELLING COSTS</td>
              <td className="p-2.5 text-center font-mono border-l border-border/60">
                {formatCurrency(c1.totalSellingCosts)}
              </td>
              {num >= 2 && (
                <td className="p-2.5 text-center font-mono border-l border-border/60">
                  {formatCurrency(c2.totalSellingCosts)}
                </td>
              )}
              {num >= 3 && (
                <td className="p-2.5 text-center font-mono border-l border-border/60">
                  {formatCurrency(c3.totalSellingCosts)}
                </td>
              )}
            </tr>

            <tr className={rowProceedsClasses}>
              <td className={labelProceedsClasses}>ESTIMATED CASH TO SELLER</td>
              <td className={getProceedsCellClasses(c1.cashToSeller)}>
                {formatCurrency(c1.cashToSeller)}
              </td>
              {num >= 2 && (
                <td className={getProceedsCellClasses(c2.cashToSeller)}>
                  {formatCurrency(c2.cashToSeller)}
                </td>
              )}
              {num >= 3 && (
                <td className={getProceedsCellClasses(c3.cashToSeller)}>
                  {formatCurrency(c3.cashToSeller)}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground font-mono text-center leading-relaxed">
        NOTE: THIS FORM IS INTENDED AS AN ESTIMATE ONLY. IT DOES NOT INCLUDE TAX PRORATION, ESCROW
        ADJUSTMENTS AND OTHER MISCELLANEOUS COSTS SOMETIMES ASSOCIATED WITH CLOSING. MATT SMITH REAL
        ESTATE GROUP/EXP REALTY ACCEPTS NO RESPONSIBILITY FOR THIS ESTIMATE.
      </p>
    </div>
  );
}
