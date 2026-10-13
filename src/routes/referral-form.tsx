import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Send,
  CheckCircle2,
  ChevronLeft,
  User,
  Phone,
  Mail,
  Home,
  Clock,
  MapPin,
  DollarSign,
  Building2,
  FileText,
  Sparkles,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  Check,
  Copy,
  Briefcase,
  Compass,
  BadgeCheck,
  Info,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useAgentAuth } from "@/hooks/use-agent-auth";
import { submitOutboundReferral, type SubmitOutboundReferralInput } from "@/lib/referrals.functions";
import logo from "@/assets/msreg-logo.png";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/referral-form")({
  ssr: false,
  component: OutboundReferralPage,
  head: () => ({
    meta: [
      { title: "Outbound Referral Sheet — MSREG Hub" },
      { name: "description", content: "Submit outbound referral information sheet to Client Care (Nancy)." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const TIMELINE_PRESETS = [
  { label: "Immediate (< 30 Days)", desc: "Ready now" },
  { label: "30 – 60 Days", desc: "Active window" },
  { label: "60 – 90 Days", desc: "Planning phase" },
  { label: "3 – 6 Months", desc: "Upcoming" },
  { label: "6+ Months / Long Term", desc: "Nurturing" },
];

function OutboundReferralPage() {
  const { user } = useAuth();
  const { agent } = useAgentAuth();
  const submitFn = useServerFn(submitOutboundReferral);

  // Form State
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [transactionType, setTransactionType] = useState<"buying" | "selling" | "both">("buying");
  const [timeline, setTimeline] = useState("");

  // Conditional fields
  const [buyingArea, setBuyingArea] = useState("");
  const [buyingBudget, setBuyingBudget] = useState("");
  const [buyingCriteria, setBuyingCriteria] = useState("");
  const [sellingAddress, setSellingAddress] = useState("");

  // Brokerage & Agent
  const [assignedAgent, setAssignedAgent] = useState("");
  const [brokerAddress, setBrokerAddress] = useState("");
  const [brokerEmail, setBrokerEmail] = useState("");
  const [brokerPhone, setBrokerPhone] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<SubmitOutboundReferralInput | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Auto-fill agent details if signed in
  useEffect(() => {
    if (agent?.full_name && !agentName) {
      setAgentName(agent.full_name);
    }
    if (agent?.email && !agentEmail) {
      setAgentEmail(agent.email);
    } else if (user?.email && !agentEmail) {
      setAgentEmail(user.email);
    }
  }, [agent, user]);

  const isBuying = transactionType === "buying" || transactionType === "both";
  const isSelling = transactionType === "selling" || transactionType === "both";

  // Form completion progress
  const completion = useMemo(() => {
    let score = 0;
    const total = 4;
    if (agentName.trim()) score++;
    if (clientName.trim()) score++;
    if (clientPhone.trim()) score++;
    if (timeline.trim()) score++;
    return { score, total, percentage: Math.round((score / total) * 100) };
  }, [agentName, clientName, clientPhone, timeline]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!agentName.trim()) {
      toast.error("Please enter the Agent Name.");
      return;
    }
    if (!clientName.trim()) {
      toast.error("Please enter the Client Name.");
      return;
    }
    if (!clientPhone.trim()) {
      toast.error("Please enter the Client Phone Number.");
      return;
    }
    if (!timeline.trim()) {
      toast.error("Please provide an expected timeline.");
      return;
    }

    const payload: SubmitOutboundReferralInput = {
      agent_name: agentName.trim(),
      agent_email: agentEmail.trim() || undefined,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim(),
      client_email: clientEmail.trim() || undefined,
      transaction_type: transactionType,
      timeline: timeline.trim(),
      buying_area: isBuying ? buyingArea.trim() || undefined : undefined,
      buying_budget: isBuying ? buyingBudget.trim() || undefined : undefined,
      buying_criteria: isBuying ? buyingCriteria.trim() || undefined : undefined,
      selling_address: isSelling ? sellingAddress.trim() || undefined : undefined,
      assigned_agent: assignedAgent.trim() || undefined,
      broker_address: brokerAddress.trim() || undefined,
      broker_email: brokerEmail.trim() || undefined,
      broker_phone: brokerPhone.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    setIsSubmitting(true);
    try {
      const res = await submitFn({ data: payload });
      if (res.ok) {
        setSubmittedData(payload);
        setSubmittedId(res.id);
        toast.success("Outbound referral submitted! Nancy has been notified via email.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err: any) {
      console.error("Submission failed:", err);
      toast.error(err.message || "Could not submit referral. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setTimeline("");
    setBuyingArea("");
    setBuyingBudget("");
    setBuyingCriteria("");
    setSellingAddress("");
    setAssignedAgent("");
    setBrokerAddress("");
    setBrokerEmail("");
    setBrokerPhone("");
    setNotes("");
    setSubmittedData(null);
    setSubmittedId(null);
    setCopiedSummary(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copyReceiptSummary = async () => {
    if (!submittedData) return;
    const text = [
      `MSREG OUTBOUND REFERRAL: ${submittedData.client_name}`,
      `Referring Agent: ${submittedData.agent_name} (${submittedData.agent_email || "N/A"})`,
      `Client Phone: ${submittedData.client_phone}`,
      `Client Email: ${submittedData.client_email || "N/A"}`,
      `Transaction: ${submittedData.transaction_type.toUpperCase()}`,
      `Expected Timeline: ${submittedData.timeline}`,
      submittedData.buying_area ? `Target Area: ${submittedData.buying_area}` : null,
      submittedData.buying_budget ? `Budget: ${submittedData.buying_budget}` : null,
      submittedData.buying_criteria ? `Wishlist: ${submittedData.buying_criteria}` : null,
      submittedData.selling_address ? `Selling Address: ${submittedData.selling_address}` : null,
      submittedData.assigned_agent ? `Destination Agent: ${submittedData.assigned_agent}` : null,
      submittedData.broker_address ? `Broker Address: ${submittedData.broker_address}` : null,
      submittedData.notes ? `Notes: ${submittedData.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      toast.success("Referral summary copied to clipboard");
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      toast.error("Could not copy summary");
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col selection:bg-accent/25 selection:text-text-primary">
      {/* Header Chrome */}
      <header className="border-b border-border/70 bg-surface-1/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors py-1.5 px-2.5 rounded-lg hover:bg-surface-2 border border-transparent hover:border-border/60"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="font-medium hidden sm:inline">Back to Hub</span>
            </Link>
            <div className="h-4 w-px bg-border/60" />
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="MSREG Logo" className="h-7 w-auto object-contain" />
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs tracking-wider uppercase text-text-primary">
                  The Hub
                </span>
                <span className="text-text-muted text-xs">/</span>
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                  Client Care
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2/90 border border-border/80 text-[11px] text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Direct Desk: Nancy</span>
            </div>
            <Link
              to="/admin/referrals"
              className="text-xs text-text-muted hover:text-text-primary transition-colors font-medium hover:underline hidden md:inline"
            >
              View Referrals Desk
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        {submittedData ? (
          /* =========================================================
             CONFIRMATION / RECEIPT SCREEN
             ========================================================= */
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in-50 duration-300">
            {/* Top Celebratory Banner */}
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 via-surface-1 to-surface-1 p-8 sm:p-10 text-center space-y-4 shadow-xl shadow-black/40 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
              <div className="h-16 w-16 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="h-9 w-9 stroke-[2]" />
              </div>

              <div className="space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
                  Referral Successfully Dispatched
                </h1>
                <p className="text-sm text-text-secondary max-w-lg mx-auto leading-relaxed">
                  Nancy at Client Care (
                  <span className="text-emerald-400 font-medium">nancy@mattsmithrealestategroup.com</span>
                  ) has received an email with the complete client and transaction specifications to begin
                  outreach.
                </p>
              </div>

              {/* Step indicator */}
              <div className="pt-4 max-w-md mx-auto grid grid-cols-3 gap-2 text-[11px] text-text-muted">
                <div className="p-2 rounded-lg bg-surface-2/60 border border-border/60 text-center">
                  <span className="block font-semibold text-text-primary">1. Submitted</span>
                  <span className="text-emerald-400 text-[10px]">Completed</span>
                </div>
                <div className="p-2 rounded-lg bg-surface-2/60 border border-border/60 text-center">
                  <span className="block font-semibold text-text-primary">2. Outreach</span>
                  <span className="text-accent text-[10px]">Nancy notified</span>
                </div>
                <div className="p-2 rounded-lg bg-surface-2/60 border border-border/60 text-center">
                  <span className="block font-semibold text-text-primary">3. Agreement</span>
                  <span className="text-text-muted text-[10px]">Coordinated</span>
                </div>
              </div>
            </div>

            {/* Dossier Summary Receipt */}
            <div className="rounded-2xl border border-border bg-surface-1 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border/80 bg-surface-2/40 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                    Official Submission Record
                  </span>
                  <h2 className="text-lg font-bold text-text-primary">{submittedData.client_name}</h2>
                  <p className="text-xs text-text-muted">
                    Submitted by {submittedData.agent_name} &bull; ID:{" "}
                    <code className="text-text-secondary">{submittedId?.slice(0, 8) || "Recorded"}</code>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyReceiptSummary}
                    className="gap-1.5 text-xs border-border"
                  >
                    {copiedSummary ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedSummary ? "Copied" : "Copy for FUB"}</span>
                  </Button>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-6 text-xs">
                {/* Contact Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-border/60">
                  <div className="space-y-2">
                    <span className="font-semibold text-text-muted uppercase tracking-wider text-[10px]">
                      Client Contact
                    </span>
                    <p className="text-base font-bold text-text-primary">{submittedData.client_name}</p>
                    <p className="text-text-secondary flex items-center gap-1.5 font-medium">
                      <Phone className="h-3.5 w-3.5 text-text-muted" />
                      <span>{submittedData.client_phone}</span>
                    </p>
                    {submittedData.client_email && (
                      <p className="text-text-secondary flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-text-muted" />
                        <span>{submittedData.client_email}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <span className="font-semibold text-text-muted uppercase tracking-wider text-[10px]">
                      Transaction Route & Scope
                    </span>
                    <div>
                      <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-surface-2 border border-border text-text-primary">
                        {submittedData.transaction_type === "both"
                          ? "Dual: Buying & Selling"
                          : submittedData.transaction_type}
                      </span>
                    </div>
                    <p className="text-text-secondary">
                      <span className="text-text-muted">Target Timeline:</span>{" "}
                      <strong className="text-text-primary font-medium">{submittedData.timeline}</strong>
                    </p>
                  </div>
                </div>

                {/* Property & Specs */}
                {(submittedData.buying_area ||
                  submittedData.buying_budget ||
                  submittedData.selling_address ||
                  submittedData.buying_criteria) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-border/60">
                    {submittedData.buying_area && (
                      <div>
                        <span className="font-semibold text-text-muted uppercase tracking-wider text-[10px]">
                          Target Destination Market
                        </span>
                        <p className="text-sm font-semibold text-text-primary mt-1">
                          {submittedData.buying_area}
                        </p>
                      </div>
                    )}
                    {submittedData.buying_budget && (
                      <div>
                        <span className="font-semibold text-text-muted uppercase tracking-wider text-[10px]">
                          Purchase Budget
                        </span>
                        <p className="text-sm font-semibold text-text-primary mt-1">
                          {submittedData.buying_budget}
                        </p>
                      </div>
                    )}
                    {submittedData.selling_address && (
                      <div className="sm:col-span-2">
                        <span className="font-semibold text-text-muted uppercase tracking-wider text-[10px]">
                          Current Address Being Sold
                        </span>
                        <p className="text-sm font-semibold text-text-primary mt-1">
                          {submittedData.selling_address}
                        </p>
                      </div>
                    )}
                    {submittedData.buying_criteria && (
                      <div className="sm:col-span-2 space-y-1">
                        <span className="font-semibold text-text-muted uppercase tracking-wider text-[10px]">
                          Property Wishlist & Specifics
                        </span>
                        <p className="text-text-secondary bg-surface-2/60 p-3 rounded-lg border border-border/60 leading-relaxed whitespace-pre-wrap">
                          {submittedData.buying_criteria}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Brokerage & Notes */}
                {(submittedData.assigned_agent ||
                  submittedData.broker_address ||
                  submittedData.broker_email ||
                  submittedData.notes) && (
                  <div className="space-y-4">
                    {submittedData.assigned_agent && (
                      <div>
                        <span className="font-semibold text-text-muted uppercase tracking-wider text-[10px]">
                          Destination Agent & Broker
                        </span>
                        <p className="text-sm font-medium text-text-primary mt-1">
                          {submittedData.assigned_agent}{" "}
                          {submittedData.broker_address && `(${submittedData.broker_address})`}
                        </p>
                      </div>
                    )}

                    {submittedData.notes && (
                      <div>
                        <span className="font-semibold text-text-muted uppercase tracking-wider text-[10px]">
                          Special Instructions & Notes
                        </span>
                        <p className="text-text-secondary bg-surface-2/60 p-3 rounded-lg border border-border/60 leading-relaxed whitespace-pre-wrap mt-1">
                          {submittedData.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full sm:w-auto gap-2 border-border/80 h-11 px-5 text-xs font-semibold"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Submit Another Referral</span>
              </Button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Link to="/admin/referrals" className="w-full sm:w-auto">
                  <Button variant="secondary" className="w-full sm:w-auto h-11 px-5 text-xs font-semibold">
                    Referrals Desk
                  </Button>
                </Link>
                <Link to="/dashboard" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto bg-accent hover:bg-accent-hover text-white font-semibold h-11 px-6 text-xs gap-2">
                    <span>Back to Hub</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================
             MAIN EXECUTIVE REFERRAL WORKSPACE (2-COLUMN DESKTOP)
             ========================================================= */
          <div className="space-y-8">
            {/* Top Workspace Header */}
            <div className="border-b border-border/70 pb-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2 max-w-2xl">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-text-primary">
                    Outbound Referral Information Sheet
                  </h1>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Submit client details directly to Client Care. Nancy will be notified immediately to
                    execute destination broker outreach, referral fee agreements, and ensure seamless client
                    placement.
                  </p>
                </div>

                {/* Live Completion & Meta Pills */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-1 border border-border/80 text-xs">
                    <span className="text-text-muted">Required:</span>
                    <span className="font-bold text-accent">
                      {completion.score} of {completion.total}
                    </span>
                    <div className="w-12 h-1.5 bg-surface-2 rounded-full overflow-hidden ml-1">
                      <div
                        className="h-full bg-accent transition-all duration-300"
                        style={{ width: `${completion.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Asymmetric 2-Column Desktop Grid */}
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
                {/* ── LEFT COLUMN: MAIN WORKSPACE FORM (8 COLUMNS) ── */}
                <div className="lg:col-span-8 space-y-8">
                  {/* Panel 1: Parties & Contact Information */}
                  <div className="rounded-2xl border border-border bg-surface-1 p-6 sm:p-8 space-y-6 shadow-sm">
                    <div className="flex items-center justify-between pb-4 border-b border-border/60">
                      <div>
                        <h2 className="text-base font-bold text-text-primary">
                          Agent & Client Representation
                        </h2>
                        <p className="text-xs text-text-muted mt-0.5">
                          Who is referring this client and who is the client?
                        </p>
                      </div>
                      <span className="text-[11px] text-text-muted font-mono">* Required fields</span>
                    </div>

                    {/* Agent Identification */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="agent-name" className="text-xs font-semibold text-text-primary">
                          Referring Agent Name <span className="text-accent">*</span>
                        </Label>
                        <Input
                          id="agent-name"
                          required
                          placeholder="Your First & Last Name"
                          value={agentName}
                          onChange={(e) => setAgentName(e.target.value)}
                          className="h-11 bg-surface-2/60 border-border text-sm focus:border-accent"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="agent-email" className="text-xs font-semibold text-text-secondary">
                          Referring Agent Email{" "}
                          <span className="text-[10px] text-text-muted">(for dispatch copy)</span>
                        </Label>
                        <Input
                          id="agent-email"
                          type="email"
                          placeholder="agent@mattsmithrealestategroup.com"
                          value={agentEmail}
                          onChange={(e) => setAgentEmail(e.target.value)}
                          className="h-11 bg-surface-2/60 border-border text-sm focus:border-accent"
                        />
                      </div>
                    </div>

                    <div className="h-px bg-border/40" />

                    {/* Client Identification */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label htmlFor="client-name" className="text-xs font-semibold text-text-primary">
                            Client Name <span className="text-accent">*</span>
                          </Label>
                          <Input
                            id="client-name"
                            required
                            placeholder="Client First & Last Name"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            className="h-11 bg-surface-2/60 border-border text-sm focus:border-accent"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="client-phone" className="text-xs font-semibold text-text-primary">
                            Client Number <span className="text-accent">*</span>
                          </Label>
                          <Input
                            id="client-phone"
                            required
                            type="tel"
                            placeholder="(573) 555-0199"
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                            className="h-11 bg-surface-2/60 border-border text-sm focus:border-accent font-medium"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="client-email" className="text-xs font-semibold text-text-secondary">
                          Client Email{" "}
                          <span className="text-[10px] text-text-muted">(optional, if available)</span>
                        </Label>
                        <Input
                          id="client-email"
                          type="email"
                          placeholder="client@gmail.com"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          className="h-11 bg-surface-2/60 border-border text-sm focus:border-accent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Panel 2: Transaction Scope & Expected Timeline */}
                  <div className="rounded-2xl border border-border bg-surface-1 p-6 sm:p-8 space-y-6 shadow-sm">
                    <div className="pb-4 border-b border-border/60">
                      <h2 className="text-base font-bold text-text-primary">Transaction Scope & Timeline</h2>
                      <p className="text-xs text-text-muted mt-0.5">
                        Define client intent and urgency to target appropriate destination partner
                      </p>
                    </div>

                    {/* Segmented Switcher for Buying or Selling? */}
                    <div className="space-y-2.5">
                      <Label className="text-xs font-semibold text-text-primary">
                        Buying or Selling? <span className="text-accent">*</span>
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          {
                            key: "buying",
                            label: "Buying",
                            sub: "Destination purchase",
                            icon: Home,
                          },
                          {
                            key: "selling",
                            label: "Selling",
                            sub: "Local property listing",
                            icon: Building2,
                          },
                          {
                            key: "both",
                            label: "Both (Relocation)",
                            sub: "Sell here & buy there",
                            icon: Compass,
                          },
                        ].map((opt) => {
                          const IconComp = opt.icon;
                          const isSelected = transactionType === opt.key;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => setTransactionType(opt.key as any)}
                              className={cn(
                                "p-4 rounded-xl border text-left transition-all relative overflow-hidden group select-none flex flex-col justify-between min-h-[96px]",
                                isSelected
                                  ? "border-accent bg-accent/10 shadow-sm ring-1 ring-accent/30"
                                  : "border-border/80 bg-surface-2/40 hover:bg-surface-2 hover:border-border text-text-secondary"
                              )}
                            >
                              <div className="flex items-center justify-between w-full mb-1">
                                <IconComp
                                  className={cn(
                                    "h-5 w-5",
                                    isSelected ? "text-accent" : "text-text-muted group-hover:text-text-primary"
                                  )}
                                />
                                {isSelected && (
                                  <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                                )}
                              </div>
                              <div>
                                <span
                                  className={cn(
                                    "block text-sm font-bold",
                                    isSelected ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"
                                  )}
                                >
                                  {opt.label}
                                </span>
                                <span className="block text-[11px] text-text-muted mt-0.5">{opt.sub}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Timeline Field & Presets */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="timeline" className="text-xs font-semibold text-text-primary">
                          (Buying or selling) What is the expected timeline?{" "}
                          <span className="text-accent">*</span>
                        </Label>
                        <span className="text-[11px] text-text-muted">Click a preset or type below</span>
                      </div>

                      {/* Interactive Presets */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {TIMELINE_PRESETS.map((p) => {
                          const active = timeline === p.label;
                          return (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => setTimeline(p.label)}
                              className={cn(
                                "p-2.5 rounded-lg border text-left transition-all text-xs",
                                active
                                  ? "border-accent bg-accent/15 text-accent font-semibold shadow-xs"
                                  : "border-border/70 bg-surface-2/40 hover:bg-surface-2 text-text-secondary hover:text-text-primary"
                              )}
                            >
                              <span className="block truncate font-medium">{p.label}</span>
                              <span className="block text-[10px] text-text-muted truncate mt-0.5">
                                {p.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom input */}
                      <Input
                        id="timeline"
                        required
                        placeholder="Or type specific timeline details (e.g. Under contract, moving by July 1st)..."
                        value={timeline}
                        onChange={(e) => setTimeline(e.target.value)}
                        className="h-11 bg-surface-2/60 border-border text-sm focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Panel 3: Dynamic Buying / Destination Specifications */}
                  {isBuying && (
                    <div className="rounded-2xl border border-border bg-surface-1 p-6 sm:p-8 space-y-6 shadow-sm transition-all animate-in fade-in-50 duration-200">
                      <div className="flex items-center justify-between pb-4 border-b border-border/60">
                        <div>
                          <h2 className="text-base font-bold text-text-primary">
                            Destination Purchase Criteria
                          </h2>
                          <p className="text-xs text-text-muted mt-0.5">
                            Target area, budget, and property specifications for the destination agent
                          </p>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2.5 py-1 rounded-full border border-accent/25">
                          Buying
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* What area? */}
                        <div className="space-y-2">
                          <Label htmlFor="buying-area" className="text-xs font-semibold text-text-primary">
                            (If Buying) What area? Specific if possible.
                          </Label>
                          <Input
                            id="buying-area"
                            placeholder="e.g. Phoenix East Valley, AZ / Tampa, FL"
                            value={buyingArea}
                            onChange={(e) => setBuyingArea(e.target.value)}
                            className="h-11 bg-surface-2/60 border-border text-sm focus:border-accent"
                          />
                        </div>

                        {/* Client Budget? */}
                        <div className="space-y-2">
                          <Label htmlFor="buying-budget" className="text-xs font-semibold text-text-primary">
                            (If Buying) Client Budget?
                          </Label>
                          <Input
                            id="buying-budget"
                            placeholder="e.g. $450k – $600k / Cash / Conventional Pre-approved"
                            value={buyingBudget}
                            onChange={(e) => setBuyingBudget(e.target.value)}
                            className="h-11 bg-surface-2/60 border-border text-sm focus:border-accent"
                          />
                        </div>
                      </div>

                      {/* Property wishlist */}
                      <div className="space-y-2">
                        <Label htmlFor="buying-criteria" className="text-xs font-semibold text-text-primary">
                          (If Buying) What are they looking for in a property?
                        </Label>
                        <Textarea
                          id="buying-criteria"
                          rows={3}
                          placeholder="e.g. 3+ bed, 2+ bath, single-story, fenced backyard, good school district, pool preferred..."
                          value={buyingCriteria}
                          onChange={(e) => setBuyingCriteria(e.target.value)}
                          className="bg-surface-2/60 border-border text-sm focus:border-accent leading-relaxed"
                        />
                      </div>
                    </div>
                  )}

                  {/* Panel 4: Dynamic Selling Details */}
                  {isSelling && (
                    <div className="rounded-2xl border border-border bg-surface-1 p-6 sm:p-8 space-y-6 shadow-sm transition-all animate-in fade-in-50 duration-200">
                      <div className="flex items-center justify-between pb-4 border-b border-border/60">
                        <div>
                          <h2 className="text-base font-bold text-text-primary">
                            Property Being Sold Locally
                          </h2>
                          <p className="text-xs text-text-muted mt-0.5">
                            Details regarding the current property sale
                          </p>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2.5 py-1 rounded-full border border-accent/25">
                          Selling
                        </span>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="selling-address" className="text-xs font-semibold text-text-primary">
                          (If Selling) What is the address being sold?
                        </Label>
                        <Input
                          id="selling-address"
                          placeholder="e.g. 1044 Ridgeview Dr, Rolla, MO 65401"
                          value={sellingAddress}
                          onChange={(e) => setSellingAddress(e.target.value)}
                          className="h-11 bg-surface-2/60 border-border text-sm focus:border-accent"
                        />
                      </div>
                    </div>
                  )}

                  {/* Panel 5: Brokerage & Assigned Destination Agent */}
                  <div className="rounded-2xl border border-border bg-surface-1 p-6 sm:p-8 space-y-6 shadow-sm">
                    <div className="pb-4 border-b border-border/60">
                      <h2 className="text-base font-bold text-text-primary">
                        Destination Brokerage & Agent (If Applicable)
                      </h2>
                      <p className="text-xs text-text-muted mt-0.5">
                        If you already have a specific agent or brokerage identified, list them here
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="assigned-agent" className="text-xs font-semibold text-text-secondary">
                          Assigned Agent <span className="text-[10px] text-text-muted">(if applicable)</span>
                        </Label>
                        <Input
                          id="assigned-agent"
                          placeholder="Destination Agent Name"
                          value={assignedAgent}
                          onChange={(e) => setAssignedAgent(e.target.value)}
                          className="h-11 bg-surface-2/60 border-border text-sm focus:border-accent"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="broker-address" className="text-xs font-semibold text-text-secondary">
                          Broker Address <span className="text-[10px] text-text-muted">(if applicable)</span>
                        </Label>
                        <Input
                          id="broker-address"
                          placeholder="e.g. 100 Main St, Suite 400"
                          value={brokerAddress}
                          onChange={(e) => setBrokerAddress(e.target.value)}
                          className="h-11 bg-surface-2/60 border-border text-sm focus:border-accent"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="broker-email" className="text-xs font-semibold text-text-secondary">
                          Broker Email <span className="text-[10px] text-text-muted">(if applicable)</span>
                        </Label>
                        <Input
                          id="broker-email"
                          type="email"
                          placeholder="broker@destination.com"
                          value={brokerEmail}
                          onChange={(e) => setBrokerEmail(e.target.value)}
                          className="h-11 bg-surface-2/60 border-border text-sm focus:border-accent"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="broker-phone" className="text-xs font-semibold text-text-secondary">
                          Broker Phone Number <span className="text-[10px] text-text-muted">(if applicable)</span>
                        </Label>
                        <Input
                          id="broker-phone"
                          type="tel"
                          placeholder="(555) 000-0000"
                          value={brokerPhone}
                          onChange={(e) => setBrokerPhone(e.target.value)}
                          className="h-11 bg-surface-2/60 border-border text-sm focus:border-accent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Panel 6: Strategic Notes */}
                  <div className="rounded-2xl border border-border bg-surface-1 p-6 sm:p-8 space-y-4 shadow-sm">
                    <div className="pb-3 border-b border-border/60">
                      <h2 className="text-base font-bold text-text-primary">Notes & Special Instructions</h2>
                      <p className="text-xs text-text-muted mt-0.5">
                        Referral fee expectations, client personality notes, relationship context
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Textarea
                        id="notes"
                        rows={4}
                        placeholder="Enter any fee agreements (e.g. 25% outbound referral fee), past relationship background, client availability preferences, or special circumstances..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="bg-surface-2/60 border-border text-sm focus:border-accent leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Mobile Bottom Submit Bar */}
                  <div className="lg:hidden pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-12 text-sm font-bold bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20 gap-2"
                    >
                      {isSubmitting ? (
                        <span>Submitting to Client Care...</span>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>Submit Outbound Referral</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* ── RIGHT COLUMN: STICKY DESKTOP RAIL (4 COLUMNS) ── */}
                <div className="hidden lg:block lg:col-span-4 sticky top-24 space-y-6">
                  {/* Live Dossier Card */}
                  <div className="rounded-2xl border border-border bg-surface-1 p-6 space-y-5 shadow-md">
                    <div className="flex items-center justify-between pb-3 border-b border-border/60">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                        Live Referral Preview
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          transactionType === "buying"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : transactionType === "selling"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        )}
                      >
                        {transactionType === "both" ? "Buy & Sell" : transactionType}
                      </span>
                    </div>

                    {/* Client Snapshot */}
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-surface-2 border border-border flex items-center justify-center font-bold text-text-primary text-sm shrink-0">
                        {clientName ? clientName.slice(0, 2).toUpperCase() : "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-text-primary truncate">
                          {clientName || "Client Name Pending"}
                        </p>
                        <p className="text-xs text-text-secondary truncate">
                          {clientPhone || "Phone required"}
                        </p>
                      </div>
                    </div>

                    {/* Quick Specs Readout */}
                    <div className="space-y-2.5 text-xs pt-1 border-t border-border/40">
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">Referring Agent:</span>
                        <span className="font-semibold text-text-primary truncate max-w-[150px]">
                          {agentName || "Not set"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">Timeline:</span>
                        <span className="font-semibold text-text-primary truncate max-w-[150px]">
                          {timeline || "Not set"}
                        </span>
                      </div>

                      {buyingArea && (
                        <div className="flex items-center justify-between">
                          <span className="text-text-muted">Target Market:</span>
                          <span className="font-semibold text-text-primary truncate max-w-[150px]">
                            {buyingArea}
                          </span>
                        </div>
                      )}

                      {buyingBudget && (
                        <div className="flex items-center justify-between">
                          <span className="text-text-muted">Budget:</span>
                          <span className="font-semibold text-text-primary truncate max-w-[150px]">
                            {buyingBudget}
                          </span>
                        </div>
                      )}

                      {sellingAddress && (
                        <div className="flex items-center justify-between">
                          <span className="text-text-muted">Selling Address:</span>
                          <span className="font-semibold text-text-primary truncate max-w-[150px]">
                            {sellingAddress}
                          </span>
                        </div>
                      )}

                      {assignedAgent && (
                        <div className="flex items-center justify-between">
                          <span className="text-text-muted">Assigned Agent:</span>
                          <span className="font-semibold text-text-primary truncate max-w-[150px]">
                            {assignedAgent}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Primary Desktop Action Button */}
                    <div className="pt-2">
                      <Button
                        type="button"
                        onClick={() => handleSubmit()}
                        disabled={isSubmitting}
                        className="w-full h-12 text-sm font-bold bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20 gap-2 transition-transform active:scale-[0.99]"
                      >
                        {isSubmitting ? (
                          <span>Submitting...</span>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            <span>Submit Referral to Nancy</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Dispatch Guarantee Notice */}
                    <div className="pt-2 flex items-start gap-2.5 text-[11px] text-text-muted border-t border-border/40">
                      <ShieldCheck className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        Instant dispatch to <strong className="text-text-secondary">Nancy</strong>.
                        Automatically creates a trackable record in The Hub Operations Desk.
                      </p>
                    </div>
                  </div>

                  {/* Nancy Desk Context Card */}
                  <div className="rounded-2xl border border-border/80 bg-surface-1/60 p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center font-bold text-accent text-sm shrink-0">
                        NC
                      </div>
                      <div>
                        <p className="text-xs font-bold text-text-primary">Nancy — Client Care</p>
                        <p className="text-[11px] text-text-muted">Direct Outbound Specialist</p>
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Questions on referral fee rates, out-of-state broker vetting, or custom relocation terms?
                      Reach out directly at:
                    </p>
                    <a
                      href="mailto:nancy@mattsmithrealestategroup.com"
                      className="text-xs text-accent hover:underline font-medium block truncate"
                    >
                      nancy@mattsmithrealestategroup.com
                    </a>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
