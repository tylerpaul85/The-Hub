import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CheckCircle2,
  UploadCloud,
  FileText,
  Sparkles,
  Clock,
  User,
  Mail,
  Building2,
  Check,
  ChevronLeft,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Layers,
  Paperclip,
} from "lucide-react";
import logo from "@/assets/msreg-logo.png";
import { cn } from "@/lib/utils";
import { checkRateLimit } from "@/lib/audit.functions";

const ALLOWED_UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_UPLOAD_EXT = /\.(jpe?g|png|webp|pdf|docx?)$/i;

export const Route = createFileRoute("/request")({
  ssr: false,
  component: PublicRequestPage,
  head: () => ({
    meta: [
      { title: "Marketing Request — MSREG Hub" },
      {
        name: "description",
        content: "Submit a marketing request to the MSREG Marketing Department.",
      },
    ],
  }),
});

const REQUEST_TYPES = [
  "Listing Graphics",
  "Just Sold Post",
  "Headshot Needed",
  "Video Edit",
  "Email Blast",
  "Event Flyer",
  "Bio Update",
  "Featured Listing",
  "Other",
] as const;

const schema = z.object({
  agent_name: z.string().trim().min(1, "Required").max(120),
  agent_email: z.string().trim().email("Invalid email").max(255),
  request_types: z.array(z.string()).min(1, "Pick at least one"),
  scope: z.enum(["personal", "listing"]),
  property_address: z.string().trim().max(300).optional(),
  deadline: z.string().optional(),
  description: z.string().trim().min(1, "Required").max(4000),
  priority: z.enum(["low", "normal", "high"]),
  copy_notes: z.string().trim().max(4000).optional(),
});

const sb = supabase as any;

