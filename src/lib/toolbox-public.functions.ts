import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";

// Forced build trigger to synchronize server function mapping IDs on Netlify after build regrouping

function getCode(): string {
  return (process.env.TOOLBOX_ACCESS_CODE || "MSREG2026").trim();
}

function expectedToken() {
  return crypto.createHash("sha256").update(getCode()).digest("hex");
}

function assertToken(token: string) {
  const exp = expectedToken();
  const a = Buffer.from(token);
  const b = Buffer.from(exp);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Unauthorized");
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const verifyToolboxCode = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => z.object({ code: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const code = getCode();
    if (data.code.trim().toUpperCase() !== code.toUpperCase()) {
      throw new Error("Incorrect access code");
    }
    return { token: expectedToken() };
  });

const tokenInput = (d: { token: string }) =>
  z.object({ token: z.string().min(1).max(200) }).parse(d);

export const listPublicListings = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const { data: listings, error } = await sb
      .from("toolbox_listings")
      .select("id,address,agent_name,status,description,created_at")
      .in("status", ["active", "coming_soon"])
      .eq("archived", false)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const ids = (listings ?? []).map((l: any) => l.id);
    let thumbs: Record<string, string> = {};
    if (ids.length) {
      const { data: assets } = await sb
        .from("toolbox_assets")
        .select("listing_id,thumbnail_url,file_url,asset_type,created_at")
        .in("listing_id", ids)
        .order("created_at", { ascending: true });
      for (const a of (assets ?? []) as any[]) {
        if (thumbs[a.listing_id]) continue;
        // Prefer an image asset; for videos use their thumbnail_url if present.
        const candidate =
          a.asset_type === "video"
            ? a.thumbnail_url
            : a.thumbnail_url || a.file_url;
        if (candidate) thumbs[a.listing_id] = candidate;
      }
    }
    return { listings: (listings ?? []).map((l: any) => ({ ...l, thumbnail: thumbs[l.id] ?? null })) };
  });

export const getPublicListing = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string().min(1).max(200), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const [{ data: listing }, { data: assets }, { data: captions }] = await Promise.all([
      sb.from("toolbox_listings").select("id,address,agent_name,status,description").eq("id", data.id).maybeSingle(),
      sb.from("toolbox_assets").select("*").eq("listing_id", data.id).order("created_at", { ascending: true }),
      sb.from("toolbox_captions").select("id,caption_text,created_at").eq("listing_id", data.id).order("created_at", { ascending: true }),
    ]);
    if (!listing) throw new Error("Not found");
    return { listing, assets: assets ?? [], captions: captions ?? [] };
  });

export const listPublicBrand = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const { data: rows, error } = await sb
      .from("toolbox_brand_assets")
      .select("id,name,category,file_url,file_size,created_at")
      .order("category", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { items: rows ?? [] };
  });

export const listPublicEdu = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const { data: rows, error } = await sb
      .from("toolbox_educational")
      .select("id,title,category,file_url,drive_url,caption,file_size,created_at")
      .order("category", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { items: rows ?? [] };
  });

export const listPublicOpenHouses = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const { data: rows, error } = await sb
      .from("toolbox_open_houses")
      .select("id,address,agent_name,status,open_house_at,description,created_at")
      .order("open_house_at", { ascending: true, nullsFirst: false });
    if (error) throw error;
    const ids = (rows ?? []).map((r: any) => r.id);
    let thumbs: Record<string, string> = {};
    if (ids.length) {
      const { data: assets } = await sb
        .from("toolbox_open_house_assets")
        .select("open_house_id,thumbnail_url,file_url,asset_type,category,created_at")
        .in("open_house_id", ids)
        .order("created_at", { ascending: true });
      const isImg = (u: string | null | undefined) =>
        !!u && /\.(png|jpe?g|gif|webp|svg|avif|heic)(\?|#|$)/i.test(String(u).split("?")[0]);
      // Prefer images in "Branded Photos and Copy"
      for (const a of (assets ?? []) as any[]) {
        if (thumbs[a.open_house_id]) continue;
        if (a.category !== "Branded Photos and Copy") continue;
        const c = a.thumbnail_url || a.file_url;
        if (isImg(c)) thumbs[a.open_house_id] = c;
      }
      // Fallback: any image
      for (const a of (assets ?? []) as any[]) {
        if (thumbs[a.open_house_id]) continue;
        const c = a.thumbnail_url || a.file_url;
        if (isImg(c)) thumbs[a.open_house_id] = c;
      }
    }
    return { openHouses: (rows ?? []).map((r: any) => ({ ...r, thumbnail: thumbs[r.id] ?? null })) };
  });

export const getPublicOpenHouse = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string().min(1).max(200), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const [{ data: openHouse }, { data: assets }, { data: captions }] = await Promise.all([
      sb.from("toolbox_open_houses").select("id,address,agent_name,status,open_house_at,description").eq("id", data.id).maybeSingle(),
      sb.from("toolbox_open_house_assets").select("*").eq("open_house_id", data.id).order("created_at", { ascending: true }),
      sb.from("toolbox_open_house_captions").select("id,caption_text,category,created_at").eq("open_house_id", data.id).order("created_at", { ascending: true }),
    ]);
    if (!openHouse) throw new Error("Not found");
    return { openHouse, assets: assets ?? [], captions: captions ?? [] };
  });

// ----- Agent Branded Content (public) -----

export const listPublicBrandedAgents = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    // Get all active agents, then filter to ones with at least one content item.
    const [{ data: agents }, { data: content }] = await Promise.all([
      sb.from("toolbox_agents").select("id,name,headshot_url,identifier,active").eq("active", true).order("name", { ascending: true }),
      sb.from("toolbox_agent_content").select("agent_id"),
    ]);
    const have = new Set<string>(((content ?? []) as any[]).map((c) => c.agent_id));
    const filtered = ((agents ?? []) as any[]).filter((a) => have.has(a.id));
    return { agents: filtered };
  });

export const listPublicAgentBrandedContent = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; agentId: string }) =>
    z.object({ token: z.string().min(1).max(200), agentId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const [{ data: agent }, { data: items }] = await Promise.all([
      sb.from("toolbox_agents").select("id,name,headshot_url,identifier").eq("id", data.agentId).maybeSingle(),
      sb.from("toolbox_agent_content")
        .select("id,content_type,title,file_url,drive_url,caption,file_size,created_at")
        .eq("agent_id", data.agentId)
        .order("created_at", { ascending: false }),
    ]);
    if (!agent) throw new Error("Not found");
    return { agent, items: items ?? [] };
  });
