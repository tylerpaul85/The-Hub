import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addDays, format } from "date-fns";
import type { ListingStatus, ParsedListing, PostType } from "@/lib/listings";

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function assertMarketing(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role as string);
  if (!roles.includes("admin") && !roles.includes("marketing_coordinator")) {
    throw new Error("Forbidden: Marketing or Admin role required");
  }
  return roles;
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const REPOST_OFFSETS: { days: number; type: PostType }[] = [
  { days: 60, type: "repost_60" },
  { days: 90, type: "repost_90" },
  { days: 120, type: "repost_120" },
];

async function createCalendarEntry(
  sb: any,
  userId: string,
  title: string,
  scheduledAt: string,
  notes: string | null = null
): Promise<string | null> {
  const { data, error } = await sb
    .from("content_items")
    .insert({
      title,
      caption: null,
      platforms: ["Meta"],
      status: "approved",
      scheduled_at: scheduledAt,
      link: null,
      priority: "normal",
      notes,
      thumbnail_url: null,
      image_urls: null,
      target_publish_date: null,
      revision_note: null,
      created_by: userId,
      brand: "MSREG ALL",
      canva_link: null,
      description: null,
      blog_content: null,
      blog_doc_link: null,
      youtube_thumbnail_url: null,
      youtube_video_title: null,
      email_subject_line: null,
      meta_media_link: null,
      meta_copy: null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[listings] Failed to create calendar entry:", error.message);
    return null;
  }
  return data?.id ?? null;
}

async function createRepostEntries(
  sb: any,
  userId: string,
  listingId: string,
  address: string,
  listDate: string
): Promise<void> {
  const base = new Date(listDate + "T00:00:00");
  for (const { days, type } of REPOST_OFFSETS) {
    const scheduledDate = format(addDays(base, days), "yyyy-MM-dd");
    const scheduledAt = scheduledDate + "T09:00:00";
    const typeLabel = days + "-Day Repost";
    const calTitle = `[Listing] ${address} — ${typeLabel}`;
    const calId = await createCalendarEntry(sb, userId, calTitle, scheduledAt, `Auto-scheduled ${typeLabel}`);
    await sb.from("listing_posts").insert({
      listing_id: listingId,
      scheduled_date: scheduledDate,
      post_type: type,
      graphic_url: null,
      copy: null,
      calendar_entry_id: calId,
      status: "scheduled",
    });
  }
}

// ─── Create Listing ───────────────────────────────────────────────────────────

const createListingSchema = z.object({
  address: z.string().trim().min(1).max(500),
  agent_name: z.string().trim().max(200).nullable().optional(),
  mls_id: z.string().trim().max(100).nullable().optional(),
  list_price: z.number().positive().nullable().optional(),
  list_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["active", "under_contract", "sold"]).default("active"),
});

export const createListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createListingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    await assertMarketing(sb, userId);

    const { data: row, error } = await sb
      .from("listings")
      .insert({
        address: data.address,
        agent_name: data.agent_name ?? null,
        mls_id: data.mls_id ?? null,
        list_price: data.list_price ?? null,
        list_date: data.list_date,
        status: data.status,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Auto-create 60/90/120 day reposts
    await createRepostEntries(sb, userId, row.id, row.address, row.list_date);

    return { id: row.id };
  });

// ─── Bulk Import ──────────────────────────────────────────────────────────────

const bulkImportSchema = z.object({
  listings: z.array(
    z.object({
      address: z.string().trim().min(1).max(500),
      agent_name: z.string().trim().max(200).nullable().optional(),
      mls_id: z.string().trim().max(100).nullable().optional(),
      list_price: z.number().positive().nullable().optional(),
      list_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status: z.enum(["active", "under_contract", "sold"]).default("active"),
    })
  ).min(1).max(500),
});

