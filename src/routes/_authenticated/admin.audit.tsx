import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  UserCheck,
  RefreshCw,
  Search,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Mail,
  Sliders,
  Scale,
  Sparkles,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
  AlertCircle,
  Plus,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  getAgentAuditOverview,
  getAgentAuditDetail,
  getSyncStatus,
  triggerFubSync,
  scanIntegrityFlags,
  reviewIntegrityFlag,
  reviewLeadGrade,
  reviewComplianceFlag,
  getRubricCriteria,
  upsertRubricCriterion,
  prepareAgentGradingSample,
  gradeSingleSampledLead,
  runAgentGradingSample,
  getCalibrationSets,
  upsertCalibrationSet,
  getCalibrationLeadDetail,
  addLeadToCalibration,
  saveCalibrationHumanGrade,
  runCalibrationEvaluation,
  sendMonthlyAuditReportEmail,
} from "@/lib/agent-audit/audit.functions";
import { getFubLeadUrl } from "@/lib/agent-audit/config";
import type {
  AgentMonthlyMetric,
  AuditRubricCriterion,
  AuditIntegrityFlag,
  AuditSampledLead,
  AuditComplianceFlag,
  AuditCalibrationSet,
  AuditCalibrationLead,
  FubSyncLog,
} from "@/lib/agent-audit/types";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AgentAuditPage,
  head: () => ({ meta: [{ title: "Agent Audit System — MSREG Hub" }] }),
});

function AgentAuditPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Data states
  const [overviewMetrics, setOverviewMetrics] = useState<AgentMonthlyMetric[]>([]);
  const [syncLogs, setSyncLogs] = useState<FubSyncLog[]>([]);
  const [rubricCriteria, setRubricCriteria] = useState<AuditRubricCriterion[]>([]);
  const [calibrationSets, setCalibrationSets] = useState<AuditCalibrationSet[]>([]);
  const [selectedAgentFubId, setSelectedAgentFubId] = useState<number | null>(null);
  const [agentDetail, setAgentDetail] = useState<any | null>(null);

  // Calibration state
  const [selectedCalibrationSetId, setSelectedCalibrationSetId] = useState<string | null>(null);
  const [calibrationLeads, setCalibrationLeads] = useState<AuditCalibrationLead[]>([]);

  // Loading states
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isScanningFlags, setIsScanningFlags] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Modals
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("tyler.p@mattsmithrealestategroup.com");
  const [emailMonth, setEmailMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const [showSamplingModal, setShowSamplingModal] = useState(false);
  const [sampleTargetAgent, setSampleTargetAgent] = useState<AgentMonthlyMetric | null>(null);
  const [sampleSize, setSampleSize] = useState(20);
  const [isGrading, setIsGrading] = useState(false);

  const [showCriterionModal, setShowCriterionModal] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<Partial<AuditRubricCriterion>>({});

  const [showAddCalLeadModal, setShowAddCalLeadModal] = useState(false);
  const [calLeadPersonId, setCalLeadPersonId] = useState("");
  const [calLeadNotes, setCalLeadNotes] = useState("");

  const [showNewCalSetModal, setShowNewCalSetModal] = useState(false);
  const [newCalSetName, setNewCalSetName] = useState("");
  const [newCalSetDesc, setNewCalSetDesc] = useState("");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Initial Data Fetch
  useEffect(() => {
    loadOverview();
    loadRubric();
    loadSyncLogs();
    loadCalibrationSets();
  }, []);

  const loadOverview = async () => {
    setIsLoadingOverview(true);
    try {
      const data = await getAgentAuditOverview();
      setOverviewMetrics(data as any);
    } catch (err: any) {
      toast.error(`Failed to load agent metrics: ${err.message}`);
    } finally {
      setIsLoadingOverview(false);
    }
  };

  const loadRubric = async () => {
    try {
      const data = await getRubricCriteria();
      setRubricCriteria(data);
    } catch (err: any) {
      toast.error(`Failed to load rubric criteria: ${err.message}`);
    }
  };

  const loadSyncLogs = async () => {
    try {
      const data = await getSyncStatus();
      setSyncLogs(data as any);
    } catch (err: any) {
      console.warn("Failed to load sync status:", err);
    }
  };

  const loadCalibrationSets = async () => {
    try {
      const data = await getCalibrationSets();
      setCalibrationSets(data as any);
      if (data && data.length > 0 && !selectedCalibrationSetId) {
        setSelectedCalibrationSetId(data[0].id);
      }
    } catch (err: any) {
      console.warn("Failed to load calibration sets:", err);
    }
  };

  // 2. Fetch Agent Detail when selected
  useEffect(() => {
    if (!selectedAgentFubId) {
      setAgentDetail(null);
      return;
    }
    const loadDetail = async () => {
      setIsLoadingDetail(true);
      try {
        const detail = await getAgentAuditDetail({ data: { agentFubId: selectedAgentFubId } });
        setAgentDetail(detail);
      } catch (err: any) {
        toast.error(`Failed to load agent details: ${err.message}`);
      } finally {
        setIsLoadingDetail(false);
      }
    };
    loadDetail();
  }, [selectedAgentFubId]);

  // 3. Fetch Calibration Leads when set changes
  useEffect(() => {
    if (!selectedCalibrationSetId) {
      setCalibrationLeads([]);
      return;
    }
    const loadCalLeads = async () => {
      try {
        const leads = await getCalibrationLeadDetail({
          data: { setId: selectedCalibrationSetId },
        });
        setCalibrationLeads(leads as any);
      } catch (err: any) {
        toast.error(`Failed to load calibration leads: ${err.message}`);
      }
    };
    loadCalLeads();
  }, [selectedCalibrationSetId]);

  // Actions
  const cleanErrorMessage = (err: any) => {
    const raw = err?.message || String(err || "Unknown error");
    const stripped = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (stripped.includes("Inactivity Timeout") || stripped.includes("Too much time has passed")) {
      return "The FUB connection timed out on the host gateway. Use Quick Sync or wait a few moments before retrying.";
    }
    return stripped;
  };

  const handleTriggerQuickSync = async () => {
    setIsSyncing(true);
    toast.info("Starting quick parallel FUB sync (3-5s)...");
    try {
      const result = await triggerFubSync({ data: { step: "quick", fullSync: false } });
      toast.success(
        `Quick sync complete: ${result.counts.leads} leads, ${result.counts.calls} calls, ${result.counts.notes} notes.`,
      );
      loadOverview();
      loadSyncLogs();
    } catch (err: any) {
      toast.error(`Sync failed: ${cleanErrorMessage(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTriggerFullSync = async () => {
    setIsSyncing(true);
    try {
      toast.loading("Step 1/4: Syncing Team Roster & Leads...", { id: "fub-stepped-sync" });
      await triggerFubSync({ data: { step: "agents_leads", fullSync: false } });

      toast.loading("Step 2/4: Syncing Calls, Texts, Emails & Notes...", { id: "fub-stepped-sync" });
      await triggerFubSync({ data: { step: "comms", fullSync: false } });

      toast.loading("Step 3/4: Syncing Tasks & Deals...", { id: "fub-stepped-sync" });
      await triggerFubSync({ data: { step: "tasks_pipeline", fullSync: false } });

      toast.loading("Step 4/4: Scanning Data Integrity Flags...", { id: "fub-stepped-sync" });
      await triggerFubSync({ data: { step: "scan_flags", fullSync: false } });

      toast.success("Comprehensive FUB sync completed successfully!", { id: "fub-stepped-sync" });
      loadOverview();
      loadSyncLogs();
    } catch (err: any) {
      toast.error(`Sync failed: ${cleanErrorMessage(err)}`, { id: "fub-stepped-sync" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleScanIntegrityFlags = async () => {
    setIsScanningFlags(true);
    try {
      const result: any = await scanIntegrityFlags();
      toast.success(`Scanned integrity rules. Generated ${result?.inserted_flags ?? 0} new flags.`);
      loadOverview();
      if (selectedAgentFubId) {
        const detail = await getAgentAuditDetail({ data: { agentFubId: selectedAgentFubId } });
        setAgentDetail(detail);
      }
    } catch (err: any) {
      toast.error(`Integrity scan failed: ${err.message}`);
    } finally {
      setIsScanningFlags(false);
    }
  };

  const handleStartSampling = (agent: AgentMonthlyMetric) => {
    setSampleTargetAgent(agent);
    setShowSamplingModal(true);
  };

  const handleExecuteSampling = async () => {
    if (!sampleTargetAgent) return;
    setIsGrading(true);
    try {
      toast.loading(`Sampling leads for ${sampleTargetAgent.agent_name}...`, {
        id: "grading-progress",
      });

      const prepResult = await prepareAgentGradingSample({
        data: {
          agentFubId: sampleTargetAgent.agent_fub_id,
          sampleSize,
          auditMonth: new Date().toISOString().slice(0, 7),
        },
      });

      const totalToGrade = prepResult.sampledLeads?.length ?? 0;
      if (totalToGrade === 0) {
        toast.error("No active leads were found in scope for this agent.", {
          id: "grading-progress",
        });
        return;
      }

      let completedCount = 0;
      for (let i = 0; i < totalToGrade; i++) {
        const item = prepResult.sampledLeads[i];
        toast.loading(
          `Grading lead ${i + 1} of ${totalToGrade} (${item.leadName}) with Claude...`,
          { id: "grading-progress" },
        );

        await gradeSingleSampledLead({
          data: { sampledLeadId: item.id },
        });
        completedCount++;
      }

      toast.success(
        `Graded ${completedCount} leads for ${sampleTargetAgent.agent_name}!`,
        { id: "grading-progress" },
      );
      setShowSamplingModal(false);
      loadOverview();
      if (selectedAgentFubId === sampleTargetAgent.agent_fub_id) {
        const detail = await getAgentAuditDetail({ data: { agentFubId: selectedAgentFubId } });
        setAgentDetail(detail);
      }
    } catch (err: any) {
      toast.error(`Grading failed: ${cleanErrorMessage(err)}`, { id: "grading-progress" });
    } finally {
      setIsGrading(false);
    }
  };

  const handleSaveFlagReview = async (
    flagId: string,
    status: "confirmed" | "dismissed" | "needs_human_review",
    overrideStatus: "agreed" | "disagreed",
    notes?: string,
  ) => {
    try {
      await reviewIntegrityFlag({
        data: {
          flagId,
          status,
          humanOverrideStatus: overrideStatus,
          notes,
        },
      });
      toast.success("Flag review updated");
      if (selectedAgentFubId) {
        const detail = await getAgentAuditDetail({ data: { agentFubId: selectedAgentFubId } });
        setAgentDetail(detail);
      }
      loadOverview();
    } catch (err: any) {
      toast.error(`Review failed: ${err.message}`);
    }
  };

  const handleSaveGradeOverride = async (
    gradeId: string,
    newScore: number | null,
    notes?: string,
  ) => {
    try {
      await reviewLeadGrade({
        data: {
          gradeId,
          humanOverrideScore: newScore,
          humanOverrideStatus: newScore !== null ? "disagreed" : "agreed",
          notes,
        },
      });
      toast.success("Grade override saved");
      if (selectedAgentFubId) {
        const detail = await getAgentAuditDetail({ data: { agentFubId: selectedAgentFubId } });
        setAgentDetail(detail);
      }
      loadOverview();
    } catch (err: any) {
      toast.error(`Failed to override grade: ${err.message}`);
    }
  };

  const handleSaveComplianceReview = async (flagId: string, status: "confirmed" | "dismissed") => {
    try {
      await reviewComplianceFlag({
        data: { flagId, status },
      });
      toast.success("Compliance flag review updated");
      if (selectedAgentFubId) {
        const detail = await getAgentAuditDetail({ data: { agentFubId: selectedAgentFubId } });
        setAgentDetail(detail);
      }
      loadOverview();
    } catch (err: any) {
      toast.error(`Review failed: ${err.message}`);
    }
  };

  const handleSaveRubricCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCriterion.key || !editingCriterion.name) {
      toast.error("Key and Name are required");
      return;
    }
    try {
      await upsertRubricCriterion({
        data: {
          id: editingCriterion.id,
          key: editingCriterion.key,
          name: editingCriterion.name,
          category: editingCriterion.category || "Conversation Quality",
          weight: editingCriterion.weight ?? 1.0,
          anchor_1: editingCriterion.anchor_1 || "Unacceptable",
          anchor_3: editingCriterion.anchor_3 || "Acceptable standard",
          anchor_5: editingCriterion.anchor_5 || "Exemplary",
          description: editingCriterion.description || "",
          examples: editingCriterion.examples || "",
          is_active: editingCriterion.is_active ?? true,
          sort_order: editingCriterion.sort_order ?? 0,
        },
      });
      toast.success("Rubric criterion saved");
      setShowCriterionModal(false);
      loadRubric();
    } catch (err: any) {
      toast.error(`Failed to save criterion: ${err.message}`);
    }
  };

  const handleAddCalibrationLead = async () => {
    if (!selectedCalibrationSetId || !calLeadPersonId) return;
    try {
      await addLeadToCalibration({
        data: {
          setId: selectedCalibrationSetId,
          personFubId: Number(calLeadPersonId),
          notes: calLeadNotes,
        },
      });
      toast.success("Added lead to calibration set");
      setShowAddCalLeadModal(false);
      setCalLeadPersonId("");
      setCalLeadNotes("");
      const leads = await getCalibrationLeadDetail({
        data: { setId: selectedCalibrationSetId },
      });
      setCalibrationLeads(leads as any);
    } catch (err: any) {
      toast.error(`Failed to add calibration lead: ${err.message}`);
    }
  };

  const handleRunCalibrationTest = async () => {
    if (!selectedCalibrationSetId) return;
    toast.info("Running Claude grading against calibration benchmark leads...");
    try {
      const result = await runCalibrationEvaluation({
        data: { calibrationSetId: selectedCalibrationSetId },
      });
      toast.success(`Evaluated ${result.evaluatedCount} benchmark leads against Claude!`);
      const leads = await getCalibrationLeadDetail({
        data: { setId: selectedCalibrationSetId },
      });
      setCalibrationLeads(leads as any);
    } catch (err: any) {
      toast.error(`Calibration run failed: ${err.message}`);
    }
  };

  const handleSendMonthlyReport = async () => {
    setIsSendingEmail(true);
    try {
      await sendMonthlyAuditReportEmail({
        data: {
          recipientEmail: emailRecipient,
          auditMonth: emailMonth,
          reportType: "team_rollup",
        },
      });
      toast.success(`Monthly audit report emailed to ${emailRecipient}`);
      setShowEmailModal(false);
    } catch (err: any) {
      toast.error(`Failed to send report: ${cleanErrorMessage(err)}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          The Agent Audit System is restricted to administrators (Tyler & Matt).
        </p>
      </div>
    );
  }

  const filteredMetrics = overviewMetrics.filter((m) =>
    m.agent_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const teamAvgRubric =
    overviewMetrics.length > 0
      ? (
          overviewMetrics.reduce((sum, m) => sum + (m.avg_rubric_score || 0), 0) /
          Math.max(overviewMetrics.filter((m) => m.avg_rubric_score > 0).length, 1)
        ).toFixed(2)
      : "0.00";

  const totalOpenFlags = overviewMetrics.reduce(
    (sum, m) => sum + (m.open_integrity_flags_count || 0),
    0,
  );
  const totalCompliance = overviewMetrics.reduce(
    (sum, m) => sum + (m.compliance_flags_count || 0),
    0,
  );

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* ── Breadcrumb / Back Navigation ─────────────────────────────────── */}
      <div>
        <Link
          to="/experiments"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-gold transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Experiments
        </Link>
      </div>

      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center text-gold shadow-sm">
              <UserCheck className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Agent Audit System
            </h1>
            <Badge variant="outline" className="bg-gold/10 text-gold border-gold/30 text-xs">
              Admin Only
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Auditing agent conversation quality, deterministic data integrity, and compliance in Follow Up Boss.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerQuickSync}
            disabled={isSyncing}
            className="border-border/80 text-xs font-medium"
            title="Fast parallel sync of latest FUB updates (3-5s)"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Quick Sync FUB"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleTriggerFullSync}
            disabled={isSyncing}
            className="border border-border/40 text-xs text-muted-foreground hover:text-foreground"
            title="4-stage comprehensive synchronization across all entities"
          >
            Full Stepped Sync
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleScanIntegrityFlags}
            disabled={isScanningFlags}
            className="border-border/80 text-xs"
          >
            <AlertTriangle className={`h-3.5 w-3.5 mr-1.5 ${isScanningFlags ? "animate-spin" : ""}`} />
            Scan Integrity Flags
          </Button>

          <Button
            size="sm"
            onClick={() => setShowEmailModal(true)}
            className="bg-gold hover:bg-gold-light text-navy-dark font-medium text-xs shadow-sm"
          >
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            Send Monthly Report
          </Button>
        </div>
      </div>

      {/* ── Main Navigation Tabs ────────────────────────────────────────────── */}
      <Tabs
        value={selectedAgentFubId ? "detail" : activeTab}
        onValueChange={(val) => {
          if (val !== "detail") setSelectedAgentFubId(null);
          setActiveTab(val);
        }}
        className="w-full space-y-6"
      >
        <TabsList className="bg-muted/60 border border-border/60 p-1">
          <TabsTrigger value="overview" className="text-xs">
            Team Overview
          </TabsTrigger>
          {selectedAgentFubId && (
            <TabsTrigger value="detail" className="text-xs flex items-center gap-1.5 text-gold font-medium">
              <ArrowLeft className="h-3 w-3" />
              Agent Detail
            </TabsTrigger>
          )}
          <TabsTrigger value="reviews" className="text-xs">
            Review Queue
            {totalOpenFlags + totalCompliance > 0 && (
              <Badge className="ml-1.5 bg-destructive text-white h-4 px-1.5 text-[10px]">
                {totalOpenFlags + totalCompliance}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rubric" className="text-xs">
            Rubric Editor
          </TabsTrigger>
          <TabsTrigger value="calibration" className="text-xs">
            Calibration Support
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: TEAM OVERVIEW
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-border/60 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Active Roster Audited
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {overviewMetrics.length} Agents
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <UserCheck className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/60 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Avg Rubric Quality
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-2xl font-bold text-gold">
                      {teamAvgRubric}
                    </p>
                    <span className="text-xs text-muted-foreground">/ 5.0</span>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-full bg-gold/15 flex items-center justify-center text-gold">
                  <Sparkles className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/60 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Open Integrity Flags
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${totalOpenFlags > 0 ? "text-amber-500" : "text-foreground"}`}>
                    {totalOpenFlags}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/60 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Compliance Risks
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${totalCompliance > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {totalCompliance}
                  </p>
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${totalCompliance > 0 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                  <ShieldAlert className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Roster Table Card */}
          <Card className="bg-card border-border/60 shadow-sm">
            <CardHeader className="p-4 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Agent Roster Performance & Integrity</CardTitle>
                <CardDescription className="text-xs">
                  Deterministic metrics computed strictly in PostgreSQL. Click an agent to drill down into conversation timelines and evidence.
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Filter agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-muted/30"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border/60 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-4">Agent Name</th>
                      <th className="py-2.5 px-4 text-center">Quality Score</th>
                      <th className="py-2.5 px-4 text-center">Open Flags</th>
                      <th className="py-2.5 px-4 text-center">Compliance</th>
                      <th className="py-2.5 px-4 text-center">Short Calls (&le;10s)</th>
                      <th className="py-2.5 px-4 text-center">Leads Graded</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {isLoadingOverview ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted-foreground">
                          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-gold" />
                          Loading SQL metrics...
                        </td>
                      </tr>
                    ) : filteredMetrics.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted-foreground">
                          No agents found matching "{searchQuery}".
                        </td>
                      </tr>
                    ) : (
                      filteredMetrics.map((agent) => (
                        <tr
                          key={agent.agent_fub_id}
                          className="hover:bg-muted/30 transition-colors cursor-pointer group"
                          onClick={() => setSelectedAgentFubId(agent.agent_fub_id)}
                        >
                          <td className="py-3 px-4 font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              <span>{agent.agent_name}</span>
                              <a
                                href={`https://app.followupboss.com/2/users/${agent.agent_fub_id}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-muted-foreground hover:text-gold transition-colors opacity-0 group-hover:opacity-100"
                                title="Open FUB Profile"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {agent.avg_rubric_score > 0 ? (
                              <Badge className="bg-gold/15 text-gold border-gold/30 font-semibold">
                                {agent.avg_rubric_score} / 5.0
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">Not graded</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {agent.open_integrity_flags_count > 0 ? (
                              <Badge variant="outline" className="border-amber-500/40 text-amber-500 bg-amber-500/10">
                                {agent.open_integrity_flags_count} flag{agent.open_integrity_flags_count > 1 ? "s" : ""}
                              </Badge>
                            ) : (
                              <span className="text-emerald-500 font-medium text-xs">Clean</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {agent.compliance_flags_count > 0 ? (
                              <Badge variant="destructive" className="font-semibold">
                                {agent.compliance_flags_count} issue{agent.compliance_flags_count > 1 ? "s" : ""}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">None</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={agent.short_calls_pct > 25 ? "text-amber-500 font-semibold" : "text-foreground"}>
                              {agent.short_calls_pct}%
                            </span>
                            <span className="text-muted-foreground text-[11px] ml-1">
                              ({agent.total_short_calls}/{agent.total_calls})
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-muted-foreground">
                            {agent.leads_graded_count}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-border/80"
                                onClick={() => handleStartSampling(agent)}
                              >
                                <Play className="h-3 w-3 mr-1 text-gold" />
                                Grade Sample
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setSelectedAgentFubId(agent.agent_fub_id)}
                              >
                                Detail
                                <ChevronRight className="h-3 w-3 ml-1" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: AGENT DETAIL DRILLDOWN
        ══════════════════════════════════════════════════════════════════════ */}
        {selectedAgentFubId && (
          <TabsContent value="detail" className="space-y-6">
            <div className="flex items-center justify-between bg-card border border-border/60 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedAgentFubId(null)}
                  className="h-8 border-border/80"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  Back to Roster
                </Button>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {agentDetail?.agent?.name || "Agent Detail"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {agentDetail?.agent?.email || "No email"} &bull; FUB ID #{selectedAgentFubId}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://app.followupboss.com/2/users/${selectedAgentFubId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-gold hover:underline flex items-center gap-1 font-medium bg-gold/10 px-3 py-1.5 rounded-md border border-gold/30"
                >
                  Open in Follow Up Boss
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                {agentDetail?.agent && (
                  <Button
                    size="sm"
                    className="bg-gold hover:bg-gold-light text-navy-dark text-xs"
                    onClick={() =>
                      handleStartSampling({
                        agent_fub_id: selectedAgentFubId,
                        agent_name: agentDetail.agent.name,
                        total_assigned_leads: 0,
                        total_calls: 0,
                        total_short_calls: 0,
                        short_calls_pct: 0,
                        total_texts: 0,
                        total_emails: 0,
                        tasks_completed: 0,
                        open_integrity_flags_count: 0,
                        compliance_flags_count: 0,
                        avg_rubric_score: 0,
                        leads_graded_count: 0,
                      })
                    }
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Sample & Grade 20 Leads
                  </Button>
                )}
              </div>
            </div>

            {isLoadingDetail ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gold" />
                Loading agent audit records and evidence...
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Integrity Flags Section */}
                <Card className="bg-card border-border/60">
                  <CardHeader className="p-4 pb-2 border-b border-border/40">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Data-Integrity Flags & Process Violations ({agentDetail?.flags?.length || 0})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Flagged by SQL integrity rules (short calls, completed tasks with no contact, stage jumps, etc.). Overrides are tracked.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 divide-y divide-border/40">
                    {!agentDetail?.flags || agentDetail.flags.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        No integrity flags recorded for this agent.
                      </p>
                    ) : (
                      agentDetail.flags.map((flag: AuditIntegrityFlag) => (
                        <div key={flag.id} className="py-3 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-start justify-between gap-3">
                          <div className="space-y-1 max-w-2xl">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={flag.severity === "high" ? "destructive" : "outline"}
                                className="text-[10px] uppercase tracking-wider"
                              >
                                {flag.severity}
                              </Badge>
                              <span className="font-semibold text-xs text-foreground">{flag.title}</span>
                              <Badge className="bg-muted text-muted-foreground text-[10px]">
                                {flag.status}
                              </Badge>
                              {flag.human_override_status !== "pending" && (
                                <Badge className="bg-primary/15 text-primary text-[10px]">
                                  Human: {flag.human_override_status}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{flag.description}</p>
                            {flag.evidence_summary && (
                              <p className="text-[11px] font-mono text-gold/90 bg-muted/40 p-1.5 rounded">
                                Evidence: {flag.evidence_summary}
                              </p>
                            )}
                            {flag.lead_fub_id && (
                              <a
                                href={getFubLeadUrl(flag.lead_fub_id)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-gold hover:underline mt-1"
                              >
                                View Lead in FUB #{flag.lead_fub_id}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                              onClick={() => handleSaveFlagReview(flag.id, "confirmed", "agreed")}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-muted-foreground/40 text-muted-foreground hover:bg-muted"
                              onClick={() => handleSaveFlagReview(flag.id, "dismissed", "disagreed")}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* 2. Compliance Risks Section */}
                {agentDetail?.complianceFlags && agentDetail.complianceFlags.length > 0 && (
                  <Card className="border-destructive/40 bg-destructive/5">
                    <CardHeader className="p-4 pb-2 border-b border-destructive/20">
                      <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4" />
                        Compliance Concerns Flagged by Claude ({agentDetail.complianceFlags.length})
                      </CardTitle>
                      <CardDescription className="text-xs text-destructive/80">
                        Fair Housing, pricing promises, or steering. These are NEVER scored and require direct leadership review.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {agentDetail.complianceFlags.map((comp: AuditComplianceFlag) => (
                        <div key={comp.id} className="bg-background border border-destructive/30 rounded p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive" className="text-[10px] uppercase">
                                {comp.flag_type.replace("_", " ")}
                              </Badge>
                              <span className="text-xs font-semibold text-foreground">
                                Quoted Violation:
                              </span>
                            </div>
                            <p className="text-xs italic font-serif text-foreground mt-1 bg-destructive/10 p-2 rounded border border-destructive/20">
                              "{comp.exact_language}"
                            </p>
                            <a
                              href={getFubLeadUrl(comp.person_fub_id)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-gold hover:underline mt-1"
                            >
                              View Lead #{comp.person_fub_id} in FUB
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs"
                              onClick={() => handleSaveComplianceReview(comp.id, "confirmed")}
                            >
                              Confirm Risk
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleSaveComplianceReview(comp.id, "dismissed")}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* 3. Sampled Graded Leads Section */}
                <Card className="bg-card border-border/60">
                  <CardHeader className="p-4 pb-2 border-b border-border/40">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-gold" />
                      Claude Graded Sample Leads ({agentDetail?.sampledLeads?.length || 0})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Randomly sampled leads graded against the rubric. Citations and excerpts are verified.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {!agentDetail?.sampledLeads || agentDetail.sampledLeads.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-xs">
                        No leads have been graded yet. Click "Sample & Grade 20 Leads" above to run an audit.
                      </div>
                    ) : (
                      agentDetail.sampledLeads.map((sl: AuditSampledLead) => (
                        <div key={sl.id} className="border border-border/60 rounded-lg p-4 bg-muted/10 space-y-3">
                          <div className="flex items-center justify-between border-b border-border/40 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-foreground">
                                Lead #{sl.person_fub_id}
                              </span>
                              <a
                                href={sl.lead_url || getFubLeadUrl(sl.person_fub_id)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-gold text-xs hover:underline flex items-center gap-1"
                              >
                                FUB Deep Link <ExternalLink className="h-3 w-3" />
                              </a>
                              <Badge className="bg-muted text-muted-foreground text-[10px]">
                                Month: {sl.audit_month}
                              </Badge>
                            </div>
                            <div>
                              {sl.overall_score ? (
                                <Badge className="bg-gold/15 text-gold border-gold/30 font-bold text-xs">
                                  Lead Score: {sl.overall_score} / 5.0
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  {sl.grading_status}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Criterion breakdown */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            {(sl.grades ?? []).map((grade) => (
                              <div key={grade.id} className="bg-card p-3 rounded border border-border/50 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-foreground">
                                    {grade.criterion_key.replace(/_/g, " ")}
                                  </span>
                                  {grade.insufficient_evidence ? (
                                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                      Insufficient Evidence
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-gold/15 text-gold border-gold/30 font-bold text-xs">
                                      {grade.human_override_score !== null && grade.human_override_score !== undefined
                                        ? `${grade.human_override_score} (Override)`
                                        : `${grade.score} / 5`}
                                    </Badge>
                                  )}
                                </div>
                                {grade.reasoning && (
                                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                                    {grade.reasoning}
                                  </p>
                                )}
                                {grade.excerpt && (
                                  <p className="text-[11px] font-mono italic text-gold/90 bg-muted/40 p-1 rounded">
                                    Snippet: "{grade.excerpt}"
                                  </p>
                                )}

                                {/* Admin score override controls */}
                                <div className="pt-1.5 flex items-center gap-1 border-t border-border/30">
                                  <span className="text-[10px] text-muted-foreground">Override:</span>
                                  {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                      key={val}
                                      type="button"
                                      className={`h-5 w-5 rounded text-[10px] font-semibold border ${
                                        (grade.human_override_score ?? grade.score) === val
                                          ? "bg-gold text-navy-dark border-gold"
                                          : "border-border/60 hover:bg-muted"
                                      }`}
                                      onClick={() => handleSaveGradeOverride(grade.id, val)}
                                    >
                                      {val}
                                    </button>
                                  ))}
                                  {grade.human_override_score !== null && (
                                    <button
                                      type="button"
                                      className="text-[10px] text-muted-foreground hover:text-foreground ml-1"
                                      onClick={() => handleSaveGradeOverride(grade.id, null)}
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 3: REVIEW QUEUE
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="reviews" className="space-y-6">
          <Card className="bg-card border-border/60 shadow-sm">
            <CardHeader className="p-4 pb-2 border-b border-border/40">
              <CardTitle className="text-base font-semibold">Leadership Review Queue</CardTitle>
              <CardDescription className="text-xs">
                Nothing is final until a human approves it. Review open flags and grades requiring sign-off.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                All open integrity flags and compliance risks appear here. Use the buttons to Agree / Disagree or provide coaching notes.
              </p>
              <div className="mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleScanIntegrityFlags}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1.5" />
                  Refresh Pending Queue
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 4: RUBRIC EDITOR
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="rubric" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Audit Rubric Criteria</h2>
              <p className="text-xs text-muted-foreground">
                Define the criteria, weights, and 1/3/5 anchor definitions used by Claude to grade agent lead interactions.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-gold hover:bg-gold-light text-navy-dark text-xs"
              onClick={() => {
                setEditingCriterion({
                  key: "",
                  name: "",
                  category: "Conversation Quality",
                  weight: 1.0,
                  anchor_1: "",
                  anchor_3: "",
                  anchor_5: "",
                  is_active: true,
                  sort_order: rubricCriteria.length + 1,
                });
                setShowCriterionModal(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Rubric Criterion
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rubricCriteria.map((c) => (
              <Card key={c.id} className="bg-card border-border/60 shadow-sm flex flex-col justify-between">
                <CardHeader className="p-4 pb-2 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] text-gold border-gold/30">
                      {c.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      Weight: {c.weight}x
                    </span>
                  </div>
                  <CardTitle className="text-sm font-semibold mt-1">{c.name}</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Key: <code>{c.key}</code>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-2.5 text-xs">
                  {c.description && <p className="text-foreground/90">{c.description}</p>}
                  <div className="space-y-1.5 bg-muted/30 p-2.5 rounded border border-border/40 text-[11px]">
                    <div>
                      <strong className="text-destructive font-semibold">1 (Unacceptable):</strong> {c.anchor_1}
                    </div>
                    <div>
                      <strong className="text-amber-500 font-semibold">3 (Standard):</strong> {c.anchor_3}
                    </div>
                    <div>
                      <strong className="text-emerald-500 font-semibold">5 (Exemplary):</strong> {c.anchor_5}
                    </div>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-border/80"
                      onClick={() => {
                        setEditingCriterion(c);
                        setShowCriterionModal(true);
                      }}
                    >
                      <Sliders className="h-3 w-3 mr-1" />
                      Edit Anchors
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 5: CALIBRATION SUPPORT
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="calibration" className="space-y-6">
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Calibration Support Engine</h2>
              <p className="text-xs text-muted-foreground">
                Validate agreement between human grades and Claude before running monthly audits. Re-run whenever prompt or rubric changes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-border/80"
                onClick={() => setShowNewCalSetModal(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                New Calibration Set
              </Button>
              <Button
                size="sm"
                className="bg-gold hover:bg-gold-light text-navy-dark text-xs"
                onClick={handleRunCalibrationTest}
                disabled={calibrationLeads.length === 0}
              >
                <Play className="h-3 w-3 mr-1" />
                Run Claude Evaluation
              </Button>
            </div>
          </div>

          {/* Set Selector */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-muted-foreground">Active Calibration Set:</span>
            <Select
              value={selectedCalibrationSetId || ""}
              onValueChange={(val) => setSelectedCalibrationSetId(val)}
            >
              <SelectTrigger className="w-72 h-8 text-xs bg-muted/30">
                <SelectValue placeholder="Choose a calibration set" />
              </SelectTrigger>
              <SelectContent>
                {calibrationSets.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name} ({s.leads_count ?? 0} leads)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-border/80"
              onClick={() => setShowAddCalLeadModal(true)}
              disabled={!selectedCalibrationSetId}
            >
              <Plus className="h-3 w-3 mr-1 text-gold" />
              Add Benchmark Lead
            </Button>
          </div>

          {/* Benchmark Leads Table & Agreement */}
          <Card className="bg-card border-border/60">
            <CardHeader className="p-4 pb-2 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Scale className="h-4 w-4 text-gold" />
                Benchmark Agreement Matrix
              </CardTitle>
              <CardDescription className="text-xs">
                Compares Human Gold Standard scores with Claude scores per criterion. Exact match and within-1-point rates are computed automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {calibrationLeads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  No benchmark leads in this calibration set. Click "Add Benchmark Lead" to import a lead from Follow Up Boss.
                </div>
              ) : (
                calibrationLeads.map((lead) => (
                  <div key={lead.id} className="border border-border/60 rounded-lg p-3 space-y-2 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <span>{lead.lead_name || `Lead #${lead.person_fub_id}`}</span>
                        <a
                          href={getFubLeadUrl(lead.person_fub_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gold hover:underline flex items-center gap-1 font-normal text-[11px]"
                        >
                          FUB #{lead.person_fub_id} <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {lead.timeline_json?.length || 0} activities in timeline
                      </span>
                    </div>

                    {/* Grades comparison table */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-1">
                      {rubricCriteria.map((c) => {
                        const gradeMatch = (lead.grades ?? []).find((g) => g.criterion_id === c.id);
                        return (
                          <div key={c.id} className="bg-card p-2.5 rounded border border-border/40 flex items-center justify-between">
                            <div>
                              <span className="font-medium text-foreground">{c.name}</span>
                              <div className="text-[11px] text-muted-foreground">
                                Human: <strong className="text-foreground">{gradeMatch?.human_score ?? "Unset"}</strong> | Claude: <strong className="text-gold">{gradeMatch?.claude_score ?? "Pending"}</strong>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((val) => (
                                <button
                                  key={val}
                                  type="button"
                                  className={`h-5 w-5 rounded text-[10px] font-semibold border ${
                                    gradeMatch?.human_score === val
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "border-border/60 hover:bg-muted"
                                  }`}
                                  onClick={async () => {
                                    await saveCalibrationHumanGrade({
                                      data: {
                                        calibrationLeadId: lead.id,
                                        criterionId: c.id,
                                        criterionKey: c.key,
                                        humanScore: val,
                                      },
                                    });
                                    toast.success(`Set ${c.name} human score to ${val}`);
                                    const leads = await getCalibrationLeadDetail({
                                      data: { setId: selectedCalibrationSetId! },
                                    });
                                    setCalibrationLeads(leads as any);
                                  }}
                                >
                                  {val}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog: Send Monthly Email ──────────────────────────────────────── */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Email Monthly Audit Report</DialogTitle>
            <DialogDescription>
              Dispatches the monthly team performance rollup via our Google Workspace / Gmail API integration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="font-semibold text-foreground">Recipient Email</label>
              <Input
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="name@mattsmithrealestategroup.com"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-foreground">Audit Month (YYYY-MM)</label>
              <Input
                value={emailMonth}
                onChange={(e) => setEmailMonth(e.target.value)}
                placeholder="2026-09"
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowEmailModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSendMonthlyReport}
              disabled={isSendingEmail}
              className="bg-gold hover:bg-gold-light text-navy-dark font-medium"
            >
              {isSendingEmail ? "Sending..." : "Send Report via Gmail"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Run Claude Sampling ─────────────────────────────────────── */}
      <Dialog open={showSamplingModal} onOpenChange={setShowSamplingModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sample & Grade Leads for {sampleTargetAgent?.agent_name}</DialogTitle>
            <DialogDescription>
              Randomly samples leads assigned to this agent, anonymizes the agent name as "Agent A", and evaluates chronological timelines against the rubric.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="rounded-md bg-muted/40 p-3 border border-border/60 space-y-1.5">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Active Leads in Scope:</span>
                <Badge variant="outline" className="text-foreground font-semibold text-xs">
                  {sampleTargetAgent?.total_assigned_leads ?? 0} leads
                </Badge>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Evaluation Model:</span>
                <span className="font-mono text-gold text-[11px] font-medium">claude-sonnet-5</span>
              </div>
            </div>

            <div>
              <label className="font-semibold text-foreground">Sample Size (leads to grade)</label>
              <Input
                type="number"
                min={1}
                max={50}
                value={sampleSize}
                onChange={(e) => setSampleSize(Math.max(1, Number(e.target.value)))}
                className="mt-1 text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Claude reviews communication threads (calls, notes, texts) and evaluates compliance and conversational quality.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowSamplingModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteSampling}
              disabled={isGrading}
              className="bg-gold hover:bg-gold-light text-navy-dark font-medium"
            >
              {isGrading ? "Grading..." : "Start Grading"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Rubric Criterion Edit ───────────────────────────────────── */}
      <Dialog open={showCriterionModal} onOpenChange={setShowCriterionModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCriterion.id ? "Edit Rubric Criterion" : "New Rubric Criterion"}</DialogTitle>
            <DialogDescription>
              Anchors define the expectations for 1, 3, and 5 scores. Claude reads these anchors verbatim to evaluate conversations.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveRubricCriterion} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-foreground">Criterion Name</label>
                <Input
                  value={editingCriterion.name || ""}
                  onChange={(e) => setEditingCriterion({ ...editingCriterion, name: e.target.value })}
                  placeholder="e.g. Needs Discovery"
                  className="mt-1 text-xs"
                  required
                />
              </div>
              <div>
                <label className="font-semibold text-foreground">Key Identifier</label>
                <Input
                  value={editingCriterion.key || ""}
                  onChange={(e) => setEditingCriterion({ ...editingCriterion, key: e.target.value })}
                  placeholder="e.g. needs_discovery"
                  className="mt-1 text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-foreground">Category</label>
              <Input
                value={editingCriterion.category || "Conversation Quality"}
                onChange={(e) => setEditingCriterion({ ...editingCriterion, category: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-destructive">Anchor 1 (Unacceptable / Detrimental)</label>
              <Textarea
                rows={2}
                value={editingCriterion.anchor_1 || ""}
                onChange={(e) => setEditingCriterion({ ...editingCriterion, anchor_1: e.target.value })}
                placeholder="What constitutes a failure on this metric?"
                className="mt-1 text-xs"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-amber-500">Anchor 3 (Standard / Acceptable Competency)</label>
              <Textarea
                rows={2}
                value={editingCriterion.anchor_3 || ""}
                onChange={(e) => setEditingCriterion({ ...editingCriterion, anchor_3: e.target.value })}
                placeholder="What is standard baseline performance?"
                className="mt-1 text-xs"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-emerald-500">Anchor 5 (Exemplary / World-Class)</label>
              <Textarea
                rows={2}
                value={editingCriterion.anchor_5 || ""}
                onChange={(e) => setEditingCriterion({ ...editingCriterion, anchor_5: e.target.value })}
                placeholder="What does mastery look like?"
                className="mt-1 text-xs"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowCriterionModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-gold hover:bg-gold-light text-navy-dark font-medium">
                Save Criterion
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Add Lead to Calibration ─────────────────────────────────── */}
      <Dialog open={showAddCalLeadModal} onOpenChange={setShowAddCalLeadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Benchmark Lead to Calibration Set</DialogTitle>
            <DialogDescription>
              Enter the Follow Up Boss Person ID. The timeline will be imported and prepared for calibration benchmarking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-semibold text-foreground">FUB Person ID</label>
              <Input
                value={calLeadPersonId}
                onChange={(e) => setCalLeadPersonId(e.target.value)}
                placeholder="e.g. 123456"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-foreground">Notes / Context for Human Evaluators</label>
              <Textarea
                rows={2}
                value={calLeadNotes}
                onChange={(e) => setCalLeadNotes(e.target.value)}
                placeholder="e.g. Gold standard example of objection handling"
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddCalLeadModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddCalibrationLead} className="bg-gold hover:bg-gold-light text-navy-dark">
              Import Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: New Calibration Set ─────────────────────────────────────── */}
      <Dialog open={showNewCalSetModal} onOpenChange={setShowNewCalSetModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Calibration Set</DialogTitle>
            <DialogDescription>
              A calibration set holds reference leads with human-evaluated scores to benchmark LLM accuracy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-semibold text-foreground">Set Name</label>
              <Input
                value={newCalSetName}
                onChange={(e) => setNewCalSetName(e.target.value)}
                placeholder="e.g. Q3 2026 Core Benchmark Set"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-foreground">Description</label>
              <Textarea
                rows={2}
                value={newCalSetDesc}
                onChange={(e) => setNewCalSetDesc(e.target.value)}
                placeholder="Description and objective of this calibration set"
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowNewCalSetModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!newCalSetName) return;
                try {
                  const res = await upsertCalibrationSet({
                    data: { name: newCalSetName, description: newCalSetDesc },
                  });
                  toast.success("Calibration set created");
                  setShowNewCalSetModal(false);
                  setNewCalSetName("");
                  setNewCalSetDesc("");
                  loadCalibrationSets();
                  setSelectedCalibrationSetId(res.id);
                } catch (err: any) {
                  toast.error(`Failed: ${err.message}`);
                }
              }}
              className="bg-gold hover:bg-gold-light text-navy-dark"
            >
              Create Set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
