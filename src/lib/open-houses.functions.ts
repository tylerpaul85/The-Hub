import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

// -------------------------------------------------------------
// 1. PUBLIC VISITOR SIGN-IN ENDPOINTS
// -------------------------------------------------------------

const signinDetailsInput = z.object({
  id: z.string().uuid(),
});

export const getPublicOpenHouseForSignin = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => signinDetailsInput.parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: oh, error } = await sb
      .from("toolbox_open_houses")
      .select("id, address, agent_name, status, open_house_at, start_time, end_time, description, archived, is_completed")
      .eq("id", data.id)
      .maybeSingle();

    if (error || !oh) {
      throw new Error("Open house not found");
    }

    // Also get hero photo / thumbnail
    const { data: assets } = await sb
      .from("toolbox_open_house_assets")
      .select("thumbnail_url, file_url, category, created_at")
      .eq("open_house_id", data.id)
      .order("created_at", { ascending: true });

    let thumbnail: string | null = null;
    const isImg = (u: string | null | undefined) =>
      !!u && (/\/file\/d\/|[?&]id=|lh3\.googleusercontent\.com/i.test(String(u)) || /\.(png|jpe?g|gif|webp|svg|avif|heic)(\?|#|$)/i.test(String(u).split("?")[0]));

    const getThumb = (u: string) => {
      if (typeof u !== "string") return "";
      const fileIdMatch = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        u.match(/\/open\?id=([a-zA-Z0-9_-]+)/) ||
        u.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
        u.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
      return fileIdMatch && fileIdMatch[1] ? `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}` : u;
    };

    for (const a of (assets ?? []) as any[]) {
      const c = a.thumbnail_url || a.file_url;
      if (isImg(c)) {
        thumbnail = getThumb(c!);
        break;
      }
    }

    return {
      openHouse: {
        ...oh,
        thumbnail,
      },
    };
  });

const visitorSigninSchema = z.object({
  openHouseId: z.string().uuid(),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().default(""),
  phone: z.string().trim().min(7, "Valid phone number is required"),
  email: z.string().trim().default(""),
  workingWithAgent: z.boolean().default(false),
  agentName: z.string().trim().optional(),
  buyingOrSelling: z.enum(["buying", "selling", "both", "just_browsing"]).default("just_browsing"),
  timeframe: z.enum(["immediate", "1-3_months", "3-6_months", "6-12_months", "just_browsing"]).default("just_browsing"),
  notes: z.string().trim().optional(),
});

export const submitPublicOpenHouseSignin = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof visitorSigninSchema>) => visitorSigninSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: inserted, error } = await sb
      .from("open_house_signins")
      .insert({
        open_house_id: data.openHouseId,
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        email: data.email,
        working_with_agent: data.workingWithAgent,
        agent_name: data.workingWithAgent ? (data.agentName || null) : null,
        buying_or_selling: data.buyingOrSelling,
        timeframe: data.timeframe,
        notes: data.notes || null,
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("Error submitting open house sign-in:", error);
      throw new Error("Unable to submit sign-in. Please try again.");
    }

    return { success: true, id: inserted.id };
  });

// -------------------------------------------------------------
// 2. AUTHENTICATED MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

export const getOpenHouseSignins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { openHouseId: string }) => z.object({ openHouseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: rows, error } = await sb
      .from("open_house_signins")
      .select("*")
      .eq("open_house_id", data.openHouseId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { signins: rows ?? [] };
  });

export const getOpenHouseChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { openHouseId: string }) => z.object({ openHouseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();

    // Check if items already exist for this open house
    const { data: existing, error } = await sb
      .from("open_house_checklist_items")
      .select("*")
      .eq("open_house_id", data.openHouseId)
      .order("phase_order", { ascending: true })
      .order("task_order", { ascending: true });

    if (error) throw error;

    if (existing && existing.length > 0) {
      return { items: existing };
    }

    // Otherwise, clone from checklist templates
    const { data: templates } = await sb
      .from("open_house_checklist_templates")
      .select("*")
      .order("phase_order", { ascending: true })
      .order("task_order", { ascending: true });

    if (templates && templates.length > 0) {
      const itemsToInsert = templates.map((t: any) => ({
        open_house_id: data.openHouseId,
        phase: t.phase,
        phase_order: t.phase_order,
        task_text: t.task_text,
        task_order: t.task_order,
        completed: false,
      }));

      const { data: inserted, error: insErr } = await sb
        .from("open_house_checklist_items")
        .insert(itemsToInsert)
        .select("*")
        .order("phase_order", { ascending: true })
        .order("task_order", { ascending: true });

      if (insErr) {
        console.error("Error seeding checklist items:", insErr);
        return { items: [] };
      }

      return { items: inserted ?? [] };
    }

    return { items: [] };
  });

export const toggleOpenHouseChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { itemId: string; completed: boolean }) =>
    z.object({ itemId: z.string().uuid(), completed: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { error } = await sb
      .from("open_house_checklist_items")
      .update({
        completed: data.completed,
        completed_at: data.completed ? new Date().toISOString() : null,
        completed_by: data.completed ? context.userId : null,
      })
      .eq("id", data.itemId);

    if (error) throw error;
    return { success: true };
  });

