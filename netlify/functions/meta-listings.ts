import { createClient } from "@supabase/supabase-js";
import { generateMetaListingsXml, type MetaListingRow } from "../../src/lib/meta-catalog.ts";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export async function handler(event: any) {
  // Public Feed - NO Auth required
  if (event.httpMethod !== "GET" && event.httpMethod !== "HEAD") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[meta-listings] Missing Supabase credentials");
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Server configuration error: missing database credentials",
    };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Query active, non-excluded listings
    const { data: listings, error } = await supabase
      .from("meta_listings")
      .select("*")
      .eq("excluded", false)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[meta-listings] Error querying meta_listings:", error);
      return {
        statusCode: 500,
        headers: { "Content-Type": "text/plain" },
        body: `Database query error: ${error.message}`,
      };
    }

    // Filter: status = active (or ComingSoon), excluded = false, and id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const seenUuids = new Set<string>();
    const seenListingNumbers = new Set<string>();
    const validListings: MetaListingRow[] = [];

    for (const item of (listings || []) as MetaListingRow[]) {
      if (item.excluded) continue;
      const st = (item.status || "").toLowerCase().trim();
      if (st !== "active" && !st.startsWith("coming")) continue;
      if (!item.id || !uuidRegex.test(item.id)) continue;
      if (seenUuids.has(item.id)) continue;
      if (item.listing_number && seenListingNumbers.has(item.listing_number)) continue;

      seenUuids.add(item.id);
      if (item.listing_number) seenListingNumbers.add(item.listing_number);
      validListings.push(item);
    }

    const xml = generateMetaListingsXml(validListings);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=600",
        "X-Listing-Count": String(validListings.length),
      },
      body: xml,
    };
  } catch (err: any) {
    console.error("[meta-listings] Unexpected error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: `Internal server error: ${err.message}`,
    };
  }
};
