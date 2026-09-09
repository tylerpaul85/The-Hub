import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";
import { isImageUrl } from "./sanitize-filename";

// Forced build trigger to synchronize server function mapping IDs on Netlify after build regrouping

function getCode(): string {
  const code = process.env.TOOLBOX_ACCESS_CODE?.trim();
  if (!code) {
    throw new Error("Server misconfiguration: TOOLBOX_ACCESS_CODE environment variable is required but not set.");
  }
  return code;
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
        .select("listing_id,thumbnail_url,file_url,drive_url,asset_type,created_at")
        .in("listing_id", ids)
        .order("created_at", { ascending: true });

      const toPreview = (url: string): string => {
        if (typeof url !== "string") return "";
        const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
          url.match(/\/open\?id=([a-zA-Z0-9_-]+)/) ||
          url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
          url.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
        return fileIdMatch && fileIdMatch[1]
          ? `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`
          : url;
      };

      // Pass 1: prefer photo/graphic assets
      for (const a of (assets ?? []) as any[]) {
        if (thumbs[a.listing_id]) continue;
        if (a.asset_type !== "photo" && a.asset_type !== "graphic") continue;
        const candidate = a.thumbnail_url || a.file_url || a.drive_url;
        if (candidate) thumbs[a.listing_id] = toPreview(candidate);
      }
      // Pass 2: fallback to any asset (including videos)
      for (const a of (assets ?? []) as any[]) {
        if (thumbs[a.listing_id]) continue;
        const candidate = a.thumbnail_url || a.file_url || a.drive_url;
        if (candidate) thumbs[a.listing_id] = toPreview(candidate);
      }
    }
    return {
      listings: (listings ?? []).map((l: any) => ({ ...l, thumbnail: thumbs[l.id] ?? null })),
    };
  });

export const getPublicListing = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string().min(1).max(200), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const [{ data: listing }, { data: assets }, { data: captions }] = await Promise.all([
      sb
        .from("toolbox_listings")
        .select("id,address,agent_name,status,description")
        .eq("id", data.id)
        .maybeSingle(),
      sb
        .from("toolbox_assets")
        .select("*")
        .eq("listing_id", data.id)
        .order("created_at", { ascending: true }),
      sb
        .from("toolbox_captions")
        .select("id,caption_text,created_at")
        .eq("listing_id", data.id)
        .order("created_at", { ascending: true }),
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
      .eq("archived", false)
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
        !!u && (/\/file\/d\/|[?&]id=|lh3\.googleusercontent\.com/i.test(String(u)) || /\.(png|jpe?g|gif|webp|svg|avif|heic)(\?|#|$)/i.test(String(u).split("?")[0]));
      
      const getThumb = (u: string) => {
        if (typeof u !== "string") return "";
        const fileIdMatch = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
          u.match(/\/open\?id=([a-zA-Z0-9_-]+)/) ||
          u.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
          u.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
        return fileIdMatch && fileIdMatch[1] ? `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}` : u;
      };

      // Prefer images in "Branded Photos and Copy"
      for (const a of (assets ?? []) as any[]) {
        if (thumbs[a.open_house_id]) continue;
        if (a.category !== "Branded Photos and Copy") continue;
        const c = a.thumbnail_url || a.file_url;
        if (isImg(c)) thumbs[a.open_house_id] = getThumb(c!);
      }
      // Fallback: any image
      for (const a of (assets ?? []) as any[]) {
        if (thumbs[a.open_house_id]) continue;
        const c = a.thumbnail_url || a.file_url;
        if (isImg(c)) thumbs[a.open_house_id] = getThumb(c!);
      }
    }
    return {
      openHouses: (rows ?? []).map((r: any) => ({ ...r, thumbnail: thumbs[r.id] ?? null })),
    };
  });

export const getPublicOpenHouse = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) =>
    z.object({ token: z.string().min(1).max(200), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const [{ data: openHouse }, { data: assets }, { data: captions }] = await Promise.all([
      sb
        .from("toolbox_open_houses")
        .select("id,address,agent_name,status,open_house_at,description")
        .eq("id", data.id)
        .eq("archived", false)
        .maybeSingle(),
      sb
        .from("toolbox_open_house_assets")
        .select("*")
        .eq("open_house_id", data.id)
        .order("created_at", { ascending: true }),
      sb
        .from("toolbox_open_house_captions")
        .select("id,caption_text,category,created_at")
        .eq("open_house_id", data.id)
        .order("created_at", { ascending: true }),
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
      sb
        .from("toolbox_agents")
        .select("id,name,headshot_url,identifier,active")
        .eq("active", true)
        .order("name", { ascending: true }),
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
      sb
        .from("toolbox_agents")
        .select("id,name,headshot_url,identifier")
        .eq("id", data.agentId)
        .maybeSingle(),
      sb
        .from("toolbox_agent_content")
        .select("id,content_type,title,file_url,drive_url,caption,file_size,created_at")
        .eq("agent_id", data.agentId)
        .order("created_at", { ascending: false }),
    ]);
    if (!agent) throw new Error("Not found");
    return { agent, items: items ?? [] };
  });

