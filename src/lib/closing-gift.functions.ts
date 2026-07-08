import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminOrClientCare(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("admin") && !roles.includes("client_care")) {
    throw new Error("Forbidden: Admin or Client Care role required");
  }
  return roles as string[];
}

async function assertAdmin(supabase: any, userId: string) {
  // Client Care owns the closing-gift inventory process, so treat them as admin here.
  await assertAdminOrClientCare(supabase, userId);
}


const SECURITY_CODE = "MSREG2026";

const shirtSchema = z.object({
  size: z.string().trim().min(1).max(10),
  color: z.string().trim().min(1).max(60),
});

const submitSchema = z.object({
  security_code: z.string(),
  agent_name: z.string().trim().min(1).max(120),
  client_first_name: z.string().trim().min(1).max(80),
  client_last_name: z.string().trim().min(1).max(80),
  closing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Closing date is required"),
  closing_location: z.enum(["rolla", "str", "osage_beach"]),
  comments: z.string().trim().max(2000).optional().nullable(),
  shirts: z.array(shirtSchema).min(1).max(3),
});

export type SubmitClosingGiftInput = z.infer<typeof submitSchema>;

export const submitClosingGiftRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    if (data.security_code !== SECURITY_CODE) {
      throw new Error("Invalid security code");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Load relevant inventory rows
    const sizes = Array.from(new Set(data.shirts.map((s) => s.size)));
    const colors = Array.from(new Set(data.shirts.map((s) => s.color)));
    const { data: inv, error: invErr } = await sb
      .from("closing_gift_inventory")
      .select("id,size,color,color_hex,quantity_available")
      .in("size", sizes)
      .in("color", colors);
    if (invErr) throw new Error(invErr.message);

    // Tally requested per (size,color)
    const tally = new Map<string, number>();
    for (const s of data.shirts) {
      const key = `${s.size}|${s.color}`;
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    const invByKey = new Map<string, any>();
    for (const row of inv ?? []) invByKey.set(`${row.size}|${row.color}`, row);

    const enrichedShirts: Array<{ size: string; color: string; color_hex: string }> = [];
    for (const [key, count] of tally.entries()) {
      const row = invByKey.get(key);
      if (!row) throw new Error(`Out of stock: ${key.replace("|", " / ")}`);
      if (row.quantity_available < count) {
        throw new Error(`Not enough stock for ${row.size} ${row.color}`);
      }
    }
    for (const s of data.shirts) {
      const row = invByKey.get(`${s.size}|${s.color}`);
      enrichedShirts.push({ size: s.size, color: s.color, color_hex: row.color_hex });
    }

    // Insert request
    const { data: inserted, error: insErr } = await sb
      .from("closing_gift_requests")
      .insert({
        agent_name: data.agent_name,
        client_first_name: data.client_first_name,
        client_last_name: data.client_last_name,
        closing_date: data.closing_date,
        closing_location: data.closing_location,
        comments: data.comments ?? null,
        shirts: enrichedShirts,
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    // Decrement inventory
    for (const [key, count] of tally.entries()) {
      const row = invByKey.get(key);
      const { error: updErr } = await sb
        .from("closing_gift_inventory")
        .update({ quantity_available: row.quantity_available - count })
        .eq("id", row.id);
      if (updErr) throw new Error(updErr.message);
    }

    return { ok: true, id: inserted.id as string };
  });

export const listClosingGiftInventory = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ security_code: z.string() }).parse(data))
  .handler(async ({ data }) => {
    if (data.security_code !== SECURITY_CODE) {
      throw new Error("Invalid security code");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("closing_gift_inventory")
      .select("size,color,color_hex,quantity_available")
      .order("size")
      .order("color");
    if (error) throw new Error(error.message);
    return rows as Array<{ size: string; color: string; color_hex: string; quantity_available: number }>;
  });

const upsertSchema = z.object({
  size: z.string().trim().min(1).max(10),
  color: z.string().trim().min(1).max(60),
  color_hex: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color"),
  quantity: z.number().int().min(0).max(100000),
});

export const addOrUpdateInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: existing, error: findErr } = await sb
      .from("closing_gift_inventory")
      .select("id")
      .eq("size", data.size)
      .eq("color", data.color)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);

    if (existing) {
      const { error } = await sb
        .from("closing_gift_inventory")
        .update({
          color_hex: data.color_hex,
          quantity_available: data.quantity,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: existing.id as string, updated: true };
    } else {
      const { data: inserted, error } = await sb
        .from("closing_gift_inventory")
        .insert({
          size: data.size,
          color: data.color,
          color_hex: data.color_hex,
          quantity_available: data.quantity,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true, id: inserted.id as string, updated: false };
    }
  });

export const deleteInventoryRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("closing_gift_inventory")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markRequestCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      request_id: z.string().uuid(),
      status: z.enum(["pending", "fulfilled", "completed"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrClientCare(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("closing_gift_requests")
      .update({ status: data.status ?? "completed" })
      .eq("id", data.request_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
