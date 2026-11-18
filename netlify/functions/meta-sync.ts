import { createClient } from "@supabase/supabase-js";
import { syncMetaCatalogListings } from "../../src/lib/meta-catalog.ts";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export async function handler(event: any) {
  // Can be called via Netlify Scheduled function OR manual POST/GET trigger
  console.log(`[meta-sync] Triggered at ${new Date().toISOString()} via ${event.httpMethod || "schedule"}`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const errorMsg = "Missing Supabase credentials in environment";
    console.error("[meta-sync]", errorMsg);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: errorMsg }),
    };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const result = await syncMetaCatalogListings(supabase);

    return {
      statusCode: result.success ? 200 : 207,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err: any) {
    console.error("[meta-sync] Uncaught error during sync:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: err.message,
      }),
    };
  }
};
