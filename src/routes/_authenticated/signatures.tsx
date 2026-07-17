import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Mail,
  CheckCircle,
  AlertTriangle,
  Upload,
  Loader2,
  Eye,
  Save,
  Settings,
  Users,
  ChevronRight,
  Image as ImageIcon,
  Phone,
  MapPin,
  Info,
} from "lucide-react";
import {
  getSignatureRoster,
  getTeamConfig,
  saveAgentSignatureData,
  saveTeamConfig,
  uploadHeadshot,
} from "@/lib/signatures.functions";

export const Route = createFileRoute("/_authenticated/signatures")({
  component: SignaturesPage,
  head: () => ({ meta: [{ title: "Email Signatures — MSREG" }] }),
});

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
interface AgentSig {
  id: string;
  email: string;
  name: string;
  active: boolean;
  sig: {
    id: string;
    toolbox_agent_id: string;
    title: string | null;
    mobile_phone: string | null;
    office_phone: string | null;
    headshot_url: string | null;
    office1_label: string | null;
    office1_addr: string | null;
    office2_label: string | null;
    office2_addr: string | null;
    gmail_email: string | null;
    last_pushed_at: string | null;
    last_push_status: "success" | "error" | null;
    last_push_error: string | null;
  } | null;
}

interface TeamConfig {
  id: string;
  accolade_line1: string;
  accolade_line2: string;
  website_url: string;
  valuation_url: string;
  facebook_url: string;
  instagram_url: string;
  logo_url: string;
  icon_fb_url: string;
  icon_ig_url: string;
  icon_web_url: string;
  html_template?: string | null;
}

// ----------------------------------------------------------------
// Completeness checker
// ----------------------------------------------------------------
function sigCompleteness(agent: AgentSig): { complete: boolean; missing: string[] } {
  const s = agent.sig;
  const missing: string[] = [];
  if (!s) return { complete: false, missing: ["All fields missing"] };
  if (!s.title) missing.push("Title");
  if (!s.mobile_phone) missing.push("Mobile phone");
  if (!s.headshot_url) missing.push("Headshot");
  if (!s.office1_addr) missing.push("Office address");
  if (!s.gmail_email) missing.push("Gmail email");
  return { complete: missing.length === 0, missing };
}

// ----------------------------------------------------------------
// HTML Signature Generator  (client-side, pixel-perfect match to prototype)
// ----------------------------------------------------------------
// Simple Handlebars-like parser for signature templates
function compileTemplate(template: string, data: Record<string, any>): string {
  let rendered = template;

  // 1. Process {{#if key}} ... {{else}} ... {{/if}}
  const ifElseRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
  rendered = rendered.replace(ifElseRegex, (match, key, trueBranch, falseBranch) => {
    const val = data[key];
    const isTrue = val && String(val).trim() !== "" && String(val) !== "null";
    if (isTrue) {
      return trueBranch;
    } else {
      return falseBranch || "";
    }
  });

  // 2. Process simple variables {{variable}}
  const varRegex = /\{\{(\w+)\}\}/g;
  rendered = rendered.replace(varRegex, (match, key) => {
    const val = data[key];
    return val !== undefined && val !== null && String(val) !== "null" ? String(val) : "";
  });

  return rendered;
}

