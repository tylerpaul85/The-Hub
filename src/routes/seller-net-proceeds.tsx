import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calculator, LogIn, UserPlus, LogOut, Save, Download, RotateCcw, Plus, Trash2, Edit3, ArrowLeft,
  Check, Lock, Building, Phone, Mail, MapPin, DollarSign, AlertCircle, FileText
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAgentAuth, isValidAgentEmail, type AgentAccount } from "@/hooks/use-agent-auth";
import logo from "@/assets/msreg-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateSellerNetPdf } from "@/lib/generate-seller-net-pdf";

export const Route = createFileRoute("/seller-net-proceeds")({
  ssr: false,
  component: SellerNetProceedsPage,
  head: () => ({
    meta: [
      { title: "Seller Net Proceeds Calculator — MSREG" },
      { name: "robots", content: "noindex, nofollow" },
    ],
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
  sheet_data: SheetData;
  created_at: string;
  updated_at: string;
}

interface SheetData {
  agent_name: string;
  agent_cell: string;
  agent_email: string;
  office_address: string;
  office_phone: string;
  property_address: string;
  num_scenarios: 1 | 2 | 3;
  scenario1_price: number;
  scenario2_price: number;
  scenario3_price: number;
  listing_comm_pct: number;
  selling_comm_pct: number;
  mortgage_payoff_1: number;
  mortgage_payoff_2: number;
  closing_protection_letter: number;
  seller_title_closing_fee: number;
  title_search_fee: number;
  warranty_deed_fee: number;
  termite_letter: number;
  inspections: number;
  home_warranty: number;
  transaction_fee: number;
  estimated_taxes: number;
  miscellaneous: number;
  seller_concessions: number;
}

const DEFAULT_SHEET_DATA: SheetData = {
  agent_name: "",
  agent_cell: "",
  agent_email: "",
  office_address: "1043 Kingshighway, Rolla, MO 65401",
  office_phone: "(573) 451-2020",
  property_address: "",
  num_scenarios: 1,
  scenario1_price: 300000,
  scenario2_price: 315000,
  scenario3_price: 330000,
  listing_comm_pct: 3.0,
  selling_comm_pct: 3.0,
  mortgage_payoff_1: 0,
  mortgage_payoff_2: 0,
  closing_protection_letter: 50,
  seller_title_closing_fee: 250,
  title_search_fee: 200,
  warranty_deed_fee: 50,
  termite_letter: 75,
  inspections: 0,
  home_warranty: 0,
  transaction_fee: 295,
  estimated_taxes: 1283,
  miscellaneous: 0,
  seller_concessions: 5000,
};

function formatCurrency(amount: number): string {
  if (isNaN(amount)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function SellerNetProceedsPage() {
  const { agent, user, loading, signOutAgent } = useAgentAuth();
  const [activeTab, setActiveTab] = useState<"dashboard" | "calculator">("dashboard");
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Calculator className="h-8 w-8 animate-bounce text-gold mx-auto" />
          <p className="text-sm text-muted-foreground">Loading Seller Net Proceeds...</p>
        </div>
      </div>
    );
  }

  if (!agent || !user) {
    return <AgentAuthView />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navy/Gold Agent Header */}
      <header className="bg-card border-b border-border px-4 py-3 sm:px-6 shadow-md print:hidden">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <Link to="/agents" className="flex items-center gap-2 text-xs font-semibold text-gold hover:underline">
              <ArrowLeft className="h-4 w-4" /> Agent Hub
            </Link>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-2">
              <img src={logo} alt="MSREG Logo" className="h-7 w-auto" />
              <span className="text-xs uppercase tracking-widest text-gold font-bold">Seller Net Proceeds</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-xs text-muted-foreground">
              Agent: <span className="font-semibold text-white">{agent.full_name}</span>{" "}
              <span className="text-muted-foreground/80">({agent.email})</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={signOutAgent}
              className="text-xs border-gold/40 text-gold hover:bg-gold hover:text-navy h-8 transition-colors duration-200"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-6">
        {activeTab === "dashboard" ? (
          <DashboardView
            agent={agent}
            onOpenNew={() => {
              setEditingSheetId(null);
              setActiveTab("calculator");
            }}
            onEditSheet={(sheet) => {
              setEditingSheetId(sheet.id);
              setActiveTab("calculator");
            }}
          />
        ) : (
          <CalculatorView
            agent={agent}
            editingSheetId={editingSheetId}
            onBackToDashboard={() => setActiveTab("dashboard")}
          />
        )}
      </main>

      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-800 print:hidden">
        © Matt Smith Real Estate Group / eXp Realty
      </footer>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/*                            AGENT AUTH VIEW                                 */
/* -------------------------------------------------------------------------- */

function AgentAuthView() {
  const { signUpAgent, signInAgent, resetAgentPassword } = useAgentAuth();
  const [authTab, setAuthTab] = useState<"signin" | "signup" | "reset" >("signin");
  const [busy, setBusy] = useState(false);

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Sign Up Form State
  const [signUpName, setSignUpName] = useState("");
  const [signUpPhone, setSignUpPhone] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  // Reset Password Form State
  const [resetEmail, setResetEmail] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signInAgent(signInEmail, signInPassword);
    } catch {
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signUpAgent(signUpEmail, signUpPassword, signUpName, signUpPhone);
    } catch {
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await resetAgentPassword(resetEmail);
      setAuthTab("signin");
    } catch {
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 pt-[max(2rem,env(safe-area-inset-top))] overflow-hidden before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,oklch(0.20_0.08_85_/_0.08),transparent_45%)] after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_bottom_left,oklch(0.18_0.05_260_/_0.2),transparent_60%)]">
      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link to="/agents" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:underline mb-2">
            <ArrowLeft className="h-4 w-4" /> Back to Agent Hub
          </Link>
          <img src={logo} alt="Matt Smith Real Estate Group" className="h-20 w-auto mx-auto" />
          <div className="text-[11px] uppercase tracking-[0.2em] text-gold font-semibold">Agent Account Access</div>
          <h1 className="text-2xl font-semibold text-white">Seller Net Proceeds Tool</h1>
          <p className="text-xs text-muted-foreground">Sign in or create your agent account to save and manage net sheets.</p>
        </div>

        {/* Required Email Domain Restriction Notice */}
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-3.5 flex items-start gap-3 text-xs">
          <AlertCircle className="h-5 w-5 text-gold shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-gold">Agent Domain Restriction</div>
            <p className="text-muted-foreground mt-0.5">
              Accounts are limited to <span className="font-bold text-white">@mattsmithrealestategroup.com</span> email addresses.
            </p>
          </div>
        </div>

        <div className="bg-card/75 border border-border/80 rounded-xl p-6 shadow-2xl backdrop-blur-md relative z-10">
          {authTab === "reset" ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <h2 className="text-base font-semibold text-[#C9A84C]">Reset Agent Password</h2>
              <p className="text-xs text-slate-300">Enter your @mattsmithrealestategroup.com email address to receive password reset instructions.</p>
              <div className="space-y-1.5">
                <Label htmlFor="reset-email" className="text-xs text-slate-300">Agent Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="agent@mattsmithrealestategroup.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setAuthTab("signin")} className="flex-1 text-xs border-slate-700 text-slate-300">
                  Cancel
                </Button>
                <Button type="submit" disabled={busy} className="flex-1 bg-[#C9A84C] text-[#1B2F5B] hover:bg-[#C9A84C]/90 font-bold text-xs">
                  {busy ? "Sending..." : "Send Reset Email"}
                </Button>
              </div>
            </form>
          ) : (
            <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as any)}>
              <TabsList className="grid grid-cols-2 bg-background mb-5 p-1 border border-border rounded-lg">
                <TabsTrigger value="signin" className="text-xs data-[state=active]:bg-gold data-[state=active]:text-navy font-semibold rounded-md transition-colors duration-200">
                  <LogIn className="h-3.5 w-3.5 mr-1.5" /> Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="text-xs data-[state=active]:bg-gold data-[state=active]:text-navy font-semibold rounded-md transition-colors duration-200">
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Create Account
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-email" className="text-xs text-muted-foreground">Agent Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="name@mattsmithrealestategroup.com"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-gold"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-pass" className="text-xs text-muted-foreground">Password</Label>
                      <button
                        type="button"
                        onClick={() => setAuthTab("reset")}
                        className="text-[11px] text-gold hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="signin-pass"
                      type="password"
                      placeholder="••••••••"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      className="bg-background border-border text-foreground focus-visible:ring-gold"
                      required
                    />
                  </div>

                  <Button type="submit" disabled={busy} className="w-full bg-gold text-navy hover:bg-gold/90 font-semibold text-xs py-2.5 h-10 transition-colors duration-200">
                    {busy ? "Signing in..." : "Sign In to Agent Hub"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-3.5">
                  <div className="space-y-1">
                    <Label htmlFor="signup-name" className="text-xs text-muted-foreground">Full Name</Label>
                    <Input
                      id="signup-name"
                      placeholder="Jane Smith"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      className="bg-background border-border text-foreground focus-visible:ring-gold"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-phone" className="text-xs text-muted-foreground">Cell Phone (Optional)</Label>
                    <Input
                      id="signup-phone"
                      placeholder="(573) 555-0199"
                      value={signUpPhone}
                      onChange={(e) => setSignUpPhone(e.target.value)}
                      className="bg-background border-border text-foreground focus-visible:ring-gold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-email" className="text-xs text-muted-foreground">
                      MSREG Email <span className="text-gold font-semibold">(@mattsmithrealestategroup.com)</span>
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="name@mattsmithrealestategroup.com"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-gold"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-pass" className="text-xs text-muted-foreground">Create Password</Label>
                    <Input
                      id="signup-pass"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      className="bg-background border-border text-foreground focus-visible:ring-gold"
                      minLength={6}
                      required
                    />
                  </div>

                  <Button type="submit" disabled={busy} className="w-full bg-gold text-navy hover:bg-gold/90 font-semibold text-xs py-2.5 mt-2 h-10 transition-colors duration-200">
                    {busy ? "Creating Account..." : "Create Agent Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/*                           DASHBOARD VIEW                                   */
/* -------------------------------------------------------------------------- */

function DashboardView({
  agent,
  onOpenNew,
  onEditSheet,
}: {
  agent: AgentAccount;
  onOpenNew: () => void;
  onEditSheet: (sheet: NetSheetRecord) => void;
}) {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ["agent-net-sheets", agent.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("seller_net_sheets")
        .select("*")
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as NetSheetRecord[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("seller_net_sheets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-net-sheets", agent.id] });
      toast.success("Net sheet deleted");
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-gold" /> Saved Seller Net Sheets
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Access and manage all saved estimated net proceeds worksheets tied to your agent account.
          </p>
        </div>
        <Button
          onClick={onOpenNew}
          className="bg-gold text-navy hover:bg-gold/90 font-semibold text-xs py-2.5 px-4 shadow-md shrink-0 h-10 transition-colors duration-200"
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Net Sheet
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading saved sheets...</div>
      ) : sheets.length === 0 ? (
        <div className="bg-card/45 border border-border rounded-xl p-8 text-center space-y-4 shadow-sm">
          <Calculator className="h-12 w-12 text-gold/30 mx-auto" />
          <h3 className="text-base font-semibold text-white">No saved net sheets yet</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Click "New Net Sheet" above to calculate seller net proceeds with up to 3 price scenarios and save it to your account.
          </p>
          <Button onClick={onOpenNew} size="sm" className="bg-gold text-navy hover:bg-gold/90 font-semibold text-xs h-9 transition-colors">
            <Plus className="h-4 w-4 mr-1" /> Create First Net Sheet
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sheets.map((sheet) => {
            const data = sheet.sheet_data;
            const createdDate = new Date(sheet.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            const p1 = data.scenario1_price ?? 0;
            const p2 = data.num_scenarios >= 2 ? data.scenario2_price : null;
            const p3 = data.num_scenarios >= 3 ? data.scenario3_price : null;

            return (
              <div
                key={sheet.id}
                className="bg-card border border-border hover:border-gold/40 rounded-xl p-4 space-y-4 transition-all duration-300 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-white text-sm leading-tight truncate">
                      {sheet.property_address || "Untitled Property"}
                    </h3>
                    <span className="text-[10px] font-semibold bg-gold/10 text-gold px-2 py-0.5 rounded border border-gold/20 shrink-0">
                      {createdDate}
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground/80">Scenarios ({data.num_scenarios}):</span>
                      <span className="font-semibold text-gold">
                        {formatCurrency(p1)}
                        {p2 !== null && ` / ${formatCurrency(p2)}`}
                        {p3 !== null && ` / ${formatCurrency(p3)}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEditSheet(sheet)}
                    className="text-xs border-border text-foreground hover:bg-gold hover:text-navy hover:border-gold transition-colors duration-200 h-8"
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1" /> Open / Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteId(sheet.id)}
                    className="text-xs text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 h-8"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Delete Seller Net Sheet?</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              This action cannot be undone. This sheet will be permanently removed from your agent account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="text-xs border-slate-700 text-slate-300">
              Cancel
            </Button>
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/*                          CALCULATOR VIEW                                   */
/* -------------------------------------------------------------------------- */

function CalculatorView({
  agent,
  editingSheetId,
  onBackToDashboard,
}: {
  agent: AgentAccount;
  editingSheetId: string | null;
  onBackToDashboard: () => void;
}) {
  const qc = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  // Initialize sheet data
  const [data, setData] = useState<SheetData>(() => ({
    ...DEFAULT_SHEET_DATA,
    agent_name: agent.full_name || "",
    agent_cell: agent.phone || "",
    agent_email: agent.email || "",
    office_address: agent.office_location || "1043 Kingshighway, Rolla, MO 65401",
    office_phone: agent.office_phone || "(573) 451-2020",
  }));

  // Fetch sheet data if editing existing ID
  useEffect(() => {
    if (!editingSheetId) return;
    (supabase as any)
      .from("seller_net_sheets")
      .select("*")
      .eq("id", editingSheetId)
      .single()
      .then(({ data: record, error }: any) => {
        if (error || !record) {
          toast.error("Failed to load net sheet");
          return;
        }
        if (record.sheet_data) {
          setData(record.sheet_data);
        }
      });
  }, [editingSheetId]);

  const updateField = (field: keyof SheetData, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  // Calculations logic
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

    return {
      salesPrice,
      listingComm,
      sellingComm,
      totalComm,
      fixedCosts,
      totalSellingCosts,
      cashToSeller,
    };
  };

  const calc1 = useMemo(() => calculateScenario(data.scenario1_price || 0), [data]);
  const calc2 = useMemo(() => calculateScenario(data.scenario2_price || 0), [data]);
  const calc3 = useMemo(() => calculateScenario(data.scenario3_price || 0), [data]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!data.property_address.trim()) {
        toast.error("Property address is required to save sheet.");
        throw new Error("Property address required");
      }

      const payload = {
        agent_id: agent.id,
        property_address: data.property_address.trim(),
        agent_name: data.agent_name.trim(),
        agent_cell: data.agent_cell.trim() || null,
        agent_email: data.agent_email.trim() || null,
        office_address: data.office_address.trim() || null,
        office_phone: data.office_phone.trim() || null,
        num_scenarios: data.num_scenarios,
        sheet_data: data,
        updated_at: new Date().toISOString(),
      };

      if (editingSheetId) {
        const { error } = await (supabase as any)
          .from("seller_net_sheets")
          .update(payload)
          .eq("id", editingSheetId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("seller_net_sheets")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-net-sheets", agent.id] });
      toast.success("Seller net sheet saved to your account!");
      onBackToDashboard();
    },
    onError: (e: any) => toast.error(e.message || "Failed to save"),
  });

  const handlePrintPdf = async () => {
    if (!data.property_address.trim()) {
      toast.error("Please enter a property address before exporting PDF.");
      return;
    }
    const toastId = toast.loading("Generating professional PDF...");
    try {
      await generateSellerNetPdf(data);
      toast.success("Seller Net Sheet PDF downloaded!", { id: toastId });
    } catch (e: any) {
      console.error("PDF generation error:", e);
      toast.error(e?.message || "Failed to generate PDF. Please try again.", { id: toastId });
    }
  };

  const handleResetDefaults = () => {
    setData({
      ...DEFAULT_SHEET_DATA,
      agent_name: agent.full_name || "",
      agent_cell: agent.phone || "",
      agent_email: agent.email || "",
      office_address: agent.office_location || "1043 Kingshighway, Rolla, MO 65401",
      office_phone: agent.office_phone || "(573) 451-2020",
    });
    toast.info("Calculator restored to defaults.");
  };

  return (
    <div className="space-y-6">
      {/* Top Action Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-3 sm:p-4 rounded-xl print:hidden">
        <Button size="sm" variant="outline" onClick={onBackToDashboard} className="text-xs border-border text-foreground hover:bg-card">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Saved Sheets
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleResetDefaults} className="text-xs border-border text-foreground hover:bg-card">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset Defaults
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrintPdf} className="text-xs border-gold/40 text-gold hover:bg-gold hover:text-navy transition-colors duration-200">
            <Download className="h-3.5 w-3.5 mr-1" /> Download PDF / Print
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-gold text-navy hover:bg-gold/90 font-semibold text-xs transition-colors h-9"
          >
            <Save className="h-3.5 w-3.5 mr-1" /> {saveMutation.isPending ? "Saving..." : "Save Sheet"}
          </Button>
        </div>
      </div>

      {/* Screenshot-Ready / Printable Worksheet Container */}
      <div ref={printRef} className="bg-card border border-border rounded-xl p-4 sm:p-8 space-y-6 print:bg-white print:text-black print:p-0 print:border-none print:shadow-none">
        
        {/* Worksheet Header: Logos & Office Info */}
        <div className="border-b border-gold/30 pb-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Matt Smith Real Estate Group" className="h-16 sm:h-20 w-auto" />
              <div className="border-l border-border print:border-slate-300 pl-3">
                <div className="text-xs uppercase tracking-widest text-gold font-bold">eXp Realty</div>
                <div className="text-base sm:text-lg font-semibold text-white print:text-black tracking-tight">SELLER ESTIMATED NET PROCEEDS</div>
              </div>
            </div>

            {/* Scenario Selection Toggle (Hidden in print) */}
            <div className="flex items-center gap-2 bg-background print:hidden p-1.5 rounded-lg border border-border">
              <span className="text-xs text-muted-foreground font-medium px-2">Scenarios:</span>
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => updateField("num_scenarios", n)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    data.num_scenarios === n
                      ? "bg-gold text-navy shadow-sm"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  {n} {n === 1 ? "Price" : "Prices"}
                </button>
              ))}
            </div>
          </div>

          {/* Agent Information Header Block */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-background print:bg-slate-50 border border-border print:border-slate-300 p-3 sm:p-4 rounded-xl text-xs">
            <div>
              <label className="text-[10px] uppercase font-bold text-gold">Agent Name</label>
              <Input
                value={data.agent_name}
                onChange={(e) => updateField("agent_name", e.target.value)}
                className="h-8 text-xs bg-card print:bg-white text-white print:text-black border-border print:border-slate-300 mt-1 focus-visible:ring-gold"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gold">Cell Phone</label>
              <Input
                value={data.agent_cell}
                onChange={(e) => updateField("agent_cell", e.target.value)}
                className="h-8 text-xs bg-card print:bg-white text-white print:text-black border-border print:border-slate-300 mt-1 focus-visible:ring-gold"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gold">Agent Email</label>
              <Input
                value={data.agent_email}
                onChange={(e) => updateField("agent_email", e.target.value)}
                className="h-8 text-xs bg-card print:bg-white text-white print:text-black border-border print:border-slate-300 mt-1 focus-visible:ring-gold"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gold">Office Location</label>
              <Input
                value={data.office_address}
                onChange={(e) => updateField("office_address", e.target.value)}
                className="h-8 text-xs bg-card print:bg-white text-white print:text-black border-border print:border-slate-300 mt-1 focus-visible:ring-gold"
              />
            </div>
          </div>

          {/* Property Address Input */}
          <div className="bg-gold/5 print:bg-slate-100 border border-gold/20 p-3.5 rounded-xl space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> Property Address <span className="text-rose-400">*</span>
            </label>
            <Input
              placeholder="e.g. 123 Main Street, Rolla, MO 65401"
              value={data.property_address}
              onChange={(e) => updateField("property_address", e.target.value)}
              className="bg-background print:bg-white text-white print:text-black font-semibold border-border print:border-slate-300 placeholder:text-muted-foreground/50 focus-visible:ring-gold"
            />
          </div>
        </div>

        {/* WORKSHEET TABLE GRID */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-sidebar/80 text-white">
                <th className="p-3 font-bold uppercase text-[11px] tracking-wider w-1/3">Line Item / Expense</th>
                <th className="p-3 font-bold uppercase text-[11px] tracking-wider text-center border-l border-border">
                  Scenario 1
                </th>
                {data.num_scenarios >= 2 && (
                  <th className="p-3 font-bold uppercase text-[11px] tracking-wider text-center border-l border-border">
                    Scenario 2
                  </th>
                )}
                {data.num_scenarios >= 3 && (
                  <th className="p-3 font-bold uppercase text-[11px] tracking-wider text-center border-l border-border">
                    Scenario 3
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border print:divide-slate-200">
              
              {/* Sales Price Row */}
              <tr className="bg-background/40 print:bg-slate-100 font-bold">
                <td className="p-2.5 text-white print:text-black">Sales Price</td>
                <td className="p-2 border-l border-border print:border-slate-200">
                  <Input
                    type="number"
                    value={data.scenario1_price || ""}
                    onChange={(e) => updateField("scenario1_price", parseFloat(e.target.value) || 0)}
                    className="h-8 font-bold text-center text-xs bg-card print:bg-white text-gold border-border focus-visible:ring-gold"
                  />
                </td>
                {data.num_scenarios >= 2 && (
                  <td className="p-2 border-l border-border print:border-slate-200">
                    <Input
                      type="number"
                      value={data.scenario2_price || ""}
                      onChange={(e) => updateField("scenario2_price", parseFloat(e.target.value) || 0)}
                      className="h-8 font-bold text-center text-xs bg-card print:bg-white text-gold border-border focus-visible:ring-gold"
                    />
                  </td>
                )}
                {data.num_scenarios >= 3 && (
                  <td className="p-2 border-l border-border print:border-slate-200">
                    <Input
                      type="number"
                      value={data.scenario3_price || ""}
                      onChange={(e) => updateField("scenario3_price", parseFloat(e.target.value) || 0)}
                      className="h-8 font-bold text-center text-xs bg-card print:bg-white text-gold border-border focus-visible:ring-gold"
                    />
                  </td>
                )}
              </tr>

              {/* Listing Agent Commission (%) */}
              <tr>
                <td className="p-2.5 text-slate-300 print:text-slate-800 flex items-center justify-between gap-2">
                  <span>Listing Agent Commission</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={data.listing_comm_pct}
                      onChange={(e) => updateField("listing_comm_pct", parseFloat(e.target.value) || 0)}
                      className="h-6 w-14 text-center text-[11px] bg-background print:bg-white border-border px-1 focus-visible:ring-gold"
                    />
                    <span className="text-slate-400">%</span>
                  </div>
                </td>
                <td className="p-2.5 text-center font-mono border-l border-border print:border-slate-200 text-slate-200 print:text-black">
                  {formatCurrency(calc1.listingComm)}
                </td>
                {data.num_scenarios >= 2 && (
                  <td className="p-2.5 text-center font-mono border-l border-border print:border-slate-200 text-slate-200 print:text-black">
                    {formatCurrency(calc2.listingComm)}
                  </td>
                )}
                {data.num_scenarios >= 3 && (
                  <td className="p-2.5 text-center font-mono border-l border-border print:border-slate-200 text-slate-200 print:text-black">
                    {formatCurrency(calc3.listingComm)}
                  </td>
                )}
              </tr>

              {/* Selling Agent Commission (%) */}
              <tr>
                <td className="p-2.5 text-slate-300 print:text-slate-800 flex items-center justify-between gap-2">
                  <span>Selling Agent Commission</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={data.selling_comm_pct}
                      onChange={(e) => updateField("selling_comm_pct", parseFloat(e.target.value) || 0)}
                      className="h-6 w-14 text-center text-[11px] bg-background print:bg-white border-border px-1 focus-visible:ring-gold"
                    />
                    <span className="text-slate-400">%</span>
                  </div>
                </td>
                <td className="p-2.5 text-center font-mono border-l border-border print:border-slate-200 text-slate-200 print:text-black">
                  {formatCurrency(calc1.sellingComm)}
                </td>
                {data.num_scenarios >= 2 && (
                  <td className="p-2.5 text-center font-mono border-l border-border print:border-slate-200 text-slate-200 print:text-black">
                    {formatCurrency(calc2.sellingComm)}
                  </td>
                )}
                {data.num_scenarios >= 3 && (
                  <td className="p-2.5 text-center font-mono border-l border-border print:border-slate-200 text-slate-200 print:text-black">
                    {formatCurrency(calc3.sellingComm)}
                  </td>
                )}
              </tr>

              {/* Fixed Expenses Rows */}
              <NumberRow label="Principal Mortgage Payoff" field="mortgage_payoff_1" data={data} updateField={updateField} />
              <NumberRow label="Second Mortgage Payoff" field="mortgage_payoff_2" data={data} updateField={updateField} />
              <NumberRow label="Closing Protection Letter" field="closing_protection_letter" data={data} updateField={updateField} />
              <NumberRow label="Seller's Title Company Closing Fee" field="seller_title_closing_fee" data={data} updateField={updateField} />
              <NumberRow label="Title Search Fee" field="title_search_fee" data={data} updateField={updateField} />
              <NumberRow label="Warranty Deed Fee" field="warranty_deed_fee" data={data} updateField={updateField} />
              <NumberRow label="Termite Letter" field="termite_letter" data={data} updateField={updateField} />
              <NumberRow label="Well, Water, Septic, Lagoon Inspection" field="inspections" data={data} updateField={updateField} />
              <NumberRow label="Home Warranty (negotiable w/ buyer)" field="home_warranty" data={data} updateField={updateField} />
              <NumberRow label="Transaction Fee" field="transaction_fee" data={data} updateField={updateField} />
              <NumberRow label="Estimated Taxes" field="estimated_taxes" data={data} updateField={updateField} />
              <NumberRow label="Miscellaneous" field="miscellaneous" data={data} updateField={updateField} />
              <NumberRow label="Sellers Concessions (negotiable w/ buyer)" field="seller_concessions" data={data} updateField={updateField} />

              {/* TOTAL SELLING COSTS (BOLD) */}
              <tr className="bg-sidebar/50 print:bg-slate-200 font-bold border-t-2 border-gold/40 text-white print:text-black text-sm">
                <td className="p-3 uppercase tracking-wider text-gold print:text-black">TOTAL SELLING COSTS</td>
                <td className="p-3 text-center font-mono border-l border-border print:border-slate-300">
                  {formatCurrency(calc1.totalSellingCosts)}
                </td>
                {data.num_scenarios >= 2 && (
                  <td className="p-3 text-center font-mono border-l border-border print:border-slate-300">
                    {formatCurrency(calc2.totalSellingCosts)}
                  </td>
                )}
                {data.num_scenarios >= 3 && (
                  <td className="p-3 text-center font-mono border-l border-border print:border-slate-300">
                    {formatCurrency(calc3.totalSellingCosts)}
                  </td>
                )}
              </tr>

              {/* ESTIMATED CASH TO SELLER (BOLD & LIGHT GREEN HIGHLIGHT) */}
              <tr className="bg-emerald-950/40 print:bg-emerald-100 font-extrabold border-t-2 border-emerald-500/50 text-emerald-400 print:text-emerald-900 text-sm">
                <td className="p-3.5 uppercase tracking-wider text-emerald-400 print:text-emerald-900">
                  ESTIMATED CASH TO SELLER
                </td>
                <td className="p-3.5 text-center font-mono text-base border-l border-emerald-800/60 print:border-emerald-300 bg-emerald-500/10 print:bg-emerald-200">
                  {formatCurrency(calc1.cashToSeller)}
                </td>
                {data.num_scenarios >= 2 && (
                  <td className="p-3.5 text-center font-mono text-base border-l border-emerald-800/60 print:border-emerald-300 bg-emerald-500/10 print:bg-emerald-200">
                    {formatCurrency(calc2.cashToSeller)}
                  </td>
                )}
                {data.num_scenarios >= 3 && (
                  <td className="p-3.5 text-center font-mono text-base border-l border-emerald-800/60 print:border-emerald-300 bg-emerald-500/10 print:bg-emerald-200">
                    {formatCurrency(calc3.cashToSeller)}
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Verbatim Disclaimer Footer */}
        <div className="pt-4 border-t border-border print:border-slate-300">
          <p className="text-[10px] text-muted-foreground print:text-slate-600 font-mono text-center leading-relaxed max-w-4xl mx-auto">
            NOTE: THIS FORM IS INTENDED AS AN ESTIMATE ONLY. IT DOES NOT INCLUDE TAX PRORATION, ESCROW ADJUSTMENTS AND OTHER MISCELLANEOUS COSTS SOMETIMES ASSOCIATED WITH CLOSING. MATT SMITH REAL ESTATE GROUP/EXP REALTY ACCEPTS NO RESPONSIBILITY FOR THIS ESTIMATE.
          </p>
        </div>
      </div>
    </div>
  );
}

function NumberRow({
  label,
  field,
  data,
  updateField,
}: {
  label: string;
  field: keyof SheetData;
  data: SheetData;
  updateField: (field: keyof SheetData, value: any) => void;
}) {
  const val = (data[field] as number) || 0;
  return (
    <tr>
      <td className="p-2.5 text-slate-300 print:text-slate-800">{label}</td>
      <td className="p-2 border-l border-border print:border-slate-200" colSpan={data.num_scenarios}>
        <div className="flex items-center justify-center gap-1 max-w-[200px] mx-auto">
          <span className="text-slate-500 text-xs">$</span>
          <Input
            type="number"
            value={val === 0 ? "" : val}
            onChange={(e) => updateField(field, parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="h-7 text-center text-xs bg-background print:bg-white text-white print:text-black border-border print:border-slate-300 focus-visible:ring-gold"
          />
        </div>
      </td>
    </tr>
  );
}
