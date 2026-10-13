import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  "Immediate (Under 30 Days)",
  "30 - 60 Days",
  "60 - 90 Days",
  "3 - 6 Months",
  "6+ Months",
  "Exploring / Flexible",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-border/40 bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back to Hub</span>
            </Link>
            <div className="h-4 w-px bg-border/60" />
            <div className="flex items-center gap-2">
              <img src={logo} alt="MSREG Logo" className="h-6 w-auto" />
              <span className="font-semibold text-xs tracking-wider uppercase text-gold/90 hidden sm:inline">
                Client Care
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full border border-border/50">
              Direct to Nancy
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        {submittedData ? (
          /* Confirmation Success Screen */
          <div className="space-y-6 animate-in fade-in-50 duration-300">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-4">
              <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Referral Successfully Submitted!
                </h1>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Nancy at Client Care (
                  <span className="text-emerald-400 font-medium">nancy@mattsmithrealestategroup.com</span>
                  ) has received an email with the complete details so she can move the referral process along.
                </p>
              </div>

              {/* Submitted Summary Card */}
              <div className="mt-6 rounded-xl border border-border bg-card p-6 text-left space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Client
                    </p>
                    <p className="text-base font-bold text-foreground">{submittedData.client_name}</p>
                    <p className="text-xs text-muted-foreground">{submittedData.client_phone}</p>
                  </div>
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                      submittedData.transaction_type === "buying"
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        : submittedData.transaction_type === "selling"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                    )}
                  >
                    {submittedData.transaction_type === "both"
                      ? "Buying & Selling"
                      : submittedData.transaction_type}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Referring Agent:</span>{" "}
                    <span className="font-semibold text-foreground">{submittedData.agent_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expected Timeline:</span>{" "}
                    <span className="font-semibold text-foreground">{submittedData.timeline}</span>
                  </div>
                  {submittedData.buying_area && (
                    <div>
                      <span className="text-muted-foreground">Target Area:</span>{" "}
                      <span className="font-semibold text-foreground">{submittedData.buying_area}</span>
                    </div>
                  )}
                  {submittedData.buying_budget && (
                    <div>
                      <span className="text-muted-foreground">Budget:</span>{" "}
                      <span className="font-semibold text-foreground">{submittedData.buying_budget}</span>
                    </div>
                  )}
                  {submittedData.selling_address && (
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Selling Address:</span>{" "}
                      <span className="font-semibold text-foreground">{submittedData.selling_address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="w-full sm:w-auto gap-2 border-border/80"
                >
                  <RotateCcw className="h-4 w-4" />
                  Submit Another Referral
                </Button>
                <Link to="/dashboard" className="w-full sm:w-auto">
                  <Button className="w-full bg-gold hover:bg-gold/90 text-navy font-semibold gap-2">
                    Return to Hub
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Main Referral Form */
          <div className="space-y-6">
            {/* Header Card */}
            <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-card/70 p-6 sm:p-8 shadow-sm space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gold/5 rounded-full blur-3xl pointer-events-none" />
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-semibold tracking-wide uppercase">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Client Care Specialist</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Outbound Referral Information Sheet
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                Please fill in this form and submit it to our Client Care Specialist. Once completed,{" "}
                <strong className="text-foreground font-medium">Nancy</strong> will receive an instant email
                notification with all client and property details so she can coordinate the referral agreement
                and keep the process moving.
              </p>
              <div className="pt-2 text-xs text-destructive font-medium flex items-center gap-1.5">
                <span>* Indicates required question</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Card 1: Referring Agent & Client Contact */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-5 shadow-sm">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Contact Information</h2>
                    <p className="text-xs text-muted-foreground">Referring agent and client details</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Agent Name */}
                  <div className="space-y-2">
                    <Label htmlFor="agent-name" className="text-xs font-semibold">
                      Agent Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="agent-name"
                      required
                      placeholder="e.g. John Smith"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      className="bg-background/80"
                    />
                  </div>

                  {/* Agent Email */}
                  <div className="space-y-2">
                    <Label htmlFor="agent-email" className="text-xs font-semibold text-muted-foreground">
                      Agent Email (for copy notification)
                    </Label>
                    <Input
                      id="agent-email"
                      type="email"
                      placeholder="e.g. agent@mattsmithrealestategroup.com"
                      value={agentEmail}
                      onChange={(e) => setAgentEmail(e.target.value)}
                      className="bg-background/80"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Client Name */}
                  <div className="space-y-2">
                    <Label htmlFor="client-name" className="text-xs font-semibold">
                      Client Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="client-name"
                      required
                      placeholder="Client First & Last Name"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="bg-background/80"
                    />
                  </div>

                  {/* Client Number */}
                  <div className="space-y-2">
                    <Label htmlFor="client-phone" className="text-xs font-semibold">
                      Client Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="client-phone"
                      required
                      type="tel"
                      placeholder="e.g. (573) 555-0199"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="bg-background/80"
                    />
                  </div>
                </div>

                {/* Client Email */}
                <div className="space-y-2">
                  <Label htmlFor="client-email" className="text-xs font-semibold text-muted-foreground">
                    Client Email
                  </Label>
                  <Input
                    id="client-email"
                    type="email"
                    placeholder="client@example.com (optional)"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="bg-background/80"
                  />
                </div>
              </div>

              {/* Card 2: Transaction Type & Timeline */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-5 shadow-sm">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <Home className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Transaction & Timeline</h2>
                    <p className="text-xs text-muted-foreground">What type of transaction and timeframe?</p>
                  </div>
                </div>

                {/* Buying or Selling? */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold">
                    Buying or Selling? <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { key: "buying", label: "Buying" },
                      { key: "selling", label: "Selling" },
                      { key: "both", label: "Both" },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setTransactionType(opt.key as any)}
                        className={cn(
                          "py-3 px-3 rounded-lg border text-sm font-semibold transition-all text-center flex items-center justify-center gap-1.5",
                          transactionType === opt.key
                            ? "border-gold bg-gold/15 text-gold shadow-sm font-bold"
                            : "border-border/80 bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expected Timeline */}
                <div className="space-y-2 pt-2">
                  <Label htmlFor="timeline" className="text-xs font-semibold">
                    (Buying or selling) What is the expected timeline?{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="timeline"
                    required
                    placeholder="e.g. Under 30 days, 2-3 months, ASAP..."
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    className="bg-background/80"
                  />
                  {/* Preset timeline pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {TIMELINE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTimeline(preset)}
                        className={cn(
                          "text-[11px] px-2.5 py-1 rounded-md border transition-colors",
                          timeline === preset
                            ? "bg-gold/20 border-gold/40 text-gold font-medium"
                            : "bg-muted/50 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 3: Buying Details (Dynamic) */}
              {isBuying && (
                <div className="rounded-xl border border-blue-500/30 bg-card p-6 space-y-4 shadow-sm animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-foreground">Buying Criteria</h2>
                        <p className="text-xs text-muted-foreground">Desired market and purchase specs</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                      Buying
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* What area? */}
                    <div className="space-y-2">
                      <Label htmlFor="buying-area" className="text-xs font-semibold">
                        (If Buying) What area? Specific if possible.
                      </Label>
                      <Input
                        id="buying-area"
                        placeholder="e.g. Phoenix, AZ / Scottsdale / Lake of the Ozarks"
                        value={buyingArea}
                        onChange={(e) => setBuyingArea(e.target.value)}
                        className="bg-background/80"
                      />
                    </div>

                    {/* Client Budget */}
                    <div className="space-y-2">
                      <Label htmlFor="buying-budget" className="text-xs font-semibold">
                        (If Buying) Client Budget?
                      </Label>
                      <Input
                        id="buying-budget"
                        placeholder="e.g. $400k - $500k / Cash / Pre-approved"
                        value={buyingBudget}
                        onChange={(e) => setBuyingBudget(e.target.value)}
                        className="bg-background/80"
                      />
                    </div>
                  </div>

                  {/* Looking for in a property */}
                  <div className="space-y-2 pt-1">
                    <Label htmlFor="buying-criteria" className="text-xs font-semibold">
                      (If Buying) What are they looking for in a property?
                    </Label>
                    <Textarea
                      id="buying-criteria"
                      rows={3}
                      placeholder="e.g. 3 bed, 2 bath, fenced yard, single-story, close to good schools..."
                      value={buyingCriteria}
                      onChange={(e) => setBuyingCriteria(e.target.value)}
                      className="bg-background/80"
                    />
                  </div>
                </div>
              )}

              {/* Card 4: Selling Details (Dynamic) */}
              {isSelling && (
                <div className="rounded-xl border border-amber-500/30 bg-card p-6 space-y-4 shadow-sm animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-foreground">Selling Details</h2>
                        <p className="text-xs text-muted-foreground">Address and property being sold</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      Selling
                    </span>
                  </div>

                  {/* Address Being Sold */}
                  <div className="space-y-2">
                    <Label htmlFor="selling-address" className="text-xs font-semibold">
                      (If Selling) What is the address being sold?
                    </Label>
                    <Input
                      id="selling-address"
                      placeholder="e.g. 1234 Main St, Rolla, MO 65401"
                      value={sellingAddress}
                      onChange={(e) => setSellingAddress(e.target.value)}
                      className="bg-background/80"
                    />
                  </div>
                </div>
              )}

              {/* Card 5: Assigned Agent & Brokerage */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
                  <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Broker & Agent (If Applicable)</h2>
                    <p className="text-xs text-muted-foreground">
                      Destination agent or brokerage contact information
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Assigned Agent */}
                  <div className="space-y-2">
                    <Label htmlFor="assigned-agent" className="text-xs font-semibold text-muted-foreground">
                      Assigned Agent (if applicable)
                    </Label>
                    <Input
                      id="assigned-agent"
                      placeholder="Destination Agent Name"
                      value={assignedAgent}
                      onChange={(e) => setAssignedAgent(e.target.value)}
                      className="bg-background/80"
                    />
                  </div>

                  {/* Broker Address */}
                  <div className="space-y-2">
                    <Label htmlFor="broker-address" className="text-xs font-semibold text-muted-foreground">
                      Broker Address (if applicable)
                    </Label>
                    <Input
                      id="broker-address"
                      placeholder="e.g. 500 Market St, Suite 200..."
                      value={brokerAddress}
                      onChange={(e) => setBrokerAddress(e.target.value)}
                      className="bg-background/80"
                    />
                  </div>

                  {/* Broker Email */}
                  <div className="space-y-2">
                    <Label htmlFor="broker-email" className="text-xs font-semibold text-muted-foreground">
                      Broker Email (if applicable)
                    </Label>
                    <Input
                      id="broker-email"
                      type="email"
                      placeholder="broker@example.com"
                      value={brokerEmail}
                      onChange={(e) => setBrokerEmail(e.target.value)}
                      className="bg-background/80"
                    />
                  </div>

                  {/* Broker Phone Number */}
                  <div className="space-y-2">
                    <Label htmlFor="broker-phone" className="text-xs font-semibold text-muted-foreground">
                      Broker Phone Number (if applicable)
                    </Label>
                    <Input
                      id="broker-phone"
                      type="tel"
                      placeholder="Broker Phone Number"
                      value={brokerPhone}
                      onChange={(e) => setBrokerPhone(e.target.value)}
                      className="bg-background/80"
                    />
                  </div>
                </div>
              </div>

              {/* Card 6: Additional Notes */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
                  <div className="h-8 w-8 rounded-lg bg-muted text-foreground flex items-center justify-center">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Notes</h2>
                    <p className="text-xs text-muted-foreground">
                      Any additional instructions or background for Client Care
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-xs font-semibold text-muted-foreground">
                    Notes
                  </Label>
                  <Textarea
                    id="notes"
                    rows={4}
                    placeholder="Enter any additional context, referral fee arrangements, communication preferences, or client background here..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="bg-background/80"
                  />
                </div>
              </div>

              {/* Notice & Submit Button */}
              <div className="pt-2 space-y-4">
                <div className="rounded-lg bg-gold/5 border border-gold/20 p-4 flex items-start gap-3 text-xs text-muted-foreground">
                  <ShieldCheck className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Submitting this form immediately dispatches a formatted notification email to{" "}
                    <strong className="text-foreground">Nancy (nancy@mattsmithrealestategroup.com)</strong>{" "}
                    and records this referral in The Hub Operations log so Client Care can execute the referral
                    agreement promptly.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 text-base font-bold bg-gold hover:bg-gold/90 text-navy shadow-lg shadow-gold/10 gap-2 transition-transform active:scale-[0.99]"
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
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
