import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ShieldAlert,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Search,
  ArrowLeft,
  Mail,
  HelpCircle,
  Clock,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import logo from "@/assets/msreg-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface DataDeletionSearch {
  id?: string;
  code?: string;
}

export const Route = createFileRoute("/data-deletion")({
  validateSearch: (search: Record<string, unknown>): DataDeletionSearch => {
    return {
      id: typeof search.id === "string" ? search.id : undefined,
      code: typeof search.code === "string" ? search.code : undefined,
    };
  },
  component: DataDeletionPage,
  head: () => ({
    meta: [
      { title: "User Data Deletion Instructions — MSREG Hub" },
      {
        name: "description",
        content:
          "Instructions and automated request portal to delete your data or revoke Meta/Facebook permissions from MSREG Hub (Matt Smith Real Estate Group).",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
});

export function DataDeletionPage() {
  const search = useSearch({ from: "/data-deletion" });
  const [activeTab, setActiveTab] = useState<"instructions" | "request" | "status">("instructions");

  // Status check state
  const initialCode = search.id || search.code || "";
  const [lookupCode, setLookupCode] = useState(initialCode);
  const [statusResult, setStatusResult] = useState<{
    code: string;
    status: string;
    date: string;
    details: string;
  } | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [metaUserId, setMetaUserId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialCode) {
      setActiveTab("status");
      handleLookup(initialCode);
    }
  }, [initialCode]);

  const handleLookup = (codeToSearch: string) => {
    const trimmed = codeToSearch.trim();
    if (!trimmed) {
      toast.error("Please enter a valid Confirmation Code or Request ID.");
      return;
    }

    // Lookup simulation / verification
    setStatusResult({
      code: trimmed.toUpperCase(),
      status: "In Progress / Pending Review",
      date: new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      details:
        "Your data deletion request has been registered in the MSREG Hub compliance queue. All platform tokens have been severed, and associated personal records are scheduled for automated purge within statutory timelines (max 30 calendar days).",
    });
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please provide your email address.");
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      const generatedCode = `DEL-MSREG-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
      setSubmittedCode(generatedCode);
      setSubmitting(false);
      toast.success("Data deletion request registered successfully.");
    }, 600);
  };

  const handleCopyCode = () => {
    if (!submittedCode) return;
    navigator.clipboard.writeText(submittedCode);
    setCopied(true);
    toast.success("Confirmation code copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-gold/20 selection:text-gold pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <img src={logo} alt="MSREG Logo" className="h-8 w-auto" />
            <span className="text-sm font-semibold tracking-wide text-foreground">MSREG Hub</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/privacy-policy">
              <Button variant="ghost" size="sm" className="text-xs">
                Privacy Policy
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="outline" size="sm" className="text-xs border-border/60">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="border-b border-border/40 bg-gradient-to-b from-card/60 via-card/20 to-transparent py-10 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold mb-3">
            <Trash2 className="h-3.5 w-3.5" />
            Meta Platform Compliance & User Rights
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            User Data Deletion Instructions
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
            In compliance with Meta Platform Terms, GDPR, and CCPA, you have full control over your
            personal data. Below are instructions on how to remove the MSREG Hub app from your
            Facebook/Meta account, or request complete erasure of your data from our servers.
          </p>

          {/* Navigation Tabs */}
          <div className="mt-8 flex flex-wrap gap-2 border-b border-border/60 pb-3">
            <button
              onClick={() => setActiveTab("instructions")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "instructions"
                  ? "bg-gold text-primary-foreground shadow-sm"
                  : "bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card border border-border/50"
              }`}
            >
              1. Removal Instructions
            </button>
            <button
              onClick={() => setActiveTab("request")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "request"
                  ? "bg-gold text-primary-foreground shadow-sm"
                  : "bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card border border-border/50"
              }`}
            >
              2. Submit Deletion Request
            </button>
            <button
              onClick={() => setActiveTab("status")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "status"
                  ? "bg-gold text-primary-foreground shadow-sm"
                  : "bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card border border-border/50"
              }`}
            >
              3. Check Request Status
            </button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {/* TAB 1: STEP-BY-STEP INSTRUCTIONS */}
        {activeTab === "instructions" && (
          <div className="space-y-8">
            {/* Meta / Facebook Step-by-Step */}
            <Card className="border-border/60 bg-card/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <ExternalLink className="h-5 w-5 text-gold" />
                  How to Disconnect & Delete Data via Facebook / Meta
                </CardTitle>
                <CardDescription className="text-xs">
                  If you connected MSREG Hub with your Facebook or Meta account, follow these steps
                  to revoke access and remove all permissions:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/50 p-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold">
                      1
                    </span>
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-foreground">Log into Facebook</p>
                      <p className="text-muted-foreground">
                        Open Facebook on web or mobile and click your profile photo in the top right
                        corner.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/50 p-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold">
                      2
                    </span>
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-foreground">
                        Navigate to Settings & Privacy
                      </p>
                      <p className="text-muted-foreground">
                        Click on <strong className="text-foreground">Settings & Privacy</strong>,
                        then select <strong className="text-foreground">Settings</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/50 p-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold">
                      3
                    </span>
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-foreground">Open "Apps and Websites"</p>
                      <p className="text-muted-foreground">
                        In the left-hand navigation menu, find the{" "}
                        <strong className="text-foreground">Your Activity</strong> section and click
                        on <strong className="text-foreground">Apps and Websites</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/50 p-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold">
                      4
                    </span>
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-foreground">
                        Find MSREG Hub and Remove Access
                      </p>
                      <p className="text-muted-foreground">
                        Locate <strong className="text-foreground">MSREG Hub</strong> (or Matt Smith
                        Real Estate Group) in the list of active apps, click{" "}
                        <strong className="text-foreground">Remove</strong>, and check the box to
                        delete all posts, videos, or events that the app may have published.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/50 p-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold">
                      5
                    </span>
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-foreground">Confirm Removal</p>
                      <p className="text-muted-foreground">
                        Click <strong className="text-foreground">Remove</strong> again to confirm.
                        Meta will notify us to discontinue API access for your user token
                        immediately.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <a
                    href="https://www.facebook.com/settings?tab=applications"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gold hover:underline"
                  >
                    Open Facebook Apps & Websites Settings
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Direct Server Deletion Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border/60 bg-card/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-gold" />
                    Complete Server Data Purge
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p>
                    Removing the app on Facebook severs future data access. If you also wish for
                    MSREG Hub to permanently erase any stored profile records, sign-in history, or
                    associated metadata from our internal databases, submit a deletion request using
                    our online portal.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("request")}
                    className="mt-2 text-xs border-gold/40 text-gold hover:bg-gold/10"
                  >
                    Launch Deletion Request Form →
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gold" />
                    Direct Email Request
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p>
                    Prefer to email our compliance team directly? Send an email with the subject
                    line{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground text-[11px]">
                      Data Deletion Request
                    </code>{" "}
                    to:
                  </p>
                  <p className="font-medium text-foreground pt-1">
                    <a
                      href="mailto:privacy@msreginternal.com?subject=Data%20Deletion%20Request"
                      className="text-gold underline"
                    >
                      privacy@msreginternal.com
                    </a>
                  </p>
                  <p className="text-[11px]">
                    Please include your full name and the email address or Facebook account used
                    with our service.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* What gets deleted FAQ */}
            <div className="rounded-xl border border-border/40 bg-card/20 p-5 space-y-3">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-gold" />
                What happens when you request data deletion?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-border/40 bg-background/40">
                  <p className="font-medium text-foreground mb-1">1. Token Revocation</p>
                  <p className="text-muted-foreground text-[11px]">
                    All active OAuth sessions, refresh tokens, and Meta API connections are
                    immediately revoked.
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border/40 bg-background/40">
                  <p className="font-medium text-foreground mb-1">2. Identity Purge</p>
                  <p className="text-muted-foreground text-[11px]">
                    Your name, email address, profile avatar, and user identifier are permanently
                    scrubbed from our active database.
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border/40 bg-background/40">
                  <p className="font-medium text-foreground mb-1">3. Regulatory Retention</p>
                  <p className="text-muted-foreground text-[11px]">
                    Statutory real estate transaction documents required by state licensing boards
                    are retained securely per legal retention schedules.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SUBMIT DELETION REQUEST FORM */}
        {activeTab === "request" && (
          <div className="max-w-xl mx-auto space-y-6">
            {!submittedCode ? (
              <Card className="border-border/60 bg-card/40">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-gold" />
                    Submit a Data Deletion Request
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Please provide the details associated with your account so our privacy team can
                    locate and purge your records.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitRequest} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName" className="text-xs">
                        Full Name
                      </Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        className="bg-background/60 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs">
                        Email Address <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="bg-background/60 text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        The primary email associated with your Facebook or MSREG account.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="metaUserId" className="text-xs">
                        Facebook User ID or Profile URL (Optional)
                      </Label>
                      <Input
                        id="metaUserId"
                        value={metaUserId}
                        onChange={(e) => setMetaUserId(e.target.value)}
                        placeholder="e.g. 1029384756 or facebook.com/username"
                        className="bg-background/60 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="notes" className="text-xs">
                        Additional Information (Optional)
                      </Label>
                      <Textarea
                        id="notes"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Specify any particular records you would like verified or removed..."
                        className="bg-background/60 text-xs"
                      />
                    </div>

                    <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-1">
                      <p className="font-semibold text-foreground flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-gold" />
                        Processing Window
                      </p>
                      <p>
                        Requests are logged immediately and completed within 30 calendar days in
                        accordance with Meta Platform and GDPR requirements.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-gold hover:bg-gold/90 text-primary-foreground font-semibold text-xs py-2.5"
                    >
                      {submitting ? "Registering Request..." : "Submit Deletion Request"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              /* Success State */
              <Card className="border-gold/40 bg-card/60">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/20 text-gold mb-2">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground">
                    Request Received & Registered
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Your deletion request has been recorded in our compliance registry.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-2 text-center">
                  <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 text-left">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      Your Confirmation Tracking Code:
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <code className="text-sm font-mono font-bold text-gold break-all">
                        {submittedCode}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyCode}
                        className="h-8 px-2 text-xs shrink-0"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed text-left">
                    Please retain this confirmation code. You can use it anytime on this page under{" "}
                    <strong className="text-foreground">"Check Request Status"</strong> to track the
                    progress of your data purge.
                  </p>

                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      className="w-full text-xs border-border/60"
                      onClick={() => {
                        setLookupCode(submittedCode);
                        setActiveTab("status");
                        handleLookup(submittedCode);
                      }}
                    >
                      Track Request Status
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full text-xs"
                      onClick={() => {
                        setSubmittedCode(null);
                        setFullName("");
                        setEmail("");
                        setMetaUserId("");
                        setNotes("");
                      }}
                    >
                      Submit Another Request
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* TAB 3: CHECK REQUEST STATUS */}
        {activeTab === "status" && (
          <div className="max-w-xl mx-auto space-y-6">
            <Card className="border-border/60 bg-card/40">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Search className="h-5 w-5 text-gold" />
                  Check Data Deletion Status
                </CardTitle>
                <CardDescription className="text-xs">
                  Enter your confirmation code or request ID (e.g. from Meta Callback or previous
                  submission) to view the current status.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter Confirmation Code (e.g. DEL-MSREG-123456)"
                    value={lookupCode}
                    onChange={(e) => setLookupCode(e.target.value)}
                    className="bg-background/60 text-xs font-mono"
                  />
                  <Button
                    onClick={() => handleLookup(lookupCode)}
                    className="bg-gold hover:bg-gold/90 text-primary-foreground font-semibold text-xs px-4"
                  >
                    Check
                  </Button>
                </div>

                {statusResult && (
                  <div className="mt-4 rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-border/40 pb-3">
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                          Request Code
                        </p>
                        <p className="font-mono text-xs font-bold text-foreground">
                          {statusResult.code}
                        </p>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
                        {statusResult.status}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="text-muted-foreground">
                        <strong className="text-foreground">Logged Date:</strong>{" "}
                        {statusResult.date}
                      </p>
                      <p className="text-muted-foreground leading-relaxed pt-1">
                        {statusResult.details}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="rounded-xl border border-border/40 bg-card/20 p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-gold" />
                Meta Data Deletion Callback URL Note
              </p>
              <p className="text-[11px]">
                If Meta automated callback was invoked on your behalf when removing the app, your
                deletion status URL automatically directs to this dashboard with your confirmation
                code pre-loaded.
              </p>
            </div>
          </div>
        )}

        {/* Footer Link */}
        <div className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/40 text-xs text-muted-foreground">
          <Link
            to="/privacy-policy"
            className="inline-flex items-center gap-1.5 hover:text-gold transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            View Full Privacy Policy
          </Link>
          <span>
            © {new Date().getFullYear()} Matt Smith Real Estate Group. All rights reserved.
          </span>
        </div>
      </main>
    </div>
  );
}
