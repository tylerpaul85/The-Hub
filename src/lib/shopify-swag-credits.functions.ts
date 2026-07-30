/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Schema validations
const IssueCreditSchema = z.object({
  agentName: z.string().trim().min(1).max(255),
  amount: z.number().positive().max(10000),
  reason: z.string().trim().min(1).max(500),
});

const RevokeCreditSchema = z.object({
  creditId: z.string().uuid(),
});

// Helper for verifying admin or marketing coordinator privileges
async function verifyMarketingAdmin(context: any) {
  const { data: roleRows } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const roles = (roleRows ?? []).map((r: any) => r.role);
  const isAllowed = roles.includes("admin") || roles.includes("marketing_coordinator");
  if (!isAllowed) {
    throw new Error("Forbidden: Admin or Marketing Coordinator role required.");
  }
}

// Shopify API request helper
async function callShopify(endpoint: string, options: RequestInit = {}) {
  const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
  const shopifyAccessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!shopifyStoreUrl || !shopifyAccessToken) {
    throw new Error(
      "Shopify configuration missing. Please configure SHOPIFY_STORE_URL and SHOPIFY_ADMIN_ACCESS_TOKEN environment variables.",
    );
  }

  const cleanedUrl = shopifyStoreUrl.replace(/^(https?:\/\/)?/, "").replace(/\/$/, "");
  const url = `https://${cleanedUrl}/admin/api/2024-04/${endpoint}`;

  const headers = {
    "X-Shopify-Access-Token": shopifyAccessToken,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Shopify API error (${res.status}): ${errorText}`);
    throw new Error(`Shopify API call failed: ${res.statusText} (${errorText})`);
  }

  return res.json();
}

/**
 * Get all swag credit entries combined with creator emails.
 */
export const getSwagCredits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await verifyMarketingAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch credits
    const { data: credits, error } = await supabaseAdmin
      .from("shopify_swag_credits")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !credits) {
      throw new Error(error?.message || "Failed to fetch swag credits.");
    }

    const creatorIds = Array.from(
      new Set(credits.map((c) => c.created_by).filter((id): id is string => !!id)),
    );

    // Fetch related creators
    const profilesRes =
      creatorIds.length > 0
        ? await supabaseAdmin.from("profiles").select("id, email").in("id", creatorIds)
        : { data: [] };

    const profilesMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

    return credits.map((c) => ({
      ...c,
      creator: c.created_by ? profilesMap.get(c.created_by) || null : null,
    }));
  });

/**
 * Issue a new swag credit (Shopify Gift Card + DB entry).
 */
export const issueSwagCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => IssueCreditSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyMarketingAdmin(context);

    // Call Shopify to create a gift card
    let card: { id: number; code: string; balance: string } | null = null;
    try {
      const response = await callShopify("gift_cards.json", {
        method: "POST",
        body: JSON.stringify({
          gift_card: {
            initial_value: data.amount.toFixed(2),
            note: `Swag Money milestone: ${data.reason}`,
            currency: "USD",
          },
        }),
      });
      card = response.gift_card;
    } catch (shopifyErr: any) {
      console.error("Shopify gift card creation failure:", shopifyErr);
      throw new Error(`Failed to create Shopify Gift Card: ${shopifyErr.message}`);
    }

    if (!card) {
      throw new Error("No gift card returned from Shopify.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Insert credit record
    const { data: inserted, error: dbErr } = await supabaseAdmin
      .from("shopify_swag_credits")
      .insert({
        agent_name: data.agentName,
        amount: data.amount,
        balance: data.amount,
        reason: data.reason,
        shopify_gift_card_id: card.id,
        gift_card_code: card.code,
        status: "active",
        created_by: context.userId,
      })
      .select("*")
      .single();

    if (dbErr) {
      console.error("Failed to insert swag credit record:", dbErr);
      throw new Error(
        `Gift Card was created in Shopify but failed to save in the hub: ${dbErr.message}`,
      );
    }

    return { ok: true, credit: inserted };
  });

/**
 * Revoke/disable a swag credit.
 */
export const revokeSwagCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => RevokeCreditSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyMarketingAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get the credit details
    const { data: credit, error: fetchErr } = await supabaseAdmin
      .from("shopify_swag_credits")
      .select("*")
      .eq("id", data.creditId)
      .single();

    if (fetchErr || !credit) {
      throw new Error("Credit record not found.");
    }

    // Call Shopify to disable the card
    try {
      await callShopify(`gift_cards/${credit.shopify_gift_card_id}/disable.json`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    } catch (shopifyErr: any) {
      console.warn("Shopify disable failed, marking revoked locally anyway:", shopifyErr);
    }

    // Update status in local DB
    const { error: updateErr } = await supabaseAdmin
      .from("shopify_swag_credits")
      .update({
        status: "revoked",
        balance: 0.0,
      })
      .eq("id", data.creditId);

    if (updateErr) {
      throw new Error(`Failed to update credit record: ${updateErr.message}`);
    }

    return { ok: true };
  });

/**
 * Sync active credits balances with Shopify.
 */
export const syncSwagCreditBalances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await verifyMarketingAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Retrieve active credits
    const { data: activeCredits, error: fetchErr } = await supabaseAdmin
      .from("shopify_swag_credits")
      .select("*")
      .eq("status", "active");

    if (fetchErr || !activeCredits) {
      throw new Error("Failed to fetch active credit records.");
    }

    let syncCount = 0;
    let revokedCount = 0;
    let errorCount = 0;

    await Promise.all(
      activeCredits.map(async (credit) => {
        try {
          const response = await callShopify(`gift_cards/${credit.shopify_gift_card_id}.json`, {
            method: "GET",
          });
          const card = response.gift_card;

          if (!card.enabled) {
            await supabaseAdmin
              .from("shopify_swag_credits")
              .update({
                status: "revoked",
                balance: 0.0,
              })
              .eq("id", credit.id);
            revokedCount++;
          } else {
            const currentBalance = parseFloat(card.balance);
            await supabaseAdmin
              .from("shopify_swag_credits")
              .update({
                balance: currentBalance,
              })
              .eq("id", credit.id);
            syncCount++;
          }
        } catch (err: any) {
          console.error(`Failed to sync credit ID ${credit.id}:`, err);
          if (err.message.includes("404") || err.message.includes("Not Found")) {
            await supabaseAdmin
              .from("shopify_swag_credits")
              .update({
                status: "revoked",
                balance: 0.0,
              })
              .eq("id", credit.id);
            revokedCount++;
          } else {
            errorCount++;
          }
        }
      }),
    );

    return { ok: true, syncCount, revokedCount, errorCount };
  });

/**
 * Check if Shopify credentials are set in the environment.
 */
export const checkShopifyConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await verifyMarketingAdmin(context);
    return {
      configured: !!process.env.SHOPIFY_STORE_URL && !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
      storeUrl: process.env.SHOPIFY_STORE_URL || null,
    };
  });
