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
    return <div className="p-8 text-center text-muted-foreground">Loading authentication...</div>;
  }

  if (!canAccess) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gold/10 rounded-lg text-gold">
            <Ticket className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Shopify Swag Credits</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Issue store credits to agents from the Agent Toolbox and dispatch gift codes via Resend.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || isRefetching || !config?.configured}
            className="border-sidebar-border hover:bg-sidebar-accent hover:text-white"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${syncMutation.isPending || isRefetching ? "animate-spin" : ""}`}
            />
            Sync Balances
          </Button>
          <Button
            onClick={handleOpenIssue}
            disabled={!config?.configured}
            className="bg-gold text-navy hover:bg-gold/90 font-medium"
          >
            <Plus className="h-4 w-4 mr-1" /> Issue Swag Credit
          </Button>
        </div>
      </header>

      {/* Configuration Alert Banner */}
      {!isConfigLoading && !config?.configured && (
        <Alert variant="destructive" className="border-red-500/30 bg-red-500/10 text-red-400">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="font-semibold text-white">Shopify Connection Missing</AlertTitle>
          <AlertDescription className="text-sm mt-1">
            Shopify API integration is not configured. Please define the server environment
            variables{" "}
            <code className="bg-red-950/50 px-1 py-0.5 rounded text-white border border-red-500/20 font-mono text-xs">
              SHOPIFY_STORE_URL
            </code>{" "}
            and either{" "}
            <code className="bg-red-950/50 px-1 py-0.5 rounded text-white border border-red-500/20 font-mono text-xs">
              SHOPIFY_CLIENT_ID
            </code>{" "}
            +{" "}
            <code className="bg-red-950/50 px-1 py-0.5 rounded text-white border border-red-500/20 font-mono text-xs">
              SHOPIFY_CLIENT_SECRET
            </code>{" "}
            or legacy{" "}
            <code className="bg-red-950/50 px-1 py-0.5 rounded text-white border border-red-500/20 font-mono text-xs">
              SHOPIFY_ADMIN_ACCESS_TOKEN
            </code>
            .
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Dashboard */}
      <Card className="border-sidebar-border bg-sidebar/40 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-sidebar-border/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-white text-lg">Issued Store Credits</CardTitle>
              <CardDescription>
                Track details, recipients, and remaining balances of issued Shopify gift cards.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search agent, email, or reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64 bg-background border-sidebar-border focus-visible:ring-gold"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-40 bg-background border-sidebar-border focus:ring-gold">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="bg-sidebar border-sidebar-border">
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
            <TableHeader className="bg-sidebar/60 border-b border-sidebar-border/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">Agent / Recipient</TableHead>
                <TableHead className="text-muted-foreground font-medium">
                  Milestone / Reason
                </TableHead>
                <TableHead className="text-muted-foreground font-medium text-right">
                  Original
                </TableHead>
                <TableHead className="text-muted-foreground font-medium text-right">
                  Balance
                </TableHead>
                <TableHead className="text-muted-foreground font-medium">Gift Card Code</TableHead>
                <TableHead className="text-muted-foreground font-medium">Status</TableHead>
                <TableHead className="text-muted-foreground font-medium">Issued Date</TableHead>
                <TableHead className="text-muted-foreground font-medium text-right w-24">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isCreditsLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gold" />
                    Loading swag credits records...
                  </TableCell>
                </TableRow>
              )}

              {!isCreditsLoading && filteredCredits.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
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
                      className="border-b border-sidebar-border/20 hover:bg-sidebar-accent/10"
                    >
                      <TableCell>
                        <div className="font-medium text-white">{credit.agent_name}</div>
                        {credit.recipient_email && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3 text-muted-foreground/70" />
                            {credit.recipient_email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell
                        className="max-w-xs truncate text-muted-foreground"
                        title={credit.reason}
                      >
                        {credit.reason}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground font-mono">
                        ${credit.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-white font-mono">
                        ${credit.balance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5 bg-background/50 border border-sidebar-border/40 px-2 py-1 rounded">
                          <code className="font-mono text-xs text-gold tracking-wider select-all">
                            {displayCode}
                          </code>
                          <button
                            onClick={() => toggleRevealCode(credit.id)}
                            className="p-1 hover:text-white text-muted-foreground transition-colors"
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
                            className="p-1 hover:text-white text-muted-foreground transition-colors"
                            title="Copy code"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-green-400" />
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
                              ? "bg-green-500/10 text-green-400 border-green-500/30"
                              : credit.status === "revoked"
                                ? "bg-red-500/10 text-red-400 border-red-500/30"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }
                        >
                          {credit.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {format(new Date(credit.created_at), "MMM d, yyyy")}
                        </div>
                        {credit.creator?.email && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
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
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2"
                            disabled={revokeMutation.isPending}
                          >
                            <Ban className="h-3.5 w-3.5 mr-1" />
                            Revoke
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic pr-2">
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
        <DialogContent className="bg-sidebar border-sidebar-border text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-xl flex items-center gap-2">
              <Ticket className="h-5 w-5 text-gold" />
              Issue Swag Store Credit
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Generate a Shopify gift card code and dispatch the formatted notification email via Resend.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleIssueSubmit} className="space-y-5 py-2">
            {/* Step 1: Agent Recipient Selection */}
            <div className="space-y-3 p-4 rounded-xl bg-background/50 border border-sidebar-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-gold flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> 1. Select Agent
                </Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="manual-agent-toggle" className="text-xs text-muted-foreground cursor-pointer">
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
                    <Label htmlFor="agent-dropdown" className="text-xs text-muted-foreground mb-1 block">
                      Agent from Toolbox Roster ({toolboxAgents.length} agents)
                    </Label>
                    <Select value={selectedAgentId} onValueChange={handleAgentSelect}>
                      <SelectTrigger
                        id="agent-dropdown"
                        className="bg-background border-sidebar-border focus:ring-gold text-white"
                      >
                        <SelectValue
                          placeholder={
                            isAgentsLoading ? "Loading agents from Toolbox..." : "Choose an agent from Toolbox…"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-sidebar border-sidebar-border max-h-60 overflow-y-auto">
                        {toolboxAgents.map((agent) => (
                          <SelectItem
                            key={agent.id}
                            value={agent.id}
                            className="text-white focus:bg-sidebar-accent cursor-pointer"
                          >
                            <span className="font-medium">{agent.name}</span>
                            {agent.email ? (
                              <span className="text-muted-foreground text-xs ml-2">({agent.email})</span>
                            ) : (
                              <span className="text-amber-400/80 text-xs ml-2">(No email in toolbox)</span>
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
                        <Label htmlFor="agent-name-confirm" className="text-xs text-muted-foreground">
                          Agent Name
                        </Label>
                        <Input
                          id="agent-name-confirm"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          className="bg-background border-sidebar-border focus-visible:ring-gold text-sm"
                          placeholder="Agent Name"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="agent-email-confirm" className="text-xs text-muted-foreground flex items-center justify-between">
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
                          className={`bg-background border-sidebar-border focus-visible:ring-gold text-sm ${
                            !recipientEmail ? "border-amber-500/50 focus-visible:ring-amber-500" : ""
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
                    <Label htmlFor="custom-name" className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> Agent / Recipient Name
                    </Label>
                    <Input
                      id="custom-name"
                      placeholder="e.g. John Doe"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="bg-background border-sidebar-border focus-visible:ring-gold text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-email" className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Recipient Email
                    </Label>
                    <Input
                      id="custom-email"
                      type="email"
                      placeholder="e.g. john@mattsmithrealestategroup.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="bg-background border-sidebar-border focus-visible:ring-gold text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: What is this credit for? */}
            <div className="space-y-3 p-4 rounded-xl bg-background/50 border border-sidebar-border/50">
              <Label className="text-xs font-semibold uppercase tracking-wider text-gold flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5" /> 2. What is it for?
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Option 1: Welcome to team */}
                <button
                  type="button"
                  onClick={() => handleCreditTypeChange("welcome")}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    creditType === "welcome"
                      ? "bg-gold/15 border-gold text-white shadow-sm ring-1 ring-gold/40"
                      : "bg-sidebar-accent/20 border-sidebar-border hover:bg-sidebar-accent/40 text-muted-foreground hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className={`h-4 w-4 ${creditType === "welcome" ? "text-gold" : "text-muted-foreground"}`} />
                    <span className="font-semibold text-sm text-white">1. Welcome to team</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    $50 default credit for newly onboarded team agents.
                  </div>
                </button>

                {/* Option 2: Agent level */}
                <button
                  type="button"
                  onClick={() => handleCreditTypeChange("agent_level")}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    creditType === "agent_level"
                      ? "bg-gold/15 border-gold text-white shadow-sm ring-1 ring-gold/40"
                      : "bg-sidebar-accent/20 border-sidebar-border hover:bg-sidebar-accent/40 text-muted-foreground hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Award className={`h-4 w-4 ${creditType === "agent_level" ? "text-gold" : "text-muted-foreground"}`} />
                    <span className="font-semibold text-sm text-white">2. Agent level</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    $100 default credit for Level 2+ milestone qualifications.
                  </div>
                </button>

                {/* Option 3: Other */}
                <button
                  type="button"
                  onClick={() => handleCreditTypeChange("other")}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    creditType === "other"
                      ? "bg-gold/15 border-gold text-white shadow-sm ring-1 ring-gold/40"
                      : "bg-sidebar-accent/20 border-sidebar-border hover:bg-sidebar-accent/40 text-muted-foreground hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Ticket className={`h-4 w-4 ${creditType === "other" ? "text-gold" : "text-muted-foreground"}`} />
                    <span className="font-semibold text-sm text-white">3. Other</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Custom amount, reason, and custom email message.
                  </div>
                </button>
              </div>

              {/* Amount & Reason / Milestone inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="credit-amount" className="text-xs text-muted-foreground">
                    Credit Amount ($)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                    <Input
                      id="credit-amount"
                      type="number"
                      placeholder="50.00"
                      step="0.01"
                      min="1"
                      max="1000"
                      value={creditAmount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      className="pl-7 bg-background border-sidebar-border focus-visible:ring-gold text-sm"
                    />
                  </div>
                </div>

                {creditType === "agent_level" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="valid-through-input" className="text-xs text-muted-foreground">
                      Credit Valid Through (Date)
                    </Label>
                    <Input
                      id="valid-through-input"
                      placeholder="e.g. Dec 31, 2026 or Q3 2026"
                      value={validThroughDate}
                      onChange={(e) => handleValidThroughChange(e.target.value)}
                      className="bg-background border-sidebar-border focus-visible:ring-gold text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="credit-reason" className="text-xs text-muted-foreground">
                      Sales Milestone / Reason Note
                    </Label>
                    <Input
                      id="credit-reason"
                      placeholder="e.g. Welcome to team, Top Producer award…"
                      value={creditReason}
                      onChange={(e) => setCreditReason(e.target.value)}
                      className="bg-background border-sidebar-border focus-visible:ring-gold text-sm"
                    />
                  </div>
                )}
              </div>

              {creditType === "agent_level" && (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="agent-level-reason" className="text-xs text-muted-foreground">
                    Milestone Record Note
                  </Label>
                  <Input
                    id="agent-level-reason"
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                    placeholder="e.g. Agent level 2 qualification"
                    className="bg-background border-sidebar-border focus-visible:ring-gold text-sm"
                  />
                </div>
              )}
            </div>

            {/* Step 3: Email Body & Subject Line */}
            <div className="space-y-3 p-4 rounded-xl bg-background/50 border border-sidebar-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-gold flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> 3. Email Notification (Resend)
                </Label>
                <div className="flex items-center gap-2">
                  {(isSubjectManuallyEdited || isBodyManuallyEdited) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetTemplate}
                      className="h-7 text-xs text-muted-foreground hover:text-white px-2"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Reset to preset
                    </Button>
                  )}
                  <Tabs value={emailTab} onValueChange={(v) => setEmailTab(v as any)} className="w-auto">
                    <TabsList className="bg-background/80 h-7 p-0.5 border border-sidebar-border">
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
                <Label htmlFor="email-subject" className="text-xs text-muted-foreground">
                  Subject Line
                </Label>
                <Input
                  id="email-subject"
                  value={emailSubject}
                  onChange={(e) => {
                    setEmailSubject(e.target.value);
                    setIsSubjectManuallyEdited(true);
                  }}
                  className="bg-background border-sidebar-border focus-visible:ring-gold text-sm"
                  placeholder="Email subject line…"
                />
              </div>

              {emailTab === "edit" ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-body" className="text-xs text-muted-foreground">
                      Email Body
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      Use <code className="text-gold font-mono bg-gold/10 px-1 py-0.5 rounded">{"{{code}}"}</code> as code placeholder
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
                    className="bg-background border-sidebar-border focus-visible:ring-gold text-sm font-sans leading-relaxed min-h-[140px]"
                    placeholder="Write the email body text…"
                  />
                </div>
              ) : (
                /* Live Preview Container */
                <div className="rounded-lg border border-sidebar-border/70 bg-[#0f172a] p-4 text-slate-100 text-sm space-y-3 font-sans shadow-inner">
                  <div className="border-b border-slate-700/60 pb-2 flex items-center justify-between text-xs text-slate-400">
                    <div>
                      <span className="text-slate-500">To:</span> {recipientEmail || "agent@example.com"}
                    </div>
                    <div>
                      <span className="text-slate-500">From:</span> MSREG Swag
                    </div>
                  </div>
                  <div className="font-semibold text-white text-base">{emailSubject}</div>
                  <div className="whitespace-pre-wrap text-slate-300 leading-relaxed text-sm py-1">
                    {emailBody.replace(
                      /\{\{\s*code\s*\}\}|\[\s*code\s*\]/gi,
                      "[GIFT-CARD-CODE]",
                    )}
                  </div>
                  <div className="bg-[#1e293b] border border-amber-500/40 rounded-lg p-3 text-center my-2">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                      Gift Card Voucher
                    </div>
                    <div className="font-mono text-lg font-bold text-white tracking-widest my-0.5">
                      •••• •••• •••• {creditAmount ? `$${creditAmount}` : "$50.00"}
                    </div>
                    <div className="text-xs text-slate-400">
                      Store:{" "}
                      <a href="http://www.msregswag.com" target="_blank" rel="noreferrer" className="text-amber-400 underline inline-flex items-center gap-0.5">
                        www.msregswag.com <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 border-t border-sidebar-border/40">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsIssueOpen(false)}
                className="border-sidebar-border hover:bg-sidebar-accent hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gold text-navy hover:bg-gold/90 font-medium"
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
        <DialogContent className="bg-sidebar border-sidebar-border text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white text-xl flex items-center gap-2">
              <Ticket className="h-6 w-6 text-green-400" />
              Gift Card Code Generated!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3 text-center">
            {/* Resend Status Banner */}
            {issueResult?.emailSent ? (
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm text-left">
                <Check className="h-5 w-5 shrink-0 text-green-400" />
                <div>
                  <div className="font-semibold text-white">Email Dispatched via Resend</div>
                  <div className="text-xs text-green-300/80">
                    The gift card code was emailed to <span className="font-medium text-white">{issueResult.recipientEmail}</span>.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm text-left">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">Gift Card Created (Email Not Sent)</div>
                  <div className="text-xs text-amber-300/80">
                    {issueResult?.emailError || "Email could not be delivered."} You can copy the code below and send it to {issueResult?.recipientEmail} manually.
                  </div>
                </div>
              </div>
            )}

            <p className="text-muted-foreground text-sm">
              Issued for <strong className="text-white">{createdCredit?.agent_name}</strong>
            </p>

            <div className="bg-background border border-sidebar-border p-4 rounded-xl flex flex-col items-center gap-3">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Shopify Gift Card Code
              </span>
              <code className="text-gold font-mono text-2xl tracking-widest font-bold select-all bg-gold/5 px-4 py-2 rounded border border-gold/15">
                {createdCredit?.gift_card_code}
              </code>
              <Button
                onClick={() =>
                  copyToClipboard(
                    createdCredit?.gift_card_code || "",
                    createdCredit?.id || "success-dialog",
                  )
                }
                className="bg-gold text-navy hover:bg-gold/90 text-sm font-semibold"
              >
                {copiedCodeId === createdCredit?.id || copiedCodeId === "success-dialog" ? (
                  <>
                    <Check className="h-4 w-4 mr-1.5 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1.5" />
                    Copy Code to Clipboard
                  </>
                )}
              </Button>
            </div>

            <div className="text-left space-y-1.5 text-xs text-muted-foreground bg-sidebar-accent/30 p-3.5 rounded-lg border border-sidebar-border/40">
              <div className="font-medium text-white mb-1">Details:</div>
              <div>• <strong>Recipient</strong>: {createdCredit?.agent_name} {issueResult?.recipientEmail && `(${issueResult.recipientEmail})`}</div>
              <div>• <strong>Amount</strong>: ${createdCredit?.amount.toFixed(2)}</div>
              <div>• <strong>Reason</strong>: {createdCredit?.reason}</div>
              <div className="text-amber-400 mt-2 text-[11px]">
                ⚠️ Shopify masks gift card codes to their last 4 characters on subsequent loads. It will remain viewable in this Hub.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setIsSuccessOpen(false)}
              className="bg-sidebar-accent hover:bg-sidebar-accent/80 text-white w-full border border-sidebar-border"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
