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
