/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Navigate } from "@tanstack/react-router";
import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Ticket,
  Plus,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertTriangle,
  Search,
  Ban,
  Calendar,
  Mail,
  User,
  Users,
  Award,
  Sparkles,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  getSwagCredits as getSwagCreditsFn,
  issueSwagCredit as issueSwagCreditFn,
  revokeSwagCredit as revokeSwagCreditFn,
  syncSwagCreditBalances as syncSwagCreditBalancesFn,
  checkShopifyConfig as checkShopifyConfigFn,
} from "@/lib/shopify-swag-credits.functions";

export const Route = createFileRoute("/_authenticated/admin/swag-credits")({
  component: AdminSwagCreditsPage,
  head: () => ({ meta: [{ title: "Swag Store Credits — MSREG Hub" }] }),
});

interface SwagCredit {
  id: string;
  agent_name: string;
  recipient_email?: string | null;
  amount: number;
  balance: number;
  reason: string;
  shopify_gift_card_id: number;
  gift_card_code: string;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  creator: { id: string; email: string } | null;
}

interface ToolboxAgent {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
}

type CreditType = "welcome" | "agent_level" | "other";

const WELCOME_TEMPLATE = `Hey!
Here is your swag credit gift card code - {{code}}
You can access the from the hub or using this url www.msregswag.com
Let me know if you have any questions!`;

const AGENT_LEVEL_TEMPLATE = (validThrough: string, amount: string) => `Hey!
Here's your $${amount || "100"} gift code for swag credit: {{code}}
You can use this anytime at www.msregswag.com. This credit is valid through ${validThrough || "____"}. At that time, you will receive another $100 credit if you are agent level 2 or higher.
Let me know if you have any questions!`;

const OTHER_TEMPLATE = `Hey!
Here is your swag credit gift card code - {{code}}
You can access the from the hub or using this url www.msregswag.com
Let me know if you have any questions!`;