const DEFAULT_SIGNATURE_TEMPLATE = `<!-- HTML EMAIL SIGNATURE TEMPLATE -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="700" style="border-collapse:collapse; width:700px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background-color:#ffffff;">
  <!-- TOP BANNER -->
  <tr>
    <td style="padding:0 0 16px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="700" style="border-collapse:collapse; width:700px;">
        <tr>
          <td bgcolor="#16232f" align="center" width="700" style="background-color:#16232f; width:700px; padding:10px 0; border-radius:4px;">
            <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:10px; line-height:13px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:#ffffff;">
              {{accolade_line1}}
            </span>
            <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:10px; line-height:13px; font-weight:400; letter-spacing:1.2px; text-transform:uppercase; color:#8ba3ba;">
              &nbsp;&nbsp;&middot;&nbsp;&nbsp;{{accolade_line2}}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- MAIN AREA -->
  <tr>
    <td style="padding:0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="700" style="border-collapse:collapse; width:700px;">
        <tr>
          <!-- COLUMN 1: CIRCULAR PHOTO -->
          <td valign="middle" width="130" style="width:130px; padding:0 16px 0 0;">
            {{#if headshot_url}}
            <img src="{{headshot_url}}" alt="{{name}}" width="120" height="120" border="0" style="display:block; width:120px; height:120px; border-radius:50%; object-fit:cover; object-position:center top; border:1px solid #e2e8f0;" />
            {{else}}
            <div style="width:120px; height:120px; background-color:#f7fafc; border:1px dashed #cbd5e0; border-radius:50%; display:inline-block;"></div>
            {{/if}}
          </td>

          <!-- DIVIDER LINE -->
          <td width="1" bgcolor="#e2e8f0" style="width:1px; background-color:#e2e8f0;"></td>

          <!-- COLUMN 2: NAME, TITLE, LOGO -->
          <td valign="top" style="padding:0 20px 0 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:4px 0 2px 0;">
                  <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:24px; line-height:28px; font-weight:700; color:#16232f; letter-spacing:-0.5px;">
                    {{name}}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:0 0 12px 0;">
                  <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; line-height:14px; font-weight:700; color:#8ba3ba; text-transform:uppercase; letter-spacing:1px;">
                    {{title}}
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  {{#if logo_url}}
                  <a href="{{website_url}}" target="_blank" style="text-decoration:none; display:block;">
                    <img src="{{logo_url}}" alt="Matt Smith Real Estate Group" width="140" border="0" style="display:block; width:140px; height:auto;" />
                  </a>
                  {{/if}}
                </td>
              </tr>
            </table>
          </td>

          <!-- DIVIDER LINE -->
          <td width="1" bgcolor="#e2e8f0" style="width:1px; background-color:#e2e8f0;"></td>

          <!-- COLUMN 3: PHONES, SOCIALS, ADDRESSES, CTA -->
          <td valign="top" style="padding:0 0 0 20px; width:280px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <!-- Phones & Socials Header Row -->
              <tr>
                <td style="padding:4px 0 10px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; line-height:16px; color:#16232f;">
                        {{#if mobile_phone}}
                        <span style="color:#C9A84C; font-weight:700; text-transform:uppercase; font-size:10px;">M</span>
                        <strong>{{mobile_phone}}</strong>
                        {{/if}}
                        {{#if office_phone}}
                        &nbsp;&nbsp;&nbsp;
                        <span style="color:#8ba3ba; font-weight:700; text-transform:uppercase; font-size:10px;">O</span>
                        <span style="color:#4a5568;">{{office_phone}}</span>
                        {{/if}}
                      </td>
                      <td align="right" style="padding:0;">
                        {{#if facebook_url}}
                        <a href="{{facebook_url}}" target="_blank" style="display:inline-block; margin-left:6px; text-decoration:none;">
                          <img src="{{icon_fb_url}}" alt="Facebook" width="18" height="18" border="0" style="display:block; width:18px; height:18px;" />
                        </a>
                        {{/if}}
                        {{#if instagram_url}}
                        <a href="{{instagram_url}}" target="_blank" style="display:inline-block; margin-left:6px; text-decoration:none;">
                          <img src="{{icon_ig_url}}" alt="Instagram" width="18" height="18" border="0" style="display:block; width:18px; height:18px;" />
                        </a>
                        {{/if}}
                        {{#if website_url}}
                        <a href="{{website_url}}" target="_blank" style="display:inline-block; margin-left:6px; text-decoration:none;">
                          <img src="{{icon_web_url}}" alt="Website" width="18" height="18" border="0" style="display:block; width:18px; height:18px;" />
                        </a>
                        {{/if}}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Office Addresses -->
              <tr>
                <td style="padding:0 0 12px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      {{#if office1_addr}}
                      <td valign="top" style="padding:0 8px 0 0; width:50%;">
                        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:10px; font-weight:700; color:#16232f; text-transform:uppercase; letter-spacing:0.5px;">{{office1_label}}</div>
                        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:9px; line-height:12px; color:#718096; margin-top:2px;">{{office1_addr}}</div>
                      </td>
                      {{/if}}
                      {{#if office2_addr}}
                      <td valign="top" style="padding:0; width:50%;">
                        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:10px; font-weight:700; color:#16232f; text-transform:uppercase; letter-spacing:0.5px;">{{office2_label}}</div>
                        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:9px; line-height:12px; color:#718096; margin-top:2px;">{{office2_addr}}</div>
                      </td>
                      {{/if}}
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Call to Action Button -->
              {{#if valuation_url}}
              <tr>
                <td style="padding:2px 0 0 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td bgcolor="#1e70e6" style="background-color:#1e70e6; border-radius:4px; padding:8px 16px;" align="center">
                        <a href="{{valuation_url}}" target="_blank" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; font-weight:700; color:#ffffff; text-decoration:none; display:inline-block; text-transform:uppercase; letter-spacing:0.5px;">
                          Instant Home Valuation &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              {{/if}}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- BOTTOM BAR ACCENT -->
  <tr>
    <td style="padding:14px 0 0 0; border-top:2px solid #C9A84C; margin-top:10px;"></td>
  </tr>
</table>`;