/* -------- Public Special Events -------- */

export const listPublicSpecialEvents = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();

    const [
      { data: events, error: evErr },
      { data: groups, error: grpErr },
      { data: signups, error: sgnErr },
      { data: committee, error: comErr },
    ] = await Promise.all([
      sb
        .from("special_events")
        .select("*")
        .eq("archived", false)
        .order("event_date", { ascending: true }),
      sb.from("special_event_groups").select("*").order("name", { ascending: true }),
      sb.from("special_event_signups").select("id,event_id,user_id,agent_name,agent_email,group_id,status,notes,created_at"),
      sb.from("special_event_committee").select("id,event_id,user_id,agent_name,agent_email,notes,created_at"),
    ]);

    if (evErr) throw evErr;

    return {
      events: events ?? [],
      groups: groups ?? [],
      signups: signups ?? [],
      committee: committee ?? [],
    };
  });

export const rsvpPublicSpecialEvent = createServerFn({ method: "POST" })
  .inputValidator((d: {
    token: string;
    eventId: string;
    agentName: string;
    agentEmail: string;
    groupId?: string | null;
    notes?: string | null;
  }) =>
    z
      .object({
        token: z.string().min(1).max(200),
        eventId: z.string().uuid(),
        agentName: z.string().trim().min(1, "Name is required").max(150),
        agentEmail: z.string().trim().email("Valid email required").max(255),
        groupId: z.string().uuid().nullable().optional(),
        notes: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const cleanEmail = data.agentEmail.trim().toLowerCase();

    // 1. Fetch event
    const { data: event, error: evErr } = await sb
      .from("special_events")
      .select("*")
      .eq("id", data.eventId)
      .single();
    if (evErr || !event) throw new Error(evErr?.message || "Event not found");
    if (event.archived) throw new Error("This event is closed or archived.");

    // 2. Fetch existing signups for event
    const { data: existingSignups = [] } = await sb
      .from("special_event_signups")
      .select("*")
      .eq("event_id", data.eventId);

    const activeSignups = existingSignups.filter((s: any) => s.status !== "cancelled");
    const mySignup = existingSignups.find(
      (s: any) => (s.agent_email ?? "").toLowerCase() === cleanEmail,
    );

    let status: "confirmed" | "waitlist" = "confirmed";

    // 3. Group capacity check
    if (event.capacity_mode === "group" && data.groupId) {
      const groupSignups = activeSignups.filter(
        (s: any) => s.group_id === data.groupId && s.id !== mySignup?.id,
      );
      const maxPerGroup = event.max_per_group || 4;
      if (groupSignups.length >= maxPerGroup) {
        throw new Error(`This team/group is full (${maxPerGroup}/${maxPerGroup} spots taken). Please choose another team.`);
      }
    }

    // 4. Simple capacity check
    if (event.capacity_mode === "simple" && event.max_capacity) {
      const confirmedOtherCount = activeSignups.filter(
        (s: any) => s.status === "confirmed" && s.id !== mySignup?.id,
      ).length;

      if (confirmedOtherCount >= event.max_capacity) {
        if (event.enable_waitlist) {
          status = "waitlist";
        } else {
          throw new Error("This event has reached full attendee capacity.");
        }
      }
    }

    // Try to match a user_id from profiles
    const { data: matchedProfile } = await sb
      .from("profiles")
      .select("id")
      .ilike("email", cleanEmail)
      .maybeSingle();

    const payload = {
      event_id: data.eventId,
      user_id: matchedProfile?.id || null,
      agent_name: data.agentName.trim(),
      agent_email: cleanEmail,
      group_id: data.groupId || null,
      status,
      notes: data.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (mySignup) {
      const { data: updated, error: updErr } = await sb
        .from("special_event_signups")
        .update(payload)
        .eq("id", mySignup.id)
        .select()
        .single();
      if (updErr) throw updErr;
      return { ok: true, status, signup: updated };
    } else {
      const { data: inserted, error: insErr } = await sb
        .from("special_event_signups")
        .insert(payload)
        .select()
        .single();
      if (insErr) throw insErr;
      return { ok: true, status, signup: inserted };
    }
  });

export const cancelPublicSpecialEventRsvp = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; eventId: string; agentEmail: string }) =>
    z
      .object({
        token: z.string().min(1).max(200),
        eventId: z.string().uuid(),
        agentEmail: z.string().trim().email().max(255),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const cleanEmail = data.agentEmail.trim().toLowerCase();

    const { error } = await sb
      .from("special_event_signups")
      .delete()
      .eq("event_id", data.eventId)
      .ilike("agent_email", cleanEmail);

    if (error) throw error;
    return { ok: true };
  });

