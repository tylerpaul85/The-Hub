import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public (no-auth) availability functions for the Agent Hub.
// Backed by supabaseAdmin since the public Agent Hub has no signed-in user.

export const publicListActiveAgents = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("duty_calendar_agents")
    .select("id,name,office")
    .eq("status", "active")
    .order("office")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const publicListAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ agent_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("agent_availability")
      .select("id,agent_id,date_start,date_end,reason,created_at")
      .eq("agent_id", data.agent_id)
      .order("date_start", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const availabilitySchema = z.object({
  id: z.string().uuid().optional(),
  agent_id: z.string().uuid(),
  date_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.enum(["vacation", "sick", "personal", "other"]).nullable().optional(),
});

export const publicSubmitAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => availabilitySchema.parse(d))
  .handler(async ({ data }) => {
    if (data.date_end < data.date_start) throw new Error("End date must be on or after start date");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const payload = {
      agent_id: data.agent_id,
      date_start: data.date_start,
      date_end: data.date_end,
      reason: data.reason ?? null,
    };
    if (data.id) {
      const { error } = await sb.from("agent_availability").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await sb
      .from("agent_availability")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row!.id };
  });

export const publicDeleteAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("agent_availability")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