function AdminSwagCreditsPage() {
  const { isAdmin, roles, loading: authLoading } = useAuth();
  const isMarketing = roles?.includes("marketing_coordinator");
  const canAccess = isAdmin || isMarketing;

  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked" | "expired">("all");
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Form State: Recipient Selection
  const [useCustomRecipient, setUseCustomRecipient] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  // Form State: Reason / Preset
  const [creditType, setCreditType] = useState<CreditType>("welcome");
  const [creditAmount, setCreditAmount] = useState("50.00");
  const [creditReason, setCreditReason] = useState("Welcome to team");
  const [validThroughDate, setValidThroughDate] = useState("");

  // Form State: Email Customization
  const [emailSubject, setEmailSubject] = useState("$50 Swag Credit Code");
  const [emailBody, setEmailBody] = useState(WELCOME_TEMPLATE);
  const [isSubjectManuallyEdited, setIsSubjectManuallyEdited] = useState(false);
  const [isBodyManuallyEdited, setIsBodyManuallyEdited] = useState(false);
  const [emailTab, setEmailTab] = useState<"edit" | "preview">("edit");

  // Success State
  const [createdCredit, setCreatedCredit] = useState<SwagCredit | null>(null);
  const [issueResult, setIssueResult] = useState<{
    emailSent: boolean;
    emailError?: string;
    recipientEmail: string;
  } | null>(null);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  // Server functions
  const getCredits = useServerFn(getSwagCreditsFn);
  const issueCredit = useServerFn(issueSwagCreditFn);
  const revokeCredit = useServerFn(revokeSwagCreditFn);
  const syncBalances = useServerFn(syncSwagCreditBalancesFn);
  const checkConfig = useServerFn(checkShopifyConfigFn);

  // Queries
  const { data: config, isLoading: isConfigLoading } = useQuery({
    queryKey: ["shopify-config-check"],
    enabled: canAccess,
    queryFn: () => checkConfig(),
  });

  // Pull all agents and emails from Agent Toolbox (toolbox_agents table)
  const { data: toolboxAgents = [], isLoading: isAgentsLoading } = useQuery({
    queryKey: ["toolbox-agents-for-swag"],
    enabled: canAccess,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("toolbox_agents")
        .select("id, name, email, active")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ToolboxAgent[];
    },
  });

  const {
    data: credits = [],
    isLoading: isCreditsLoading,
    isRefetching,
  } = useQuery({
    queryKey: ["swag-credits-list"],
    enabled: canAccess,
    queryFn: () => getCredits() as Promise<SwagCredit[]>,
  });

  // Mutations
  const issueMutation = useMutation({
    mutationFn: async (payload: {
      agentName: string;
      recipientEmail: string;
      amount: number;
      reason: string;
      creditType: CreditType;
      emailSubject: string;
      emailBody: string;
    }) => {
      const res = await issueCredit({ data: payload });
      return res;
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["swag-credits-list"] });
      setCreatedCredit(res.credit as SwagCredit);
      setIssueResult({
        emailSent: !!res.emailSent,
        emailError: res.emailError,
        recipientEmail: res.recipientEmail,
      });
      setIsIssueOpen(false);
      setIsSuccessOpen(true);

      if (res.emailSent) {
        toast.success(`Swag credit issued and email sent to ${res.recipientEmail} via Resend!`);
      } else {
        toast.warning(
          `Swag credit issued in Shopify, but email could not be sent: ${res.emailError || "Unknown error"}. You can copy the code manually.`,
          { duration: 8000 },
        );
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to issue swag credit.");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (creditId: string) => {
      await revokeCredit({ data: { creditId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swag-credits-list"] });
      toast.success("Swag credit successfully revoked.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to revoke swag credit.");
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => syncBalances(),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["swag-credits-list"] });
      toast.success(
        `Balances synchronized! ${res.syncCount} updated, ${res.revokedCount} revoked, ${res.errorCount} failed.`,
      );
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to sync balances.");
    },
  });

  // Preset switching logic
  const handleCreditTypeChange = (newType: CreditType) => {
    setCreditType(newType);
    setIsSubjectManuallyEdited(false);
    setIsBodyManuallyEdited(false);

    if (newType === "welcome") {
      setCreditAmount("50.00");
      setCreditReason("Welcome to team");
      setEmailSubject("$50 Swag Credit Code");
      setEmailBody(WELCOME_TEMPLATE);
    } else if (newType === "agent_level") {
      setCreditAmount("100.00");
      setCreditReason("Agent level");
      setEmailSubject("$100 Gift Code - MSREG Swag Credit");
      setEmailBody(AGENT_LEVEL_TEMPLATE(validThroughDate, "100"));
    } else {
      // other
      if (creditReason === "Welcome to team" || creditReason === "Agent level") {
        setCreditReason("");
      }
      setEmailSubject("Your MSREG Swag Store Gift Code");
      setEmailBody(OTHER_TEMPLATE);
    }
  };

  // Dynamic Amount adjustments
  const handleAmountChange = (newAmount: string) => {
    setCreditAmount(newAmount);
    if (!isSubjectManuallyEdited) {
      if (creditType === "welcome") {
        setEmailSubject(`$${newAmount || "0"} Swag Credit Code`);
      } else if (creditType === "agent_level") {
        setEmailSubject(`$${newAmount || "0"} Gift Code - MSREG Swag Credit`);
      }
    }
    if (!isBodyManuallyEdited && creditType === "agent_level") {
      setEmailBody(AGENT_LEVEL_TEMPLATE(validThroughDate, newAmount));
    }
  };

  // Valid through date adjustments for Agent Level
  const handleValidThroughChange = (newDate: string) => {
    setValidThroughDate(newDate);
    if (!isBodyManuallyEdited && creditType === "agent_level") {
      setEmailBody(AGENT_LEVEL_TEMPLATE(newDate, creditAmount));
    }
  };

  // Reset email copy back to template default
  const handleResetTemplate = () => {
    setIsSubjectManuallyEdited(false);
    setIsBodyManuallyEdited(false);
    if (creditType === "welcome") {
      setEmailSubject(`$${creditAmount || "50"} Swag Credit Code`);
      setEmailBody(WELCOME_TEMPLATE);
    } else if (creditType === "agent_level") {
      setEmailSubject(`$${creditAmount || "100"} Gift Code - MSREG Swag Credit`);
      setEmailBody(AGENT_LEVEL_TEMPLATE(validThroughDate, creditAmount));
    } else {
      setEmailSubject("Your MSREG Swag Store Gift Code");
      setEmailBody(OTHER_TEMPLATE);
    }
    toast.info("Reset subject and body to default template.");
  };

  // Agent dropdown selection
  const handleAgentSelect = (agentId: string) => {
    setSelectedAgentId(agentId);
    const agent = toolboxAgents.find((a) => a.id === agentId);
    if (agent) {
      setRecipientName(agent.name);
      setRecipientEmail(agent.email || "");
    }
  };

  // Open Issue Dialog with clean initial state
  const handleOpenIssue = () => {
    setUseCustomRecipient(false);
    setSelectedAgentId("");
    setRecipientName("");
    setRecipientEmail("");
    setCreditType("welcome");
    setCreditAmount("50.00");
    setCreditReason("Welcome to team");
    setValidThroughDate("");
    setEmailSubject("$50 Swag Credit Code");
    setEmailBody(WELCOME_TEMPLATE);
    setIsSubjectManuallyEdited(false);
    setIsBodyManuallyEdited(false);
    setEmailTab("edit");
    setIsIssueOpen(true);
  };

  // Submission handler
  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalName = recipientName.trim();
    const finalEmail = recipientEmail.trim();

    if (!finalName) {
      toast.error("Please select an agent or enter a recipient name.");
      return;
    }
    if (!finalEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)) {
      toast.error("Please provide a valid recipient email address.");
      return;
    }

    const amountNum = parseFloat(creditAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid positive credit amount.");
      return;
    }

    const finalReason = creditReason.trim();
    if (!finalReason) {
      toast.error("Please enter a reason or milestone.");
      return;
    }

    if (!emailSubject.trim()) {
      toast.error("Please enter an email subject line.");
      return;
    }

    if (!emailBody.trim()) {
      toast.error("Please enter the email body.");
      return;
    }

    issueMutation.mutate({
      agentName: finalName,
      recipientEmail: finalEmail,
      amount: amountNum,
      reason: finalReason,
      creditType,
      emailSubject: emailSubject.trim(),
      emailBody: emailBody.trim(),
    });
  };

  // Filters logic
  const filteredCredits = useMemo(() => {
    return credits.filter((c) => {
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        c.agent_name?.toLowerCase().includes(searchLower) ||
        (c.recipient_email && c.recipient_email.toLowerCase().includes(searchLower)) ||
        c.reason?.toLowerCase().includes(searchLower) ||
        c.gift_card_code?.toLowerCase().includes(searchLower);
      return matchesStatus && matchesSearch;
    });
  }, [credits, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const totalAmount = credits.reduce((acc, c) => acc + (c.amount || 0), 0);
    const totalBalance = credits.reduce((acc, c) => acc + (c.balance || 0), 0);
    const activeCount = credits.filter((c) => c.status === "active").length;
    const revokedCount = credits.filter((c) => c.status === "revoked").length;
    return { totalAmount, totalBalance, activeCount, revokedCount, count: credits.length };
  }, [credits]);

  const toggleRevealCode = (id: string) => {
    setRevealedCodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  if (authLoading || isConfigLoading) {
    return <div className="p-8 text-center text-[var(--text-secondary)]">Loading swag credits system...</div>;
  }

  if (!canAccess) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Shopify Swag Credits"
        subtitle="Issue store credits to agents from the Agent Toolbox and dispatch gift codes via Resend."
        badge={
          <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]">
            msregswag.com
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || isRefetching || !config?.configured}
              className="border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-2)] h-9 text-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${syncMutation.isPending || isRefetching ? "animate-spin" : ""}`}
              />
              Sync Balances
            </Button>
            <Button
              onClick={handleOpenIssue}
              disabled={!config?.configured}
              size="sm"
              className="bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] font-semibold h-9 text-xs shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Issue Swag Credit
            </Button>
          </div>
        }
      />

      {/* Metric Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="p-4 bg-[var(--surface-1)] border-[var(--border)] rounded-xl space-y-1">
          <div className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">Total Issued</div>
          <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
            ${stats.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">{stats.count} total cards</div>
        </Card>

        <Card className="p-4 bg-[var(--surface-1)] border-[var(--border)] rounded-xl space-y-1">
          <div className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">Active Credits</div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {stats.activeCount}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">ready for checkout</div>
        </Card>

        <Card className="p-4 bg-[var(--surface-1)] border-[var(--border)] rounded-xl space-y-1">
          <div className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">Unspent Balance</div>
          <div className="text-xl font-bold font-mono text-[var(--accent)]">
            ${stats.totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">remaining on cards</div>
        </Card>

        <Card className="p-4 bg-[var(--surface-1)] border-[var(--border)] rounded-xl space-y-1">
          <div className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">Revoked</div>
          <div className="text-xl font-bold font-mono text-[var(--text-muted)]">
            {stats.revokedCount}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">cancelled or expired</div>
        </Card>
      </div>

      {/* Configuration Status Notice (informative, not alarming) */}
      {!isConfigLoading && !config?.configured && (
        <Card className="p-4 border-[var(--border)] bg-[var(--surface-2)]/60 rounded-xl flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
            <Ticket className="h-4 w-4" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="font-semibold text-[var(--text-primary)]">
              Shopify API Integration Notice
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Shopify store API keys are currently configured in production (Netlify). When running on localhost, issuing new cards is disabled until <code className="text-xs bg-[var(--surface-1)] px-1 py-0.5 rounded border border-[var(--border)] text-[var(--accent)]">SHOPIFY_STORE_URL</code> and credentials are set in your local <code className="text-xs bg-[var(--surface-1)] px-1 py-0.5 rounded border border-[var(--border)]">.env</code>. All existing credit history and balance records below remain fully readable.
            </p>
          </div>
        </Card>
      )}

      {/* Resend Configuration Notice */}
      {!isConfigLoading && !config?.hasResend && (
        <Card className="p-3.5 border-[var(--border)] bg-[var(--surface-2)]/40 rounded-xl flex items-center gap-3">
          <Mail className="h-4 w-4 text-amber-400 shrink-0" />
          <div className="text-xs text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">Resend email delivery offline:</span> Automated gift card emails are paused until <code className="font-mono text-[11px] text-[var(--accent)]">RESEND_API_KEY</code> is set. Gift card codes can still be copied and shared manually.
          </div>
        </Card>
      )}

      {/* Main Content Dashboard */}
      <Card className="border-[var(--border)] bg-[var(--surface-1)] rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b border-[var(--border)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold text-[var(--text-primary)]">Issued Store Credits</CardTitle>
              <CardDescription className="text-xs text-[var(--text-secondary)] mt-0.5">
                Track details, recipients, and remaining balances of issued Shopify gift cards.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                <Input
                  placeholder="Search agent, email, or reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-60 h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-36 h-9 text-xs bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--accent)]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-primary)]">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-[var(--surface-2)]/50 border-b border-[var(--border)]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[var(--text-secondary)] font-medium text-xs">Agent / Recipient</TableHead>
                <TableHead className="text-[var(--text-secondary)] font-medium text-xs">Milestone / Reason</TableHead>
                <TableHead className="text-[var(--text-secondary)] font-medium text-xs text-right">Original</TableHead>
                <TableHead className="text-[var(--text-secondary)] font-medium text-xs text-right">Balance</TableHead>
                <TableHead className="text-[var(--text-secondary)] font-medium text-xs">Gift Card Code</TableHead>
                <TableHead className="text-[var(--text-secondary)] font-medium text-xs">Status</TableHead>
                <TableHead className="text-[var(--text-secondary)] font-medium text-xs">Issued Date</TableHead>
                <TableHead className="text-[var(--text-secondary)] font-medium text-xs text-right w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isCreditsLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-[var(--text-secondary)] py-12">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-[var(--accent)]" />
                    Loading swag credits records...
                  </TableCell>
                </TableRow>
              )}

              {!isCreditsLoading && filteredCredits.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-[var(--text-muted)] py-12 text-xs">
                    No matching swag store credits found.
                  </TableCell>
                </TableRow>
              )}

              {!isCreditsLoading &&
                filteredCredits.map((credit) => {
                  const isRevealed = !!revealedCodes[credit.id];
                  const isCopied = copiedCodeId === credit.id;
                  const displayCode = isRevealed
                    ? credit.gift_card_code
                    : `•••• •••• •••• ${credit.gift_card_code.slice(-4)}`;

                  return (
                    <TableRow
                      key={credit.id}
                      className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]/40 transition-colors"
                    >
                      <TableCell>
                        <div className="font-semibold text-[var(--text-primary)] text-xs sm:text-sm">{credit.agent_name}</div>
                        {credit.recipient_email && (
                          <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3 text-[var(--text-muted)]" />
                            {credit.recipient_email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell
                        className="max-w-xs truncate text-[var(--text-secondary)] text-xs"
                        title={credit.reason}
                      >
                        {credit.reason}
                      </TableCell>
                      <TableCell className="text-right text-[var(--text-muted)] font-mono text-xs">
                        ${credit.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-[var(--text-primary)] font-mono text-xs">
                        ${credit.balance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5 bg-[var(--surface-2)] border border-[var(--border)] px-2.5 py-1 rounded-lg">
                          <code className="font-mono text-xs text-[var(--accent)] font-semibold tracking-wider select-all">
                            {displayCode}
                          </code>
                          <button
                            onClick={() => toggleRevealCode(credit.id)}
                            className="p-1 hover:text-[var(--text-primary)] text-[var(--text-muted)] transition-colors"
                            title={isRevealed ? "Hide code" : "Reveal code"}
                          >
                            {isRevealed ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => copyToClipboard(credit.gift_card_code, credit.id)}
                            className="p-1 hover:text-[var(--text-primary)] text-[var(--text-muted)] transition-colors"
                            title="Copy code"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            credit.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-semibold"
                              : credit.status === "revoked"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px] font-semibold"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] font-semibold"
                          }
                        >
                          {credit.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[var(--text-muted)]">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-[var(--text-muted)]" />
                          {format(new Date(credit.created_at), "MMM d, yyyy")}
                        </div>
                        {credit.creator?.email && (
                          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            by {credit.creator.email.split("@")[0]}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {credit.status === "active" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (
                                confirm(
                                  `Are you sure you want to revoke this credit for $${credit.balance.toFixed(
                                    2,
                                  )}? This will permanently disable the gift card in Shopify.`,
                                )
                              ) {
                                revokeMutation.mutate(credit.id);
                              }
                            }}
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-7 px-2 text-xs"
                            disabled={revokeMutation.isPending}
                          >
                            <Ban className="h-3 w-3 mr-1" />
                            Revoke
                          </Button>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)] italic pr-2">
                            Revoked
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ISSUE CREDIT DIALOG */}
      <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
        <DialogContent className="bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-primary)] max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)] text-xl font-bold flex items-center gap-2">
              <Ticket className="h-5 w-5 text-[var(--accent)]" />
              Issue Swag Store Credit
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--text-secondary)]">
              Generate a Shopify gift card code and dispatch the formatted notification email via Resend.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleIssueSubmit} className="space-y-5 py-2">
            {/* Step 1: Agent Recipient Selection */}
            <div className="space-y-3 p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> 1. Select Agent
                </Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="manual-agent-toggle" className="text-xs text-[var(--text-secondary)] cursor-pointer">
                    Manual entry
                  </Label>
                  <Switch
                    id="manual-agent-toggle"
                    checked={useCustomRecipient}
                    onCheckedChange={(checked) => {
                      setUseCustomRecipient(checked);
                      if (checked) {
                        setSelectedAgentId("");
                      }
                    }}
                  />
                </div>
              </div>

              {!useCustomRecipient ? (
                <div className="space-y-2.5">
                  <div>
                    <Label htmlFor="agent-dropdown" className="text-xs text-[var(--text-secondary)] mb-1 block">
                      Agent from Toolbox Roster ({toolboxAgents.length} agents)
                    </Label>
                    <Select value={selectedAgentId} onValueChange={handleAgentSelect}>
                      <SelectTrigger
                        id="agent-dropdown"
                        className="bg-[var(--surface-1)] border-[var(--border)] focus:ring-[var(--accent)] text-[var(--text-primary)]"
                      >
                        <SelectValue
                          placeholder={
                            isAgentsLoading ? "Loading agents from Toolbox..." : "Choose an agent from Toolbox…"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-primary)] max-h-60 overflow-y-auto">
                        {toolboxAgents.map((agent) => (
                          <SelectItem
                            key={agent.id}
                            value={agent.id}
                            className="text-[var(--text-primary)] focus:bg-[var(--surface-2)] cursor-pointer"
                          >
                            <span className="font-medium">{agent.name}</span>
                            {agent.email ? (
                              <span className="text-[var(--text-muted)] text-xs ml-2">({agent.email})</span>
                            ) : (
                              <span className="text-amber-400 text-xs ml-2">(No email in toolbox)</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Editable Recipient Email & Name display */}
                  {selectedAgentId && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <Label htmlFor="agent-name-confirm" className="text-xs text-[var(--text-secondary)]">
                          Agent Name
                        </Label>
                        <Input
                          id="agent-name-confirm"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          className="bg-[var(--surface-1)] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] text-sm text-[var(--text-primary)]"
                          placeholder="Agent Name"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="agent-email-confirm" className="text-xs text-[var(--text-secondary)] flex items-center justify-between">
                          <span>Recipient Email</span>
                          {!recipientEmail && (
                            <span className="text-[11px] text-amber-400 font-medium">Required</span>
                          )}
                        </Label>
                        <Input
                          id="agent-email-confirm"
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="agent@example.com"
                          className={`bg-[var(--surface-1)] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] text-sm text-[var(--text-primary)] ${
                            !recipientEmail ? "border-amber-500/50" : ""
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Manual Entry Mode */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-name" className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                      <User className="h-3 w-3" /> Agent / Recipient Name
                    </Label>
                    <Input
                      id="custom-name"
                      placeholder="e.g. John Doe"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="bg-[var(--surface-1)] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] text-sm text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-email" className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Recipient Email
                    </Label>
                    <Input
                      id="custom-email"
                      type="email"
                      placeholder="e.g. john@mattsmithrealestategroup.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="bg-[var(--surface-1)] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: What is this credit for? */}
            <div className="space-y-3 p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
              <Label className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5" /> 2. What is it for?
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Option 1: Welcome to team */}
                <button
                  type="button"
                  onClick={() => handleCreditTypeChange("welcome")}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    creditType === "welcome"
                      ? "bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--accent)]/40"
                      : "bg-[var(--surface-1)] border-[var(--border)] hover:border-[var(--accent)]/40 text-[var(--text-secondary)]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className={`h-4 w-4 ${creditType === "welcome" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`} />
                    <span className="font-semibold text-sm text-[var(--text-primary)]">1. Welcome to team</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                    $50 default credit for newly onboarded team agents.
                  </div>
                </button>

                {/* Option 2: Agent level */}
                <button
                  type="button"
                  onClick={() => handleCreditTypeChange("agent_level")}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    creditType === "agent_level"
                      ? "bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--accent)]/40"
                      : "bg-[var(--surface-1)] border-[var(--border)] hover:border-[var(--accent)]/40 text-[var(--text-secondary)]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Award className={`h-4 w-4 ${creditType === "agent_level" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`} />
                    <span className="font-semibold text-sm text-[var(--text-primary)]">2. Agent level</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                    $100 default credit for Level 2+ milestone qualifications.
                  </div>
                </button>

                {/* Option 3: Other */}
                <button
                  type="button"
                  onClick={() => handleCreditTypeChange("other")}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    creditType === "other"
                      ? "bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--accent)]/40"
                      : "bg-[var(--surface-1)] border-[var(--border)] hover:border-[var(--accent)]/40 text-[var(--text-secondary)]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Ticket className={`h-4 w-4 ${creditType === "other" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`} />
                    <span className="font-semibold text-sm text-[var(--text-primary)]">3. Other</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Custom amount, reason, and custom email message.
                  </div>
                </button>
              </div>

              {/* Amount & Reason / Milestone inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="credit-amount" className="text-xs text-[var(--text-secondary)] font-medium">
                    Credit Amount ($)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-[var(--text-muted)] text-sm">$</span>
                    <Input
                      id="credit-amount"
                      type="number"
                      placeholder="50.00"
                      step="0.01"
                      min="1"
                      max="1000"
                      value={creditAmount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      className="pl-7 bg-[var(--surface-1)] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] text-sm text-[var(--text-primary)] font-mono"
                    />
                  </div>
                </div>

                {creditType === "agent_level" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="valid-through-input" className="text-xs text-[var(--text-secondary)] font-medium">
                      Credit Valid Through (Date)
                    </Label>
                    <Input
                      id="valid-through-input"
                      placeholder="e.g. Dec 31, 2026 or Q3 2026"
                      value={validThroughDate}
                      onChange={(e) => handleValidThroughChange(e.target.value)}
                      className="bg-[var(--surface-1)] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] text-sm text-[var(--text-primary)]"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="credit-reason" className="text-xs text-[var(--text-secondary)] font-medium">
                      Sales Milestone / Reason Note
                    </Label>
                    <Input
                      id="credit-reason"
                      placeholder="e.g. Welcome to team, Top Producer award…"
                      value={creditReason}
                      onChange={(e) => setCreditReason(e.target.value)}
                      className="bg-[var(--surface-1)] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] text-sm text-[var(--text-primary)]"
                    />
                  </div>
                )}
              </div>

              {creditType === "agent_level" && (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="agent-level-reason" className="text-xs text-[var(--text-secondary)] font-medium">
                    Milestone Record Note
                  </Label>
                  <Input
                    id="agent-level-reason"
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                    placeholder="e.g. Agent level 2 qualification"
                    className="bg-[var(--surface-1)] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] text-sm text-[var(--text-primary)]"
                  />
                </div>
              )}
            </div>

            {/* Step 3: Email Body & Subject Line */}
            <div className="space-y-3 p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> 3. Email Notification (Resend)
                </Label>
                <div className="flex items-center gap-2">
                  {(isSubjectManuallyEdited || isBodyManuallyEdited) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetTemplate}
                      className="h-7 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Reset preset
                    </Button>
                  )}
                  <Tabs value={emailTab} onValueChange={(v) => setEmailTab(v as any)} className="w-auto">
                    <TabsList className="bg-[var(--surface-1)] h-7 p-0.5 border border-[var(--border)]">
                      <TabsTrigger value="edit" className="text-xs h-6 px-2.5">
                        Edit
                      </TabsTrigger>
                      <TabsTrigger value="preview" className="text-xs h-6 px-2.5">
                        Preview
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-subject" className="text-xs text-[var(--text-secondary)] font-medium">
                  Subject Line
                </Label>
                <Input
                  id="email-subject"
                  value={emailSubject}
                  onChange={(e) => {
                    setEmailSubject(e.target.value);
                    setIsSubjectManuallyEdited(true);
                  }}
                  className="bg-[var(--surface-1)] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] text-sm text-[var(--text-primary)]"
                  placeholder="Email subject line…"
                />
              </div>

              {emailTab === "edit" ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-body" className="text-xs text-[var(--text-secondary)] font-medium">
                      Email Body
                    </Label>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Use <code className="text-[var(--accent)] font-mono bg-[var(--surface-1)] px-1 py-0.5 rounded border border-[var(--border)]">{"{{code}}"}</code> as code placeholder
                    </span>
                  </div>
                  <Textarea
                    id="email-body"
                    rows={6}
                    value={emailBody}
                    onChange={(e) => {
                      setEmailBody(e.target.value);
                      setIsBodyManuallyEdited(true);
                    }}
                    className="bg-[var(--surface-1)] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] text-sm font-sans leading-relaxed min-h-[140px] text-[var(--text-primary)]"
                    placeholder="Write the email body text…"
                  />
                </div>
              ) : (
                /* Live Preview Container */
                <div className="rounded-xl border border-[var(--border)] bg-[#0C0F17] p-5 text-slate-100 text-sm space-y-3 font-sans shadow-inner">
                  <div className="border-b border-slate-800 pb-2.5 flex items-center justify-between text-xs text-slate-400">
                    <div>
                      <span className="text-slate-500 font-medium">To:</span> {recipientEmail || "agent@example.com"}
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">From:</span> MSREG Swag Store
                    </div>
                  </div>
                  <div className="font-bold text-white text-base">{emailSubject}</div>
                  <div className="whitespace-pre-wrap text-slate-300 leading-relaxed text-xs sm:text-sm py-1">
                    {emailBody.replace(
                      /\{\{\s*code\s*\}\}|\[\s*code\s*\]/gi,
                      "[GIFT-CARD-CODE]",
                    )}
                  </div>
                  <div className="bg-[#131826] border border-amber-500/40 rounded-xl p-4 text-center my-2 shadow-sm">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                      MSREG Gift Card Voucher
                    </div>
                    <div className="font-mono text-xl font-extrabold text-white tracking-widest my-1">
                      •••• •••• •••• {creditAmount ? `$${creditAmount}` : "$50.00"}
                    </div>
                    <div className="text-xs text-slate-400">
                      Store:{" "}
                      <a href="http://www.msregswag.com" target="_blank" rel="noreferrer" className="text-amber-400 underline inline-flex items-center gap-0.5 font-medium">
                        www.msregswag.com <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 border-t border-[var(--border)]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsIssueOpen(false)}
                className="border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] font-semibold text-xs shadow-sm"
                disabled={issueMutation.isPending}
              >
                {issueMutation.isPending ? "Generating & Sending…" : "Issue & Send via Resend"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SUCCESS DIALOG displaying the newly generated code & Resend delivery feedback */}
      <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
        <DialogContent className="bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-primary)] max-w-lg shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)] text-xl font-bold flex items-center gap-2">
              <Ticket className="h-6 w-6 text-emerald-400" />
              Gift Card Code Generated!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3 text-center">
            {/* Resend Status Banner */}
            {issueResult?.emailSent ? (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-left">
                <Check className="h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <div className="font-semibold text-white">Email Dispatched via Resend</div>
                  <div className="text-xs text-emerald-300/80">
                    The gift card code was emailed to <span className="font-medium text-white">{issueResult.recipientEmail}</span>.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm text-left">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Gift Card Created (Email Not Sent)</div>
                  <div className="text-xs text-amber-300/80">
                    {issueResult?.emailError || "Email could not be delivered."} You can copy the code below and send it to {issueResult?.recipientEmail} manually.
                  </div>
                </div>
              </div>
            )}

            <p className="text-[var(--text-secondary)] text-sm">
              Issued for <strong className="text-[var(--text-primary)]">{createdCredit?.agent_name}</strong>
            </p>

            <div className="bg-[var(--surface-2)] border border-[var(--border)] p-5 rounded-2xl flex flex-col items-center gap-3">
              <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-bold">
                Shopify Gift Card Code
              </span>
              <code className="text-[var(--accent)] font-mono text-2xl tracking-widest font-black select-all bg-[var(--surface-1)] px-5 py-2.5 rounded-xl border border-[var(--accent)]/30">
                {createdCredit?.gift_card_code}
              </code>
              <Button
                size="sm"
                onClick={() =>
                  copyToClipboard(
                    createdCredit?.gift_card_code || "",
                    createdCredit?.id || "success-dialog",
                  )
                }
                className="bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] text-xs font-semibold shadow-sm"
              >
                {copiedCodeId === createdCredit?.id || copiedCodeId === "success-dialog" ? (
                  <>
                    <Check className="h-4 w-4 mr-1.5 text-emerald-300" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1.5" />
                    Copy Code
                  </>
                )}
              </Button>
            </div>

            <div className="text-left space-y-1.5 text-xs text-[var(--text-secondary)] bg-[var(--surface-2)]/60 p-3.5 rounded-xl border border-[var(--border)]">
              <div className="font-semibold text-[var(--text-primary)] mb-1">Details:</div>
              <div>• <strong>Recipient</strong>: {createdCredit?.agent_name} {issueResult?.recipientEmail && `(${issueResult.recipientEmail})`}</div>
              <div>• <strong>Amount</strong>: ${createdCredit?.amount.toFixed(2)}</div>
              <div>• <strong>Reason</strong>: {createdCredit?.reason}</div>
              <div className="text-amber-400/90 mt-2 text-[11px]">
                ⚠️ Shopify masks gift card codes to their last 4 characters on subsequent loads. It will remain securely recorded in this Hub.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              onClick={() => setIsSuccessOpen(false)}
              className="bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] w-full border border-[var(--border)] text-xs"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
