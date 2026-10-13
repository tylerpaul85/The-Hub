import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SubmitOutboundReferralSchema = z.object({
  agent_name: z.string().trim().min(1, "Agent name is required").max(150),
  agent_email: z.string().trim().email("Invalid agent email").nullable().optional().or(z.literal("")),
  client_name: z.string().trim().min(1, "Client name is required").max(150),
  client_phone: z.string().trim().min(1, "Client phone number is required").max(50),
  client_email: z.string().trim().email("Invalid client email").nullable().optional().or(z.literal("")),
  transaction_type: z.enum(["buying", "selling", "both"]),
  timeline: z.string().trim().min(1, "Expected timeline is required").max(200),
  buying_area: z.string().trim().max(300).nullable().optional().or(z.literal("")),
  buying_budget: z.string().trim().max(100).nullable().optional().or(z.literal("")),
  buying_criteria: z.string().trim().max(2000).nullable().optional().or(z.literal("")),
  selling_address: z.string().trim().max(300).nullable().optional().or(z.literal("")),
  assigned_agent: z.string().trim().max(150).nullable().optional().or(z.literal("")),
  broker_address: z.string().trim().max(300).nullable().optional().or(z.literal("")),
  broker_email: z.string().trim().max(150).nullable().optional().or(z.literal("")),
  broker_phone: z.string().trim().max(50).nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(3000).nullable().optional().or(z.literal("")),
});

export type SubmitOutboundReferralInput = z.infer<typeof SubmitOutboundReferralSchema>;

const NANCY_EMAIL = "nancy@mattsmithrealestategroup.com";

