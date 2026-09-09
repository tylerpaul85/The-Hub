import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tokenInput = z.object({
  token: z.string().min(1).max(200),
});

function assertToken(token: string) {
  if (token !== "msreg2026") {
    throw new Error("Invalid access token");
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

// -------------------------------------------------------------
// 1. PUBLIC VISITOR SIGN-IN ENDPOINTS (No Login Required)
// -------------------------------------------------------------

const signinDetailsInput = z.object({
  id: z.string().min(1),
});

export const getPublicOpenHouseForSignin = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => signinDetailsInput.parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: oh, error } = await sb
      .from("toolbox_open_houses")
      .select("id, address, agent_name, status, open_house_at, description, archived")
      .eq("id", data.id)
      .maybeSingle();

    if (error || !oh) {
      console.error("Open house query error:", error, "ID:", data.id);
      throw new Error("Open house not found or has concluded");
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
  openHouseId: z.string().min(1),
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
  .inputValidator((d: z.infer<typeof visitorSigninSchema>) => visitorSigninSchema.parse(d))
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
// 2. AGENT HUB OPEN HOUSE ENDPOINTS (Passcode or Authenticated)
// -------------------------------------------------------------

export const listAgentOpenHouses = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();

    const { data: rows, error } = await sb
      .from("toolbox_open_houses")
      .select("*")
      .order("open_house_at", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Error loading open houses:", error);
      throw error;
    }

    // Safely query auxiliary tables without crashing if migrations haven't run yet
    const [assetsRes, signinsRes, checklistRes] = await Promise.all([
      sb.from("toolbox_open_house_assets").select("open_house_id, thumbnail_url, file_url, asset_type, category").then((r: any) => r.data || []).catch(() => []),
      sb.from("open_house_signins").select("open_house_id").then((r: any) => r.data || []).catch(() => []),
      sb.from("open_house_checklist_items").select("open_house_id, completed").then((r: any) => r.data || []).catch(() => []),
    ]);

    const assets = assetsRes || [];
    const signins = signinsRes || [];
    const checklistItems = checklistRes || [];

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

    // Calculate thumbnails and counts
    const thumbs: Record<string, string> = {};
    const assetCounts: Record<string, number> = {};
    for (const a of (assets ?? []) as any[]) {
      assetCounts[a.open_house_id] = (assetCounts[a.open_house_id] || 0) + 1;
      if (!thumbs[a.open_house_id]) {
        const c = a.thumbnail_url || a.file_url;
        if (isImg(c)) thumbs[a.open_house_id] = getThumb(c!);
      }
    }

    const signinCounts: Record<string, number> = {};
    for (const s of (signins ?? []) as any[]) {
      signinCounts[s.open_house_id] = (signinCounts[s.open_house_id] || 0) + 1;
    }

    const checklistCounts: Record<string, { total: number; completed: number }> = {};
    for (const c of (checklistItems ?? []) as any[]) {
      if (!checklistCounts[c.open_house_id]) {
        checklistCounts[c.open_house_id] = { total: 0, completed: 0 };
      }
      checklistCounts[c.open_house_id].total += 1;
      if (c.completed) checklistCounts[c.open_house_id].completed += 1;
    }

    const formatted = (rows ?? []).map((r: any) => ({
      ...r,
      thumbnail: thumbs[r.id] ?? null,
      assetCount: assetCounts[r.id] ?? 0,
      signinCount: signinCounts[r.id] ?? 0,
      checklistTotal: checklistCounts[r.id]?.total ?? 0,
      checklistCompleted: checklistCounts[r.id]?.completed ?? 0,
    }));

    return { openHouses: formatted };
  });

const agentOHManagementInput = z.object({
  token: z.string().min(1),
  openHouseId: z.string().min(1),
});

export const getAgentOpenHouseManagement = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof agentOHManagementInput>) => agentOHManagementInput.parse(d))
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();

    const [
      { data: openHouse },
      { data: assets },
      { data: captions },
      { data: signins },
    ] = await Promise.all([
      sb.from("toolbox_open_houses").select("*").eq("id", data.openHouseId).maybeSingle(),
      sb.from("toolbox_open_house_assets").select("*").eq("open_house_id", data.openHouseId).order("created_at", { ascending: false }),
      sb.from("toolbox_open_house_captions").select("*").eq("open_house_id", data.openHouseId).order("created_at", { ascending: true }),
      sb.from("open_house_signins").select("*").eq("open_house_id", data.openHouseId).order("created_at", { ascending: false }),
    ]);

    if (!openHouse) throw new Error("Open house not found");

    // Checklist items
    let { data: checklist } = await sb
      .from("open_house_checklist_items")
      .select("*")
      .eq("open_house_id", data.openHouseId)
      .order("phase_order", { ascending: true })
      .order("task_order", { ascending: true });

    if (!checklist || checklist.length === 0) {
      // Auto-clone from templates
      const { data: templates } = await sb
        .from("open_house_checklist_templates")
        .select("*")
        .order("phase_order", { ascending: true })
        .order("task_order", { ascending: true });

      if (templates && templates.length > 0) {
        const items = templates.map((t: any) => ({
          open_house_id: data.openHouseId,
          phase: t.phase,
          phase_order: t.phase_order,
          task_text: t.task_text,
          task_order: t.task_order,
          completed: false,
        }));
        const { data: seeded } = await sb.from("open_house_checklist_items").insert(items).select("*");
        checklist = seeded ?? [];
      }
    }

    return {
      openHouse,
      assets: assets ?? [],
      captions: captions ?? [],
      signins: signins ?? [],
      checklist: checklist ?? [],
    };
  });