function buildSignatureHtml(agent: AgentSig, team: TeamConfig): string {
  const s = agent.sig;
  
  const data = {
    name: agent.name || "",
    email: agent.email || "",
    title: s?.title ?? "",
    mobile_phone: s?.mobile_phone ?? "",
    office_phone: s?.office_phone ?? "",
    headshot_url: s?.headshot_url ?? "",
    office1_label: s?.office1_label ?? "",
    office1_addr: s?.office1_addr ?? "",
    office2_label: s?.office2_label ?? "",
    office2_addr: s?.office2_addr ?? "",
    gmail_email: s?.gmail_email ?? "",
    accolade_line1: team.accolade_line1 || "",
    accolade_line2: team.accolade_line2 || "",
    website_url: team.website_url || "",
    valuation_url: team.valuation_url || "",
    facebook_url: team.facebook_url || "",
    instagram_url: team.instagram_url || "",
    logo_url: team.logo_url || "",
    icon_fb_url: team.icon_fb_url || "",
    icon_ig_url: team.icon_ig_url || "",
    icon_web_url: team.icon_web_url || "",
  };

  const template = team.html_template || DEFAULT_SIGNATURE_TEMPLATE;
  return compileTemplate(template, data);
}

              <!-- Valuation link -->
              ${team.valuation_url ? `<tr>
                <td style="padding:6px 0 0 0;" align="right">
                  <a href="${team.valuation_url}" target="_blank"
                    style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                    font-size:9px; color:#C9A84C; text-decoration:none; letter-spacing:0.5px;
                    text-transform:uppercase; font-weight:700;">
                    What's My Home Worth?
                  </a>
                </td>
              </tr>` : ""}
            </table>
          </td>

        </tr>
      </table>
    </td>
  </tr>

  <!-- BOTTOM BORDER -->
  <tr>
    <td style="padding:14px 0 0 0; border-top:2px solid #C9A84C; margin-top:10px;"></td>
  </tr>

</table>`;
}

// ----------------------------------------------------------------
// Signature Preview Component
// ----------------------------------------------------------------
function SignaturePreview({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8" />
      <style>
        body { margin: 0; padding: 16px; background: #fff; font-size: 0; }
      </style>
    </head><body>${html}</body></html>`);
    doc.close();
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title="Signature Preview"
      className="w-full rounded-lg border border-border"
      style={{ height: 280 }}
      sandbox="allow-same-origin"
    />
  );
}

// ----------------------------------------------------------------
// Completeness Badge
// ----------------------------------------------------------------
function CompletenessBadge({ agent }: { agent: AgentSig }) {
  const { complete, missing } = sigCompleteness(agent);
  if (complete) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 border text-xs gap-1 font-medium">
        <CheckCircle className="h-3 w-3" /> Complete
      </Badge>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 border text-xs gap-1 font-medium">
        <AlertTriangle className="h-3 w-3" /> Incomplete
      </Badge>
      <span className="text-[10px] text-muted-foreground hidden sm:inline">
        Missing: {missing.slice(0, 2).join(", ")}
        {missing.length > 2 ? ` +${missing.length - 2}` : ""}
      </span>
    </div>
  );
}