function PublicRequestPage() {
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [scope, setScope] = useState<"personal" | "listing">("personal");
  const [address, setAddress] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [copyNotes, setCopyNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const checkLimit = useServerFn(checkRateLimit);

  const toggleType = (t: string) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      agent_name: agentName,
      agent_email: agentEmail,
      request_types: types,
      scope,
      property_address: scope === "listing" ? address : undefined,
      deadline: deadline || undefined,
      description,
      priority,
      copy_notes: copyNotes || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    if (scope === "listing" && !address.trim()) {
      toast.error("Property address is required for listing/transaction requests");
      return;
    }
    const closingGiftPayload: any = null;
    setBusy(true);
    try {
      // Rate-limit: 5 submissions / hour per IP.
      const limit = await checkLimit({
        data: { bucket: "marketing_request", window_seconds: 3600, max: 5 },
      }).catch(() => ({ allowed: true }));
      if (!limit.allowed) {
        toast.error("Too many requests from your network. Please try again later.");
        setBusy(false);
        return;
      }
      const fileUrls: string[] = [];

      // SECURITY: Enforce server-side upload constraints
      if (files.length > 5) {
        toast.error("Maximum 5 files allowed per submission.");
        setBusy(false);
        return;
      }
      const totalBytes = files.reduce((s, f) => s + f.size, 0);
      if (totalBytes > 50 * 1024 * 1024) {
        toast.error("Total upload size must be under 50MB.");
        setBusy(false);
        return;
      }

      // Extension → safe MIME mapping (never trust browser-supplied file.type)
      const EXT_TO_MIME: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
        webp: "image/webp", pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };

      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`"${file.name}" is over 25MB`);
          setBusy(false);
          return;
        }
        const ext = (file.name.split(".").pop() ?? "").toLowerCase();
        const safeMime = EXT_TO_MIME[ext];
        if (!safeMime || !ALLOWED_UPLOAD_EXT.test(file.name)) {
          toast.error(`"${file.name}" is not an allowed file type (JPG, PNG, WEBP, PDF, DOC).`);
          setBusy(false);
          return;
        }
        const safeName = file.name
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, "_")
          .slice(0, 80);
        const key = `incoming/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("marketing-request-uploads")
          // Use extension-derived MIME — never trust browser-supplied file.type
          .upload(key, file, { contentType: safeMime });
        if (upErr) throw upErr;
        fileUrls.push(key);
      }
      const { error } = await sb.from("marketing_requests").insert({
        agent_name: parsed.data.agent_name,
        agent_email: parsed.data.agent_email,
        request_types: parsed.data.request_types,
        scope: parsed.data.scope,
        property_address: parsed.data.property_address ?? null,
        deadline: parsed.data.deadline ?? null,
        description: parsed.data.description,
        priority: parsed.data.priority,
        copy_notes: parsed.data.copy_notes ?? null,
        file_urls: fileUrls,
        closing_gift: closingGiftPayload,
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <main className="relative min-h-screen flex items-center justify-center bg-background text-foreground px-4 py-12 overflow-hidden selection:bg-gold/30 selection:text-white">
        {/* Ambient Spotlight */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.16),transparent)] pointer-events-none -z-10" />

        {/* Brand Emblem Watermark in Background */}
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] pointer-events-none opacity-[0.035] -z-10 select-none">
          <img
            src={logo}
            alt=""
            className="w-full h-full object-contain filter grayscale contrast-200"
          />
        </div>

        <div className="max-w-md w-full bg-surface-1/95 border border-gold/40 rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.05] relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="h-9 w-9 stroke-[2]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-serif font-bold text-foreground">Request Received!</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Thanks! Our marketing team has been notified. We will review your request and send updates to <strong className="text-foreground">{agentEmail}</strong>.
            </p>
          </div>
          <Button
            className="w-full h-11 bg-gold text-navy hover:bg-gold/90 font-bold rounded-xl shadow-md shadow-gold/20 active:scale-[0.985] transition-all cursor-pointer"
            onClick={() => {
              setSubmitted(false);
              setAgentName("");
              setAgentEmail("");
              setTypes([]);
              setScope("personal");
              setAddress("");
              setDeadline("");
              setDescription("");
              setPriority("normal");
              setCopyNotes("");
              setFiles([]);
            }}
          >
            Submit Another Request
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-background text-foreground px-4 py-8 sm:py-12 overflow-x-hidden selection:bg-gold/30 selection:text-white">
      {/* Ambient Top Spotlight */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[350px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(196,90,44,0.16),transparent)] pointer-events-none -z-10" />

      {/* Brand Emblem Watermark in Background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[600px] h-[420px] sm:h-[600px] pointer-events-none opacity-[0.035] -z-10 select-none">
        <img
          src={logo}
          alt=""
          className="w-full h-full object-contain filter grayscale contrast-200"
        />
      </div>

      <div className="max-w-2xl mx-auto relative z-10 space-y-6">
        <AgentHubBackLink />
        
        <header className="text-center space-y-2">
          <img src={logo} alt="Matt Smith Real Estate Group" className="h-20 sm:h-22 w-auto mx-auto drop-shadow-sm" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Agent Marketing Request
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Submit your listing collateral, design requests, or video needs to the marketing team.
            </p>
          </div>
        </header>

        <form onSubmit={onSubmit} className="bg-surface-1/90 border border-border/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]">
          {/* Agent Information */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Your Name <span className="text-rose-400 font-bold">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  maxLength={120}
                  required
                  placeholder="e.g. Sarah Jenkins"
                  className="pl-10 h-11 rounded-xl bg-surface-2/80 border-border/80 focus-visible:ring-gold text-foreground"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Your Email <span className="text-rose-400 font-bold">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                  maxLength={255}
                  required
                  placeholder="sarah@mattsmithrealestate.com"
                  className="pl-10 h-11 rounded-xl bg-surface-2/80 border-border/80 focus-visible:ring-gold text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Request Type Chips */}
          <div className="space-y-2.5 pt-1">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-gold" /> Request Type *
              </span>
              <span className="text-[11px] text-muted-foreground font-normal">
                {types.length > 0 ? `${types.length} selected` : "Select all that apply"}
              </span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {REQUEST_TYPES.map((t) => {
                const active = types.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium text-left transition-all cursor-pointer select-none",
                      active
                        ? "bg-gold/15 border-gold text-foreground font-semibold shadow-2xs ring-1 ring-gold/40"
                        : "bg-surface-2/60 border-border/70 text-muted-foreground hover:bg-surface-2 hover:border-border hover:text-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                        active
                          ? "bg-gold border-gold text-navy"
                          : "border-border/80 bg-surface-1"
                      )}
                    >
                      {active && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <span className="truncate">{t}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scope Selector: Personal vs Listing */}
          <div className="space-y-2.5 pt-2 border-t border-border/60">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-gold" /> This request is for *
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScope("personal")}
                className={cn(
                  "p-3.5 rounded-2xl border text-left transition-all relative flex items-center justify-between cursor-pointer",
                  scope === "personal"
                    ? "bg-gold/15 border-gold text-foreground shadow-2xs ring-1 ring-gold/40"
                    : "bg-surface-2/60 border-border/70 text-muted-foreground hover:bg-surface-2 hover:border-border hover:text-foreground"
                )}
              >
                <div>
                  <div className="font-semibold text-xs text-foreground">Personal Agent Branding</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Bio, headshot, social post, personal flyer</div>
                </div>
                {scope === "personal" && (
                  <div className="w-5 h-5 rounded-full bg-gold text-navy flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setScope("listing")}
                className={cn(
                  "p-3.5 rounded-2xl border text-left transition-all relative flex items-center justify-between cursor-pointer",
                  scope === "listing"
                    ? "bg-gold/15 border-gold text-foreground shadow-2xs ring-1 ring-gold/40"
                    : "bg-surface-2/60 border-border/70 text-muted-foreground hover:bg-surface-2 hover:border-border hover:text-foreground"
                )}
              >
                <div>
                  <div className="font-semibold text-xs text-foreground">Specific Listing / Transaction</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Just Listed, Under Contract, Just Sold</div>
                </div>
                {scope === "listing" && (
                  <div className="w-5 h-5 rounded-full bg-gold text-navy flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {scope === "listing" && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label className="text-xs font-medium text-foreground">
                Property Address <span className="text-rose-400 font-bold">*</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={300}
                  required
                  placeholder="e.g. 1234 Heritage Way, Rolla, MO"
                  className="pl-10 h-11 rounded-xl bg-surface-2/80 border-border/80 focus-visible:ring-gold text-foreground"
                />
              </div>
            </div>
          )}

          {/* Deadline and Priority */}
          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-gold" /> Requested Deadline
              </Label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="h-11 rounded-xl bg-surface-2/80 border-border/80 focus-visible:ring-gold text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Priority</Label>
              <div className="grid grid-cols-3 gap-2 h-11">
                {[
                  { id: "low", label: "Low" },
                  { id: "normal", label: "Normal" },
                  { id: "high", label: "Rush 🔥" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id as any)}
                    className={cn(
                      "rounded-xl border text-xs font-semibold flex items-center justify-center transition-all cursor-pointer select-none",
                      priority === p.id
                        ? p.id === "high"
                          ? "bg-rose-500/20 border-rose-500 text-rose-400 ring-1 ring-rose-500/40"
                          : "bg-gold text-navy border-gold font-bold shadow-2xs ring-1 ring-gold/40"
                        : "bg-surface-2/60 border-border/70 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-1.5 pt-2 border-t border-border/60">
            <Label className="text-xs font-medium text-foreground">
              What do you need? <span className="text-rose-400 font-bold">*</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={4000}
              required
              placeholder="Describe what collateral or graphic you need, who the audience is, any dimensions or formats..."
              className="rounded-xl bg-surface-2/80 border-border/80 focus-visible:ring-gold text-foreground text-xs leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Specific Copy or Messaging to Include (Optional)
            </Label>
            <Textarea
              value={copyNotes}
              onChange={(e) => setCopyNotes(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder="Headlines, dates, open house times, price points, disclaimers..."
              className="rounded-xl bg-surface-2/80 border-border/80 focus-visible:ring-gold text-foreground text-xs leading-relaxed"
            />
          </div>

          {/* File Upload Dropzone */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Photos or Reference Assets</span>
              <span className="text-[11px] text-muted-foreground font-normal">Max 5 files · 50MB</span>
            </Label>
            <div className="relative border-2 border-dashed border-border/80 hover:border-gold/50 rounded-2xl p-5 text-center bg-surface-2/40 hover:bg-surface-2/60 transition-all cursor-pointer group">
              <input
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                accept="image/*,video/*,.pdf,.zip"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <UploadCloud className="h-8 w-8 mx-auto text-muted-foreground group-hover:text-gold transition-colors" />
              <div className="text-xs font-medium text-foreground mt-2">
                Click to browse or drop files here
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Supports photos, videos, PDFs, and ZIP archives
              </p>
              {files.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                  {files.map((f, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] bg-gold/15 text-gold border border-gold/30 font-medium"
                    >
                      <Paperclip className="h-2.5 w-2.5" />
                      {f.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={busy}
              className="w-full h-12 bg-gold hover:bg-gold/90 text-navy font-bold text-sm rounded-xl shadow-md shadow-gold/20 active:scale-[0.985] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {busy ? (
                "Submitting Request..."
              ) : (
                <>
                  Submit Marketing Request <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mt-3">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" />
              Direct pipeline to the MSREG Marketing Department.
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

function AgentHubBackLink() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem("msreg-agent-hub-unlocked") === "1");
    } catch {}
  }, []);
  if (!show) return null;
  return (
    <div className="mb-4">
      <Link
        to="/agents"
        className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
      >
        ← MSREG Agent Hub
      </Link>
    </div>
  );
}
