import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function clientIp(): string | null {
  return (
    getRequestHeader("cf-connecting-ip") ||
    (getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? null)
  );
}

const eventSchema = z.object({
  event_type: z.string().min(1).max(100),
  target_user_id: z.string().uuid().optional(),
  target_id: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

/** Authenticated audit-log writer. RLS allows only admin reads. */
export const logAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => eventSchema.parse(data))
  .handler(async ({ data, context }) => {
    const ua = getRequestHeader("user-agent") ?? null;
    const ip = clientIp();
    const { error } = await (context.supabase as any).rpc("log_security_event", {
      _event_type: data.event_type,
      _target_user_id: data.target_user_id ?? null,
      _target_id: data.target_id ?? null,
      _metadata: data.metadata ?? {},
      _ip_address: ip,
      _user_agent: ua,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public auth-event writer (login success/failure). No auth required. */
export const logAuthEvent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        event_type: z.enum(["auth.login_success", "auth.login_failure", "auth.signout", "auth.signup", "auth.rate_limited"]),
        email: z.string().email().max(255).optional(),
        reason: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ua = getRequestHeader("user-agent") ?? null;
    const ip = clientIp();
    await (supabaseAdmin as any).rpc("log_security_event", {
      _event_type: data.event_type,
      _target_user_id: null,
      _target_id: data.email ?? null,
      _metadata: data.reason ? { reason: data.reason } : {},
      _ip_address: ip,
      _user_agent: ua,
    });
    return { ok: true };
  });

/** Rate-limit hit. Returns { allowed: boolean }. */
export const checkRateLimit = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        bucket: z.enum(["login", "marketing_request"]),
        key: z.string().min(1).max(200).optional(),
        window_seconds: z.number().int().min(1).max(86400),
        max: z.number().int().min(1).max(1000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = clientIp() ?? "unknown";
    const key = data.key ? `${ip}:${data.key}` : ip;
    const { data: allowed, error } = await (supabaseAdmin as any).rpc("rate_limit_hit", {
      _bucket: data.bucket,
      _key: key,
      _window_seconds: data.window_seconds,
      _max: data.max,
    });
    if (error) throw new Error(error.message);
    return { allowed: allowed === true };
  });
