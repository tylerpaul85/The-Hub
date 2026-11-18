import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { generateMetaListingsXml, MetaListingRow } from "../../src/lib/meta-catalog";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const handler: Handler = async (event) => {
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
      .neq("status", "removed")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[meta-listings] Error querying meta_listings:", error);
      return {
        statusCode: 500,
        headers: { "Content-Type": "text/plain" },
        body: `Database query error: ${error.message}`,
      };
    }

    const xml = generateMetaListingsXml((listings || []) as MetaListingRow[]);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "X-Listing-Count": String((listings || []).length),
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
