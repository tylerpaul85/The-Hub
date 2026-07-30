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

  // New Credit Form State
  const [selectedAgentEmail, setSelectedAgentEmail] = useState("");
  const [customAgentName, setCustomAgentName] = useState("");
  const [useCustomName, setUseCustomName] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [createdCredit, setCreatedCredit] = useState<SwagCredit | null>(null);
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

  // Aggregated dropdown list combining signatures, profiles, and agent accounts
  const { data: dropdownAgents = [], isLoading: isAgentsLoading } = useQuery({
    queryKey: ["swag-agents-dropdown-list"],
    enabled: canAccess,
    queryFn: async () => {
      const [sigsRes, profilesRes, accountsRes] = await Promise.all([
        supabase.from("agent_signature_data").select("user_id, gmail_email"),
        supabase.from("profiles").select("id, email, first_name, last_name"),
        supabase.from("agent_accounts").select("id, email, full_name"),
      ]);

      const profMap = new Map(profilesRes.data?.map((p) => [p.id, p]) ?? []);
      const combined = new Map<string, { name: string; email: string }>();

      // 1. Add signature agents
      (sigsRes.data ?? []).forEach((s: any) => {
        const p = profMap.get(s.user_id);
        const name = p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : "";
        const email = s.gmail_email || p?.email || "";
        if (email) {
          combined.set(email.toLowerCase(), { name: name || email, email });
        }
      });

      // 2. Add agent accounts
      (accountsRes.data ?? []).forEach((a: any) => {
        if (a.email) {
          combined.set(a.email.toLowerCase(), { name: a.full_name || a.email, email: a.email });
        }
      });

      // 3. Add profiles
      (profilesRes.data ?? []).forEach((p: any) => {
        const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
        if (p.email) {
          const key = p.email.toLowerCase();
          if (!combined.has(key)) {
            combined.set(key, { name: name || p.email, email: p.email });
          }
        }
      });

      return Array.from(combined.values()).sort((a, b) => a.name.localeCompare(b.name));
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
    mutationFn: async (payload: { agentName: string; amount: number; reason: string }) => {
      const res = await issueCredit({ data: payload });
      return res.credit as SwagCredit;
    },
    onSuccess: (newCredit) => {
      qc.invalidateQueries({ queryKey: ["swag-credits-list"] });
      setCreatedCredit(newCredit);
      setIsIssueOpen(false);
      setIsSuccessOpen(true);
      // Reset form
      setSelectedAgentEmail("");
      setCustomAgentName("");
      setUseCustomName(false);
      setCreditAmount("");
      setCreditReason("");
      toast.success("Swag money credit issued successfully!");
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

  // Filters logic
  const filteredCredits = useMemo(() => {
    return credits.filter((c) => {
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesSearch =
        !searchTerm ||
        c.agent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.gift_card_code?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [credits, searchTerm, statusFilter]);

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let agentNameToSend = "";
    if (useCustomName) {
      agentNameToSend = customAgentName.trim();
    } else {
      const matched = dropdownAgents.find((a) => a.email === selectedAgentEmail);
      agentNameToSend = matched ? `${matched.name} (${matched.email})` : selectedAgentEmail;
    }

    if (!agentNameToSend) {
      toast.error("Please provide an agent name or select one.");
      return;
    }
    const amountNum = parseFloat(creditAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid positive amount.");
      return;
    }
    if (!creditReason.trim()) {
      toast.error("Please enter a reason or milestone.");
      return;
    }

    issueMutation.mutate({
      agentName: agentNameToSend,
      amount: amountNum,
      reason: creditReason.trim(),
    });
  };

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
              Issue and manage store credits for agent sales milestones.
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
            onClick={() => setIsIssueOpen(true)}
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
            (2026 OAuth) or the legacy{" "}
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
                Track details and remaining balances of issued Shopify gift cards.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search agent or reason..."
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
                <TableHead className="text-muted-foreground font-medium">Agent</TableHead>
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

      {/* Issue Credit Dialog */}
      <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
        <DialogContent className="bg-sidebar border-sidebar-border text-white">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">Issue Swag Store Credit</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a Shopify Gift Card and record it in the agent swag credit log.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleIssueSubmit} className="space-y-4 py-2">
            {/* Input Selection Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded bg-background/50 border border-sidebar-border/30">
              <div className="space-y-0.5">
                <Label
                  htmlFor="custom-name-toggle"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Custom Input Mode
                </Label>
                <div className="text-xs text-muted-foreground">
                  Type a custom name/email instead of picking from list
                </div>
              </div>
              <Switch
                id="custom-name-toggle"
                checked={useCustomName}
                onCheckedChange={setUseCustomName}
              />
            </div>

            {useCustomName ? (
              <div className="space-y-2">
                <Label htmlFor="agent-name-input" className="text-sm font-medium">
                  Agent Name or Email
                </Label>
                <Input
                  id="agent-name-input"
                  placeholder="e.g. John Doe (john@example.com)"
                  value={customAgentName}
                  onChange={(e) => setCustomAgentName(e.target.value)}
                  className="bg-background border-sidebar-border focus-visible:ring-gold"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="agent-select" className="text-sm font-medium">
                  Select Agent
                </Label>
                <Select value={selectedAgentEmail} onValueChange={setSelectedAgentEmail}>
                  <SelectTrigger
                    id="agent-select"
                    className="bg-background border-sidebar-border focus:ring-gold"
                  >
                    <SelectValue
                      placeholder={
                        isAgentsLoading
                          ? "Loading agents..."
                          : "Choose an agent from signatures/accounts"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-sidebar border-sidebar-border max-h-60 overflow-y-auto">
                    {dropdownAgents.map((agent) => (
                      <SelectItem
                        key={agent.email}
                        value={agent.email}
                        className="text-white focus:bg-sidebar-accent"
                      >
                        {agent.name} {agent.name !== agent.email && `(${agent.email})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm font-medium">
                Credit Amount ($)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="number"
                  placeholder="50.00"
                  step="0.01"
                  min="1"
                  max="1000"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="pl-7 bg-background border-sidebar-border focus-visible:ring-gold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium">
                Sales Milestone / Reason
              </Label>
              <Textarea
                id="reason"
                placeholder="e.g. Sales Milestone: Closed 25 properties in Q2"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                className="bg-background border-sidebar-border focus-visible:ring-gold min-h-[80px]"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-sidebar-border/40">
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
                {issueMutation.isPending ? "Generating Code…" : "Issue Credit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SUCCESS DIALOG displaying the newly generated code */}
      <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
        <DialogContent className="bg-sidebar border-sidebar-border text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-xl flex items-center gap-2">
              <Ticket className="h-6 w-6 text-green-400" />
              Gift Card Code Generated!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-center">
            <p className="text-muted-foreground text-sm">
              Copy this code now to send to **{createdCredit?.agent_name}**.
            </p>

            <div className="bg-background border border-sidebar-border p-4 rounded-xl flex flex-col items-center gap-3">
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
                {copiedCodeId === createdCredit?.id ? (
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

            <div className="text-left space-y-2 text-xs text-muted-foreground bg-sidebar-accent/30 p-3 rounded border border-sidebar-border/40">
              <div className="font-medium text-white">Details:</div>
              <div>• **Value**: ${createdCredit?.amount.toFixed(2)}</div>
              <div>• **Reason**: {createdCredit?.reason}</div>
              <div className="text-amber-400 mt-1">
                ⚠️ Shopify masks the code to last 4 characters on subsequent loads. It will always
                remain fully viewable in this hub.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setIsSuccessOpen(false)}
              className="bg-sidebar-accent hover:bg-sidebar-accent/80 text-white w-full border border-sidebar-border"
            >
              Close Window
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
