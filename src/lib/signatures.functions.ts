import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ----------------------------------------------------------------
// Role guard helpers
// ----------------------------------------------------------------
async function assertAdminOrMarketing(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role as string);
  if (!roles.includes("admin") && !roles.includes("marketing_coordinator")) {
    throw new Error("Forbidden: Admin or Marketing Coordinator role required");
  }
  return roles;
}

// ----------------------------------------------------------------
// Zod schemas
// ----------------------------------------------------------------
const AgentSigSchema = z.object({
  toolbox_agent_id: z.string().uuid(),
  title: z.string().max(120).nullable().optional(),
  mobile_phone: z.string().max(30).nullable().optional(),
  office_phone: z.string().max(30).nullable().optional(),
  headshot_url: z.string().url().max(1000).nullable().optional().or(z.literal("")),
  office1_label: z.string().max(80).nullable().optional(),
  office1_addr: z.string().max(200).nullable().optional(),
  office2_label: z.string().max(80).nullable().optional(),
  office2_addr: z.string().max(200).nullable().optional(),
  show_office_rolla: z.boolean().optional().nullable(),
  show_office_strobert: z.boolean().optional().nullable(),
  show_office_osage: z.boolean().optional().nullable(),
  office_rolla_addr: z.string().max(200).nullable().optional(),
  office_strobert_addr: z.string().max(200).nullable().optional(),
  office_osage_addr: z.string().max(200).nullable().optional(),
  gmail_email: z.string().email().max(255).nullable().optional().or(z.literal("")),
});

const TeamConfigSchema = z.object({
  accolade_line1: z.string().max(200),
  accolade_line2: z.string().max(200),
  website_url: z.string().url().max(500),
  valuation_url: z.string().url().max(500),
  facebook_url: z.string().url().max(500),
  instagram_url: z.string().url().max(500),
  logo_url: z.string().max(1000),
  icon_fb_url: z.string().max(1000),
  icon_ig_url: z.string().max(1000),
  icon_web_url: z.string().max(1000),
  html_template: z.string().max(30000).optional().nullable(),
  office_rolla_addr: z.string().max(250).optional().nullable(),
  office_strobert_addr: z.string().max(250).optional().nullable(),
  office_osage_addr: z.string().max(250).optional().nullable(),
});

const PushSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(200),
});

// ----------------------------------------------------------------
// getSignatureRoster
// Returns all agents from public.toolbox_agents, joined with
// their agent_signature_data row.
// ----------------------------------------------------------------
export const getSignatureRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrMarketing(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Pull all toolbox agents
    const { data: agents, error: aErr } = await sb
      .from("toolbox_agents")
      .select("id, name, email, headshot_url, active")
      .order("name", { ascending: true });
    if (aErr) throw new Error(aErr.message);

    const agentIds = (agents ?? []).map((a: any) => a.id);

    // Pull all signature data rows
    const { data: sigRows, error: sErr } = await sb
      .from("agent_signature_data")
      .select("*")
      .in("toolbox_agent_id", agentIds);
    if (sErr) throw new Error(sErr.message);

    const sigByAgent = new Map<string, any>();
    for (const s of sigRows ?? []) {
      sigByAgent.set(s.toolbox_agent_id, s);
    }

    return (agents ?? []).map((a: any) => ({
      ...a,
      sig: sigByAgent.get(a.id) ?? null,
    }));
  });

