import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calculator,
  LogIn,
  UserPlus,
  LogOut,
  Save,
  Download,
  RotateCcw,
  Plus,
  Trash2,
  Edit3,
  ArrowLeft,
  Check,
  Building,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  AlertCircle,
  FileText,
  Search,
  Eye,
  SlidersHorizontal,
  FileSpreadsheet,
  Calendar,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { useAgentAuth, isValidAgentEmail, type AgentAccount } from "@/hooks/use-agent-auth";
import logo from "@/assets/msreg-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToolCanvas } from "@/components/tool-canvas";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { generateSellerNetPdf } from "@/lib/generate-seller-net-pdf";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller-net-proceeds")({
  ssr: false,
  component: SellerNetProceedsPage,
  head: () => ({
    meta: [
      { title: "Seller Net Proceeds Calculator — MSREG Hub" },
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
  listing_comm_type?: "percent" | "flat";
  listing_comm_flat_fee?: number;
  selling_comm_type?: "percent" | "flat";
  selling_comm_flat_fee?: number;
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
  estimated_taxes_1?: number;
  estimated_taxes_2?: number;
  estimated_taxes_3?: number;
  miscellaneous: number;
  seller_concessions: number;
  [key: string]: any;
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
  listing_comm_type: "percent",
  listing_comm_flat_fee: 1500,
  selling_comm_type: "percent",
  selling_comm_flat_fee: 1500,
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
  estimated_taxes_1: 1283,
  estimated_taxes_2: 1283,
  estimated_taxes_3: 1283,
  miscellaneous: 0,
  seller_concessions: 5000,
};

function getFieldValue(data: SheetData, fieldKey: string, scenarioIndex: 1 | 2 | 3): number {
  const specificKey = `${fieldKey}_${scenarioIndex}`;
  if (data[specificKey] !== undefined) {
    return data[specificKey] as number;
  }
  const legacyKey = fieldKey as keyof SheetData;
  return (data[legacyKey] as number) || 0;
}

function formatCurrency(amount: number): string {
  if (isNaN(amount)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function SellerNetProceedsPage() {
  const { agent, loading, signOutAgent } = useAgentAuth();
  const [activeTab, setActiveTab] = useState<"dashboard" | "calculator">("dashboard");
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-foreground flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Calculator className="h-8 w-8 animate-pulse text-accent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading Seller Net Proceeds...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return <AgentAuthView />;
  }

  return (
    <div className="relative min-h-screen bg-bg text-foreground flex flex-col antialiased overflow-x-hidden selection:bg-gold/30 selection:text-white">
      {/* Ambient Top Spotlight Halo */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[950px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.14),transparent)] pointer-events-none -z-10" />

      {/* Subtle Brand Emblem Watermark in Background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[650px] h-[420px] sm:h-[650px] pointer-events-none opacity-[0.03] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      {/* Top Header */}
      <header className="bg-surface-1/90 backdrop-blur-md border-b border-border px-4 py-3 sm:px-6 shadow-2xs print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <Link
              to="/agents"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Agent Portal
            </Link>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-2">
              <img src={logo} alt="MSREG Logo" className="h-7 w-auto" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Seller Net Proceeds
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span>Agent:</span>
              <span className="font-semibold text-foreground">{agent.full_name}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={signOutAgent}
              className="text-xs border-border hover:bg-surface-2 text-muted-foreground hover:text-foreground h-8"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
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

      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border print:hidden">
        © Matt Smith Real Estate Group · eXp Realty
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            AGENT AUTH VIEW                                 */
/* -------------------------------------------------------------------------- */

function AgentAuthView() {
  const { signInAgent, signUpAgent, resetAgentPassword } = useAgentAuth();
  const [authTab, setAuthTab] = useState<"signin" | "signup" | "reset">("signin");
  const [busy, setBusy] = useState(false);

  // Sign in state
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Sign up state
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPhone, setSignUpPhone] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  // Reset state
  const [resetEmail, setResetEmail] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAgentEmail(signInEmail)) {
      toast.error("Please enter a valid @mattsmithrealestategroup.com email");
      return;
    }
    setBusy(true);
    try {
      await signInAgent(signInEmail, signInPassword);
      toast.success("Welcome back!");
    } catch (err: any) {
      toast.error(err.message || "Failed to sign in");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAgentEmail(signUpEmail)) {
      toast.error("Must use @mattsmithrealestategroup.com email");
      return;
    }
    if (signUpPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await signUpAgent(signUpEmail, signUpPassword, signUpName, signUpPhone);
      toast.success("Account created! You are now signed in.");
    } catch (err: any) {
      toast.error(err.message || "Failed to create account");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAgentEmail(resetEmail)) {
      toast.error("Must use @mattsmithrealestategroup.com email");
      return;
    }
    setBusy(true);
    try {
      await resetAgentPassword(resetEmail);
      toast.success("Password reset instructions sent to your email!");
      setAuthTab("signin");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-bg flex flex-col justify-center items-center px-4 py-8 overflow-hidden selection:bg-gold/30 selection:text-white">
      {/* Ambient Top Spotlight Halo */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[650px] sm:w-[850px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.16),transparent)] pointer-events-none -z-10" />

      {/* Subtle Brand Emblem Watermark in Background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] sm:w-[550px] h-[380px] sm:h-[550px] pointer-events-none opacity-[0.035] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <img src={logo} alt="MSREG" className="h-16 w-auto mx-auto drop-shadow-sm" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Seller Net Proceeds
          </h1>
          <p className="text-xs text-muted-foreground">
            Sign in with your MSREG agent account to create and manage net sheets.
          </p>
        </div>

        <div className="bg-surface-1/95 border border-border/80 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.06]">
          {authTab === "reset" ? (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="reset-email" className="text-xs text-muted-foreground">
                  Your MSREG Email
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="name@mattsmithrealestategroup.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="bg-surface-2 border-border"
                  required
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-accent text-white hover:bg-accent/90 text-xs h-10">
                {busy ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAuthTab("signin")}
                className="w-full text-xs text-muted-foreground"
              >
                Back to Sign In
              </Button>
            </form>
          ) : (
            <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as any)}>
              <TabsList className="grid grid-cols-2 bg-surface-2 p-1 mb-5">
                <TabsTrigger value="signin" className="text-xs">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="text-xs">Create Account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="signin-email" className="text-xs text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="name@mattsmithrealestategroup.com"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      className="bg-surface-2 border-border"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-pass" className="text-xs text-muted-foreground">
                        Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => setAuthTab("reset")}
                        className="text-[11px] text-accent hover:underline cursor-pointer"
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
                      className="bg-surface-2 border-border"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full bg-accent text-white hover:bg-accent/90 text-xs h-10 font-semibold shadow-xs"
                  >
                    {busy ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-3.5">
                  <div className="space-y-1">
                    <Label htmlFor="signup-name" className="text-xs text-muted-foreground">
                      Full Name
                    </Label>
                    <Input
                      id="signup-name"
                      placeholder="Jane Smith"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      className="bg-surface-2 border-border"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-phone" className="text-xs text-muted-foreground">
                      Cell Phone (Optional)
                    </Label>
                    <Input
                      id="signup-phone"
                      placeholder="(573) 555-0199"
                      value={signUpPhone}
                      onChange={(e) => setSignUpPhone(e.target.value)}
                      className="bg-surface-2 border-border"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-email" className="text-xs text-muted-foreground">
                      MSREG Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="name@mattsmithrealestategroup.com"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      className="bg-surface-2 border-border"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-pass" className="text-xs text-muted-foreground">
                      Create Password
                    </Label>
                    <Input
                      id="signup-pass"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      className="bg-surface-2 border-border"
                      minLength={6}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full bg-accent text-white hover:bg-accent/90 text-xs h-10 font-semibold shadow-xs mt-2"
                  >
                    {busy ? "Creating Account..." : "Create Account"}
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
  const { sellerSupabase } = useAgentAuth();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ["agent-net-sheets", agent.id],
    queryFn: async () => {
      const { data, error } = await sellerSupabase
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
      const { error } = await sellerSupabase.from("seller_net_sheets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-net-sheets", agent.id] });
      toast.success("Net sheet deleted");
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete"),
  });

  const filteredSheets = useMemo(() => {
    if (!search.trim()) return sheets;
    const q = search.toLowerCase();
    return sheets.filter((s) => s.property_address.toLowerCase().includes(q));
  }, [sheets, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-accent" />
            Saved Seller Net Sheets
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Access and manage saved estimated net proceeds worksheets for your listing presentations.
          </p>
        </div>
        <Button
          onClick={onOpenNew}
          className="bg-accent text-white hover:bg-accent/90 text-xs font-semibold h-9.5 px-4 shadow-xs shrink-0"
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Net Sheet
        </Button>
      </div>

      {sheets.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by property address..."
            className="pl-9 h-9 text-xs bg-surface-1 border-border"
          />
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-xs">
          Loading saved sheets...
        </div>
      ) : filteredSheets.length === 0 ? (
        search.trim() ? (
          <div className="text-center py-12 text-muted-foreground text-xs">
            No net sheets matching "{search}".
          </div>
        ) : (
          <EmptyState
            icon={Calculator}
            title="No saved net sheets yet"
            description="Create your first seller net proceeds estimate with up to 3 price scenarios for listing appointments."
            action={{
              label: "Create First Net Sheet",
              onClick: onOpenNew,
            }}
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSheets.map((sheet) => (
            <div
              key={sheet.id}
              className="group rounded-xl border border-border bg-surface-1 p-5 shadow-xs hover:shadow-sm hover:border-accent/40 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-surface-2 border border-border text-foreground">
                      <MapPin className="h-4 w-4 text-accent" />
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-2 text-muted-foreground border border-border">
                      {sheet.num_scenarios} {sheet.num_scenarios === 1 ? "Scenario" : "Scenarios"}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-accent transition-colors">
                    {sheet.property_address}
                  </h3>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    <span>Created {new Date(sheet.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {sheet.sheet_data && (
                  <div className="pt-2 border-t border-border/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">List Price</div>
                      <div className="font-mono font-medium text-foreground">
                        {formatCurrency(sheet.sheet_data.scenario1_price)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Estimated Taxes</div>
                      <div className="font-mono text-muted-foreground">
                        {formatCurrency(sheet.sheet_data.estimated_taxes || 0)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-border/60">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEditSheet(sheet)}
                  className="text-xs h-8 flex-1"
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const toastId = toast.loading("Generating PDF...");
                    try {
                      await generateSellerNetPdf(sheet.sheet_data);
                      toast.success("PDF Downloaded!", { id: toastId });
                    } catch (e: any) {
                      toast.error("Failed to generate PDF", { id: toastId });
                    }
                  }}
                  className="text-xs h-8 px-2.5"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteId(sheet.id)}
                  className="text-xs h-8 px-2.5 text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-w-md bg-surface-1 border-border">
          <DialogHeader>
            <DialogTitle>Delete Seller Net Sheet</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to permanently delete this net sheet? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 text-white hover:bg-red-700 text-xs font-semibold"
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
  const { sellerSupabase } = useAgentAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");

  // Initialize sheet data
  const [data, setData] = useState<SheetData>(() => {
    const base = {
      ...DEFAULT_SHEET_DATA,
      agent_name: agent.full_name || "",
      agent_cell: agent.phone || "",
      agent_email: agent.email || "",
      office_address: agent.office_location || "1043 Kingshighway, Rolla, MO 65401",
      office_phone: agent.office_phone || "(573) 451-2020",
    };

    const scenarioKeys = [
      "mortgage_payoff_1",
      "mortgage_payoff_2",
      "closing_protection_letter",
      "seller_title_closing_fee",
      "title_search_fee",
      "warranty_deed_fee",
      "termite_letter",
      "inspections",
      "home_warranty",
      "transaction_fee",
      "estimated_taxes",
      "miscellaneous",
      "seller_concessions",
    ];

    scenarioKeys.forEach((key) => {
      const val = (base as any)[key] || 0;
      (base as any)[`${key}_1`] = val;
      (base as any)[`${key}_2`] = val;
      (base as any)[`${key}_3`] = val;
    });

    return base;
  });

  // Fetch sheet data if editing existing ID
  useEffect(() => {
    if (!editingSheetId) return;
    sellerSupabase
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
          const loaded = { ...record.sheet_data };
          const scenarioKeys = [
            "mortgage_payoff_1",
            "mortgage_payoff_2",
            "closing_protection_letter",
            "seller_title_closing_fee",
            "title_search_fee",
            "warranty_deed_fee",
            "termite_letter",
            "inspections",
            "home_warranty",
            "transaction_fee",
            "estimated_taxes",
            "miscellaneous",
            "seller_concessions",
          ];
          scenarioKeys.forEach((key) => {
            const val = loaded[key] || 0;
            if (loaded[`${key}_1`] === undefined) loaded[`${key}_1`] = val;
            if (loaded[`${key}_2`] === undefined) loaded[`${key}_2`] = val;
            if (loaded[`${key}_3`] === undefined) loaded[`${key}_3`] = val;
          });
          setData(loaded);
        }
      });
  }, [editingSheetId]);

  const updateField = (field: keyof SheetData, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const updateScenarioField = (fieldKey: string, scenarioIndex: 1 | 2 | 3, value: number) => {
    setData((prev) => {
      const next = { ...prev, [`${fieldKey}_${scenarioIndex}`]: value };
      if (scenarioIndex === 1) {
        next[fieldKey] = value;
      }
      return next;
    });
  };

  // Calculations logic
  const calculateScenario = (salesPrice: number, scenarioIndex: 1 | 2 | 3) => {
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
      getFieldValue(data, "mortgage_payoff_1", scenarioIndex) +
      getFieldValue(data, "mortgage_payoff_2", scenarioIndex) +
      getFieldValue(data, "closing_protection_letter", scenarioIndex) +
      getFieldValue(data, "seller_title_closing_fee", scenarioIndex) +
      getFieldValue(data, "title_search_fee", scenarioIndex) +
      getFieldValue(data, "warranty_deed_fee", scenarioIndex) +
      getFieldValue(data, "termite_letter", scenarioIndex) +
      getFieldValue(data, "inspections", scenarioIndex) +
      getFieldValue(data, "home_warranty", scenarioIndex) +
      getFieldValue(data, "transaction_fee", scenarioIndex) +
      getFieldValue(data, "estimated_taxes", scenarioIndex) +
      getFieldValue(data, "miscellaneous", scenarioIndex) +
      getFieldValue(data, "seller_concessions", scenarioIndex);

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

  const calc1 = useMemo(() => calculateScenario(data.scenario1_price || 0, 1), [data]);
  const calc2 = useMemo(() => calculateScenario(data.scenario2_price || 0, 2), [data]);
  const calc3 = useMemo(() => calculateScenario(data.scenario3_price || 0, 3), [data]);

  const activeCalcs = useMemo(() => {
    const list = [calc1];
    if (data.num_scenarios >= 2) list.push(calc2);
    if (data.num_scenarios >= 3) list.push(calc3);
    return list;
  }, [calc1, calc2, calc3, data.num_scenarios]);

  const hasSub50k = useMemo(() => {
    const priceUnder50k = activeCalcs.some((c) => c.salesPrice > 0 && c.salesPrice <= 50000);
    return priceUnder50k || data.listing_comm_type === "flat" || data.selling_comm_type === "flat";
  }, [activeCalcs, data.listing_comm_type, data.selling_comm_type]);

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
        const { error } = await sellerSupabase
          .from("seller_net_sheets")
          .update(payload)
          .eq("id", editingSheetId);
        if (error) throw error;
      } else {
        const { error } = await sellerSupabase.from("seller_net_sheets").insert(payload);
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
    const base = {
      ...DEFAULT_SHEET_DATA,
      agent_name: agent.full_name || "",
      agent_cell: agent.phone || "",
      agent_email: agent.email || "",
      office_address: agent.office_location || "1043 Kingshighway, Rolla, MO 65401",
      office_phone: agent.office_phone || "(573) 451-2020",
    };

    const scenarioKeys = [
      "mortgage_payoff_1",
      "mortgage_payoff_2",
      "closing_protection_letter",
      "seller_title_closing_fee",
      "title_search_fee",
      "warranty_deed_fee",
      "termite_letter",
      "inspections",
      "home_warranty",
      "transaction_fee",
      "estimated_taxes",
      "miscellaneous",
      "seller_concessions",
    ];

    scenarioKeys.forEach((key) => {
      const val = (base as any)[key] || 0;
      (base as any)[`${key}_1`] = val;
      (base as any)[`${key}_2`] = val;
      (base as any)[`${key}_3`] = val;
    });

    setData(base);
    toast.info("Calculator restored to defaults.");
  };

  return (
    <div className="space-y-6">
      {/* Top Action Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-1 border border-border p-3.5 rounded-xl shadow-2xs print:hidden">
        <Button
          size="sm"
          variant="outline"
          onClick={onBackToDashboard}
          className="text-xs border-border hover:bg-surface-2 text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Saved Sheets
        </Button>

        {/* Mobile View Toggle */}
        <div className="lg:hidden flex items-center rounded-lg border border-border bg-surface-2 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMobileTab("edit")}
            className={cn(
              "px-3 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5",
              mobileTab === "edit" ? "bg-surface-1 text-foreground shadow-2xs font-semibold" : "text-muted-foreground",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Inputs
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("preview")}
            className={cn(
              "px-3 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5",
              mobileTab === "preview" ? "bg-surface-1 text-foreground shadow-2xs font-semibold" : "text-muted-foreground",
            )}
          >
            <Eye className="h-3.5 w-3.5" /> Client Preview
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetDefaults}
            className="text-xs border-border hover:bg-surface-2 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrintPdf}
            className="text-xs border-border hover:bg-surface-2 text-foreground"
          >
            <Download className="h-3.5 w-3.5 mr-1 text-accent" /> Export PDF
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-accent text-white hover:bg-accent/90 font-semibold text-xs h-9 px-4 shadow-xs"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saveMutation.isPending ? "Saving..." : "Save Sheet"}
          </Button>
        </div>
      </div>

      {/* Two Column Layout on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Input Parameter Form */}
        <div
          className={cn(
            "lg:col-span-5 space-y-4",
            mobileTab === "preview" ? "hidden lg:block" : "block",
          )}
        >
          {/* Section 1: Property & Scenarios */}
          <div className="bg-surface-1 border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4 text-accent" />
                Property & Scenarios
              </h2>
              {/* Scenarios count toggle */}
              <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded-lg border border-border text-xs">
                {([1, 2, 3] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateField("num_scenarios", n)}
                    className={cn(
                      "px-2.5 py-0.5 rounded-md font-medium text-xs transition-colors",
                      data.num_scenarios === n
                        ? "bg-accent text-white font-semibold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {n} {n === 1 ? "Price" : "Prices"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="prop-address" className="text-xs font-medium text-foreground">
                  Property Address <span className="text-accent">*</span>
                </Label>
                <Input
                  id="prop-address"
                  value={data.property_address}
                  onChange={(e) => updateField("property_address", e.target.value)}
                  placeholder="e.g. 1244 Oak Ridge Dr, Rolla, MO"
                  className="mt-1 h-9 text-xs bg-surface-2 border-border"
                  required
                />
              </div>

              {/* Price inputs for scenarios */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Scenario 1 Price</Label>
                  <Input
                    type="number"
                    step="5000"
                    value={data.scenario1_price || ""}
                    onChange={(e) => updateField("scenario1_price", parseFloat(e.target.value) || 0)}
                    className="mt-1 h-8 text-xs font-mono bg-surface-2 border-border"
                  />
                </div>
                {data.num_scenarios >= 2 && (
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Scenario 2 Price</Label>
                    <Input
                      type="number"
                      step="5000"
                      value={data.scenario2_price || ""}
                      onChange={(e) => updateField("scenario2_price", parseFloat(e.target.value) || 0)}
                      className="mt-1 h-8 text-xs font-mono bg-surface-2 border-border"
                    />
                  </div>
                )}
                {data.num_scenarios >= 3 && (
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Scenario 3 Price</Label>
                    <Input
                      type="number"
                      step="5000"
                      value={data.scenario3_price || ""}
                      onChange={(e) => updateField("scenario3_price", parseFloat(e.target.value) || 0)}
                      className="mt-1 h-8 text-xs font-mono bg-surface-2 border-border"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Brokerage Commissions */}
          <div className="bg-surface-1 border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Percent className="h-4 w-4 text-accent" />
                Commissions
              </h2>
            </div>

            {hasSub50k && (
              <div className="p-2.5 rounded-lg bg-accent/8 border border-accent/20 text-xs space-y-2">
                <div className="text-[11px] font-semibold text-accent">Sub-$50,000 Transaction Detected:</div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      updateField("listing_comm_type", "flat");
                      updateField("selling_comm_type", "flat");
                      toast.success("Applied $1,500 flat fee to both agents");
                    }}
                    className="h-6 text-[10px] px-2 border-accent/40 text-accent hover:bg-accent/20"
                  >
                    $1,500 Flat (Both Sides)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      updateField("listing_comm_type", "flat");
                      updateField("selling_comm_type", "percent");
                      toast.success("Applied $1,500 flat fee to listing side");
                    }}
                    className="h-6 text-[10px] px-2 border-accent/40 text-accent hover:bg-accent/20"
                  >
                    $1,500 Flat (Listing Only)
                  </Button>
                  {(data.listing_comm_type === "flat" || data.selling_comm_type === "flat") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        updateField("listing_comm_type", "percent");
                        updateField("selling_comm_type", "percent");
                        toast.info("Reset to standard %");
                      }}
                      className="h-6 text-[10px] px-2 text-muted-foreground"
                    >
                      Reset to %
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Listing Agent</Label>
                {data.listing_comm_type === "flat" ? (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={data.listing_comm_flat_fee ?? 1500}
                      onChange={(e) => updateField("listing_comm_flat_fee", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs font-mono bg-surface-2 border-border"
                    />
                    <span className="text-[10px] uppercase font-bold text-accent">Flat</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={data.listing_comm_pct}
                      onChange={(e) => updateField("listing_comm_pct", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs font-mono bg-surface-2 border-border"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Selling (Buyer) Agent</Label>
                {data.selling_comm_type === "flat" ? (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={data.selling_comm_flat_fee ?? 1500}
                      onChange={(e) => updateField("selling_comm_flat_fee", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs font-mono bg-surface-2 border-border"
                    />
                    <span className="text-[10px] uppercase font-bold text-accent">Flat</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={data.selling_comm_pct}
                      onChange={(e) => updateField("selling_comm_pct", parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs font-mono bg-surface-2 border-border"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Mortgages, Liens & Concessions */}
          <div className="bg-surface-1 border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
              <DollarSign className="h-4 w-4 text-accent" />
              Mortgages & Concessions
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">1st Mortgage Payoff</Label>
                <Input
                  type="number"
                  value={getFieldValue(data, "mortgage_payoff_1", 1) || ""}
                  onChange={(e) => updateScenarioField("mortgage_payoff_1", 1, parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="mt-1 h-8 text-xs font-mono bg-surface-2 border-border"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">2nd Mortgage Payoff</Label>
                <Input
                  type="number"
                  value={getFieldValue(data, "mortgage_payoff_2", 1) || ""}
                  onChange={(e) => updateScenarioField("mortgage_payoff_2", 1, parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="mt-1 h-8 text-xs font-mono bg-surface-2 border-border"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Seller Concessions</Label>
                <Input
                  type="number"
                  value={getFieldValue(data, "seller_concessions", 1) || ""}
                  onChange={(e) => updateScenarioField("seller_concessions", 1, parseFloat(e.target.value) || 0)}
                  placeholder="5000"
                  className="mt-1 h-8 text-xs font-mono bg-surface-2 border-border"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Estimated Taxes</Label>
                <Input
                  type="number"
                  value={getFieldValue(data, "estimated_taxes", 1) || ""}
                  onChange={(e) => updateScenarioField("estimated_taxes", 1, parseFloat(e.target.value) || 0)}
                  placeholder="1283"
                  className="mt-1 h-8 text-xs font-mono bg-surface-2 border-border"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Title & Closing Fees */}
          <div className="bg-surface-1 border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
              <Building className="h-4 w-4 text-accent" />
              Title & Closing Fees
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <Label className="text-[10px] text-muted-foreground">Title Closing Fee</Label>
                <Input
                  type="number"
                  value={getFieldValue(data, "seller_title_closing_fee", 1) || ""}
                  onChange={(e) => updateScenarioField("seller_title_closing_fee", 1, parseFloat(e.target.value) || 0)}
                  className="mt-1 h-7 text-xs font-mono bg-surface-2 border-border"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Title Search Fee</Label>
                <Input
                  type="number"
                  value={getFieldValue(data, "title_search_fee", 1) || ""}
                  onChange={(e) => updateScenarioField("title_search_fee", 1, parseFloat(e.target.value) || 0)}
                  className="mt-1 h-7 text-xs font-mono bg-surface-2 border-border"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Transaction Fee</Label>
                <Input
                  type="number"
                  value={getFieldValue(data, "transaction_fee", 1) || ""}
                  onChange={(e) => updateScenarioField("transaction_fee", 1, parseFloat(e.target.value) || 0)}
                  className="mt-1 h-7 text-xs font-mono bg-surface-2 border-border"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Closing Prot. Letter</Label>
                <Input
                  type="number"
                  value={getFieldValue(data, "closing_protection_letter", 1) || ""}
                  onChange={(e) => updateScenarioField("closing_protection_letter", 1, parseFloat(e.target.value) || 0)}
                  className="mt-1 h-7 text-xs font-mono bg-surface-2 border-border"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Warranty Deed Fee</Label>
                <Input
                  type="number"
                  value={getFieldValue(data, "warranty_deed_fee", 1) || ""}
                  onChange={(e) => updateScenarioField("warranty_deed_fee", 1, parseFloat(e.target.value) || 0)}
                  className="mt-1 h-7 text-xs font-mono bg-surface-2 border-border"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Termite Letter</Label>
                <Input
                  type="number"
                  value={getFieldValue(data, "termite_letter", 1) || ""}
                  onChange={(e) => updateScenarioField("termite_letter", 1, parseFloat(e.target.value) || 0)}
                  className="mt-1 h-7 text-xs font-mono bg-surface-2 border-border"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Inspections</Label>
                <Input
                  type="number"
                  value={getFieldValue(data, "inspections", 1) || ""}
                  onChange={(e) => updateScenarioField("inspections", 1, parseFloat(e.target.value) || 0)}
                  className="mt-1 h-7 text-xs font-mono bg-surface-2 border-border"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Home Warranty</Label>
                <Input
                  type="number"
                  value={getFieldValue(data, "home_warranty", 1) || ""}
                  onChange={(e) => updateScenarioField("home_warranty", 1, parseFloat(e.target.value) || 0)}
                  className="mt-1 h-7 text-xs font-mono bg-surface-2 border-border"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Miscellaneous</Label>
                <Input
                  type="number"
                  value={getFieldValue(data, "miscellaneous", 1) || ""}
                  onChange={(e) => updateScenarioField("miscellaneous", 1, parseFloat(e.target.value) || 0)}
                  className="mt-1 h-7 text-xs font-mono bg-surface-2 border-border"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Recipient ToolCanvas Preview */}
        <div
          className={cn(
            "lg:col-span-7 sticky top-4 space-y-4",
            mobileTab === "edit" ? "hidden lg:block" : "block",
          )}
        >
          <ToolCanvas
            label="Client Output Preview"
            badge={
              <span className="text-[11px] font-mono text-muted-foreground">
                {data.num_scenarios} {data.num_scenarios === 1 ? "Price Column" : "Price Columns"}
              </span>
            }
          >
            <div ref={printRef} className="space-y-6 text-slate-900 font-sans">
              {/* Header: MSREG / eXp Brand */}
              <div className="border-b-2 border-amber-600/60 pb-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img src={logo} alt="Matt Smith Real Estate Group" className="h-14 sm:h-16 w-auto" />
                    <div className="border-l border-slate-300 pl-3">
                      <div className="text-[11px] uppercase tracking-wider text-amber-700 font-bold">
                        eXp Realty
                      </div>
                      <div className="text-base sm:text-lg font-bold tracking-tight text-slate-950">
                        SELLER ESTIMATED NET PROCEEDS
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-200 text-xs text-slate-600">
                  <div>
                    <div className="font-semibold text-slate-900">{data.property_address || "Property Address Pending"}</div>
                    <div className="text-[11px] text-slate-500">Prepared for Seller Presentation</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">{data.agent_name}</div>
                    <div className="text-[11px] text-slate-500">{data.agent_cell} · {data.agent_email}</div>
                  </div>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-left font-semibold">
                      <th className="p-2.5">Item / Expense</th>
                      <th className="p-2.5 text-center font-mono border-l border-slate-200">
                        Scenario 1
                        <div className="text-sm font-bold text-slate-950">{formatCurrency(calc1.salesPrice)}</div>
                      </th>
                      {data.num_scenarios >= 2 && (
                        <th className="p-2.5 text-center font-mono border-l border-slate-200">
                          Scenario 2
                          <div className="text-sm font-bold text-slate-950">{formatCurrency(calc2.salesPrice)}</div>
                        </th>
                      )}
                      {data.num_scenarios >= 3 && (
                        <th className="p-2.5 text-center font-mono border-l border-slate-200">
                          Scenario 3
                          <div className="text-sm font-bold text-slate-950">{formatCurrency(calc3.salesPrice)}</div>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    {/* Commissions */}
                    <tr>
                      <td className="p-2">Listing Agent Commission</td>
                      <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(calc1.listingComm)}</td>
                      {data.num_scenarios >= 2 && (
                        <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(calc2.listingComm)}</td>
                      )}
                      {data.num_scenarios >= 3 && (
                        <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(calc3.listingComm)}</td>
                      )}
                    </tr>
                    <tr>
                      <td className="p-2">Selling (Buyer) Commission</td>
                      <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(calc1.sellingComm)}</td>
                      {data.num_scenarios >= 2 && (
                        <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(calc2.sellingComm)}</td>
                      )}
                      {data.num_scenarios >= 3 && (
                        <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(calc3.sellingComm)}</td>
                      )}
                    </tr>

                    {/* Mortgages & Payoffs */}
                    <tr>
                      <td className="p-2">Principal Mortgage Payoff</td>
                      <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "mortgage_payoff_1", 1))}</td>
                      {data.num_scenarios >= 2 && (
                        <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "mortgage_payoff_1", 2))}</td>
                      )}
                      {data.num_scenarios >= 3 && (
                        <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "mortgage_payoff_1", 3))}</td>
                      )}
                    </tr>
                    {getFieldValue(data, "mortgage_payoff_2", 1) > 0 && (
                      <tr>
                        <td className="p-2">Second Mortgage Payoff</td>
                        <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "mortgage_payoff_2", 1))}</td>
                        {data.num_scenarios >= 2 && (
                          <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "mortgage_payoff_2", 2))}</td>
                        )}
                        {data.num_scenarios >= 3 && (
                          <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "mortgage_payoff_2", 3))}</td>
                        )}
                      </tr>
                    )}

                    {/* Title & Closing */}
                    <tr>
                      <td className="p-2">Title Company Closing Fee</td>
                      <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "seller_title_closing_fee", 1))}</td>
                      {data.num_scenarios >= 2 && (
                        <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "seller_title_closing_fee", 2))}</td>
                      )}
                      {data.num_scenarios >= 3 && (
                        <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "seller_title_closing_fee", 3))}</td>
                      )}
                    </tr>
                    <tr>
                      <td className="p-2">Title Search & Deed Fees</td>
                      <td className="p-2 text-center font-mono border-l border-slate-200">
                        {formatCurrency(getFieldValue(data, "title_search_fee", 1) + getFieldValue(data, "warranty_deed_fee", 1))}
                      </td>
                      {data.num_scenarios >= 2 && (
                        <td className="p-2 text-center font-mono border-l border-slate-200">
                          {formatCurrency(getFieldValue(data, "title_search_fee", 2) + getFieldValue(data, "warranty_deed_fee", 2))}
                        </td>
                      )}
                      {data.num_scenarios >= 3 && (
                        <td className="p-2 text-center font-mono border-l border-slate-200">
                          {formatCurrency(getFieldValue(data, "title_search_fee", 3) + getFieldValue(data, "warranty_deed_fee", 3))}
                        </td>
                      )}
                    </tr>

                    {/* Taxes & Concessions */}
                    <tr>
                      <td className="p-2">Estimated Taxes</td>
                      <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "estimated_taxes", 1))}</td>
                      {data.num_scenarios >= 2 && (
                        <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "estimated_taxes", 2))}</td>
                      )}
                      {data.num_scenarios >= 3 && (
                        <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "estimated_taxes", 3))}</td>
                      )}
                    </tr>
                    <tr>
                      <td className="p-2">Seller Concessions (buyer credit)</td>
                      <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "seller_concessions", 1))}</td>
                      {data.num_scenarios >= 2 && (
                        <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "seller_concessions", 2))}</td>
                      )}
                      {data.num_scenarios >= 3 && (
                        <td className="p-2 text-center font-mono border-l border-slate-200">{formatCurrency(getFieldValue(data, "seller_concessions", 3))}</td>
                      )}
                    </tr>

                    {/* Total Selling Costs */}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td className="p-2.5 uppercase tracking-wider text-[11px]">Total Selling Costs</td>
                      <td className="p-2.5 text-center font-mono border-l border-slate-200">{formatCurrency(calc1.totalSellingCosts)}</td>
                      {data.num_scenarios >= 2 && (
                        <td className="p-2.5 text-center font-mono border-l border-slate-200">{formatCurrency(calc2.totalSellingCosts)}</td>
                      )}
                      {data.num_scenarios >= 3 && (
                        <td className="p-2.5 text-center font-mono border-l border-slate-200">{formatCurrency(calc3.totalSellingCosts)}</td>
                      )}
                    </tr>

                    {/* Estimated Cash to Seller Highlight */}
                    <tr className="bg-emerald-50 text-emerald-950 font-extrabold border-t-2 border-emerald-600/60">
                      <td className="p-3 uppercase tracking-wider text-xs text-emerald-900">
                        Estimated Cash to Seller
                      </td>
                      <td className={cn(
                        "p-3 text-center font-mono text-sm border-l border-emerald-200",
                        calc1.cashToSeller < 0 ? "bg-red-50 text-red-900" : "text-emerald-900",
                      )}>
                        {formatCurrency(calc1.cashToSeller)}
                      </td>
                      {data.num_scenarios >= 2 && (
                        <td className={cn(
                          "p-3 text-center font-mono text-sm border-l border-emerald-200",
                          calc2.cashToSeller < 0 ? "bg-red-50 text-red-900" : "text-emerald-900",
                        )}>
                          {formatCurrency(calc2.cashToSeller)}
                        </td>
                      )}
                      {data.num_scenarios >= 3 && (
                        <td className={cn(
                          "p-3 text-center font-mono text-sm border-l border-emerald-200",
                          calc3.cashToSeller < 0 ? "bg-red-50 text-red-900" : "text-emerald-900",
                        )}>
                          {formatCurrency(calc3.cashToSeller)}
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Disclaimer */}
              <div className="pt-3 border-t border-slate-200">
                <p className="text-[9px] text-slate-500 font-mono text-center leading-relaxed">
                  NOTE: THIS FORM IS INTENDED AS AN ESTIMATE ONLY. IT DOES NOT INCLUDE TAX PRORATION,
                  ESCROW ADJUSTMENTS AND OTHER MISCELLANEOUS COSTS SOMETIMES ASSOCIATED WITH CLOSING. MATT
                  SMITH REAL ESTATE GROUP/EXP REALTY ACCEPTS NO RESPONSIBILITY FOR THIS ESTIMATE.
                </p>
              </div>
            </div>
          </ToolCanvas>
        </div>
      </div>
    </div>
  );
}
