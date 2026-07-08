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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import logo from "@/assets/msreg-logo.png.asset.json";
import { checkRateLimit } from "@/lib/audit.functions";

const ALLOWED_UPLOAD_MIME = new Set([
  "image/jpeg", "image/png", "image/webp",
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
      { title: "Marketing Request — Matt Smith Real Estate Group" },
      { name: "description", content: "Submit a marketing request to the MSREG Marketing Department." },
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
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`"${file.name}" is over 25MB`);
          setBusy(false);
          return;
        }
        if (!ALLOWED_UPLOAD_EXT.test(file.name) || (file.type && !ALLOWED_UPLOAD_MIME.has(file.type))) {
          toast.error(`"${file.name}" is not an allowed file type (JPG, PNG, WEBP, PDF, DOC).`);
          setBusy(false);
          return;
        }
        const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "_").slice(0, 80);
        const key = `incoming/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("marketing-request-uploads")
          .upload(key, file, { contentType: file.type || "application/octet-stream" });
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
      <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center">
          <img src={logo.url} alt="Matt Smith Real Estate Group" className="h-20 w-auto mx-auto mb-6" />
          <CheckCircle2 className="h-12 w-12 text-gold mx-auto mb-4" />
          <h1 className="text-2xl font-semibold">Request received</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Thanks — our marketing team has been notified and will reach out at the email you provided with updates.
          </p>
          <Button
            className="mt-6"
            variant="outline"
            onClick={() => {
              setSubmitted(false);
              setAgentName(""); setAgentEmail(""); setTypes([]); setScope("personal");
              setAddress(""); setDeadline(""); setDescription(""); setPriority("normal");
              setCopyNotes(""); setFiles([]);
            }}
          >
            Submit another request
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <AgentHubBackLink />
        <header className="text-center mb-8">
          <img src={logo.url} alt="Matt Smith Real Estate Group" className="h-24 w-auto mx-auto mb-3" />
          <h1 className="text-2xl font-semibold">Agent Marketing Request</h1>
          <p className="text-sm text-muted-foreground mt-1">Tell the marketing team what you need.</p>
        </header>

        <form onSubmit={onSubmit} className="bg-card border border-border rounded-lg p-6 space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Your name *</Label>
              <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} maxLength={120} required />
            </div>
            <div className="space-y-2">
              <Label>Your email *</Label>
              <Input type="email" value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)} maxLength={255} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Request type * (select all that apply)</Label>
            <div className="grid sm:grid-cols-2 gap-2">
              {REQUEST_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={types.includes(t)} onCheckedChange={() => toggleType(t)} />
                  {t}
                </label>
              ))}
            </div>
          </div>


          <div className="space-y-2">
            <Label>This request is for *</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as any)} className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="personal" /> Personal agent branding
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="listing" /> A specific listing / transaction
              </label>
            </RadioGroup>
          </div>

          {scope === "listing" && (
            <div className="space-y-2">
              <Label>Property address *</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} required />
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Requested deadline</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>What do you need? *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={4000} required />
          </div>

          <div className="space-y-2">
            <Label>Specific copy or messaging to include</Label>
            <Textarea value={copyNotes} onChange={(e) => setCopyNotes(e.target.value)} rows={3} maxLength={4000} />
          </div>

          <div className="space-y-2">
            <Label>Photos or assets</Label>
            <Input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              accept="image/*,video/*,.pdf,.zip"
            />
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">{files.length} file(s) selected</p>
            )}
          </div>

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Submitting..." : "Submit request"}
          </Button>
        </form>
      </div>
    </main>
  );
}

function AgentHubBackLink() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(localStorage.getItem("msreg-agent-hub-unlocked") === "1"); } catch {}
  }, []);
  if (!show) return null;
  return (
    <div className="mb-4">
      <Link to="/agents" className="inline-flex items-center gap-1 text-xs text-gold hover:underline">
        ← MSREG Agent Hub
      </Link>
    </div>
  );
}