// ----------------------------------------------------------------
// getTeamConfig
// ----------------------------------------------------------------
export const getTeamConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrMarketing(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("signature_team_config")
      .select("*")
      .limit(1)
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

// ----------------------------------------------------------------
// saveAgentSignatureData  (upsert)
// ----------------------------------------------------------------
export const saveAgentSignatureData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AgentSigSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdminOrMarketing(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("agent_signature_data")
      .upsert(
        {
          toolbox_agent_id: data.toolbox_agent_id,
          title: data.title ?? null,
          mobile_phone: data.mobile_phone ?? null,
          office_phone: data.office_phone ?? null,
          headshot_url: data.headshot_url || null,
          office1_label: data.office1_label ?? null,
          office1_addr: data.office1_addr ?? null,
          office2_label: data.office2_label ?? null,
          office2_addr: data.office2_addr ?? null,
          show_office_rolla: data.show_office_rolla ?? true,
          show_office_strobert: data.show_office_strobert ?? false,
          show_office_osage: data.show_office_osage ?? false,
          office_rolla_addr: data.office_rolla_addr ?? null,
          office_strobert_addr: data.office_strobert_addr ?? null,
          office_osage_addr: data.office_osage_addr ?? null,
          gmail_email: data.gmail_email || null,
        },
        { onConflict: "toolbox_agent_id" }
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----------------------------------------------------------------
// saveTeamConfig  (update the single row)
// ----------------------------------------------------------------
export const saveTeamConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TeamConfigSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdminOrMarketing(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Update whichever row exists (there should be exactly one)
    const { error } = await (supabaseAdmin as any)
      .from("signature_team_config")
      .update({
        accolade_line1: data.accolade_line1,
        accolade_line2: data.accolade_line2,
        website_url: data.website_url,
        valuation_url: data.valuation_url,
        facebook_url: data.facebook_url,
        instagram_url: data.instagram_url,
        logo_url: data.logo_url,
        icon_fb_url: data.icon_fb_url,
        icon_ig_url: data.icon_ig_url,
        icon_web_url: data.icon_web_url,
        html_template: data.html_template ?? null,
        office_rolla_addr: data.office_rolla_addr ?? null,
        office_strobert_addr: data.office_strobert_addr ?? null,
        office_osage_addr: data.office_osage_addr ?? null,
      })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // matches all rows
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----------------------------------------------------------------
// uploadHeadshot
// Accepts a base64-encoded image and filename, uploads to Supabase
// Storage public bucket "signature-headshots", returns permanent URL.
// ----------------------------------------------------------------
const UploadHeadshotSchema = z.object({
  toolbox_agent_id: z.string().uuid(),
  filename: z.string().max(200),
  base64: z.string().max(10_000_000), // ~7.5 MB limit
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export const uploadHeadshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UploadHeadshotSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdminOrMarketing(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Decode base64 → Buffer
    const buffer = Buffer.from(data.base64.replace(/^data:[^;]+;base64,/, ""), "base64");

    // Deterministic storage path: signature-headshots/{toolbox_agent_id}/{filename}
    const ext = data.mime_type.split("/")[1];
    const path = `${data.toolbox_agent_id}/headshot.${ext}`;

    const { error } = await sb.storage
      .from("signature-headshots")
      .upload(path, buffer, {
        upsert: true,
        contentType: data.mime_type,
        cacheControl: "31536000", // 1 year
      });
    if (error) throw new Error(error.message);

    const { data: urlData } = sb.storage
      .from("signature-headshots")
      .getPublicUrl(path);

    return { url: urlData.publicUrl as string };
  });

// ----------------------------------------------------------------
// recordPushResult  (called after Gmail push — placeholder for now)
// Records the outcome to signatures_push_log and updates agent row.
// ----------------------------------------------------------------
const PushResultSchema = z.object({
  toolbox_agent_id: z.string().uuid(),
  gmail_email: z.string().email(),
  status: z.enum(["success", "error"]),
  error_msg: z.string().max(1000).nullable().optional(),
});

export const recordPushResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PushResultSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdminOrMarketing(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Write audit log
    await sb.from("signatures_push_log").insert({
      toolbox_agent_id: data.toolbox_agent_id,
      pushed_by: context.userId,
      gmail_email: data.gmail_email,
      status: data.status,
      error_msg: data.error_msg ?? null,
    });

    // Update last_pushed_at on agent row
    await sb
      .from("agent_signature_data")
      .update({
        last_pushed_at: new Date().toISOString(),
        last_push_status: data.status,
        last_push_error: data.error_msg ?? null,
      })
      .eq("toolbox_agent_id", data.toolbox_agent_id);

    return { ok: true };
  });

const DEFAULT_SIGNATURE_TEMPLATE = `<!-- HTML EMAIL SIGNATURE TEMPLATE -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="700" style="border-collapse:collapse; width:700px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background-color:#ffffff;">
  <!-- TOP BANNER -->
  <tr>
    <td style="padding:0 0 20px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="700" style="border-collapse:collapse; width:700px;">
        <tr>
          <td bgcolor="#16232f" align="center" width="700" style="background-color:#16232f; width:700px; padding:9px 0; border-radius:4px;">
            <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:10px; line-height:13px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:#ffffff;">
              {{accolade_line1}}
            </span>
            {{#if accolade_line2}}
            <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:10px; line-height:13px; font-weight:400; letter-spacing:1.2px; text-transform:uppercase; color:#8ba3ba;">
              &nbsp;&nbsp;&middot;&nbsp;&nbsp;{{accolade_line2}}
            </span>
            {{/if}}
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
          <td valign="middle" align="left" width="158" style="width:158px; padding:0 18px 0 0;">
            {{#if headshot_url}}
            <img src="{{headshot_url}}" alt="{{name}}" width="140" height="140" border="0" style="display:block; width:140px; height:140px; border-radius:50%; object-fit:cover; object-position:center top; border:1px solid #e2e8f0;" />
            {{else}}
            <div style="width:140px; height:140px; background-color:#f7fafc; border:1px dashed #cbd5e0; border-radius:50%; display:inline-block;"></div>
            {{/if}}
          </td>

          <!-- DIVIDER LINE -->
          <td width="1" bgcolor="#e2e8f0" style="width:1px; background-color:#e2e8f0; font-size:0; line-height:0;">&nbsp;</td>

          <!-- COLUMN 2: NAME, TITLE, LOGO -->
          <td valign="middle" align="left" width="205" style="width:205px; padding:0 18px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="169" style="width:169px;">
              <tr>
                <td align="left" style="padding:0 0 3px 0;">
                  <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:23px; line-height:27px; font-weight:700; color:#16232f; letter-spacing:-0.4px; white-space:nowrap;">
                    {{name}}
                  </span>
                </td>
              </tr>
              <tr>
                <td align="left" style="padding:0 0 14px 0;">
                  <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:10px; line-height:13px; font-weight:700; color:#8ba3ba; text-transform:uppercase; letter-spacing:1px; white-space:nowrap;">
                    {{title}}
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:0;">
                  {{#if logo_url}}
                  <a href="{{website_url}}" target="_blank" style="text-decoration:none; display:block;">
                    <img src="{{logo_url}}" alt="Matt Smith Real Estate Group" width="125" border="0" style="display:block; width:125px; height:auto; margin:0 auto;" />
                  </a>
                  {{/if}}
                </td>
              </tr>
            </table>
          </td>

          <!-- DIVIDER LINE -->
          <td width="1" bgcolor="#e2e8f0" style="width:1px; background-color:#e2e8f0; font-size:0; line-height:0;">&nbsp;</td>

          <!-- COLUMN 3: PHONES, ADDRESSES, CTA, SOCIALS -->
          <td valign="top" align="left" width="299" style="padding:0 0 0 18px; width:299px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="281" height="140" style="width:281px; height:140px;">
              <!-- Phone Row -->
              <tr>
                <td align="left" valign="top" style="padding:0 0 14px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; line-height:15px; color:#16232f; white-space:nowrap;">
                  {{#if mobile_phone}}
                  <span style="color:#C9A84C; font-weight:700; font-size:9px; letter-spacing:0.5px;">M</span>&nbsp;<strong style="font-weight:700;">{{mobile_phone}}</strong>
                  {{/if}}
                  {{#if office_phone}}
                  <span style="color:#cbd5e0;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
                  <span style="color:#8ba3ba; font-weight:700; font-size:9px; letter-spacing:0.5px;">O</span>&nbsp;<span style="color:#4a5568;">{{office_phone}}</span>
                  {{/if}}
                </td>
              </tr>

              <!-- Office Addresses -->
              <tr>
                <td valign="top" style="padding:0 0 16px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="281" style="width:281px;">
                    <tr>
                      {{#if office1_addr}}
                      <td align="left" valign="top" style="padding:0 10px 6px 0; width:135px;">
                        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:10px; line-height:13px; font-weight:700; color:#16232f; text-transform:uppercase; letter-spacing:0.5px;">{{office1_label}}</div>
                        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:9px; line-height:13px; color:#718096; padding-top:2px;">{{office1_addr}}</div>
                      </td>
                      {{/if}}
                      {{#if office2_addr}}
                      <td align="left" valign="top" style="padding:0 0 6px 0; width:136px;">
                        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:10px; line-height:13px; font-weight:700; color:#16232f; text-transform:uppercase; letter-spacing:0.5px;">{{office2_label}}</div>
                        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:9px; line-height:13px; color:#718096; padding-top:2px;">{{office2_addr}}</div>
                      </td>
                      {{/if}}
                    </tr>
                    {{#if office3_addr}}
                    <tr>
                      <td align="left" valign="top" colspan="2" style="padding:4px 0 0 0;">
                        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:10px; line-height:13px; font-weight:700; color:#16232f; text-transform:uppercase; letter-spacing:0.5px;">{{office3_label}}</div>
                        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:9px; line-height:13px; color:#718096; padding-top:2px;">{{office3_addr}}</div>
                      </td>
                    </tr>
                    {{/if}}
                  </table>
                </td>
              </tr>

              <!-- CTA Button + Socials Row -->
              <tr>
                <td valign="bottom" style="padding:0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="281" style="width:281px;">
                    <tr>
                      <!-- Call to Action Button -->
                      <td align="left" valign="middle" style="padding:0;">
                        {{#if valuation_url}}
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td bgcolor="#1e70e6" align="center" style="background-color:#1e70e6; border-radius:4px; padding:9px 16px;">
                              <a href="{{valuation_url}}" target="_blank" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:10px; line-height:13px; font-weight:700; color:#ffffff; text-decoration:none; display:inline-block; text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap;">
                                Instant Home Valuation &rarr;
                              </a>
                            </td>
                          </tr>
                        </table>
                        {{/if}}
                      </td>

                      <!-- Social Icons -->
                      <td align="right" valign="middle" style="padding:0;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right">
                          <tr>
                            {{#if facebook_url}}
                            <td style="padding:0 0 0 8px;">
                              <a href="{{facebook_url}}" target="_blank" style="text-decoration:none;">
                                <img src="{{icon_fb_url}}" alt="Facebook" width="18" height="18" border="0" style="display:block; width:18px; height:18px;" />
                              </a>
                            </td>
                            {{/if}}
                            {{#if instagram_url}}
                            <td style="padding:0 0 0 8px;">
                              <a href="{{instagram_url}}" target="_blank" style="text-decoration:none;">
                                <img src="{{icon_ig_url}}" alt="Instagram" width="18" height="18" border="0" style="display:block; width:18px; height:18px;" />
                              </a>
                            </td>
                            {{/if}}
                            {{#if website_url}}
                            <td style="padding:0 0 0 8px;">
                              <a href="{{website_url}}" target="_blank" style="text-decoration:none;">
                                <img src="{{icon_web_url}}" alt="Website" width="18" height="18" border="0" style="display:block; width:18px; height:18px;" />
                              </a>
                            </td>
                            {{/if}}
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- BOTTOM BAR ACCENT -->
  <tr>
    <td height="1" style="font-size:0; line-height:0; padding:20px 0 0 0; border-top:2px solid #C9A84C;">&nbsp;</td>
  </tr>
</table>`;

export function minifySignatureHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function compileTemplateServer(template: string, data: Record<string, any>): string {
  let rendered = template;
  const ifElseRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
  rendered = rendered.replace(ifElseRegex, (match, key, trueBranch, falseBranch) => {
    const val = data[key];
    const isTrue = val && String(val).trim() !== "" && String(val) !== "null";
    return isTrue ? trueBranch : (falseBranch || "");
  });
  const varRegex = /\{\{(\w+)\}\}/g;
  rendered = rendered.replace(varRegex, (match, key) => {
    const val = data[key];
    return val !== undefined && val !== null && String(val) !== "null" ? String(val) : "";
  });
  return minifySignatureHtml(rendered);
}

const PushSignaturesInput = z.object({
  toolbox_agent_ids: z.array(z.string().uuid()),
});

export const pushSignatureToGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PushSignaturesInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdminOrMarketing(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const keyString = process.env.GOOGLE_SA_KEY_JSON;
    if (!keyString) {
      throw new Error("Missing Google Service Account key in environment variables (GOOGLE_SA_KEY_JSON)");
    }
    let key: any;
    try {
      key = JSON.parse(keyString);
    } catch (e) {
      // Handle escaped double quotes from Netlify configuration
      try {
        key = JSON.parse(keyString.replace(/\\n/g, '\n'));
      } catch (e2) {
        throw new Error("Failed to parse GOOGLE_SA_KEY_JSON environment variable. Ensure it is valid JSON.");
      }
    }

    // Get team config
    const { data: teamConfig, error: tcErr } = await sb
      .from("signature_team_config")
      .select("*")
      .limit(1)
      .single();
    if (tcErr) throw new Error(tcErr.message);

    // Get agents & signature data
    const { data: agents, error: aErr } = await sb
      .from("toolbox_agents")
      .select("id, name, email, headshot_url")
      .in("id", data.toolbox_agent_ids);
    if (aErr) throw new Error(aErr.message);

    const { data: sigRows, error: sErr } = await sb
      .from("agent_signature_data")
      .select("*")
      .in("toolbox_agent_id", data.toolbox_agent_ids);
    if (sErr) throw new Error(sErr.message);

    const sigByAgent = new Map<string, any>();
    for (const s of sigRows ?? []) {
      sigByAgent.set(s.toolbox_agent_id, s);
    }

    const { google } = await import("googleapis");

    const results: Array<{ id: string; name: string; status: "success" | "error"; error?: string }> = [];

    for (const agent of agents ?? []) {
      const sig = sigByAgent.get(agent.id);
      const gmailEmail = sig?.gmail_email || agent.email;

      if (!gmailEmail) {
        results.push({
          id: agent.id,
          name: agent.name,
          status: "error",
          error: "No Gmail email configured for this agent.",
        });
        continue;
      }

      try {
        // Calculate active office locations based on agent checkboxes and team defaults
        const rollaAddr = sig?.office_rolla_addr || teamConfig.office_rolla_addr || "1043 Kingshighway, Rolla, MO 65401";
        const strobertAddr = sig?.office_strobert_addr || teamConfig.office_strobert_addr || "157 Saint Robert Blvd, St. Robert, MO 65584";
        const osageAddr = sig?.office_osage_addr || teamConfig.office_osage_addr || "456 Shore Dr, Osage Beach, MO 65065";

        const showRolla = sig?.show_office_rolla ?? true;
        const showStRobert = sig?.show_office_strobert ?? false;
        const showOsage = sig?.show_office_osage ?? false;

        const activeOffices: Array<{ label: string; addr: string }> = [];
        if (showRolla && rollaAddr) activeOffices.push({ label: "Rolla", addr: rollaAddr });
        if (showStRobert && strobertAddr) activeOffices.push({ label: "St. Robert", addr: strobertAddr });
        if (showOsage && osageAddr) activeOffices.push({ label: "Osage Beach", addr: osageAddr });
        if (sig?.office1_addr) activeOffices.push({ label: sig.office1_label || "Primary Office", addr: sig.office1_addr });
        if (sig?.office2_addr) activeOffices.push({ label: sig.office2_label || "Second Office", addr: sig.office2_addr });

        const o1 = activeOffices[0];
        const o2 = activeOffices[1];
        const o3 = activeOffices[2];

        // Compile signature HTML
        const compilerData = {
          name: agent.name || "",
          email: agent.email || "",
          title: sig?.title ?? "",
          mobile_phone: sig?.mobile_phone ?? "",
          office_phone: sig?.office_phone ?? "",
          headshot_url: sig?.headshot_url ?? agent.headshot_url ?? "",
          office1_label: o1?.label ?? "",
          office1_addr: o1?.addr ?? "",
          office2_label: o2?.label ?? "",
          office2_addr: o2?.addr ?? "",
          office3_label: o3?.label ?? "",
          office3_addr: o3?.addr ?? "",
          office_rolla_addr: showRolla ? rollaAddr : "",
          office_strobert_addr: showStRobert ? strobertAddr : "",
          office_osage_addr: showOsage ? osageAddr : "",
          gmail_email: gmailEmail,
          accolade_line1: teamConfig.accolade_line1 || "",
          accolade_line2: teamConfig.accolade_line2 || "",
          website_url: teamConfig.website_url || "",
          valuation_url: teamConfig.valuation_url || "",
          facebook_url: teamConfig.facebook_url || "",
          instagram_url: teamConfig.instagram_url || "",
          logo_url: teamConfig.logo_url || "",
          icon_fb_url: teamConfig.icon_fb_url || "",
          icon_ig_url: teamConfig.icon_ig_url || "",
          icon_web_url: teamConfig.icon_web_url || "",
        };

        const template = teamConfig.html_template || DEFAULT_SIGNATURE_TEMPLATE;
        const signatureHtml = compileTemplateServer(template, compilerData);

        // Impersonate agent
        const auth = new google.auth.JWT(
          key.client_email,
          undefined,
          key.private_key,
          ["https://www.googleapis.com/auth/gmail.settings.basic"],
          gmailEmail
        );

        const gmail = google.gmail({ version: "v1", auth });

        // Get primary alias
        const listRes = await gmail.users.settings.sendAs.list({ userId: "me" });
        const aliases = listRes.data.sendAs || [];
        const primaryAlias = aliases.find((a: any) => a.isPrimary) || aliases[0];

        if (!primaryAlias || !primaryAlias.sendAsEmail) {
          throw new Error("No Send-As aliases found for this Gmail account.");
        }

        // Push signature
        await gmail.users.settings.sendAs.patch({
          userId: "me",
          sendAsEmail: primaryAlias.sendAsEmail,
          requestBody: {
            signature: signatureHtml,
          },
        });

        // Write log
        await sb.from("signatures_push_log").insert({
          toolbox_agent_id: agent.id,
          pushed_by: context.userId,
          gmail_email: gmailEmail,
          status: "success",
        });

        // Update signature data
        await sb
          .from("agent_signature_data")
          .update({
            last_pushed_at: new Date().toISOString(),
            last_push_status: "success",
            last_push_error: null,
          })
          .eq("toolbox_agent_id", agent.id);

        results.push({
          id: agent.id,
          name: agent.name,
          status: "success",
        });
      } catch (err: any) {
        console.error(`Gmail Signature push failed for ${gmailEmail}:`, err);
        const errMsg = err?.message || String(err);

        await sb.from("signatures_push_log").insert({
          toolbox_agent_id: agent.id,
          pushed_by: context.userId,
          gmail_email: gmailEmail,
          status: "error",
          error_msg: errMsg.substring(0, 1000),
        });

        await sb
          .from("agent_signature_data")
          .update({
            last_push_status: "error",
            last_push_error: errMsg.substring(0, 1000),
          })
          .eq("toolbox_agent_id", agent.id);

        results.push({
          id: agent.id,
          name: agent.name,
          status: "error",
          error: errMsg,
        });
      }
    }

    return results;
  });