export const getChecklistTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = await admin();
    const { data, error } = await sb
      .from("open_house_checklist_templates")
      .select("*")
      .order("phase_order", { ascending: true })
      .order("task_order", { ascending: true });

    if (error) throw error;
    return { templates: data ?? [] };
  });

const saveTemplateSchema = z.object({
  templates: z.array(
    z.object({
      id: z.string().uuid().optional(),
      phase: z.string().min(1),
      phase_order: z.number().int(),
      task_text: z.string().min(1),
      task_order: z.number().int(),
      is_required: z.boolean().default(true),
    })
  ),
});

export const updateChecklistTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: z.infer<typeof saveTemplateSchema>) => saveTemplateSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();

    // Delete existing and re-insert or upsert
    await sb.from("open_house_checklist_templates").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const toInsert = data.templates.map((t, idx) => ({
      phase: t.phase,
      phase_order: t.phase_order,
      task_text: t.task_text,
      task_order: t.task_order || idx + 1,
      is_required: t.is_required,
    }));

    const { error } = await sb.from("open_house_checklist_templates").insert(toInsert);
    if (error) throw error;

    return { success: true };
  });

export const cloneListingAssetsToOpenHouse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { listingId: string; openHouseId: string }) =>
    z.object({ listingId: z.string().uuid(), openHouseId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();

    // 1. Get all assets from listing
    const { data: assets, error: aErr } = await sb
      .from("toolbox_assets")
      .select("*")
      .eq("listing_id", data.listingId);

    if (aErr) throw aErr;

    if (assets && assets.length > 0) {
      const ohAssets = assets.map((a: any) => {
        let category = "Other";
        if (a.asset_type === "photo" || a.asset_type === "photos") category = "Branded Photos and Copy";
        else if (a.asset_type === "graphic" || a.asset_type === "flyer") category = "Flyer";

        return {
          open_house_id: data.openHouseId,
          asset_type: a.asset_type,
          file_url: a.file_url,
          drive_url: a.drive_url,
          thumbnail_url: a.thumbnail_url,
          name: a.name,
          category,
          created_by: context.userId,
        };
      });

      await sb.from("toolbox_open_house_assets").insert(ohAssets);
    }

    // 2. Clone captions if available
    const { data: captions } = await sb
      .from("toolbox_captions")
      .select("*")
      .eq("listing_id", data.listingId);

    if (captions && captions.length > 0) {
      const ohCaptions = captions.map((c: any) => ({
        open_house_id: data.openHouseId,
        caption_text: c.caption_text,
        category: "Branded Photos and Copy",
        created_by: context.userId,
      }));

      await sb.from("toolbox_open_house_captions").insert(ohCaptions);
    }

    return { success: true, count: (assets?.length ?? 0) };
  });

export const getOpenHousesAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = await admin();

    const [
      { data: openHouses },
      { data: signins },
      { data: checklistItems },
      { data: users },
    ] = await Promise.all([
      sb.from("toolbox_open_houses").select("id, address, agent_name, host_agent_id, open_house_at, is_completed, archived, created_at"),
      sb.from("open_house_signins").select("id, open_house_id, buying_or_selling, working_with_agent, created_at"),
      sb.from("open_house_checklist_items").select("id, open_house_id, task_text, phase, completed"),
      sb.from("profiles").select("id, full_name, email"),
    ]);

    const totalOpenHouses = (openHouses ?? []).length;
    const totalSignins = (signins ?? []).length;
    const totalBuyers = (signins ?? []).filter((s: any) => s.buying_or_selling === "buying" || s.buying_or_selling === "both").length;
    const totalSellers = (signins ?? []).filter((s: any) => s.buying_or_selling === "selling" || s.buying_or_selling === "both").length;
    const unrepresentedLeads = (signins ?? []).filter((s: any) => !s.working_with_agent).length;

    // Leads by agent
    const leadsByAgent: Record<string, { count: number; openHouses: number; name: string }> = {};
    for (const oh of (openHouses ?? []) as any[]) {
      const name = oh.agent_name || "Unassigned";
      if (!leadsByAgent[name]) leadsByAgent[name] = { count: 0, openHouses: 0, name };
      leadsByAgent[name].openHouses += 1;
    }
    for (const s of (signins ?? []) as any[]) {
      const oh = (openHouses ?? []).find((o: any) => o.id === s.open_house_id);
      const name = oh?.agent_name || "Unassigned";
      if (!leadsByAgent[name]) leadsByAgent[name] = { count: 0, openHouses: 0, name };
      leadsByAgent[name].count += 1;
    }

    // Checklist compliance rates
    const ohChecklistStats: Record<string, { total: number; completed: number; skippedTasks: string[] }> = {};
    for (const item of (checklistItems ?? []) as any[]) {
      if (!ohChecklistStats[item.open_house_id]) {
        ohChecklistStats[item.open_house_id] = { total: 0, completed: 0, skippedTasks: [] };
      }
      ohChecklistStats[item.open_house_id].total += 1;
      if (item.completed) {
        ohChecklistStats[item.open_house_id].completed += 1;
      } else {
        ohChecklistStats[item.open_house_id].skippedTasks.push(item.task_text);
      }
    }

    return {
      totalOpenHouses,
      totalSignins,
      totalBuyers,
      totalSellers,
      unrepresentedLeads,
      leadsByAgent: Object.values(leadsByAgent),
      ohChecklistStats,
    };
  });