const createAgentOHInput = z.object({
  token: z.string().min(1),
  address: z.string().trim().min(1),
  agent_name: z.string().trim().optional(),
  listing_id: z.string().optional(),
  open_house_at: z.string().optional(),
  description: z.string().trim().optional(),
});

export const createAgentOpenHouse = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof createAgentOHInput>) => createAgentOHInput.parse(d))
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();

    const { data: newOH, error } = await sb
      .from("toolbox_open_houses")
      .insert({
        address: data.address,
        agent_name: data.agent_name || null,
        listing_id: data.listing_id && data.listing_id !== "none" ? data.listing_id : null,
        status: "upcoming",
        open_house_at: data.open_house_at ? new Date(data.open_house_at).toISOString() : null,
        description: data.description || null,
      })
      .select("id")
      .single();

    if (error) throw error;
    const ohId = newOH.id;

    // Auto-clone listing assets if listing was selected
    if (data.listing_id && data.listing_id !== "none") {
      const { data: assets } = await sb
        .from("toolbox_assets")
        .select("*")
        .eq("listing_id", data.listing_id);

      if (assets && assets.length > 0) {
        const ohAssets = assets.map((a: any) => {
          let category = "Other";
          if (a.asset_type === "photo" || a.asset_type === "photos") category = "Branded Photos and Copy";
          else if (a.asset_type === "graphic" || a.asset_type === "flyer") category = "Flyer";
          return {
            open_house_id: ohId,
            asset_type: a.asset_type,
            file_url: a.file_url,
            drive_url: a.drive_url,
            thumbnail_url: a.thumbnail_url,
            name: a.name,
            category,
          };
        });
        await sb.from("toolbox_open_house_assets").insert(ohAssets);
      }
    }

    // Seed default checklist items
    const { data: templates } = await sb
      .from("open_house_checklist_templates")
      .select("*")
      .order("phase_order", { ascending: true })
      .order("task_order", { ascending: true });

    if (templates && templates.length > 0) {
      const items = templates.map((t: any) => ({
        open_house_id: ohId,
        phase: t.phase,
        phase_order: t.phase_order,
        task_text: t.task_text,
        task_order: t.task_order,
        completed: false,
      }));
      await sb.from("open_house_checklist_items").insert(items);
    }

    return { success: true, id: ohId };
  });

const toggleAgentChecklistInput = z.object({
  token: z.string().min(1),
  itemId: z.string().min(1),
  completed: z.boolean(),
});

export const toggleAgentChecklistItem = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof toggleAgentChecklistInput>) => toggleAgentChecklistInput.parse(d))
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const { error } = await sb
      .from("open_house_checklist_items")
      .update({
        completed: data.completed,
        completed_at: data.completed ? new Date().toISOString() : null,
      })
      .eq("id", data.itemId);

    if (error) throw error;
    return { success: true };
  });

const archiveAgentOHInput = z.object({
  token: z.string().min(1),
  openHouseId: z.string().min(1),
  archived: z.boolean(),
});

export const archiveAgentOpenHouse = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof archiveAgentOHInput>) => archiveAgentOHInput.parse(d))
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const { error } = await sb
      .from("toolbox_open_houses")
      .update({ archived: data.archived })
      .eq("id", data.openHouseId);

    if (error) throw error;
    return { success: true };
  });

// -------------------------------------------------------------
// 3. AUTHENTICATED OPS MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

export const getOpenHouseSignins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { openHouseId: string }) => z.object({ openHouseId: z.string().min(1) }).parse(d))
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
  .inputValidator((d: { openHouseId: string }) => z.object({ openHouseId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();

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

      const { data: inserted } = await sb
        .from("open_house_checklist_items")
        .insert(itemsToInsert)
        .select("*")
        .order("phase_order", { ascending: true })
        .order("task_order", { ascending: true });

      return { items: inserted ?? [] };
    }

    return { items: [] };
  });

export const toggleOpenHouseChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { itemId: string; completed: boolean }) =>
    z.object({ itemId: z.string().min(1), completed: z.boolean() }).parse(d)
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
      id: z.string().optional(),
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
  .inputValidator((d: z.infer<typeof saveTemplateSchema>) => saveTemplateSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();

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
  .inputValidator((d: { listingId: string; openHouseId: string }) =>
    z.object({ listingId: z.string().min(1), openHouseId: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();

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
          created_by: context?.userId || null,
        };
      });

      await sb.from("toolbox_open_house_assets").insert(ohAssets);
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
    ] = await Promise.all([
      sb.from("toolbox_open_houses").select("id, address, agent_name, open_house_at, archived, created_at"),
      sb.from("open_house_signins").select("id, open_house_id, buying_or_selling, working_with_agent, created_at"),
      sb.from("open_house_checklist_items").select("id, open_house_id, task_text, phase, completed"),
    ]);

    const totalOpenHouses = (openHouses ?? []).length;
    const totalSignins = (signins ?? []).length;
    const totalBuyers = (signins ?? []).filter((s: any) => s.buying_or_selling === "buying" || s.buying_or_selling === "both").length;
    const totalSellers = (signins ?? []).filter((s: any) => s.buying_or_selling === "selling" || s.buying_or_selling === "both").length;
    const unrepresentedLeads = (signins ?? []).filter((s: any) => !s.working_with_agent).length;

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

    return {
      totalOpenHouses,
      totalSignins,
      totalBuyers,
      totalSellers,
      unrepresentedLeads,
      leadsByAgent: Object.values(leadsByAgent),
    };
  });
