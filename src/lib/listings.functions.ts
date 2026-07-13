/**
 * listings.functions.ts
 *
 * Client-side async helpers for listing operations.
 * These use the client-side Supabase instance directly — no server functions
 * needed — matching the pattern used throughout the rest of this codebase
 * (calendar.tsx, toolbox.tsx, etc.).
 */

import { addDays, format } from "date-fns";
import type { ListingStatus, ParsedListing, PostType } from "@/lib/listings";

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

export async function createListing(
  sb: any,
  userId: string,
  input: {
    address: string;
    agent_name?: string | null;
    mls_id?: string | null;
    list_price?: number | null;
    list_date: string;
    status?: ListingStatus;
  }
): Promise<{ id: string }> {
  const { data: row, error } = await sb
    .from("listings")
    .insert({
      address: input.address,
      agent_name: input.agent_name ?? null,
      mls_id: input.mls_id ?? null,
      list_price: input.list_price ?? null,
      list_date: input.list_date,
      status: input.status ?? "active",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await createRepostEntries(sb, userId, row.id, row.address, row.list_date);
  return { id: row.id };
}

// ─── Bulk Import ──────────────────────────────────────────────────────────────

export async function bulkImportListings(
  sb: any,
  userId: string,
  listings: ParsedListing[]
): Promise<{ imported: number; skipped: number }> {
  const { data: existing } = await sb
    .from("listings")
    .select("address, agent_name")
    .eq("archived", false);

  const existingSet = new Set(
    (existing ?? []).map((r: any) =>
      `${r.address.toLowerCase()}|${(r.agent_name ?? "").toLowerCase()}`
    )
  );

  let imported = 0;
  let skipped = 0;

  for (const item of listings) {
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
    await createRepostEntries(sb, userId, row.id, row.address, row.list_date);
    imported++;
  }

  return { imported, skipped };
}

// ─── Update Listing ───────────────────────────────────────────────────────────

export async function updateListing(
  sb: any,
  id: string,
  fields: Partial<{
    address: string;
    agent_name: string | null;
    mls_id: string | null;
    list_price: number | null;
    list_date: string;
    status: ListingStatus;
  }>
): Promise<void> {
  const { error } = await sb
    .from("listings")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Mark Under Contract ──────────────────────────────────────────────────────

export async function markUnderContract(
  sb: any,
  userId: string,
  listingId: string
): Promise<{ agentName: string | null; cancelledCount: number }> {
  const { data: listing, error: fetchErr } = await sb
    .from("listings")
    .select("id, address, agent_name")
    .eq("id", listingId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  await sb
    .from("listings")
    .update({ status: "under_contract", updated_at: new Date().toISOString() })
    .eq("id", listingId);

  const today = new Date().toISOString().slice(0, 10);
  const { data: futurePosts } = await sb
    .from("listing_posts")
    .select("id, calendar_entry_id")
    .eq("listing_id", listingId)
    .eq("status", "scheduled")
    .in("post_type", ["repost_60", "repost_90", "repost_120"])
    .gte("scheduled_date", today);

  let cancelledCount = 0;
  if (futurePosts && futurePosts.length > 0) {
    const calIds = futurePosts.map((p: any) => p.calendar_entry_id).filter(Boolean);
    if (calIds.length > 0) {
      await sb.from("content_items").delete().in("id", calIds);
    }
    await sb
      .from("listing_posts")
      .update({ status: "cancelled" })
      .in("id", futurePosts.map((p: any) => p.id));
    cancelledCount = futurePosts.length;
  }

  const calTitle = `[Listing] ${listing.address} — Under Contract`;
  const calId = await createCalendarEntry(
    sb, userId, calTitle, today + "T09:00:00",
    `Under contract for ${listing.agent_name ?? "agent"}`
  );
  await sb.from("listing_posts").insert({
    listing_id: listingId,
    scheduled_date: today,
    post_type: "under_contract",
    graphic_url: null,
    copy: null,
    calendar_entry_id: calId,
    status: "scheduled",
  });

  return { agentName: listing.agent_name, cancelledCount };
}

// ─── Mark Sold ────────────────────────────────────────────────────────────────

export async function markSold(sb: any, listingId: string): Promise<void> {
  await sb
    .from("listings")
    .update({ status: "sold", updated_at: new Date().toISOString() })
    .eq("id", listingId);

  const today = new Date().toISOString().slice(0, 10);
  const { data: futurePosts } = await sb
    .from("listing_posts")
    .select("id, calendar_entry_id")
    .eq("listing_id", listingId)
    .eq("status", "scheduled")
    .gte("scheduled_date", today);

  if (futurePosts && futurePosts.length > 0) {
    const calIds = futurePosts.map((p: any) => p.calendar_entry_id).filter(Boolean);
    if (calIds.length > 0) await sb.from("content_items").delete().in("id", calIds);
    await sb
      .from("listing_posts")
      .update({ status: "cancelled" })
      .in("id", futurePosts.map((p: any) => p.id));
  }
}

// ─── Archive Listing ──────────────────────────────────────────────────────────

export async function archiveListing(sb: any, listingId: string): Promise<void> {
  const { error } = await sb
    .from("listings")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("id", listingId);
  if (error) throw new Error(error.message);
}

// ─── Schedule Manual Post ─────────────────────────────────────────────────────

export async function scheduleManualPost(
  sb: any,
  userId: string,
  input: {
    listing_id: string;
    address: string;
    scheduled_date: string;
    graphic_url?: string | null;
    copy?: string | null;
  }
): Promise<void> {
  const calTitle = `[Listing] ${input.address} — Manual Post`;
  const calId = await createCalendarEntry(
    sb, userId, calTitle, input.scheduled_date + "T09:00:00", input.copy ?? null
  );
  const { error } = await sb.from("listing_posts").insert({
    listing_id: input.listing_id,
    scheduled_date: input.scheduled_date,
    post_type: "manual",
    graphic_url: input.graphic_url ?? null,
    copy: input.copy ?? null,
    calendar_entry_id: calId,
    status: "scheduled",
  });
  if (error) throw new Error(error.message);
}

// ─── Auto-Schedule 60/90/120 Reposts ─────────────────────────────────────────

export async function autoScheduleReposts(
  sb: any,
  userId: string,
  listingId: string,
  address: string,
  listDate: string
): Promise<{ created: number; alreadyScheduled: number }> {
  const { data: existing } = await sb
    .from("listing_posts")
    .select("post_type")
    .eq("listing_id", listingId)
    .in("post_type", ["repost_60", "repost_90", "repost_120"]);

  const existingTypes = new Set((existing ?? []).map((p: any) => p.post_type));

  const base = new Date(listDate + "T00:00:00");
  let created = 0;
  for (const { days, type } of REPOST_OFFSETS) {
    if (existingTypes.has(type)) continue;
    const scheduledDate = format(addDays(base, days), "yyyy-MM-dd");
    const calTitle = `[Listing] ${address} — ${days}-Day Repost`;
    const calId = await createCalendarEntry(
      sb, userId, calTitle, scheduledDate + "T09:00:00",
      `Auto-scheduled ${days}-day repost`
    );
    await sb.from("listing_posts").insert({
      listing_id: listingId,
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
}

// ─── Cancel Post ──────────────────────────────────────────────────────────────

export async function cancelListingPost(
  sb: any,
  postId: string,
  calendarEntryId: string | null
): Promise<void> {
  if (calendarEntryId) {
    await sb.from("content_items").delete().eq("id", calendarEntryId);
  }
  await sb.from("listing_posts").update({ status: "cancelled" }).eq("id", postId);
}

// ─── Save Listing Copy ────────────────────────────────────────────────────────

export async function saveListingCopy(
  sb: any,
  listingId: string,
  socialMediaCopy: string
): Promise<void> {
  const { data: existing } = await sb
    .from("listing_copy")
    .select("id")
    .eq("listing_id", listingId)
    .single();

  if (existing?.id) {
    await sb
      .from("listing_copy")
      .update({ social_media_copy: socialMediaCopy, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await sb
      .from("listing_copy")
      .insert({ listing_id: listingId, social_media_copy: socialMediaCopy });
  }
}