// ----------------------------------------------------------------
// Agent Edit Sheet
// ----------------------------------------------------------------
interface AgentSheetProps {
  agent: AgentSig | null;
  team: TeamConfig | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function AgentSheet({ agent, team, open, onClose, onSaved }: AgentSheetProps) {
  const saveFn = useServerFn(saveAgentSignatureData);
  const uploadFn = useServerFn(uploadHeadshot);

  const [form, setForm] = useState({
    title: "",
    mobile_phone: "",
    office_phone: "",
    headshot_url: "",
    office1_label: "",
    office1_addr: "",
    office2_label: "",
    office2_addr: "",
    gmail_email: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset form when agent changes
  useEffect(() => {
    if (!agent) return;
    const s = agent.sig;
    setForm({
      title: s?.title ?? "",
      mobile_phone: s?.mobile_phone ?? "",
      office_phone: s?.office_phone ?? "",
      headshot_url: s?.headshot_url ?? "",
      office1_label: s?.office1_label ?? "",
      office1_addr: s?.office1_addr ?? "",
      office2_label: s?.office2_label ?? "",
      office2_addr: s?.office2_addr ?? "",
      gmail_email: s?.gmail_email ?? agent.email ?? "",
    });
  }, [agent]);

  const previewHtml = useMemo(() => {
    if (!agent || !team) return "";
    const synth: AgentSig = {
      ...agent,
      sig: { ...agent.sig, ...form, toolbox_agent_id: agent.id, id: agent.sig?.id ?? "" } as any,
    };
    return buildSignatureHtml(synth, team);
  }, [agent, team, form]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agent) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8 MB.");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const result = await uploadFn({
        data: {
          toolbox_agent_id: agent.id,
          filename: file.name,
          base64,
          mime_type: file.type as any,
        },
      });
      setForm((f) => ({ ...f, headshot_url: result.url }));
      toast.success("Headshot uploaded");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [agent, uploadFn]);

