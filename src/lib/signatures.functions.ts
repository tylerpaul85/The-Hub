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
  user_id: z.string().uuid(),
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
});

const PushSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(200),
});

// ----------------------------------------------------------------
// getSignatureRoster
// Returns all profiles that have a non-client_care role, joined with
// their agent_signature_data row (may be null for new agents).
// ----------------------------------------------------------------
export const getSignatureRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrMarketing(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Pull all profiles
    const { data: profiles, error: pErr } = await sb
      .from("profiles")
      .select("id, email, first_name, last_name")
      .order("last_name", { ascending: true });
    if (pErr) throw new Error(pErr.message);

    // Pull their roles
    const { data: roleRows, error: rErr } = await sb
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);

    // Exclude pure client_care users
    const rolesByUser = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }

    const agentProfiles = (profiles ?? []).filter((p: any) => {
      const roles = rolesByUser.get(p.id) ?? [];
      return roles.length > 0 && !roles.every((r: string) => r === "client_care");
    });

    // Pull all signature data rows
    const agentIds = agentProfiles.map((p: any) => p.id);
    const { data: sigRows, error: sErr } = await sb
      .from("agent_signature_data")
      .select("*")
      .in("user_id", agentIds);
    if (sErr) throw new Error(sErr.message);

    const sigByUser = new Map<string, any>();
    for (const s of sigRows ?? []) {
      sigByUser.set(s.user_id, s);
    }

    return agentProfiles.map((p: any) => ({
      ...p,
      sig: sigByUser.get(p.id) ?? null,
    }));
  });

// ----------------------------------------------------------------
// getTeamConfig
// ----------------------------------------------------------------
export const getTeamConfig = createServerFn({ method: "GET" })
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
          user_id: data.user_id,
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
        { onConflict: "user_id" }
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
  user_id: z.string().uuid(),
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

    // Deterministic storage path: signature-headshots/{user_id}/{filename}
    const ext = data.mime_type.split("/")[1];
    const path = `${data.user_id}/headshot.${ext}`;

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
  user_id: z.string().uuid(),
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
      user_id: data.user_id,
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
      .eq("user_id", data.user_id);

    return { ok: true };
  });