export const togglePublicSpecialEventCommittee = createServerFn({ method: "POST" })
  .inputValidator((d: {
    token: string;
    eventId: string;
    agentName: string;
    agentEmail: string;
    isJoining: boolean;
    notes?: string | null;
  }) =>
    z
      .object({
        token: z.string().min(1).max(200),
        eventId: z.string().uuid(),
        agentName: z.string().trim().min(1).max(150),
        agentEmail: z.string().trim().email().max(255),
        isJoining: z.boolean(),
        notes: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const cleanEmail = data.agentEmail.trim().toLowerCase();

    if (!data.isJoining) {
      const { error } = await sb
        .from("special_event_committee")
        .delete()
        .eq("event_id", data.eventId)
        .ilike("agent_email", cleanEmail);
      if (error) throw error;
      return { ok: true, joined: false };
    }

    const { data: matchedProfile } = await sb
      .from("profiles")
      .select("id")
      .ilike("email", cleanEmail)
      .maybeSingle();

    const { data: existing } = await sb
      .from("special_event_committee")
      .select("id")
      .eq("event_id", data.eventId)
      .ilike("agent_email", cleanEmail)
      .maybeSingle();

    if (existing) {
      await sb
        .from("special_event_committee")
        .update({
          agent_name: data.agentName.trim(),
          notes: data.notes?.trim() || null,
        })
        .eq("id", existing.id);
    } else {
      const { error: insErr } = await sb.from("special_event_committee").insert({
        event_id: data.eventId,
        user_id: matchedProfile?.id || null,
        agent_name: data.agentName.trim(),
        agent_email: cleanEmail,
        notes: data.notes?.trim() || null,
      });
      if (insErr) throw insErr;
    }

    return { ok: true, joined: true };
  });

export const createPublicSpecialEventGroup = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; eventId: string; name: string }) =>
    z
      .object({
        token: z.string().min(1).max(200),
        eventId: z.string().uuid(),
        name: z.string().trim().min(1, "Group name required").max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();

    // Check event max_groups
    const { data: event, error: evErr } = await sb
      .from("special_events")
      .select("max_groups")
      .eq("id", data.eventId)
      .single();
    if (evErr || !event) throw new Error("Event not found");

    if (event.max_groups) {
      const { count } = await sb
        .from("special_event_groups")
        .select("id", { count: "exact", head: true })
        .eq("event_id", data.eventId);

      if ((count ?? 0) >= event.max_groups) {
        throw new Error(`Maximum group limit reached (${event.max_groups} teams max).`);
      }
    }

    const { data: group, error } = await sb
      .from("special_event_groups")
      .insert({
        event_id: data.eventId,
        name: data.name.trim(),
      })
      .select()
      .single();

    if (error) throw error;
    return { ok: true, group };
  });

/* -------- Public Vendor Directory -------- */

export const listPublicVendors = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();

    const [
      { data: categories, error: cErr },
      { data: vendors, error: vErr },
    ] = await Promise.all([
      sb
        .from("vendor_categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      sb
        .from("vendors")
        .select("*, category:vendor_categories(*)")
        .eq("status", "active")
        .order("name", { ascending: true }),
    ]);

    if (cErr) throw cErr;
    if (vErr) throw vErr;

    return {
      categories: categories ?? [],
      vendors: vendors ?? [],
    };
  });

export const submitPublicVendorRequest = createServerFn({ method: "POST" })
  .inputValidator((d: {
    token: string;
    requestType: "add" | "remove" | "flag";
    vendorId?: string | null;
    vendorName: string;
    region?: string | null;
    categoryId?: string | null;
    primaryContact?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    specialtyNotes?: string | null;
    reason: string;
    agentName: string;
    agentEmail: string;
  }) =>
    z
      .object({
        token: z.string().min(1).max(200),
        requestType: z.enum(["add", "remove", "flag"]),
        vendorId: z.string().uuid().nullable().optional(),
        vendorName: z.string().trim().min(1, "Vendor name is required").max(200),
        region: z.string().trim().nullable().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        primaryContact: z.string().trim().max(150).nullable().optional(),
        phone: z.string().trim().max(50).nullable().optional(),
        email: z.string().trim().email().nullable().optional().or(z.literal("")),
        website: z.string().trim().max(255).nullable().optional().or(z.literal("")),
        specialtyNotes: z.string().trim().max(2000).nullable().optional(),
        reason: z.string().trim().min(1, "Reason is required").max(2000),
        agentName: z.string().trim().min(1, "Your name is required").max(150),
        agentEmail: z.string().trim().email("Valid email required").max(255),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    assertToken(data.token);
    const sb = await admin();
    const cleanEmail = data.agentEmail.trim().toLowerCase();

    // Check if user has an auth profile
    const { data: matchedProfile } = await sb
      .from("profiles")
      .select("id")
      .ilike("email", cleanEmail)
      .maybeSingle();

    const { data: request, error } = await sb
      .from("vendor_requests")
      .insert({
        request_type: data.requestType,
        status: "pending",
        vendor_id: data.vendorId || null,
        vendor_name: data.vendorName.trim(),
        region: data.region || "st_robert_rolla",
        category_id: data.categoryId || null,
        primary_contact: data.primaryContact?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        website: data.website?.trim() || null,
        specialty_notes: data.specialtyNotes?.trim() || null,
        reason: data.reason.trim(),
        agent_name: data.agentName.trim(),
        agent_email: cleanEmail,
        user_id: matchedProfile?.id || null,
      })
      .select()
      .single();

    if (error) throw error;
    return { ok: true, request };
  });