function formatHtmlEmail(data: SubmitOutboundReferralInput, referralId: string): string {
  const isBuying = data.transaction_type === "buying" || data.transaction_type === "both";
  const isSelling = data.transaction_type === "selling" || data.transaction_type === "both";

  const typeBadgeLabel =
    data.transaction_type === "buying"
      ? "BUYING"
      : data.transaction_type === "selling"
      ? "SELLING"
      : "BUYING & SELLING";

  const typeBadgeColor =
    data.transaction_type === "buying"
      ? "#2563eb"
      : data.transaction_type === "selling"
      ? "#d97706"
      : "#7c3aed";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Outbound Referral Information Sheet</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f17; color: #f3f4f6; margin: 0; padding: 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto; background-color: #111827; border-radius: 12px; border: 1px solid #1f2937; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
    
    <!-- Header -->
    <tr>
      <td style="padding: 28px 32px; background: linear-gradient(135deg, #111827 0%, #1e293b 100%); border-bottom: 2px solid #d97706;">
        <table width="100%">
          <tr>
            <td>
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #d97706; font-weight: 700; margin-bottom: 4px;">
                MATT SMITH REAL ESTATE GROUP &bull; CLIENT CARE
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">
                Outbound Referral Submitted
              </h1>
            </td>
            <td align="right">
              <span style="display: inline-block; padding: 6px 14px; border-radius: 9999px; background-color: ${typeBadgeColor}; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">
                ${typeBadgeLabel}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td style="padding: 28px 32px;">

        <p style="margin-top: 0; margin-bottom: 20px; font-size: 14px; line-height: 1.5; color: #9ca3af;">
          Hi Nancy, a new outbound referral information sheet was submitted by <strong style="color: #ffffff;">${data.agent_name}</strong>. Here are the full client and transaction details to move your process along:
        </p>

        <!-- Quick Summary Box -->
        <div style="background-color: #1e293b; border-radius: 8px; border: 1px solid #334155; padding: 18px 20px; margin-bottom: 24px;">
          <table width="100%" cellpadding="4" cellspacing="0" style="font-size: 13px;">
            <tr>
              <td width="35%" style="color: #94a3b8; font-weight: 600;">Referring Agent:</td>
              <td style="color: #ffffff; font-weight: 700;">${data.agent_name} ${data.agent_email ? `<span style="color: #94a3b8; font-weight: 400;">(${data.agent_email})</span>` : ""}</td>
            </tr>
            <tr>
              <td style="color: #94a3b8; font-weight: 600;">Client Name:</td>
              <td style="color: #ffffff; font-weight: 700;">${data.client_name}</td>
            </tr>
            <tr>
              <td style="color: #94a3b8; font-weight: 600;">Client Phone:</td>
              <td><a href="tel:${data.client_phone}" style="color: #38bdf8; text-decoration: none; font-weight: 600;">${data.client_phone}</a></td>
            </tr>
            ${data.client_email ? `
            <tr>
              <td style="color: #94a3b8; font-weight: 600;">Client Email:</td>
              <td><a href="mailto:${data.client_email}" style="color: #38bdf8; text-decoration: none;">${data.client_email}</a></td>
            </tr>` : ""}
            <tr>
              <td style="color: #94a3b8; font-weight: 600;">Expected Timeline:</td>
              <td style="color: #facc15; font-weight: 600;">${data.timeline}</td>
            </tr>
          </table>
        </div>

        ${isBuying ? `
        <!-- Buying Section -->
        <div style="margin-bottom: 24px;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #38bdf8; margin-bottom: 8px; border-bottom: 1px solid #1e293b; padding-bottom: 4px;">
            Buying Details
          </div>
          <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; background-color: #0f172a; border-radius: 6px; border: 1px solid #1e293b;">
            <tr>
              <td width="35%" style="color: #94a3b8; padding-left: 12px;">Target Area:</td>
              <td style="color: #ffffff; font-weight: 600;">${data.buying_area || "Not specified"}</td>
            </tr>
            <tr>
              <td style="color: #94a3b8; padding-left: 12px;">Client Budget:</td>
              <td style="color: #34d399; font-weight: 700;">${data.buying_budget || "Not specified"}</td>
            </tr>
            <tr>
              <td style="color: #94a3b8; padding-left: 12px; vertical-align: top;">Property Wishlist:</td>
              <td style="color: #e2e8f0; line-height: 1.4;">${data.buying_criteria || "None provided"}</td>
            </tr>
          </table>
        </div>
        ` : ""}

        ${isSelling ? `
        <!-- Selling Section -->
        <div style="margin-bottom: 24px;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #f59e0b; margin-bottom: 8px; border-bottom: 1px solid #1e293b; padding-bottom: 4px;">
            Selling Details
          </div>
          <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; background-color: #0f172a; border-radius: 6px; border: 1px solid #1e293b;">
            <tr>
              <td width="35%" style="color: #94a3b8; padding-left: 12px;">Address Being Sold:</td>
              <td style="color: #ffffff; font-weight: 600;">${data.selling_address || "Not specified"}</td>
            </tr>
          </table>
        </div>
        ` : ""}

        ${(data.assigned_agent || data.broker_address || data.broker_email || data.broker_phone) ? `
        <!-- Brokerage Information -->
        <div style="margin-bottom: 24px;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #a78bfa; margin-bottom: 8px; border-bottom: 1px solid #1e293b; padding-bottom: 4px;">
            Assigned Agent & Brokerage
          </div>
          <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; background-color: #0f172a; border-radius: 6px; border: 1px solid #1e293b;">
            ${data.assigned_agent ? `
            <tr>
              <td width="35%" style="color: #94a3b8; padding-left: 12px;">Assigned Agent:</td>
              <td style="color: #ffffff; font-weight: 600;">${data.assigned_agent}</td>
            </tr>` : ""}
            ${data.broker_address ? `
            <tr>
              <td style="color: #94a3b8; padding-left: 12px;">Broker Address:</td>
              <td style="color: #e2e8f0;">${data.broker_address}</td>
            </tr>` : ""}
            ${data.broker_email ? `
            <tr>
              <td style="color: #94a3b8; padding-left: 12px;">Broker Email:</td>
              <td><a href="mailto:${data.broker_email}" style="color: #38bdf8; text-decoration: none;">${data.broker_email}</a></td>
            </tr>` : ""}
            ${data.broker_phone ? `
            <tr>
              <td style="color: #94a3b8; padding-left: 12px;">Broker Phone:</td>
              <td><a href="tel:${data.broker_phone}" style="color: #38bdf8; text-decoration: none;">${data.broker_phone}</a></td>
            </tr>` : ""}
          </table>
        </div>
        ` : ""}

        ${data.notes ? `
        <!-- Additional Notes -->
        <div style="margin-bottom: 28px;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; border-bottom: 1px solid #1e293b; padding-bottom: 4px;">
            Additional Notes
          </div>
          <div style="background-color: #0f172a; border-radius: 6px; border: 1px solid #1e293b; padding: 12px 16px; font-size: 13px; color: #cbd5e1; line-height: 1.5; white-space: pre-wrap;">${data.notes}</div>
        </div>
        ` : ""}

        <!-- Action Button -->
        <div style="text-align: center; margin-top: 32px; margin-bottom: 16px;">
          <a href="https://marketing.msreginternal.com/admin/referrals" style="display: inline-block; background: linear-gradient(135deg, #d97706 0%, #b45309 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.35);">
            View Referral in The Hub &rarr;
          </a>
        </div>

      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 32px; background-color: #0d131f; border-top: 1px solid #1f2937; text-align: center; font-size: 11px; color: #6b7280;">
        Outbound Referral ID: <code style="color: #9ca3af;">${referralId}</code> &bull; Matt Smith Real Estate Group Internal Hub
      </td>
    </tr>

  </table>
</body>
</html>`;
}

// 1. Submit Outbound Referral (Agent facing)
export const submitOutboundReferral = createServerFn({ method: "POST" })
  .validator((data: unknown) => SubmitOutboundReferralSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // 1. Insert into outbound_referrals table
    const { data: inserted, error: insertErr } = await sb
      .from("outbound_referrals")
      .insert({
        agent_name: data.agent_name,
        agent_email: data.agent_email || null,
        client_name: data.client_name,
        client_phone: data.client_phone,
        client_email: data.client_email || null,
        transaction_type: data.transaction_type,
        timeline: data.timeline,
        buying_area: data.buying_area || null,
        buying_budget: data.buying_budget || null,
        buying_criteria: data.buying_criteria || null,
        selling_address: data.selling_address || null,
        assigned_agent: data.assigned_agent || null,
        broker_address: data.broker_address || null,
        broker_email: data.broker_email || null,
        broker_phone: data.broker_phone || null,
        notes: data.notes || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[Referrals] Failed to insert into outbound_referrals:", insertErr);
      throw new Error(`Database error: ${insertErr.message}`);
    }

    const referralId = inserted.id;

    // 2. Dispatch Email to Nancy via Resend
    let emailSent = false;
    let emailError: string | null = null;
    const resendApiKey = process.env.RESEND_API_KEY;

    let fromEmail =
      process.env.RESEND_FROM_EMAIL ||
      "MSREG Hub <notifications@msreginternal.com>";
    if (fromEmail.includes("mattsmithrealestategroup.com")) {
      fromEmail = fromEmail.replace(/mattsmithrealestategroup\.com/g, "msreginternal.com");
    }

    if (resendApiKey) {
      try {
        const recipients = [NANCY_EMAIL];
        const ccRecipients: string[] = [];
        if (data.agent_email && data.agent_email.toLowerCase() !== NANCY_EMAIL.toLowerCase()) {
          ccRecipients.push(data.agent_email.trim());
        }

        const emailSubject = `New Outbound Referral: ${data.client_name} (from ${data.agent_name})`;
        const emailHtml = formatHtmlEmail(data, referralId);

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: recipients,
            ...(ccRecipients.length > 0 ? { cc: ccRecipients } : {}),
            subject: emailSubject,
            html: emailHtml,
          }),
        });

        if (resendRes.ok) {
          emailSent = true;
        } else {
          const resendData = await resendRes.json().catch(() => ({}));
          emailError = resendData?.message || resendData?.error || `HTTP ${resendRes.status}`;
          console.warn("[Referrals] Resend email delivery failed:", emailError);
        }
      } catch (err: any) {
        emailError = err?.message || String(err);
        console.warn("[Referrals] Resend email exception:", emailError);
      }
    } else {
      console.warn("[Referrals] RESEND_API_KEY is not set. Email notification skipped.");
      emailError = "RESEND_API_KEY environment variable is missing";
    }

    return {
      ok: true,
      id: referralId,
      emailSent,
      emailError,
    };
  });

// 2. List Outbound Referrals (Admin / Client Care / Team)
export const listOutboundReferrals = createServerFn({ method: "POST" })
  .validator((params: unknown) =>
    z
      .object({
        status: z.enum(["all", "pending", "in_progress", "placed", "closed", "archived"]).optional(),
        search: z.string().optional(),
      })
      .parse(params || {})
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    let query = sb
      .from("outbound_referrals")
      .select("*")
      .order("created_at", { ascending: false });

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    if (data.search && data.search.trim()) {
      const term = data.search.trim();
      query = query.or(
        `client_name.ilike.%${term}%,agent_name.ilike.%${term}%,client_phone.ilike.%${term}%,buying_area.ilike.%${term}%,selling_address.ilike.%${term}%`
      );
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error("[Referrals] Failed to list outbound_referrals:", error);
      throw new Error(error.message);
    }

    return (rows ?? []) as Array<{
      id: string;
      agent_name: string;
      agent_email: string | null;
      client_name: string;
      client_phone: string;
      client_email: string | null;
      transaction_type: string;
      timeline: string;
      buying_area: string | null;
      buying_budget: string | null;
      buying_criteria: string | null;
      selling_address: string | null;
      assigned_agent: string | null;
      broker_address: string | null;
      broker_email: string | null;
      broker_phone: string | null;
      notes: string | null;
      status: string;
      assigned_to: string | null;
      internal_notes: string | null;
      created_at: string;
      updated_at: string;
    }>;
  });

// 3. Update Outbound Referral Status / Notes (Admin / Client Care)
const UpdateReferralSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "placed", "closed", "archived"]).optional(),
  assigned_to: z.string().trim().max(150).nullable().optional(),
  internal_notes: z.string().trim().max(3000).nullable().optional(),
});

export const updateOutboundReferral = createServerFn({ method: "POST" })
  .validator((d: unknown) => UpdateReferralSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.status !== undefined) updates.status = data.status;
    if (data.assigned_to !== undefined) updates.assigned_to = data.assigned_to;
    if (data.internal_notes !== undefined) updates.internal_notes = data.internal_notes;

    const { error } = await sb
      .from("outbound_referrals")
      .update(updates)
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// 4. Delete Outbound Referral (Admin only)
export const deleteOutboundReferral = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { error } = await sb
      .from("outbound_referrals")
      .delete()
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
