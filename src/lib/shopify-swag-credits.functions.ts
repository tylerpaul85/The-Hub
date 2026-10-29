/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Schema validations
const IssueCreditSchema = z.object({
  agentName: z.string().trim().min(1).max(255),
  recipientEmail: z.string().trim().email("Please enter a valid recipient email address"),
  amount: z.number().positive().max(10000),
  reason: z.string().trim().min(1).max(500),
  creditType: z.enum(["welcome", "agent_level", "other"]).default("other"),
  emailSubject: z.string().trim().min(1).max(255),
  emailBody: z.string().trim().min(1).max(10000),
});

const RevokeCreditSchema = z.object({
  creditId: z.string().uuid(),
});

const SendRemindersSchema = z.object({
  recipients: z
    .array(
      z.object({
        creditId: z.string().uuid(),
        recipientEmail: z.string().trim().email("Valid email required"),
      }),
    )
    .min(1, "At least one recipient is required"),
  includeUnspent: z.boolean().default(true),
  includePartial: z.boolean().default(true),
  emailSubject: z.string().trim().min(1).max(255),
  emailBody: z.string().trim().min(1).max(10000),
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Format plain text and HTML for the swag gift card email
 */
function buildSwagCreditEmail(opts: {
  agentName: string;
  amount: number;
  originalAmount?: number;
  giftCardCode: string;
  subject: string;
  rawBody: string;
}): { subject: string; html: string; text: string } {
  const codeRegex = /\{\{\s*code\s*\}\}|\[\s*code\s*\]/gi;
  const balanceRegex = /\$?\{\{\s*balance\s*\}\}|\$?\[\s*balance\s*\]/gi;
  const amountRegex = /\$?\{\{\s*amount\s*\}\}|\$?\[\s*amount\s*\]/gi;
  const nameRegex = /\{\{\s*name\s*\}\}|\[\s*name\s*\]/gi;
  const firstNameRegex = /\{\{\s*first_name\s*\}\}|\[\s*first_name\s*\]/gi;

  const firstName = opts.agentName.trim().split(/\s+/)[0] || opts.agentName;
  const formattedBalance = `$${opts.amount.toFixed(2)}`;
  const origAmt = opts.originalAmount ?? opts.amount;
  const formattedAmount = `$${origAmt.toFixed(2)}`;

  const resolvedSubject = opts.subject
    .replace(balanceRegex, formattedBalance)
    .replace(amountRegex, formattedAmount)
    .replace(nameRegex, opts.agentName)
    .replace(firstNameRegex, firstName)
    .replace(codeRegex, opts.giftCardCode);

  const hasCodePlaceholder = codeRegex.test(opts.rawBody);

  // Plain text replacement
  let text = opts.rawBody
    .replace(balanceRegex, formattedBalance)
    .replace(amountRegex, formattedAmount)
    .replace(nameRegex, opts.agentName)
    .replace(firstNameRegex, firstName);

  if (hasCodePlaceholder) {
    text = text.replace(codeRegex, opts.giftCardCode);
  } else {
    text = `${text}\n\nGift Card Code: ${opts.giftCardCode}`;
  }

  // Format body lines for HTML
  const safeBodyHtml = opts.rawBody
    .split(/\r?\n/)
    .map((line) => {
      if (!line.trim()) return "<br/>";
      // Escape HTML
      let l = escapeHtml(line);

      // Replace URL www.msregswag.com
      l = l.replace(
        /(https?:\/\/[^\s]+|www\.msregswag\.com)/gi,
        (match) => {
          const href = match.startsWith("http") ? match : `http://${match}`;
          return `<a href="${href}" target="_blank" style="color: #f59e0b; text-decoration: underline; font-weight: 600;">${match}</a>`;
        },
      );

      // Name & amount replacements
      l = l
        .replace(nameRegex, escapeHtml(opts.agentName))
        .replace(firstNameRegex, escapeHtml(firstName))
        .replace(
          balanceRegex,
          `<span style="color: #34d399; font-weight: 700;">${formattedBalance}</span>`,
        )
        .replace(
          amountRegex,
          `<span style="color: #f8fafc; font-weight: 700;">${formattedAmount}</span>`,
        );

      // Inline code replacement
      l = l.replace(
        codeRegex,
        `<span style="font-family: 'Courier New', Courier, monospace; font-weight: 700; color: #f59e0b; letter-spacing: 1px; background: #0f172a; padding: 2px 6px; border-radius: 4px; border: 1px solid #d97706;">${opts.giftCardCode}</span>`,
      );

      return `<p style="margin: 0 0 14px; font-size: 15px; line-height: 1.6; color: #cbd5e1;">${l}</p>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(resolvedSubject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
          <tr>
            <td style="padding: 28px 32px 20px; border-bottom: 1px solid #334155; background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);">
              <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background-color: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">
                Swag Store Credit
              </span>
              <h1 style="margin: 14px 0 0; font-size: 22px; font-weight: 700; color: #f8fafc; line-height: 1.3;">
                ${escapeHtml(resolvedSubject)}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <div style="margin-bottom: 24px;">
                ${safeBodyHtml}
              </div>

              <!-- Gift Card Card Display -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; border-radius: 10px; border: 2px dashed #f59e0b; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #fbbf24; margin-bottom: 8px;">
                      Your Gift Card Code
                    </div>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 26px; font-weight: 800; letter-spacing: 3px; color: #ffffff; margin-bottom: 8px; user-select: all;">
                      ${opts.giftCardCode}
                    </div>
                    <div style="font-size: 13px; color: #94a3b8; font-weight: 500;">
                      Available Balance: <span style="color: #34d399; font-weight: 700;">$${opts.amount.toFixed(2)}</span>${
                        origAmt > opts.amount + 0.005
                          ? ` <span style="color: #64748b; font-size: 12px;">(of $${origAmt.toFixed(2)} issued)</span>`
                          : ""
                      }
                    </div>
                  </td>
                </tr>
              </table>

              <div style="text-align: center; margin-bottom: 28px;">
                <a href="http://www.msregswag.com" target="_blank" style="display: inline-block; background-color: #d97706; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);">
                  Shop Swag Store →
                </a>
              </div>

              <p style="margin: 28px 0 0; font-size: 13px; line-height: 1.5; color: #64748b; border-top: 1px solid #334155; padding-top: 20px;">
                Questions? You can access the swag store directly from the Agent Hub or at <a href="http://www.msregswag.com" style="color: #94a3b8; text-decoration: underline;">www.msregswag.com</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 18px 32px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                © Matt Smith Real Estate Group · Swag Store
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: resolvedSubject, html, text };
}

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
  if (!shopifyStoreUrl) {
    throw new Error("Shopify configuration missing. Please configure SHOPIFY_STORE_URL.");
  }

  // Determine access token (use legacy static token if present, otherwise perform Client Credentials exchange)
  let shopifyAccessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!shopifyAccessToken) {
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        "Shopify authentication missing. Please configure either SHOPIFY_ADMIN_ACCESS_TOKEN (legacy) or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (2026 OAuth).",
      );
    }

    const cleanedUrl = shopifyStoreUrl.replace(/^(https?:\/\/)?/, "").replace(/\/$/, "");
    const oauthUrl = `https://${cleanedUrl}/admin/oauth/access_token`;

    try {
      const authRes = await fetch(oauthUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!authRes.ok) {
        const errorText = await authRes.text();
        console.error(`Shopify OAuth token exchange failure (${authRes.status}): ${errorText}`);
        throw new Error(`Shopify OAuth failed: ${authRes.statusText} (${errorText})`);
      }

      const authData = await authRes.json();
      shopifyAccessToken = authData.access_token;
    } catch (authErr: any) {
      console.error("Failed to exchange Shopify Client Credentials:", authErr);
      throw new Error(`Shopify Authentication failed: ${authErr.message}`);
    }
  }

  if (!shopifyAccessToken) {
    throw new Error("Failed to obtain Shopify Access Token.");
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
 * Issue a new swag credit (Shopify Gift Card + DB entry + Resend email dispatch).
 */
export const issueSwagCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => IssueCreditSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyMarketingAdmin(context);

    // 1. Call Shopify to create the gift card
    let card: { id: number; code: string; balance: string } | null = null;
    try {
      const response = await callShopify("gift_cards.json", {
        method: "POST",
        body: JSON.stringify({
          gift_card: {
            initial_value: data.amount.toFixed(2),
            note: `Swag Money (${data.creditType}): ${data.reason}`,
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

    // 2. Insert credit record with fallback if recipient_email column isn't migrated yet
    const baseInsert: any = {
      agent_name: data.agentName,
      amount: data.amount,
      balance: data.amount,
      reason: data.reason,
      shopify_gift_card_id: card.id,
      gift_card_code: card.code,
      status: "active",
      created_by: context.userId,
    };

    let inserted: any = null;
    const firstAttempt = await supabaseAdmin
      .from("shopify_swag_credits")
      .insert({ ...baseInsert, recipient_email: data.recipientEmail })
      .select("*")
      .single();

    if (firstAttempt.error) {
      // Column might not exist in unmigrated remote DB
      if (
        firstAttempt.error.message.includes("recipient_email") ||
        firstAttempt.error.code === "PGRST204"
      ) {
        const retry = await supabaseAdmin
          .from("shopify_swag_credits")
          .insert(baseInsert)
          .select("*")
          .single();

        if (retry.error) {
          throw new Error(
            `Gift card created in Shopify (${card.code}) but failed to save in the hub: ${retry.error.message}`,
          );
        }
        inserted = retry.data;
      } else {
        throw new Error(
          `Gift card created in Shopify (${card.code}) but failed to save in the hub: ${firstAttempt.error.message}`,
        );
      }
    } else {
      inserted = firstAttempt.data;
    }

    // 3. Format email text and HTML
    const { html: emailHtml, text: emailText } = buildSwagCreditEmail({
      agentName: data.agentName,
      amount: data.amount,
      giftCardCode: card.code,
      subject: data.emailSubject,
      rawBody: data.emailBody,
    });

    // 4. Send email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    let fromEmail =
      process.env.RESEND_FROM_EMAIL ||
      "MSREG Swag <notifications@msreginternal.com>";
    if (fromEmail.includes("mattsmithrealestategroup.com")) {
      fromEmail = fromEmail.replace(/mattsmithrealestategroup\.com/g, "msreginternal.com");
    }

    let emailSent = false;
    let emailError: string | null = null;

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY environment secret is not set. Email was skipped.");
      emailError = "RESEND_API_KEY is not configured on the server.";
    } else {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [data.recipientEmail],
            subject: data.emailSubject,
            html: emailHtml,
            text: emailText,
          }),
        });

        const resendData = await resendRes.json().catch(() => ({}));
        if (!resendRes.ok) {
          emailError =
            resendData?.message ||
            resendData?.error ||
            `Resend API error (${resendRes.status})`;
          console.error("Resend API failed to send swag credit email:", emailError);
        } else {
          emailSent = true;
        }
      } catch (err: any) {
        emailError = err?.message || "Network error contacting Resend API";
        console.error("Failed to send swag credit email:", err);
      }
    }

    return {
      ok: true,
      credit: inserted,
      emailSent,
      emailError: emailError || undefined,
      recipientEmail: data.recipientEmail,
    };
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

          if (card.disabled_at !== null && card.disabled_at !== undefined) {
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

export const checkShopifyConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await verifyMarketingAdmin(context);
    const hasLegacyToken =
      !!process.env.SHOPIFY_STORE_URL && !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const hasNewCredentials =
      !!process.env.SHOPIFY_STORE_URL &&
      !!process.env.SHOPIFY_CLIENT_ID &&
      !!process.env.SHOPIFY_CLIENT_SECRET;
    return {
      configured: hasLegacyToken || hasNewCredentials,
      storeUrl: process.env.SHOPIFY_STORE_URL || null,
      hasResend: !!process.env.RESEND_API_KEY,
    };
  });

/**
 * Send reminder emails for existing active swag credits with balance > $0.
 */
export const sendSwagCreditReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => SendRemindersSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyMarketingAdmin(context);

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured on the server.");
    }

    let fromEmail =
      process.env.RESEND_FROM_EMAIL ||
      "MSREG Swag <notifications@msreginternal.com>";
    if (fromEmail.includes("mattsmithrealestategroup.com")) {
      fromEmail = fromEmail.replace(/mattsmithrealestategroup\.com/g, "msreginternal.com");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const creditIds = Array.from(new Set(data.recipients.map((r) => r.creditId)));
    const emailByCreditId = new Map(
      data.recipients.map((r) => [r.creditId, r.recipientEmail.trim()]),
    );

    const { data: credits, error: fetchErr } = await supabaseAdmin
      .from("shopify_swag_credits")
      .select("*")
      .in("id", creditIds);

    if (fetchErr || !credits) {
      throw new Error(fetchErr?.message || "Failed to fetch swag credit records.");
    }

    let sentCount = 0;
    let failedCount = 0;
    let skippedZeroBalanceCount = 0;
    const errors: string[] = [];

    const emailPayloads: Array<{
      creditId: string;
      agentName: string;
      recipientEmail: string;
      payload: {
        from: string;
        to: string[];
        subject: string;
        html: string;
        text: string;
      };
    }> = [];

    for (const credit of credits) {
      const balance = Number(credit.balance || 0);
      const amount = Number(credit.amount || 0);

      // Strictly exclude $0 balance or non-active credits
      if (credit.status !== "active" || balance <= 0) {
        skippedZeroBalanceCount++;
        continue;
      }

      const isUnspent = balance >= amount - 0.005;
      const isPartial = balance > 0 && balance < amount - 0.005;

      if ((isUnspent && !data.includeUnspent) || (isPartial && !data.includePartial)) {
        continue;
      }

      const recipientEmail =
        emailByCreditId.get(credit.id) || (credit.recipient_email ?? "").trim();

      if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
        failedCount++;
        errors.push(`${credit.agent_name}: Missing or invalid email address`);
        continue;
      }

      // Persist resolved email if the credit row didn't have one saved yet
      if (!credit.recipient_email && recipientEmail) {
        try {
          await supabaseAdmin
            .from("shopify_swag_credits")
            .update({ recipient_email: recipientEmail })
            .eq("id", credit.id);
        } catch {
          // Ignore if recipient_email column does not exist
        }
      }

      const { subject, html, text } = buildSwagCreditEmail({
        agentName: credit.agent_name,
        amount: balance,
        originalAmount: amount,
        giftCardCode: credit.gift_card_code,
        subject: data.emailSubject,
        rawBody: data.emailBody,
      });

      emailPayloads.push({
        creditId: credit.id,
        agentName: credit.agent_name,
        recipientEmail,
        payload: {
          from: fromEmail,
          to: [recipientEmail],
          subject,
          html,
          text,
        },
      });
    }

    if (emailPayloads.length === 0) {
      return {
        ok: true,
        sentCount: 0,
        failedCount,
        skippedZeroBalanceCount,
        errors,
      };
    }

    // Send in chunks of 50 via Resend batch endpoint, with per-email fallback
    const chunkSize = 50;
    for (let i = 0; i < emailPayloads.length; i += chunkSize) {
      const chunk = emailPayloads.slice(i, i + chunkSize);
      try {
        const batchRes = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify(chunk.map((item) => item.payload)),
        });

        if (batchRes.ok) {
          sentCount += chunk.length;
          continue;
        }
      } catch (batchErr) {
        console.warn("Resend batch call failed, falling back to sequential send:", batchErr);
      }

      // Sequential fallback with rate-limit spacing
      for (let j = 0; j < chunk.length; j++) {
        const item = chunk[j];
        if (j > 0) {
          await new Promise((r) => setTimeout(r, 550));
        }
        try {
          const singleRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify(item.payload),
          });
          const singleData = await singleRes.json().catch(() => ({}));
          if (!singleRes.ok) {
            failedCount++;
            errors.push(
              `${item.agentName} (${item.recipientEmail}): ${
                singleData?.message || singleData?.error || `HTTP ${singleRes.status}`
              }`,
            );
          } else {
            sentCount++;
          }
        } catch (err: any) {
          failedCount++;
          errors.push(`${item.agentName} (${item.recipientEmail}): ${err?.message || "Network error"}`);
        }
      }
    }

    return {
      ok: true,
      sentCount,
      failedCount,
      skippedZeroBalanceCount,
      errors,
    };
  });
