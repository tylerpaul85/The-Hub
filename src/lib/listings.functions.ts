/**
 * listings.functions.ts
 * Client-side async helpers for listing operations.
 */

import { addDays, format } from "date-fns";
import type { ListingStatus, ParsedListing, PostType } from "@/lib/listings";

const REPOST_OFFSETS: { days: number; type: PostType }[] = [
  { days: 60, type: "repost_60" },
  { days: 90, type: "repost_90" },
  { days: 120, type: "repost_120" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Insert a task for the content coordinator (used for Under Contract) */
async function createCoordinatorTask(
  sb: any,
  userId: string,
  title: string,
  description: string
): Promise<void> {
  await sb.from("tasks").insert({
    title,
    description,
    status: "todo",
    priority: "normal",
    created_by: userId,
    owner: null,
  });
}

/** Insert a row in content_items (Content Calendar). Returns null on failure (non-fatal). */
async function createCalendarEntry(
  sb: any,
  userId: string,
  title: string,
  scheduledAt: string,
  notes: string | null = null,
  canvaLink: string | null = null,
  copy: string | null = null
): Promise<string | null> {
  const { data, error } = await sb
    .from("content_items")
    .insert({
      title,
      status: "approved",
      platforms: ["Meta"],
      scheduled_at: scheduledAt,
      priority: "normal",
      notes: [notes, copy ? `Copy: ${copy}` : null].filter(Boolean).join("\n") || null,
      created_by: userId,
      brand: "MSREG ALL",
      canva_link: canvaLink,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[listings] Calendar entry error:", error.message, error.code);
    return null;
  }
  return data?.id ?? null;
}

/**
 * Creates 60/90/120-day repost entries for a listing.
 * baseDate: the post_date (when listing went live), time: HH:MM string.
 */
async function createRepostEntries(
  sb: any,
  userId: string,
  listingId: string,
  address: string,
  baseDate: string,   // post_date (YYYY-MM-DD)
  postTime: string,   // HH:MM or HH:MM:SS
  canvaLink: string | null,
  socialCopy: string | null
): Promise<void> {
  const base = new Date(baseDate + "T00:00:00");
  for (const { days, type } of REPOST_OFFSETS) {
    const scheduledDate = format(addDays(base, days), "yyyy-MM-dd");
    const timePart = postTime?.slice(0, 5) ?? "09:00";
    const scheduledAt = `${scheduledDate}T${timePart}:00`;
    const calTitle = `[Listing] ${address} — ${days}-Day Repost`;
    const calId = await createCalendarEntry(
      sb, userId, calTitle, scheduledAt,
      `Auto-scheduled ${days}-day repost`,
      canvaLink,
      socialCopy
    );
    await sb.from("listing_posts").insert({
      listing_id: listingId,
      scheduled_date: scheduledDate,
      post_type: type,
      graphic_url: null,
      copy: socialCopy ?? null,
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
    post_date: string;       // When the listing goes live / initial post date
    post_time?: string;      // HH:MM
    status?: ListingStatus;
    canva_link?: string | null;
  }
): Promise<{ id: string }> {
  const postTime = input.post_time ?? "09:00";
  const { data: row, error } = await sb
    .from("listings")
    .insert({
      address: input.address,
      agent_name: input.agent_name ?? null,
      mls_id: input.mls_id ?? null,
      list_price: input.list_price ?? null,
      list_date: input.list_date,
      post_date: input.post_date,
      post_time: postTime + ":00",
      status: input.status ?? "active",
      canva_link: input.canva_link ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Initial "Just Listed" calendar entry
  const calId = await createCalendarEntry(
    sb, userId,
    `[Listing] ${row.address} — Just Listed`,
    `${input.post_date}T${postTime}:00`,
    "Initial listing post",
    input.canva_link ?? null,
    null
  );

  // Add the live day post to listing_posts
  await sb.from("listing_posts").insert({
    listing_id: row.id,
    scheduled_date: input.post_date,
    post_type: "active",
    graphic_url: null,
    copy: null,
    calendar_entry_id: calId,
    status: "scheduled",
  });

  // 60/90/120 reposts calculated from post_date
  await createRepostEntries(
    sb, userId, row.id, row.address,
    input.post_date, postTime,
    input.canva_link ?? null, null
  );

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
    if (existingSet.has(key)) { skipped++; continue; }

    const { data: row, error } = await sb
      .from("listings")
      .insert({
        address: item.address,
        agent_name: item.agent_name ?? null,
        mls_id: item.mls_id ?? null,
        list_price: item.list_price ?? null,
        list_date: item.list_date,
        post_date: item.list_date,   // default post_date = list_date for bulk imports
        post_time: "09:00:00",
        status: item.status,
        canva_link: null,
      })
      .select()
      .single();

    if (error) { console.error("[bulkImport] row error:", error.message); skipped++; continue; }

    existingSet.add(key);

    // Initial post for bulk imported active listing
    const calId = await createCalendarEntry(
      sb, userId,
      `[Listing] ${row.address} — Just Listed`,
      `${item.list_date}T09:00:00`,
      "Initial listing post (Bulk Imported)",
      null, null
    );

    await sb.from("listing_posts").insert({
      listing_id: row.id,
      scheduled_date: item.list_date,
      post_type: "active",
      graphic_url: null,
      copy: null,
      calendar_entry_id: calId,
      status: "scheduled",
    });

    await createRepostEntries(sb, userId, row.id, row.address, item.list_date, "09:00", null, null);
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
    post_date: string;
    post_time: string;
    status: ListingStatus;
    canva_link: string | null;
  }>
): Promise<void> {
  const { error } = await sb
    .from("listings")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Mark Under Contract ──────────────────────────────────────────────────────
// Does NOT create a calendar entry — creates a task for the content coordinator instead.

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
    if (calIds.length > 0) await sb.from("content_items").delete().in("id", calIds);
    await sb
      .from("listing_posts")
      .update({ status: "cancelled" })
      .in("id", futurePosts.map((p: any) => p.id));
    cancelledCount = futurePosts.length;
  }

  // Create a task for content coordinator instead of a calendar entry
  const agentLine = listing.agent_name ? ` — Agent: ${listing.agent_name}` : "";
  await createCoordinatorTask(
    sb, userId,
    `Under Contract — ${listing.address}`,
    `This listing is now under contract.${agentLine}\n\nSend the Under Contract graphic to the agent and post to social media.`
  );

  return { agentName: listing.agent_name, cancelledCount };
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
    canva_link?: string | null;
  }
): Promise<void> {
  const calTitle = `[Listing] ${input.address} — Manual Post`;
  const calId = await createCalendarEntry(
    sb, userId, calTitle, input.scheduled_date + "T09:00:00",
    input.copy ?? null, input.canva_link ?? null, input.copy ?? null
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
  postDate: string,
  postTime: string,
  canvaLink: string | null,
  socialCopy: string | null
): Promise<{ created: number; alreadyScheduled: number }> {
  const { data: existing } = await sb
    .from("listing_posts")
    .select("post_type")
    .eq("listing_id", listingId)
    .in("post_type", ["repost_60", "repost_90", "repost_120"]);

  const existingTypes = new Set((existing ?? []).map((p: any) => p.post_type));

  const base = new Date(postDate + "T00:00:00");
  const timePart = postTime?.slice(0, 5) ?? "09:00";
  let created = 0;
  for (const { days, type } of REPOST_OFFSETS) {
    if (existingTypes.has(type)) continue;
    const scheduledDate = format(addDays(base, days), "yyyy-MM-dd");
    const calTitle = `[Listing] ${address} — ${days}-Day Repost`;
    const calId = await createCalendarEntry(
      sb, userId, calTitle, `${scheduledDate}T${timePart}:00`,
      `Auto-scheduled ${days}-day repost`, canvaLink, socialCopy
    );
    await sb.from("listing_posts").insert({
      listing_id: listingId,
      scheduled_date: scheduledDate,
      post_type: type,
      graphic_url: null,
      copy: socialCopy ?? null,
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

// ─── Push to Agent Toolbox ────────────────────────────────────────────────────

export async function pushToToolbox(
  sb: any,
  userId: string,
  input: {
    address: string;
    agent_name: string | null;
    graphics: { image_url: string; label: string | null }[];
    videos: { drive_url: string; label: string | null }[];
    social_copy: string | null;
  }
): Promise<{ toolboxListingId: string }> {
  // Create toolbox listing
  const { data: tbListing, error: tbErr } = await sb
    .from("toolbox_listings")
    .insert({
      address: input.address,
      agent_name: input.agent_name ?? null,
      status: "active",
      description: input.social_copy ?? null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (tbErr) throw new Error(tbErr.message);

  const tbId = tbListing.id as string;

  // Add each graphic as a toolbox asset (type: "graphic")
  for (const g of input.graphics) {
    await sb.from("toolbox_assets").insert({
      listing_id: tbId,
      asset_type: "graphic",
      file_url: g.image_url,
      thumbnail_url: g.image_url,
      name: g.label ?? "Just Listed",
      created_by: userId,
    });
  }

  // Add each video as a toolbox asset (type: "video")
  for (const v of input.videos) {
    await sb.from("toolbox_assets").insert({
      listing_id: tbId,
      asset_type: "video",
      drive_url: v.drive_url,
      name: v.label ?? "Listing Video",
      created_by: userId,
    });
  }

  // Add social copy as a caption
  if (input.social_copy?.trim()) {
    await sb.from("toolbox_captions").insert({
      listing_id: tbId,
      caption_text: input.social_copy.trim(),
      created_by: userId,
    });
  }

  return { toolboxListingId: tbId };
}
