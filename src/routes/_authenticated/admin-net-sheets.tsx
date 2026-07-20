import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, Eye, FileText, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin-net-sheets")({
  component: AdminNetSheetsPage,
  head: () => ({
    meta: [{ title: "Agent Net Sheets — MSREG Admin" }],
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
  const { isAdmin } = useAuth();
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
    enabled: isAdmin,
  });

  const filteredSheets = sheets.filter((s) => {
    const q = search.toLowerCase();
    return (
      (s.property_address ?? "").toLowerCase().includes(q) ||
      (s.agent_name ?? "").toLowerCase().includes(q) ||
      (s.agent_email ?? "").toLowerCase().includes(q)
    );
  });

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Access restricted. Admins only.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-gold" /> Agent Seller Net Sheets
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            View all seller net proceeds worksheets created across all agent accounts.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by agent or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading net sheets...</div>
      ) : filteredSheets.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-2">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="font-semibold text-sm">No seller net sheets found</div>
          <p className="text-xs text-muted-foreground">
            {search ? "No sheets match your search query." : "No agents have created saved net sheets yet."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-sidebar border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="p-3">Agent</th>
                  <th className="p-3">Property Address</th>
                  <th className="p-3">Date Created</th>
                  <th className="p-3">Price Scenarios</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
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

                  return (
                    <tr key={sheet.id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3 font-medium">
                        <div className="font-semibold text-foreground">{sheet.agent_name}</div>
                        <div className="text-[10px] text-muted-foreground">{sheet.agent_email}</div>
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        {sheet.property_address || "Untitled Property"}
                      </td>
                      <td className="p-3 text-muted-foreground font-mono">
                        {dateStr}
                      </td>
                      <td className="p-3 font-mono text-[#C9A84C] font-semibold">
                        {formatCurrency(p1)}
                        {p2 !== null && ` / ${formatCurrency(p2)}`}
                        {p3 !== null && ` / ${formatCurrency(p3)}`}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedSheet(sheet)}
                          className="text-xs h-7 border-gold/40 text-gold hover:bg-gold hover:text-navy"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View Sheet
                        </Button>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 text-white border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#C9A84C] flex items-center justify-between">
              <span>Agent Net Sheet Inspection</span>
            </DialogTitle>
          </DialogHeader>

          {selectedSheet && (
            <ReadOnlySheetViewer sheet={selectedSheet} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReadOnlySheetViewer({ sheet }: { sheet: NetSheetRecord }) {
  const data = sheet.sheet_data || {};
  const num = data.num_scenarios || 1;

  const calculateScenario = (salesPrice: number) => {
    const listingComm = salesPrice * ((data.listing_comm_pct || 0) / 100);
    const sellingComm = salesPrice * ((data.selling_comm_pct || 0) / 100);
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

  return (
    <div className="space-y-6 text-xs text-slate-200 p-2">
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="text-[10px] uppercase font-bold text-[#C9A84C]">Property Address</div>
            <div className="text-base font-bold text-white">{sheet.property_address}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-[#C9A84C]">Date Created</div>
            <div className="text-xs font-mono text-slate-300">
              {new Date(sheet.created_at).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-400">Agent Name:</span>
            <div className="font-semibold text-white">{sheet.agent_name}</div>
          </div>
          <div>
            <span className="text-slate-400">Agent Email:</span>
            <div className="font-semibold text-white">{sheet.agent_email || "N/A"}</div>
          </div>
          <div>
            <span className="text-slate-400">Cell Phone:</span>
            <div className="font-semibold text-white">{sheet.agent_cell || "N/A"}</div>
          </div>
          <div>
            <span className="text-slate-400">Office:</span>
            <div className="font-semibold text-white">{sheet.office_address || "N/A"}</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-xl">
        <table className="w-full text-xs text-left">
          <thead className="bg-[#1B2F5B] text-white">
            <tr>
              <th className="p-3 font-bold uppercase text-[10px]">Expense Item</th>
              <th className="p-3 font-bold uppercase text-[10px] text-center border-l border-slate-700">Scenario 1</th>
              {num >= 2 && <th className="p-3 font-bold uppercase text-[10px] text-center border-l border-slate-700">Scenario 2</th>}
              {num >= 3 && <th className="p-3 font-bold uppercase text-[10px] text-center border-l border-slate-700">Scenario 3</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950">
            <tr className="font-bold bg-slate-900">
              <td className="p-2.5 text-white">Sales Price</td>
              <td className="p-2.5 text-center font-mono text-[#C9A84C] border-l border-slate-800">{formatCurrency(c1.salesPrice)}</td>
              {num >= 2 && <td className="p-2.5 text-center font-mono text-[#C9A84C] border-l border-slate-800">{formatCurrency(c2.salesPrice)}</td>}
              {num >= 3 && <td className="p-2.5 text-center font-mono text-[#C9A84C] border-l border-slate-800">{formatCurrency(c3.salesPrice)}</td>}
            </tr>
            <tr>
              <td className="p-2 text-slate-300">Listing Commission ({data.listing_comm_pct}%)</td>
              <td className="p-2 text-center font-mono border-l border-slate-800">{formatCurrency(c1.listingComm)}</td>
              {num >= 2 && <td className="p-2 text-center font-mono border-l border-slate-800">{formatCurrency(c2.listingComm)}</td>}
              {num >= 3 && <td className="p-2 text-center font-mono border-l border-slate-800">{formatCurrency(c3.listingComm)}</td>}
            </tr>
            <tr>
              <td className="p-2 text-slate-300">Selling Commission ({data.selling_comm_pct}%)</td>
              <td className="p-2 text-center font-mono border-l border-slate-800">{formatCurrency(c1.sellingComm)}</td>
              {num >= 2 && <td className="p-2 text-center font-mono border-l border-slate-800">{formatCurrency(c2.sellingComm)}</td>}
              {num >= 3 && <td className="p-2 text-center font-mono border-l border-slate-800">{formatCurrency(c3.sellingComm)}</td>}
            </tr>
            <tr>
              <td className="p-2 text-slate-300">Principal Mortgage Payoff</td>
              <td className="p-2 text-center font-mono border-l border-slate-800" colSpan={num}>{formatCurrency(data.mortgage_payoff_1 || 0)}</td>
            </tr>
            <tr>
              <td className="p-2 text-slate-300">Second Mortgage Payoff</td>
              <td className="p-2 text-center font-mono border-l border-slate-800" colSpan={num}>{formatCurrency(data.mortgage_payoff_2 || 0)}</td>
            </tr>
            <tr>
              <td className="p-2 text-slate-300">Title Closing Fee</td>
              <td className="p-2 text-center font-mono border-l border-slate-800" colSpan={num}>{formatCurrency(data.seller_title_closing_fee || 0)}</td>
            </tr>
            <tr>
              <td className="p-2 text-slate-300">Title Search Fee</td>
              <td className="p-2 text-center font-mono border-l border-slate-800" colSpan={num}>{formatCurrency(data.title_search_fee || 0)}</td>
            </tr>
            <tr>
              <td className="p-2 text-slate-300">Transaction Fee</td>
              <td className="p-2 text-center font-mono border-l border-slate-800" colSpan={num}>{formatCurrency(data.transaction_fee || 0)}</td>
            </tr>
            <tr>
              <td className="p-2 text-slate-300">Estimated Taxes</td>
              <td className="p-2 text-center font-mono border-l border-slate-800" colSpan={num}>{formatCurrency(data.estimated_taxes || 0)}</td>
            </tr>
            <tr>
              <td className="p-2 text-slate-300">Seller Concessions</td>
              <td className="p-2 text-center font-mono border-l border-slate-800" colSpan={num}>{formatCurrency(data.seller_concessions || 0)}</td>
            </tr>

            <tr className="bg-[#1B2F5B]/50 font-bold border-t-2 border-[#C9A84C]/40 text-white">
              <td className="p-2.5 text-[#C9A84C]">TOTAL SELLING COSTS</td>
              <td className="p-2.5 text-center font-mono border-l border-slate-800">{formatCurrency(c1.totalSellingCosts)}</td>
              {num >= 2 && <td className="p-2.5 text-center font-mono border-l border-slate-800">{formatCurrency(c2.totalSellingCosts)}</td>}
              {num >= 3 && <td className="p-2.5 text-center font-mono border-l border-slate-800">{formatCurrency(c3.totalSellingCosts)}</td>}
            </tr>

            <tr className="bg-emerald-950/40 font-extrabold border-t-2 border-emerald-500/50 text-emerald-400">
              <td className="p-3 uppercase">ESTIMATED CASH TO SELLER</td>
              <td className="p-3 text-center font-mono text-sm border-l border-emerald-800/60 bg-emerald-500/10">{formatCurrency(c1.cashToSeller)}</td>
              {num >= 2 && <td className="p-3 text-center font-mono text-sm border-l border-emerald-800/60 bg-emerald-500/10">{formatCurrency(c2.cashToSeller)}</td>}
              {num >= 3 && <td className="p-3 text-center font-mono text-sm border-l border-emerald-800/60 bg-emerald-500/10">{formatCurrency(c3.cashToSeller)}</td>}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 font-mono text-center leading-relaxed">
        NOTE: THIS FORM IS INTENDED AS AN ESTIMATE ONLY. IT DOES NOT INCLUDE TAX PRORATION, ESCROW ADJUSTMENTS AND OTHER MISCELLANEOUS COSTS SOMETIMES ASSOCIATED WITH CLOSING. MATT SMITH REAL ESTATE GROUP/EXP REALTY ACCEPTS NO RESPONSIBILITY FOR THIS ESTIMATE.
      </p>
    </div>
  );
}
