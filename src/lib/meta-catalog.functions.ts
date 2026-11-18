import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { syncMetaCatalogListings } from "./meta-catalog";

// ── 1. Get Catalog Feed Stats ─────────────────────────────────────
export const getMetaCatalogStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    try {
      // Fetch all active/non-removed listings
      const { data: listings, error: listErr } = await sb
        .from("meta_listings")
        .select("id, excluded, missing_fields, status")
        .neq("status", "removed");

      if (listErr) {
        console.warn("[meta-catalog] Error fetching listings stats:", listErr.message);
      }

      const activeListings = listings || [];
      const totalActive = activeListings.length;
      const inFeed = activeListings.filter((l: any) => !l.excluded).length;
      const excluded = activeListings.filter((l: any) => l.excluded).length;
      const missingData = activeListings.filter(
        (l: any) => Array.isArray(l.missing_fields) && l.missing_fields.length > 0,
      ).length;

      // Fetch last sync run
      const { data: lastRuns, error: runErr } = await sb
        .from("meta_feed_runs")
        .select("id, run_time, listing_count, errors")
        .order("run_time", { ascending: false })
        .limit(1);

      if (runErr) {
        console.warn("[meta-catalog] Error fetching last run:", runErr.message);
      }

      const lastRun = lastRuns && lastRuns.length > 0 ? lastRuns[0] : null;

      return {
        totalActive,
        inFeed,
        excluded,
        missingData,
        lastRun: lastRun
          ? {
              id: lastRun.id,
              runTime: lastRun.run_time,
              listingCount: lastRun.listing_count,
              hasErrors: Array.isArray(lastRun.errors) && lastRun.errors.length > 0,
              errors: lastRun.errors,
            }
          : null,
      };
    } catch (err: any) {
      console.error("[meta-catalog] Unexpected error in getMetaCatalogStats:", err);
      return {
        totalActive: 0,
        inFeed: 0,
        excluded: 0,
        missingData: 0,
        lastRun: null,
      };
    }
  });

// ── 2. Get Listings for Table with Filters ────────────────────────
export const getMetaCatalogListings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      filter: z.enum(["all", "residential", "land", "reduced", "missing"]),
      search: z.string().optional().default(""),
      limit: z.number().optional().default(150),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    try {
      let query = sb
        .from("meta_listings")
        .select("*")
        .neq("status", "removed")
        .order("updated_at", { ascending: false })
        .limit(data.limit);

      if (data.filter === "residential") {
        query = query.ilike("property_type", "%residential%");
      } else if (data.filter === "land") {
        query = query.ilike("property_type", "%land%");
      } else if (data.filter === "reduced") {
        query = query.not("old_price", "is", null);
      }

      const { data: results, error } = await query;
      if (error) throw error;

      let items = results || [];

      // Client-side filter for 'missing' fields or complex checks
      if (data.filter === "missing") {
        items = items.filter(
          (item: any) => Array.isArray(item.missing_fields) && item.missing_fields.length > 0,
        );
      }

      // Filter by search query if provided
      if (data.search && data.search.trim()) {
        const q = data.search.trim().toLowerCase();
        items = items.filter(
          (item: any) =>
            (item.first_address && item.first_address.toLowerCase().includes(q)) ||
            (item.city && item.city.toLowerCase().includes(q)) ||
            (item.listing_number && item.listing_number.toLowerCase().includes(q)) ||
            (item.zip && item.zip.toLowerCase().includes(q)),
        );
      }

      return items;
    } catch (err: any) {
      console.error("[meta-catalog] Error fetching listings:", err);
      return [];
    }
  });

// ── 3. Toggle Listing Exclusion ───────────────────────────────────
export const toggleListingExclusion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      excluded: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { error } = await sb
      .from("meta_listings")
      .update({ excluded: data.excluded, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    if (error) {
      console.error("[meta-catalog] Failed to toggle exclusion:", error);
      throw new Error(`Failed to update exclusion: ${error.message}`);
    }

    return { success: true, id: data.id, excluded: data.excluded };
  });

// ── 4. Trigger Manual Sync Now ────────────────────────────────────
export const triggerManualCatalogSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    return await syncMetaCatalogListings(sb);
  });

// ── 5. Get Sync History ───────────────────────────────────────────
export const getMetaSyncHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    try {
      const { data: runs, error } = await sb
        .from("meta_feed_runs")
        .select("*")
        .order("run_time", { ascending: false })
        .limit(15);

      if (error) throw error;
      return runs || [];
    } catch (err: any) {
      console.error("[meta-catalog] Error fetching sync history:", err);
      return [];
    }
  });