export const bulkImportListings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bulkImportSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    await assertMarketing(sb, userId);

    // Fetch existing to detect duplicates (address + agent_name combo)
    const { data: existing } = await sb
      .from("listings")
      .select("address, agent_name")
      .eq("archived", false);
    const existingSet = new Set(
      (existing ?? []).map((r: any) => `${r.address.toLowerCase()}|${(r.agent_name ?? "").toLowerCase()}`)
    );

    let imported = 0;
    let skipped = 0;
    const importedIds: string[] = [];

    for (const item of data.listings) {
      const key = `${item.address.toLowerCase()}|${(item.agent_name ?? "").toLowerCase()}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }
      const { data: row, error } = await sb
        .from("listings")
        .insert({
          address: item.address,
          agent_name: item.agent_name ?? null,
          mls_id: item.mls_id ?? null,
          list_price: item.list_price ?? null,
          list_date: item.list_date,
          status: item.status,
        })
        .select()
        .single();
      if (error) {
        console.error("[bulkImport] row error:", error.message);
        skipped++;
        continue;
      }
      existingSet.add(key);
      importedIds.push(row.id);
      await createRepostEntries(sb, userId, row.id, row.address, row.list_date);
      imported++;
    }

    return { imported, skipped };
  });

// ─── Update Listing ───────────────────────────────────────────────────────────

const updateListingSchema = z.object({
  id: z.string().uuid(),
  address: z.string().trim().min(1).max(500).optional(),
  agent_name: z.string().trim().max(200).nullable().optional(),
  mls_id: z.string().trim().max(100).nullable().optional(),
  list_price: z.number().positive().nullable().optional(),
  list_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["active", "under_contract", "sold"]).optional(),
});

export const updateListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateListingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    await assertMarketing(sb, userId);

    const { id, ...fields } = data;
    const { error } = await sb
      .from("listings")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Mark Under Contract ──────────────────────────────────────────────────────

export const markUnderContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    await assertMarketing(sb, userId);

    // Fetch listing
    const { data: listing, error: fetchErr } = await sb
      .from("listings")
      .select("id, address, agent_name")
      .eq("id", data.id)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    // Update status
    await sb.from("listings").update({ status: "under_contract", updated_at: new Date().toISOString() }).eq("id", data.id);

    // Cancel + delete calendar entries for future scheduled reposts
    const today = new Date().toISOString().slice(0, 10);
    const { data: futurePosts } = await sb
      .from("listing_posts")
      .select("id, calendar_entry_id")
      .eq("listing_id", data.id)
      .eq("status", "scheduled")
      .in("post_type", ["repost_60", "repost_90", "repost_120"])
      .gte("scheduled_date", today);

    if (futurePosts && futurePosts.length > 0) {
      const calIds = futurePosts.map((p: any) => p.calendar_entry_id).filter(Boolean);
      if (calIds.length > 0) {
        await sb.from("content_items").delete().in("id", calIds);
      }
      await sb
        .from("listing_posts")
        .update({ status: "cancelled" })
        .in("id", futurePosts.map((p: any) => p.id));
    }

    // Create Under Contract post + calendar entry for today
    const calTitle = `[Listing] ${listing.address} — Under Contract`;
    const calId = await createCalendarEntry(sb, userId, calTitle, today + "T09:00:00", `Under contract for ${listing.agent_name ?? "agent"}`);
    await sb.from("listing_posts").insert({
      listing_id: data.id,
      scheduled_date: today,
      post_type: "under_contract",
      graphic_url: null,
      copy: null,
      calendar_entry_id: calId,
      status: "scheduled",
    });

    return { agentName: listing.agent_name, cancelledCount: futurePosts?.length ?? 0 };
  });

// ─── Mark Sold ────────────────────────────────────────────────────────────────

export const markSold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    await assertMarketing(sb, userId);

    await sb.from("listings").update({ status: "sold", updated_at: new Date().toISOString() }).eq("id", data.id);

    // Cancel all remaining scheduled future posts
    const today = new Date().toISOString().slice(0, 10);
    const { data: futurePosts } = await sb
      .from("listing_posts")
      .select("id, calendar_entry_id")
      .eq("listing_id", data.id)
      .eq("status", "scheduled")
      .gte("scheduled_date", today);

    if (futurePosts && futurePosts.length > 0) {
      const calIds = futurePosts.map((p: any) => p.calendar_entry_id).filter(Boolean);
      if (calIds.length > 0) await sb.from("content_items").delete().in("id", calIds);
      await sb.from("listing_posts").update({ status: "cancelled" }).in("id", futurePosts.map((p: any) => p.id));
    }

    return { ok: true };
  });

// ─── Archive Listing ──────────────────────────────────────────────────────────

export const archiveListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    await assertMarketing(sb, userId);
    const { error } = await sb.from("listings").update({ archived: true, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Schedule Manual Post ─────────────────────────────────────────────────────

const schedulePostSchema = z.object({
  listing_id: z.string().uuid(),
  address: z.string(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  graphic_url: z.string().url().nullable().optional(),
  copy: z.string().trim().max(5000).nullable().optional(),
});

export const scheduleManualPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schedulePostSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    await assertMarketing(sb, userId);

    const calTitle = `[Listing] ${data.address} — Manual Post`;
    const calId = await createCalendarEntry(sb, userId, calTitle, data.scheduled_date + "T09:00:00", data.copy ?? null);

    const { error } = await sb.from("listing_posts").insert({
      listing_id: data.listing_id,
      scheduled_date: data.scheduled_date,
      post_type: "manual",
      graphic_url: data.graphic_url ?? null,
      copy: data.copy ?? null,
      calendar_entry_id: calId,
      status: "scheduled",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Auto-Schedule 60/90/120 Reposts ─────────────────────────────────────────

const autoScheduleSchema = z.object({
  listing_id: z.string().uuid(),
  address: z.string(),
  list_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const autoScheduleReposts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => autoScheduleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    await assertMarketing(sb, userId);

    // Check which offsets already have entries
    const { data: existing } = await sb
      .from("listing_posts")
      .select("post_type")
      .eq("listing_id", data.listing_id)
      .in("post_type", ["repost_60", "repost_90", "repost_120"]);
    const existingTypes = new Set((existing ?? []).map((p: any) => p.post_type));

    const base = new Date(data.list_date + "T00:00:00");
    let created = 0;
    for (const { days, type } of REPOST_OFFSETS) {
      if (existingTypes.has(type)) continue;
      const scheduledDate = format(addDays(base, days), "yyyy-MM-dd");
      const calTitle = `[Listing] ${data.address} — ${days}-Day Repost`;
      const calId = await createCalendarEntry(sb, userId, calTitle, scheduledDate + "T09:00:00", `Auto-scheduled ${days}-day repost`);
      await sb.from("listing_posts").insert({
        listing_id: data.listing_id,
        scheduled_date: scheduledDate,
        post_type: type,
        graphic_url: null,
        copy: null,
        calendar_entry_id: calId,
        status: "scheduled",
      });
      created++;
    }
    return { created, alreadyScheduled: existingTypes.size };
  });

// ─── Cancel Post ──────────────────────────────────────────────────────────────

export const cancelListingPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), calendar_entry_id: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    await assertMarketing(sb, userId);
    if (data.calendar_entry_id) {
      await sb.from("content_items").delete().eq("id", data.calendar_entry_id);
    }
    await sb.from("listing_posts").update({ status: "cancelled" }).eq("id", data.id);
    return { ok: true };
  });

// ─── Save listing copy ────────────────────────────────────────────────────────

export const saveListingCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      listing_id: z.string().uuid(),
      social_media_copy: z.string().max(10000),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    await assertMarketing(sb, userId);

    // Upsert by listing_id
    const { data: existing } = await sb
      .from("listing_copy")
      .select("id")
      .eq("listing_id", data.listing_id)
      .single();

    if (existing?.id) {
      await sb
        .from("listing_copy")
        .update({ social_media_copy: data.social_media_copy, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await sb.from("listing_copy").insert({
        listing_id: data.listing_id,
        social_media_copy: data.social_media_copy,
      });
    }
    return { ok: true };
  });