  const handleSave = async () => {
    if (!agent) return;
    setSaving(true);
    try {
      await saveFn({
        data: { toolbox_agent_id: agent.id, ...form },
      });
      toast.success("Signature data saved");
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const field = (
    id: string,
    label: string,
    key: keyof typeof form,
    placeholder?: string,
    type = "text"
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="h-9 text-sm"
      />
    </div>
  );

  if (!agent) return null;
  const fullName = agent.name || agent.email || "Unknown Agent";

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-border shrink-0 bg-sidebar/40">
          <SheetTitle className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gold/15 text-gold flex items-center justify-center text-sm font-semibold shrink-0">
              {(agent.name?.[0] ?? agent.email?.[0] ?? "?").toUpperCase()}
            </div>
            <div>
              <div className="font-semibold">{fullName}</div>
              <div className="text-xs font-normal text-muted-foreground mt-0.5">{agent.email}</div>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Tab bar */}
        <div className="flex border-b border-border shrink-0">
          {(["edit", "preview"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-3 text-sm font-medium capitalize transition-colors",
                activeTab === tab
                  ? "text-gold border-b-2 border-gold bg-gold/5"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "edit" ? "Edit Details" : "Preview"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "edit" ? (
            <div className="space-y-5">
              {/* Personal */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
                  Personal Info
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {field("title", "Title / Role", "title", "REALTOR®, Team Lead, etc.")}
                  {field("gmail_email", "Gmail Address", "gmail_email", "agent@mattsmithrealestategroup.com", "email")}
                  {field("mobile_phone", "Mobile Phone", "mobile_phone", "(573) 555-0100")}
                  {field("office_phone", "Office Phone", "office_phone", "(573) 555-0200")}
                </div>
              </div>

              {/* Headshot */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
                  Headshot Photo
                </p>
                <div className="flex items-start gap-4">
                  {form.headshot_url ? (
                    <img
                      src={form.headshot_url}
                      alt="Headshot preview"
                      className="h-20 w-16 rounded-md object-cover object-top border border-border shrink-0"
                    />
                  ) : (
                    <div className="h-20 w-16 rounded-md bg-muted border border-border shrink-0 flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <Input
                      value={form.headshot_url}
                      onChange={(e) => setForm((f) => ({ ...f, headshot_url: e.target.value }))}
                      placeholder="https://... (paste a permanent URL)"
                      className="h-9 text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleUpload}
                        id="headshot-upload"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                      >
                        {uploading ? (
                          <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Uploading…</>
                        ) : (
                          <><Upload className="h-3 w-3 mr-1.5" /> Upload from file</>
                        )}
                      </Button>
                      <span className="text-[10px] text-muted-foreground">JPG, PNG, WebP · max 8 MB</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Offices */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
                  Office Locations
                </p>
                <div className="space-y-3">
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <p className="text-xs font-medium text-foreground">Primary Office</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {field("o1label", "Label (e.g. Rolla)", "office1_label", "Rolla")}
                      {field("o1addr", "Address", "office1_addr", "123 Main St, Rolla, MO 65401")}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <p className="text-xs font-medium text-foreground flex items-center gap-2">
                      Second Office
                      <span className="text-[10px] font-normal text-muted-foreground">(leave blank if agent has only one)</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {field("o2label", "Label (e.g. Lake of Ozarks)", "office2_label", "Lake of Ozarks")}
                      {field("o2addr", "Address", "office2_addr", "456 Shore Dr, Osage Beach, MO 65065")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>Preview updates live as you edit. Scroll to see the full signature.</span>
              </div>
              <div className="overflow-x-auto">
                <SignaturePreview html={previewHtml} />
              </div>
              {/* Raw HTML copy */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                  Raw HTML (copy into any email client that accepts HTML signatures)
                </p>
                <textarea
                  readOnly
                  value={previewHtml}
                  className="w-full h-32 rounded-md border border-border bg-muted/50 px-3 py-2 text-[10px] font-mono text-muted-foreground resize-none focus:outline-none"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex items-center gap-3 bg-sidebar/30">
          <Button
            className="bg-gold text-navy font-semibold hover:bg-gold/90 gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
            Close
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs opacity-50 cursor-not-allowed"
            disabled
            title="Gmail integration coming soon"
          >
            <Mail className="h-3.5 w-3.5" />
            Push to Gmail
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ----------------------------------------------------------------
// Team Config Section
// ----------------------------------------------------------------
function TeamConfigSection({ onChanged }: { onChanged: () => void }) {
  const getRosterFn = useServerFn(getTeamConfig);
  const saveFn = useServerFn(saveTeamConfig);

  const { data: config, isLoading } = useQuery({
    queryKey: ["signature-team-config"],
    queryFn: () => getRosterFn({ data: undefined }),
  });

  const [form, setForm] = useState<Partial<TeamConfig>>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) setForm(config as TeamConfig);
  }, [config]);

  const handleSave = async () => {
    if (!form.accolade_line1) return;
    setSaving(true);
    try {
      await saveFn({ data: form as any });
      toast.success("Team settings saved");
      onChanged();
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const f = (id: string, label: string, key: keyof TeamConfig, placeholder?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      <Input
        id={id}
        value={(form[key] as string) ?? ""}
        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        className="h-9 text-sm"
      />
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-5 hover:bg-sidebar/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gold/15 text-gold flex items-center justify-center">
            <Settings className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="font-semibold text-sm">Team-Wide Settings</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Accolade banner · links · logo · social icons
            </div>
          </div>
        </div>
        <ChevronRight
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")}
        />
      </button>

      {open && (
        <div className="border-t border-border p-5 space-y-5">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              {/* Accolade */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
                  Accolade Banner
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {f("acc1", "Line 1 (bold)", "accolade_line1", "#1 Real Estate Team in Missouri")}
                  {f("acc2", "Line 2 (secondary)", "accolade_line2", "#18 in the Country by Sides")}
                </div>
              </div>
              {/* Links */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
                  Links
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {f("web", "Website URL", "website_url")}
                  {f("val", "Home Valuation URL", "valuation_url")}
                  {f("fb", "Facebook URL", "facebook_url")}
                  {f("ig", "Instagram URL", "instagram_url")}
                </div>
              </div>
              {/* Assets */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
                  Image URLs (must be permanent public https:// URLs)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {f("logo", "Team Logo", "logo_url", "https://...")}
                  {f("ico-web", "Web Icon", "icon_web_url", "https://...")}
                  {f("ico-fb", "Facebook Icon", "icon_fb_url", "https://...")}
                  {f("ico-ig", "Instagram Icon", "icon_ig_url", "https://...")}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1.5">
                  <Info className="h-3 w-3 shrink-0" />
                  Upload images to Supabase Storage → set to public → paste the permanent URL here.
                </p>
              </div>
              {/* HTML Template Editor */}
              <div className="space-y-1.5">
                <Label htmlFor="html_template" className="text-xs text-muted-foreground uppercase tracking-wide">
                  HTML Email Template (Base Template)
                </Label>
                <Textarea
                  id="html_template"
                  value={form.html_template ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, html_template: e.target.value }))}
                  placeholder="Enter base HTML email template..."
                  className="font-mono text-xs h-[300px] bg-muted/30 border-border"
                />
                <div className="text-[10px] text-muted-foreground mt-2 space-y-1.5 p-3 rounded-lg border border-border bg-sidebar/25">
                  <p className="font-semibold text-foreground">Available Placeholders:</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[9px] text-gold">
                    <div>{"{{name}}"} - Agent Name</div>
                    <div>{"{{title}}"} - Title / Role</div>
                    <div>{"{{mobile_phone}}"} - Mobile Phone</div>
                    <div>{"{{office_phone}}"} - Office Phone</div>
                    <div>{"{{headshot_url}}"} - Public Headshot URL</div>
                    <div>{"{{logo_url}}"} - Public Logo URL</div>
                    <div>{"{{office1_label}}"} - Office 1 Label</div>
                    <div>{"{{office1_addr}}"} - Office 1 Address</div>
                    <div>{"{{office2_label}}"} - Office 2 Label</div>
                    <div>{"{{office2_addr}}"} - Office 2 Address</div>
                    <div>{"{{website_url}}"} - Website Link</div>
                    <div>{"{{valuation_url}}"} - Valuation Link</div>
                    <div>{"{{facebook_url}}"} - FB Profile Link</div>
                    <div>{"{{instagram_url}}"} - IG Profile Link</div>
                    <div>{"{{accolade_line1}}"} - Banner Title</div>
                    <div>{"{{accolade_line2}}"} - Banner Subtitle</div>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-2 leading-relaxed">
                    Supports basic Handlebars-style conditionals:
                    <br />
                    <code className="bg-muted px-1 py-0.5 rounded text-foreground">{"{{#if mobile_phone}} ... {{/if}}"}</code> or
                    <br />
                    <code className="bg-muted px-1 py-0.5 rounded text-foreground">{"{{#if headshot_url}} ... {{else}} ... {{/if}}"}</code>
                  </p>
                </div>
              </div>
              <Button
                className="bg-gold text-navy font-semibold hover:bg-gold/90 gap-2"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Team Settings
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Main Page
// ----------------------------------------------------------------
function SignaturesPage() {
  const { isAdmin, loading, roles } = useAuth();
  const qc = useQueryClient();

  const canAccess = isAdmin || roles.includes("marketing_coordinator");

  const getRosterFn = useServerFn(getSignatureRoster);
  const getConfigFn = useServerFn(getTeamConfig);

  const { data: roster = [], isLoading: rosterLoading, error: rosterError } = useQuery({
    queryKey: ["signature-roster"],
    enabled: canAccess,
    queryFn: () => getRosterFn({ data: undefined }),
  });

  const { data: teamConfig } = useQuery({
    queryKey: ["signature-team-config"],
    enabled: canAccess,
    queryFn: () => getConfigFn({ data: undefined }),
  });

  const [selectedAgent, setSelectedAgent] = useState<AgentSig | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleEditAgent = (agent: AgentSig) => {
    setSelectedAgent(agent);
    setSheetOpen(true);
  };

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ["signature-roster"] });
  };

  if (loading) {
    return (
      <div className="p-8 text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!canAccess) return <Navigate to="/dashboard" />;

  const complete = (roster as AgentSig[]).filter((a) => sigCompleteness(a).complete).length;
  const total = (roster as AgentSig[]).length;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Page header */}
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
              <Mail className="h-6 w-6 text-gold" />
              Email Signatures
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage branded Gmail signatures for every agent on the team.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled
              className="opacity-50 cursor-not-allowed gap-1.5 text-xs"
              title="Gmail integration coming soon — awaiting service account setup"
            >
              <Mail className="h-3.5 w-3.5" />
              Push All to Gmail
              <Badge className="ml-1 bg-amber-500/15 text-amber-400 border-amber-500/30 border text-[10px] py-0">
                Coming Soon
              </Badge>
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        {!rosterLoading && total > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-3 max-w-md">
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <div className="text-2xl font-bold text-gold">{total}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Agents</div>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">{complete}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Complete</div>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">{total - complete}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Need Attention</div>
            </div>
          </div>
        )}
      </header>

      {/* Gmail integration notice */}
      <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
        <Info className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-300">
          <span className="font-semibold">Gmail push is not yet connected.</span>{" "}
          You can build out every agent's signature and preview it here. Once you have the Google Workspace
          service account credentials, the Push to Gmail buttons will activate.
        </div>
      </div>

      {/* Team-wide settings */}
      <TeamConfigSection
        onChanged={() => qc.invalidateQueries({ queryKey: ["signature-team-config"] })}
      />

      {/* Agent roster */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gold/15 text-gold flex items-center justify-center">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Agent Roster</div>
            <div className="text-xs text-muted-foreground">
              {rosterLoading ? "Loading…" : `${total} agents`}
            </div>
          </div>
        </div>

        {rosterLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading agents…
          </div>
        ) : rosterError ? (
          <div className="p-8 text-center text-sm">
            <div className="text-rose-400 font-medium mb-1">Failed to load roster</div>
            <div className="text-muted-foreground text-xs font-mono">{(rosterError as any)?.message ?? String(rosterError)}</div>
          </div>
        ) : total === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No agents found.</div>
        ) : (
          <div className="divide-y divide-border">
            {(roster as AgentSig[]).map((agent) => {
              const fullName = agent.name || agent.email || "Unknown Agent";
              const { complete: isComplete, missing } = sigCompleteness(agent);
              const lastPushed = agent.sig?.last_pushed_at;
              const pushStatus = agent.sig?.last_push_status;

              return (
                <div key={agent.id} className="p-4 flex flex-wrap items-center gap-3 hover:bg-sidebar/30 transition-colors">
                  {/* Avatar */}
                  <div className="h-9 w-9 rounded-full bg-gold/10 border border-gold/20 text-gold flex items-center justify-center text-sm font-semibold shrink-0">
                    {(agent.name?.[0] ?? agent.email?.[0] ?? "?").toUpperCase()}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-medium text-sm">{fullName}</div>
                    <div className="text-xs text-muted-foreground">{agent.email}</div>
                  </div>

                  {/* Gmail target */}
                  <div className="min-w-[180px] hidden md:block">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Gmail Target</div>
                    <div className="text-xs mt-0.5 font-mono text-foreground/80 truncate max-w-[180px]">
                      {agent.sig?.gmail_email ?? (
                        <span className="text-muted-foreground italic">not set</span>
                      )}
                    </div>
                  </div>

                  {/* Phone quick-view */}
                  <div className="min-w-[120px] hidden lg:flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground/80">
                      {agent.sig?.mobile_phone ?? (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </span>
                  </div>

                  {/* Last push */}
                  <div className="min-w-[130px] hidden lg:block">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Last Push</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {pushStatus === "success" && (
                        <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
                      )}
                      {pushStatus === "error" && (
                        <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
                      )}
                      <span className="text-xs text-foreground/70">
                        {lastPushed
                          ? new Date(lastPushed).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "2-digit",
                            })
                          : "Never"}
                      </span>
                    </div>
                  </div>

                  {/* Completeness */}
                  <div className="shrink-0">
                    <CompletenessBadge agent={agent} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => handleEditAgent(agent)}
                    >
                      <Eye className="h-3 w-3" />
                      Edit / Preview
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Agent editor sheet */}
      <AgentSheet
        agent={selectedAgent}
        team={(teamConfig as TeamConfig) ?? null}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
